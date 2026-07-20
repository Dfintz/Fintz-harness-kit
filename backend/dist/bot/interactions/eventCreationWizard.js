"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchEventCreationWizard = launchEventCreationWizard;
exports.handleWizardButton = handleWizardButton;
exports.handleWizardModal = handleWizardModal;
exports.handleWizardSelectMenu = handleWizardSelectMenu;
exports.isWizardButtonId = isWizardButtonId;
exports.isWizardModalId = isWizardModalId;
exports.isWizardSelectId = isWizardSelectId;
const discord_js_1 = require("discord.js");
const Activity_1 = require("../../models/Activity");
const activity_1 = require("../../services/activity");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const UserService_1 = require("../../services/user/UserService");
const logger_1 = require("../../utils/logger");
const eventEmbed_1 = require("../embeds/eventEmbed");
const sharedChoices_1 = require("../utils/sharedChoices");
const wizardSessionStore_1 = require("../utils/wizardSessionStore");
const voiceAutoCreate_1 = require("../voice/voiceAutoCreate");
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 200;
const MAX_REQUIREMENTS_LENGTH = 500;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const wizardSessions = new wizardSessionStore_1.WizardSessionStore({
    ttlMs: SESSION_TTL_MS,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
    keyFactory: (guildId, userId) => `${guildId}:${userId}`,
    getLastInteraction: session => session.lastInteraction,
    touch: (session, now) => {
        session.lastInteraction = now;
    },
});
function sessionKey(guildId, userId) {
    return wizardSessions.makeKey(guildId, userId);
}
function getActiveSessionForLaunch(key) {
    return wizardSessions.get(key);
}
function prepareWizardSession(interaction, guildId) {
    const key = sessionKey(guildId, interaction.user.id);
    const existingSession = getActiveSessionForLaunch(key);
    const session = existingSession ?? {
        activityType: Activity_1.ActivityType.EVENT,
        voiceChannelMode: 'none',
        guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        userName: interaction.user.username,
        lastInteraction: Date.now(),
    };
    wizardSessions.set(key, session);
    return { session, isResumed: existingSession !== null };
}
async function ensureEventCreationAllowed(interaction, guildId) {
    if (!interaction.member || !('roles' in interaction.member)) {
        return true;
    }
    try {
        const { discordSettingsService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/DiscordSettingsService')));
        const orgId = await getGuildOrgService().resolveOrganization(guildId);
        const guildSettings = orgId ? await discordSettingsService.getSettings(orgId, guildId) : null;
        const eventConfig = guildSettings?.eventSettings;
        if (!eventConfig?.bannedRoleIds?.length) {
            return true;
        }
        const memberRoles = new Set(Array.isArray(interaction.member.roles)
            ? interaction.member.roles
            : [...interaction.member.roles.cache.keys()]);
        const hasBanned = eventConfig.bannedRoleIds.some((roleId) => memberRoles.has(roleId));
        if (hasBanned) {
            await interaction.reply({
                content: 'Γ¥î You do not have permission to create events.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
    }
    catch {
    }
    return true;
}
let _activityService = null;
function getActivityService() {
    _activityService ??= new activity_1.ActivityService();
    return _activityService;
}
let _guildOrgService = null;
function getGuildOrgService() {
    _guildOrgService ??= GuildOrganizationService_1.GuildOrganizationService.getInstance();
    return _guildOrgService;
}
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
let _participantService = null;
function getParticipantService() {
    _participantService ??= new activity_1.ActivityParticipantService();
    return _participantService;
}
function sanitizeText(input, maxLength) {
    return input.trim().slice(0, maxLength);
}
const DIFFICULTY_LABELS = {
    easy: '≡ƒƒó Easy',
    medium: '≡ƒƒí Medium',
    hard: '≡ƒƒá Hard',
    expert: '≡ƒö┤ Expert',
};
const VOICE_MODE_LABELS = {
    none: 'Disabled',
    current: 'Use Current Channel',
    temp: 'Create Temporary Channel',
};
function buildDescriptionField(description) {
    const value = description.length > 100 ? `${description.slice(0, 97)}...` : description;
    return { name: 'Description', value, inline: true };
}
function buildDurationField(durationMinutes) {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const value = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return { name: 'Duration', value, inline: true };
}
function buildVoiceField(session) {
    if (session.voiceChannelMode === 'none') {
        return null;
    }
    let limitSuffix = '';
    if (session.voiceChannelMode === 'temp') {
        limitSuffix = session.voiceChannelLimit
            ? ` (${session.voiceChannelLimit} user limit)`
            : ' (unlimited)';
    }
    return {
        name: 'Voice Channel',
        value: `${VOICE_MODE_LABELS[session.voiceChannelMode]}${limitSuffix}`,
        inline: true,
    };
}
function buildWizardFields(session) {
    const typeInfo = sharedChoices_1.ACTIVITY_TYPE_LABELS[session.activityType] ?? { emoji: '≡ƒôà', label: 'Event' };
    const fields = [];
    if (session.title) {
        fields.push({ name: 'Title', value: session.title, inline: true });
    }
    if (session.description) {
        fields.push(buildDescriptionField(session.description));
    }
    fields.push({ name: 'Type', value: `${typeInfo.emoji} ${typeInfo.label}`, inline: true });
    if (session.scheduledStartDate) {
        const ts = Math.floor(session.scheduledStartDate.getTime() / 1000);
        fields.push({ name: 'Date & Time', value: `<t:${ts}:F> (<t:${ts}:R>)`, inline: true });
    }
    if (session.estimatedDuration) {
        fields.push(buildDurationField(session.estimatedDuration));
    }
    if (session.location) {
        fields.push({ name: 'Location', value: session.location, inline: true });
    }
    if (session.difficulty) {
        fields.push({
            name: 'Difficulty',
            value: DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty,
            inline: true,
        });
    }
    if (session.maxParticipants) {
        fields.push({ name: 'Max Participants', value: String(session.maxParticipants), inline: true });
    }
    const voiceField = buildVoiceField(session);
    if (voiceField) {
        fields.push(voiceField);
    }
    if (session.requirements) {
        fields.push({ name: 'Requirements', value: session.requirements, inline: false });
    }
    return fields;
}
function buildWizardEmbed(session) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Select an option or finish the event creation.')
        .setDescription(buildWizardStatusText(session))
        .setFooter({ text: 'Session expires after 15 minutes of inactivity' })
        .setTimestamp();
    const fields = buildWizardFields(session);
    if (fields.length > 0) {
        embed.addFields(fields);
    }
    return embed;
}
function buildWizardStatusText(session) {
    const check = (val) => (val ? 'Γ£à' : 'Γ¼¢');
    const lines = [
        `01 ${check(session.title)}  **Title**`,
        `02 ${check(session.description)}  **Description**`,
        `03 ${check(true)}  **Type** ΓÇö ${(sharedChoices_1.ACTIVITY_TYPE_LABELS[session.activityType] ?? { label: 'Event' }).label}`,
        `04 ${check(session.scheduledStartDate)}  **Date & Time**`,
        `05 ${check(session.estimatedDuration)}  **Duration**`,
        `06 ${check(session.location)}  **Location**`,
        `07 ${check(session.difficulty)}  **Difficulty**`,
        `08 ${check(session.maxParticipants)}  **Max Participants**`,
        `09 ${check(session.voiceChannelMode !== 'none')}  **Voice Channel** ΓÇö ${VOICE_MODE_LABELS[session.voiceChannelMode]}`,
        `10 ${check(session.requirements)}  **Requirements**`,
    ];
    return lines.join('\n');
}
function buildWizardButtons() {
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_title')
        .setLabel('01 Title')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_description')
        .setLabel('02 Description')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_type')
        .setLabel('03 Type')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_datetime')
        .setLabel('04 Date & Time')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_duration')
        .setLabel('05 Duration')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_location')
        .setLabel('06 Location')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_difficulty')
        .setLabel('07 Difficulty')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_maxplayers')
        .setLabel('08 Max Players')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_voice')
        .setLabel('09 Voice')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_requirements')
        .setLabel('10 Requirements')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const row4 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_finish')
        .setLabel('Finish')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId('event_wiz_cancel')
        .setLabel('Cancel')
        .setStyle(discord_js_1.ButtonStyle.Danger));
    return [row1, row2, row3, row4];
}
async function launchEventCreationWizard(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (!(await ensureEventCreationAllowed(interaction, guildId))) {
        return;
    }
    const { session, isResumed } = prepareWizardSession(interaction, guildId);
    const embed = buildWizardEmbed(session);
    const buttons = buildWizardButtons();
    await interaction.reply({
        content: isResumed ? 'Γå⌐∩╕Å Resumed your existing event draft.' : undefined,
        embeds: [embed],
        components: buttons,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
function getSession(guildId, userId) {
    if (!guildId) {
        return null;
    }
    const key = sessionKey(guildId, userId);
    return wizardSessions.get(key);
}
const WIZARD_BUTTON_HANDLERS = {
    event_wiz_title: showTitleModal,
    event_wiz_description: showDescriptionModal,
    event_wiz_type: showTypeSelect,
    event_wiz_datetime: showDateTimeModal,
    event_wiz_duration: showDurationModal,
    event_wiz_location: showLocationModal,
    event_wiz_difficulty: showDifficultySelect,
    event_wiz_maxplayers: showMaxPlayersModal,
    event_wiz_voice: handleVoiceToggle,
    event_wiz_requirements: showRequirementsModal,
    event_wiz_finish: handleWizardFinish,
    event_wiz_cancel: handleWizardCancel,
};
async function handleWizardButton(interaction) {
    const { customId } = interaction;
    const session = getSession(interaction.guildId, interaction.user.id);
    if (!session) {
        await interaction.reply({
            content: 'ΓÜá∩╕Å Your event creation session has expired. Use `/events create` to start again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const handler = WIZARD_BUTTON_HANDLERS[customId];
    if (handler) {
        await handler(interaction, session);
    }
}
async function showTitleModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('event_wiz_modal_title').setTitle('Set Event Title');
    const titleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_title')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Enter event title (3-200 characters)')
        .setMinLength(3)
        .setMaxLength(MAX_TITLE_LENGTH)
        .setRequired(true);
    if (session.title) {
        titleInput.setValue(session.title);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Title').setTextInputComponent(titleInput));
    await interaction.showModal(modal);
}
async function showDescriptionModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('event_wiz_modal_desc')
        .setTitle('Set Event Description');
    const descInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_desc')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('Enter event description')
        .setMaxLength(MAX_DESCRIPTION_LENGTH)
        .setRequired(false);
    if (session.description) {
        descInput.setValue(session.description);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Description').setTextInputComponent(descInput));
    await interaction.showModal(modal);
}
async function showTypeSelect(interaction, session) {
    const row = (0, sharedChoices_1.buildEventTypeSelect)('event_wiz_select_type', session.activityType);
    await interaction.reply({
        content: 'Select the activity type:',
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function showDateTimeModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('event_wiz_modal_datetime')
        .setTitle('Set Date & Time');
    const dateInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_date')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('2026-04-24')
        .setMinLength(10)
        .setMaxLength(10)
        .setRequired(true);
    const timeInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_time')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('21:00')
        .setMinLength(4)
        .setMaxLength(5)
        .setRequired(true);
    if (session.scheduledStartDate) {
        const d = session.scheduledStartDate;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        dateInput.setValue(dateStr);
        timeInput.setValue(timeStr);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Date (YYYY-MM-DD)').setTextInputComponent(dateInput), new discord_js_1.LabelBuilder().setLabel('Time (HH:MM, 24h format)').setTextInputComponent(timeInput));
    await interaction.showModal(modal);
}
async function showDurationModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('event_wiz_modal_duration').setTitle('Set Duration');
    const durInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_duration')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('60')
        .setMaxLength(4)
        .setRequired(true);
    if (session.estimatedDuration) {
        durInput.setValue(String(session.estimatedDuration));
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Duration in minutes (1-1440)').setTextInputComponent(durInput));
    await interaction.showModal(modal);
}
async function showLocationModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('event_wiz_modal_location').setTitle('Set Location');
    const locInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_location')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Stanton, Crusader, Port Olisar')
        .setMaxLength(MAX_LOCATION_LENGTH)
        .setRequired(false);
    if (session.location) {
        locInput.setValue(session.location);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Location').setTextInputComponent(locInput));
    await interaction.showModal(modal);
}
async function showDifficultySelect(interaction, session) {
    const row = (0, sharedChoices_1.buildEventDifficultySelect)('event_wiz_select_difficulty', session.difficulty);
    await interaction.reply({
        content: 'Select the difficulty level:',
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function showMaxPlayersModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('event_wiz_modal_maxplayers')
        .setTitle('Set Max Participants');
    const maxInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_maxplayers')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('20')
        .setMaxLength(3)
        .setRequired(true);
    if (session.maxParticipants) {
        maxInput.setValue(String(session.maxParticipants));
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder()
        .setLabel('Maximum number of participants (1-100)')
        .setTextInputComponent(maxInput));
    await interaction.showModal(modal);
}
async function handleVoiceToggle(interaction, session) {
    const select = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('event_wiz_select_voice_mode')
        .setPlaceholder('Select a voice channel mode')
        .addOptions({
        label: 'No voice channel',
        value: 'none',
        description: 'Do not link or create a voice channel for this event',
        default: session.voiceChannelMode === 'none',
    }, {
        label: 'Use my current voice channel',
        value: 'current',
        description: 'Link the voice channel you are currently in when the event is created',
        default: session.voiceChannelMode === 'current',
    }, {
        label: 'Create a temporary event voice channel',
        value: 'temp',
        description: 'Create a temp channel that is cleaned up after the event when empty',
        default: session.voiceChannelMode === 'temp',
    });
    await interaction.reply({
        content: 'Select how voice should work for this event:',
        components: [new discord_js_1.ActionRowBuilder().addComponents(select)],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
function buildVoiceSettingsModal(session) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('event_wiz_modal_voice')
        .setTitle('Voice Channel Settings');
    const limitInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_voicelimit')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('0')
        .setMaxLength(2)
        .setRequired(false);
    if (session.voiceChannelLimit) {
        limitInput.setValue(String(session.voiceChannelLimit));
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder()
        .setLabel('User limit (0 = unlimited, max 99)')
        .setTextInputComponent(limitInput));
    return modal;
}
async function showRequirementsModal(interaction, session) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('event_wiz_modal_requirements')
        .setTitle('Set Requirements');
    const reqInput = new discord_js_1.TextInputBuilder()
        .setCustomId('event_wiz_input_requirements')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('e.g., Must have combat experience, Bring own ship')
        .setMaxLength(MAX_REQUIREMENTS_LENGTH)
        .setRequired(false);
    if (session.requirements) {
        reqInput.setValue(session.requirements);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Requirements (free text)').setTextInputComponent(reqInput));
    await interaction.showModal(modal);
}
async function handleWizardCancel(interaction, _session) {
    if (interaction.guildId) {
        wizardSessions.delete(sessionKey(interaction.guildId, interaction.user.id));
    }
    await interaction.update({
        content: 'Γ¥î Event creation cancelled.',
        embeds: [],
        components: [],
    });
}
const WIZARD_MODAL_HANDLERS = {
    event_wiz_modal_title: handleTitleModal,
    event_wiz_modal_desc: handleDescModal,
    event_wiz_modal_datetime: handleDateTimeModal,
    event_wiz_modal_duration: handleDurationModal,
    event_wiz_modal_location: handleLocationModal,
    event_wiz_modal_maxplayers: handleMaxPlayersModal,
    event_wiz_modal_voice: handleVoiceModal,
    event_wiz_modal_requirements: handleRequirementsModal,
};
async function handleWizardModal(interaction) {
    const { customId } = interaction;
    const session = getSession(interaction.guildId, interaction.user.id);
    if (!session) {
        await interaction.reply({
            content: 'ΓÜá∩╕Å Your event creation session has expired. Use `/events create` to start again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const handler = WIZARD_MODAL_HANDLERS[customId];
    if (handler) {
        await handler(interaction, session);
    }
}
async function handleTitleModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_title');
    session.title = sanitizeText(raw, MAX_TITLE_LENGTH);
    await updateWizardMessage(interaction, session);
}
async function handleDescModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_desc');
    session.description = raw ? sanitizeText(raw, MAX_DESCRIPTION_LENGTH) : undefined;
    await updateWizardMessage(interaction, session);
}
async function handleDateTimeModal(interaction, session) {
    const dateStr = interaction.fields.getTextInputValue('event_wiz_input_date').trim();
    const timeStr = interaction.fields.getTextInputValue('event_wiz_input_time').trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        await interaction.reply({
            content: 'Γ¥î Invalid date format. Use YYYY-MM-DD (e.g., 2026-04-24).',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const timeParts = timeRegex.exec(timeStr);
    if (!timeParts) {
        await interaction.reply({
            content: 'Γ¥î Invalid time format. Use HH:MM in 24h format (e.g., 21:00).',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const hours = Number.parseInt(timeParts[1], 10);
    const minutes = Number.parseInt(timeParts[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        await interaction.reply({
            content: 'Γ¥î Invalid time. Hours must be 0-23, minutes 0-59.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const parsedDate = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        await interaction.reply({
            content: 'Γ¥î Could not parse date. Use YYYY-MM-DD format.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    session.scheduledStartDate = parsedDate;
    await updateWizardMessage(interaction, session);
}
async function handleDurationModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_duration');
    const duration = Number.parseInt(raw, 10);
    if (Number.isNaN(duration) || duration < 1 || duration > 1440) {
        await interaction.reply({
            content: 'Γ¥î Duration must be between 1 and 1440 minutes.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    session.estimatedDuration = duration;
    await updateWizardMessage(interaction, session);
}
async function handleLocationModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_location');
    session.location = raw ? sanitizeText(raw, MAX_LOCATION_LENGTH) : undefined;
    await updateWizardMessage(interaction, session);
}
async function handleMaxPlayersModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_maxplayers');
    const max = Number.parseInt(raw, 10);
    if (Number.isNaN(max) || max < 1 || max > 100) {
        await interaction.reply({
            content: 'Γ¥î Max participants must be between 1 and 100.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    session.maxParticipants = max;
    await updateWizardMessage(interaction, session);
}
async function handleVoiceModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_voicelimit');
    let limit = 0;
    if (raw && raw.trim() !== '') {
        limit = Number.parseInt(raw, 10);
        if (Number.isNaN(limit) || limit < 0) {
            limit = 0;
        }
        if (limit > 99) {
            limit = 99;
        }
    }
    session.voiceChannelMode = 'temp';
    session.voiceChannelLimit = limit > 0 ? limit : undefined;
    await updateWizardMessage(interaction, session);
}
async function handleRequirementsModal(interaction, session) {
    const raw = interaction.fields.getTextInputValue('event_wiz_input_requirements');
    session.requirements = raw ? sanitizeText(raw, MAX_REQUIREMENTS_LENGTH) : undefined;
    await updateWizardMessage(interaction, session);
}
async function handleWizardSelectMenu(interaction) {
    const { customId, values } = interaction;
    const session = getSession(interaction.guildId, interaction.user.id);
    if (!session) {
        await interaction.reply({
            content: 'ΓÜá∩╕Å Your event creation session has expired. Use `/events create` to start again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (customId === 'event_wiz_select_type') {
        const selectedType = values[0];
        if (Object.values(Activity_1.ActivityType).includes(selectedType)) {
            session.activityType = selectedType;
        }
        const typeLabel = (sharedChoices_1.ACTIVITY_TYPE_LABELS[session.activityType] ?? { label: session.activityType }).label;
        await dismissSelectAndConfirm(interaction, `Γ£à Type set to **${typeLabel}**`);
        return;
    }
    if (customId === 'event_wiz_select_difficulty') {
        const selectedDifficulty = values[0];
        const validDifficulties = ['easy', 'medium', 'hard', 'expert'];
        if (validDifficulties.includes(selectedDifficulty)) {
            session.difficulty = selectedDifficulty;
        }
        const diffLabel = DIFFICULTY_LABELS[session.difficulty ?? 'medium'] ?? session.difficulty;
        await dismissSelectAndConfirm(interaction, `Γ£à Difficulty set to **${diffLabel}**`);
        return;
    }
    if (customId === 'event_wiz_select_voice_mode') {
        const selectedMode = values[0];
        if (!['none', 'current', 'temp'].includes(selectedMode)) {
            await interaction.reply({
                content: 'Γ¥î Invalid voice mode selection.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (selectedMode === 'temp') {
            await interaction.showModal(buildVoiceSettingsModal(session));
            return;
        }
        session.voiceChannelMode = selectedMode;
        session.voiceChannelLimit = undefined;
        await dismissSelectAndConfirm(interaction, `Γ£à Voice mode set to **${VOICE_MODE_LABELS[selectedMode]}**`);
    }
}
async function tryCreateDiscordEvent(session, title, startDate, organizationId, participantSummary) {
    try {
        const { discordSettingsService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/DiscordSettingsService')));
        const guildSettings = await discordSettingsService.getSettings(organizationId, session.guildId);
        const eventConfig = guildSettings?.eventSettings;
        if (!eventConfig?.createDiscordEvent) {
            return '';
        }
        const { DiscordEventService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/DiscordEventService')));
        const discordEventId = await DiscordEventService.getInstance().createEvent(session.guildId, {
            title,
            description: session.description,
            scheduledStartDate: startDate,
            location: session.location ?? 'Star Citizen',
            participantCount: participantSummary?.participantCount,
            participantCap: participantSummary?.participantCap,
        });
        if (discordEventId) {
            return `https://discord.com/events/${session.guildId}/${discordEventId}`;
        }
    }
    catch {
    }
    return '';
}
async function tryCreateVoiceChannel(session, title, startDate, activityId, guild, organizationId) {
    if (session.voiceChannelMode !== 'temp' || !guild) {
        return undefined;
    }
    try {
        const channelName = `≡ƒÄ« ${title}`;
        const durationMs = (session.estimatedDuration ?? 120) * 60 * 1000;
        const gracePeriodMs = 30 * 60 * 1000;
        const expiresAt = new Date(startDate.getTime() + durationMs + gracePeriodMs);
        const userLimit = session.voiceChannelLimit && session.voiceChannelLimit > 0
            ? session.voiceChannelLimit
            : undefined;
        let parentCategoryId;
        try {
            const { discordSettingsService: settingsSvc } = await Promise.resolve().then(() => __importStar(require('../../services/discord/DiscordSettingsService')));
            const guildSettings = await settingsSvc.getSettings(organizationId, session.guildId);
            parentCategoryId = guildSettings?.eventSettings?.eventVoiceCategoryId || undefined;
        }
        catch {
        }
        const creatorMember = guild.members.cache.get(session.userId);
        if (!creatorMember) {
            return undefined;
        }
        const result = await (0, voiceAutoCreate_1.createEventTempVoiceChannel)({
            guild,
            creator: creatorMember,
            channelName,
            parentCategoryId,
            userLimit,
            expiresAt,
            eventId: activityId,
        });
        if (result?.channelId) {
            return result.channelId;
        }
    }
    catch (voiceErr) {
        logger_1.logger.warn('Failed to create voice channel for wizard event', voiceErr instanceof Error ? voiceErr : new Error(String(voiceErr)));
    }
    return undefined;
}
function resolveCurrentVoiceChannel(interaction, session) {
    const member = interaction.guild?.members.cache.get(session.userId);
    const currentVoiceChannel = member?.voice?.channel;
    if (!currentVoiceChannel) {
        return undefined;
    }
    return {
        id: currentVoiceChannel.id,
        name: currentVoiceChannel.name,
    };
}
async function persistVoiceChannelLink(activityId, channelId, channelName, options) {
    await getActivityService().updateActivity(activityId, {
        voiceChannelId: channelId,
        voiceChannelName: channelName,
        voiceChannel: {
            autoCreate: options.autoCreate,
            autoDelete: options.autoDelete,
            channelId,
        },
    });
}
function buildConfirmationEmbed(session, activityId, title, startDate, discordEventUrl) {
    const descSuffix = session.description ? `\n${session.description}` : '';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Γ£à Activity Created Successfully!')
        .setDescription(`**${title}**${descSuffix}`)
        .addFields({ name: 'Activity ID', value: activityId, inline: true }, { name: 'Type', value: session.activityType, inline: true }, { name: 'Location', value: session.location ?? 'TBD', inline: true });
    const ts = Math.floor(startDate.getTime() / 1000);
    embed.addFields({ name: 'Date', value: `<t:${ts}:F>`, inline: true });
    if (discordEventUrl) {
        embed.addFields({
            name: 'Discord Event',
            value: `[View in Discord](${discordEventUrl})`,
            inline: true,
        });
    }
    embed.setFooter({ text: `Activity ID: ${activityId}` }).setTimestamp();
    return embed;
}
async function handleWizardFinish(interaction, session) {
    const { title, scheduledStartDate } = session;
    const missing = [];
    if (!title) {
        missing.push('Title');
    }
    if (!scheduledStartDate) {
        missing.push('Date & Time');
    }
    if (missing.length > 0 || !title || !scheduledStartDate) {
        const missingList = missing.map(f => `ΓÇó **${f}**`).join('\n');
        await interaction.reply({
            content: `Γ¥î Please fill in the required fields before finishing:\n${missingList}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const currentVoiceChannel = session.voiceChannelMode === 'current'
        ? resolveCurrentVoiceChannel(interaction, session)
        : undefined;
    if (session.voiceChannelMode === 'current' && !currentVoiceChannel) {
        await interaction.reply({
            content: 'Γ¥î Join the voice channel you want to use before finishing, or switch to temporary voice mode.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferUpdate();
    try {
        const orgId = await getGuildOrgService().resolveOrganization(session.guildId);
        if (!orgId) {
            await interaction.editReply({
                content: 'Γ¥î **This Discord server is not linked to an organization.**\n' +
                    'An admin needs to link this server to an organization in the web app before events can be created.',
                components: [],
            });
            return;
        }
        let creatorId = session.userId;
        let creatorName = session.userName;
        try {
            const internalUser = await getUserService().getUserByDiscordId(session.userId);
            if (internalUser) {
                creatorId = internalUser.id;
                creatorName = internalUser.username ?? session.userName;
            }
        }
        catch {
            logger_1.logger.warn('Could not resolve internal user for event creator', {
                discordId: session.userId,
            });
        }
        const newActivity = await getActivityService().createActivity(orgId, {
            title,
            description: session.description ?? '',
            activityType: session.activityType,
            location: session.location ?? 'TBD',
            scheduledStartDate,
            estimatedDuration: session.estimatedDuration,
            maxParticipants: session.maxParticipants,
            creatorId,
            creatorName,
            metadata: {
                discordServerId: session.guildId,
                difficulty: session.difficulty,
                requirements: session.requirements,
            },
        });
        const discordEventUrl = await tryCreateDiscordEvent(session, title, scheduledStartDate, orgId, {
            participantCount: 1,
            participantCap: session.maxParticipants,
        });
        if (discordEventUrl) {
            newActivity.discordEventId = discordEventUrl.split('/').pop();
            await getActivityService().updateActivity(newActivity.id, {
                discordEventId: newActivity.discordEventId,
            });
        }
        if (currentVoiceChannel) {
            await persistVoiceChannelLink(newActivity.id, currentVoiceChannel.id, currentVoiceChannel.name, {
                autoCreate: false,
                autoDelete: false,
            });
        }
        else {
            const vcId = await tryCreateVoiceChannel(session, title, scheduledStartDate, newActivity.id, interaction.guild, orgId);
            if (vcId) {
                try {
                    await persistVoiceChannelLink(newActivity.id, vcId, `≡ƒÄ« ${title}`, {
                        autoCreate: true,
                        autoDelete: true,
                    });
                }
                catch {
                }
            }
        }
        const confirmEmbed = buildConfirmationEmbed(session, newActivity.id, title, scheduledStartDate, discordEventUrl);
        await interaction.editReply({ embeds: [confirmEmbed], components: [] });
        let targetChannelId = session.channelId;
        let mentionContent = '';
        let shouldAutoPublish = false;
        let shouldCreateEventThread = false;
        try {
            const { discordSettingsService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/DiscordSettingsService')));
            const guildSettings = await discordSettingsService.getSettings(orgId, session.guildId);
            const eventConfig = guildSettings?.eventSettings;
            if (eventConfig?.eventAnnouncementChannelId) {
                targetChannelId = eventConfig.eventAnnouncementChannelId;
            }
            shouldAutoPublish = eventConfig?.autoPublishAnnouncements === true;
            shouldCreateEventThread = eventConfig?.createEventThread === true;
            const mentionsEnabled = eventConfig?.enableEventMentions !== false;
            if (mentionsEnabled) {
                const roleIds = [];
                if (Array.isArray(eventConfig?.eventNotificationRoleIds)) {
                    roleIds.push(...eventConfig.eventNotificationRoleIds.filter(Boolean));
                }
                if (eventConfig?.eventNotificationRoleId) {
                    roleIds.push(eventConfig.eventNotificationRoleId);
                }
                const uniqueRoleIds = Array.from(new Set(roleIds));
                if (uniqueRoleIds.length > 0) {
                    mentionContent = uniqueRoleIds.map(id => `<@&${id}>`).join(' ');
                }
            }
        }
        catch (settingsErr) {
            logger_1.logger.warn('Failed to resolve event announcement channel/mentions from settings', {
                guildId: session.guildId,
                error: settingsErr instanceof Error ? settingsErr.message : String(settingsErr),
            });
        }
        const channel = interaction.guild?.channels.cache.get(targetChannelId);
        if (channel?.isTextBased()) {
            let participantList = [];
            try {
                const rows = await getParticipantService().getParticipants(newActivity.id);
                participantList = rows.map(p => ({
                    userId: p.userId,
                    userName: p.userName ?? undefined,
                    discordUserId: p.userId === creatorId ? session.userId : undefined,
                    status: p.status ?? 'accepted',
                    role: p.role ?? undefined,
                    shipType: p.shipType ?? undefined,
                    shipName: p.shipName ?? undefined,
                }));
            }
            catch (participantsErr) {
                logger_1.logger.warn('Failed to fetch initial participants for wizard embed', {
                    activityId: newActivity.id,
                    error: participantsErr instanceof Error ? participantsErr.message : String(participantsErr),
                });
            }
            const eventEmbedData = {
                id: newActivity.id,
                title: newActivity.title,
                type: newActivity.activityType,
                status: newActivity.status ?? 'open',
                description: newActivity.description ?? undefined,
                location: newActivity.location ?? undefined,
                startDate: newActivity.scheduledStartDate ?? undefined,
                maxParticipants: session.maxParticipants ?? undefined,
                creatorName: session.userName,
                creatorId,
                participants: participantList,
                postedAt: newActivity.createdAt ?? new Date(),
                updatedAt: newActivity.updatedAt ?? newActivity.createdAt ?? new Date(),
            };
            const rsvpEmbed = (0, eventEmbed_1.buildEventEmbed)(eventEmbedData);
            const eventRows = (0, eventEmbed_1.buildEventComponentRows)(newActivity.id, { includeManage: true });
            const sentMsg = await channel.send({
                content: mentionContent || undefined,
                embeds: [rsvpEmbed],
                components: eventRows,
                allowedMentions: mentionContent
                    ? { parse: [], roles: mentionContent.match(/\d{17,20}/g) ?? [] }
                    : undefined,
            });
            if (shouldCreateEventThread && sentMsg?.startThread) {
                try {
                    await sentMsg.startThread({
                        name: `Event: ${title}`.slice(0, 100),
                        autoArchiveDuration: 1440,
                        reason: `Auto-created discussion thread for activity ${newActivity.id}`,
                    });
                }
                catch (threadErr) {
                    logger_1.logger.warn('Failed to auto-create event discussion thread from wizard', {
                        guildId: session.guildId,
                        channelId: targetChannelId,
                        activityId: newActivity.id,
                        error: threadErr instanceof Error ? threadErr.message : String(threadErr),
                    });
                }
            }
            if (shouldAutoPublish &&
                channel.type === discord_js_1.ChannelType.GuildAnnouncement &&
                sentMsg?.crosspost) {
                try {
                    await sentMsg.crosspost();
                }
                catch (crosspostErr) {
                    logger_1.logger.warn('Failed to crosspost event wizard message', {
                        guildId: session.guildId,
                        channelId: targetChannelId,
                        error: crosspostErr instanceof Error ? crosspostErr.message : String(crosspostErr),
                    });
                }
            }
        }
        wizardSessions.delete(sessionKey(session.guildId, session.userId));
        logger_1.logger.info(`Event created via wizard: ${newActivity.id} by ${session.userName}`);
    }
    catch (error) {
        logger_1.logger.error('Failed to create event via wizard', error instanceof Error ? error : new Error(String(error)));
        await interaction.editReply({
            content: 'Γ¥î Failed to create event. Please try again.',
            embeds: [],
            components: [],
        });
        if (interaction.guildId) {
            wizardSessions.delete(sessionKey(interaction.guildId, interaction.user.id));
        }
    }
}
async function updateWizardMessage(interaction, session) {
    const embed = buildWizardEmbed(session);
    const buttons = buildWizardButtons();
    if (interaction.isModalSubmit()) {
        await interaction.deferUpdate();
        await interaction.editReply({
            embeds: [embed],
            components: buttons,
        });
    }
    else {
        await interaction.update({
            embeds: [embed],
            components: buttons,
        });
    }
}
async function dismissSelectAndConfirm(interaction, confirmText) {
    await interaction.update({
        content: confirmText,
        components: [],
    });
}
function isWizardButtonId(customId) {
    return customId.startsWith('event_wiz_');
}
function isWizardModalId(customId) {
    return customId.startsWith('event_wiz_modal_');
}
function isWizardSelectId(customId) {
    return customId.startsWith('event_wiz_select_');
}
//# sourceMappingURL=eventCreationWizard.js.map