"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRecurrenceInput = normalizeRecurrenceInput;
exports.isEditWizardButtonId = isEditWizardButtonId;
exports.isEditWizardModalId = isEditWizardModalId;
exports.launchEventEditWizard = launchEventEditWizard;
exports.handleEditWizardButton = handleEditWizardButton;
exports.handleEditWizardModal = handleEditWizardModal;
const discord_js_1 = require("discord.js");
const activity_1 = require("../../services/activity");
const UserService_1 = require("../../services/user/UserService");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const eventEmbed_1 = require("../embeds/eventEmbed");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const wizardSessionStore_1 = require("../utils/wizardSessionStore");
const eventButtons_1 = require("./eventButtons");
const SESSION_TTL_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 200;
const MAX_REQUIREMENTS_LENGTH = 500;
const CUSTOM_ID_PREFIX = 'event_edw_';
const sessions = new wizardSessionStore_1.WizardSessionStore({
    ttlMs: SESSION_TTL_MS,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
    keyFactory: (guildId, userId, activityId) => `${guildId}:${userId}:${activityId}`,
    getLastInteraction: session => session.lastInteraction,
    touch: (session, now) => {
        session.lastInteraction = now;
    },
});
function sessionKey(guildId, userId, activityId) {
    return sessions.makeKey(guildId, userId, activityId);
}
let _activityService = null;
function getActivityService() {
    _activityService ??= new activity_1.ActivityService();
    return _activityService;
}
let _participantService = null;
function getParticipantService() {
    _participantService ??= new activity_1.ActivityParticipantService();
    return _participantService;
}
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
function sanitizeText(input, maxLength) {
    return input.trim().slice(0, maxLength);
}
function formatDateForInput(d) {
    if (!d) {
        return '';
    }
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
function parseDateInput(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)
        ? `${trimmed.replace(' ', 'T')}:00Z`
        : trimmed;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatDateOnly(d) {
    if (!d || Number.isNaN(d.getTime())) {
        return '';
    }
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const RECURRENCE_CHOICES = ['none', 'daily', 'weekly', 'monthly'];
function normalizeRecurrenceInput(patternRaw, endRaw) {
    const pattern = patternRaw.trim().toLowerCase();
    if (pattern && !RECURRENCE_CHOICES.includes(pattern)) {
        return { ok: false, error: 'Repeat must be none, daily, weekly, or monthly.' };
    }
    const normalized = (pattern || 'none');
    if (normalized === 'none') {
        return { ok: true, pattern: 'none' };
    }
    const endTrimmed = endRaw.trim();
    if (!endTrimmed) {
        return { ok: true, pattern: normalized };
    }
    const endDate = parseDateInput(endTrimmed);
    if (!endDate) {
        return { ok: false, error: 'Invalid end date. Use `YYYY-MM-DD` (UTC).' };
    }
    return { ok: true, pattern: normalized, endDate };
}
function getSession(guildId, userId, activityId) {
    if (!guildId) {
        return null;
    }
    const key = sessionKey(guildId, userId, activityId);
    return sessions.get(key);
}
async function resolveInternalUserId(discordId) {
    try {
        const user = await getUserService().getUserByDiscordId(discordId);
        return user?.id ?? null;
    }
    catch {
        return null;
    }
}
function parseCustomId(customId) {
    if (!customId.startsWith(CUSTOM_ID_PREFIX)) {
        return null;
    }
    const rest = customId.slice(CUSTOM_ID_PREFIX.length);
    const modalMatch = /^modal_([a-z]+)_(.+)$/.exec(rest);
    if (modalMatch) {
        return { kind: 'modal', field: modalMatch[1], activityId: modalMatch[2] };
    }
    const selectMatch = /^select_([a-z]+)_(.+)$/.exec(rest);
    if (selectMatch) {
        return { kind: 'select', field: selectMatch[1], activityId: selectMatch[2] };
    }
    const buttonMatch = /^([a-z]+)_(.+)$/.exec(rest);
    if (buttonMatch) {
        return { kind: 'button', field: buttonMatch[1], activityId: buttonMatch[2] };
    }
    return null;
}
function isEditWizardButtonId(customId) {
    if (!customId.startsWith(CUSTOM_ID_PREFIX)) {
        return false;
    }
    const rest = customId.slice(CUSTOM_ID_PREFIX.length);
    return !rest.startsWith('modal_') && !rest.startsWith('select_');
}
function isEditWizardModalId(customId) {
    return customId.startsWith(`${CUSTOM_ID_PREFIX}modal_`);
}
const RECURRENCE_LABELS = {
    none: 'None',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
};
function buildEditEmbed(session) {
    const check = (v) => v !== undefined && v !== null && v !== '' ? 'Γ£Å∩╕Å' : 'Γ¼¢';
    const startStr = session.scheduledStartDate
        ? `<t:${Math.floor(session.scheduledStartDate.getTime() / 1000)}:F>`
        : '_not set_';
    const endStr = session.scheduledEndDate
        ? `<t:${Math.floor(session.scheduledEndDate.getTime() / 1000)}:F>`
        : '_not set_';
    const durStr = session.estimatedDuration ? `${session.estimatedDuration} min` : '_not set_';
    const recStr = session.recurrencePattern
        ? `${RECURRENCE_LABELS[session.recurrencePattern] ?? session.recurrencePattern}${session.recurrenceEndDate
            ? ` (until <t:${Math.floor(session.recurrenceEndDate.getTime() / 1000)}:d>)`
            : ''}`
        : '_none_';
    const lines = [
        `${check(session.title)} **Title** ΓÇö ${session.title ?? '_not set_'}`,
        `${check(session.description)} **Description** ΓÇö ${session.description ? `${session.description.slice(0, 80)}${session.description.length > 80 ? 'ΓÇª' : ''}` : '_not set_'}`,
        `${check(session.location)} **Location** ΓÇö ${session.location ?? '_not set_'}`,
        `${check(session.scheduledStartDate)} **Starts** ΓÇö ${startStr}`,
        `${check(session.scheduledEndDate)} **Ends** ΓÇö ${endStr}`,
        `${check(session.estimatedDuration)} **Duration** ΓÇö ${durStr}`,
        `${check(session.maxParticipants)} **Max Participants** ΓÇö ${session.maxParticipants ?? '_unlimited_'}`,
        `${check(session.requirements)} **Requirements** ΓÇö ${session.requirements ? `${session.requirements.slice(0, 80)}${session.requirements.length > 80 ? 'ΓÇª' : ''}` : '_none_'}`,
        `${check(session.recurrencePattern && session.recurrencePattern !== 'none')} **Recurrence** ΓÇö ${recStr}`,
    ];
    return new discord_js_1.EmbedBuilder()
        .setColor(0xfaa61a)
        .setTitle('Γ£Å∩╕Å Edit Event')
        .setDescription(`Click a field to edit it, then **Save Changes** to apply.\n\n${lines.join('\n')}`)
        .setFooter({ text: 'Session expires after 15 minutes of inactivity' })
        .setTimestamp();
}
function buildEditButtons(activityId) {
    const mk = (field, label, style = discord_js_1.ButtonStyle.Secondary) => new discord_js_1.ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}${field}_${activityId}`)
        .setLabel(label)
        .setStyle(style);
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(mk('title', '≡ƒô¥ Title'), mk('desc', '≡ƒôä Description'), mk('location', '≡ƒôì Location'), mk('start', '≡ƒòÆ Start'));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(mk('end', '≡ƒÅü End'), mk('duration', 'ΓÅ▒∩╕Å Duration'), mk('max', '≡ƒæÑ Max Players'), mk('reqs', '≡ƒôï Requirements'));
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(mk('recur', '≡ƒöü Recurrence'));
    const row4 = new discord_js_1.ActionRowBuilder().addComponents(mk('save', '≡ƒÆ╛ Save Changes', discord_js_1.ButtonStyle.Success), mk('cancel', 'Γ£û∩╕Å Cancel', discord_js_1.ButtonStyle.Danger));
    return [row1, row2, row3, row4];
}
async function launchEventEditWizard(interaction, activityId) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
        await interaction.reply({
            content: 'ΓÜá∩╕Å Activity no longer exists.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (activity.creatorId !== internalUserId && activity.creatorId !== interaction.user.id) {
        await interaction.reply({
            content: 'Γ¥î Only the event creator can edit this event.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const status = (activity.status ?? '').toLowerCase();
    if (status === 'cancelled' || status === 'completed') {
        await interaction.reply({
            content: `ΓÜá∩╕Å Cannot edit a ${status} event.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const baseMetadata = (activity.metadata ?? {});
    const recurrencePattern = baseMetadata.recurrencePattern;
    const recurrenceEndDateRaw = baseMetadata.recurrenceEndDate;
    const recurrenceEndDate = recurrenceEndDateRaw instanceof Date
        ? recurrenceEndDateRaw
        : typeof recurrenceEndDateRaw === 'string'
            ? new Date(recurrenceEndDateRaw)
            : undefined;
    const session = {
        activityId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        embedMessageId: interaction.message?.id,
        userId: interaction.user.id,
        userName: interaction.user.username,
        title: activity.title ?? undefined,
        description: activity.description ?? undefined,
        location: activity.location ?? undefined,
        scheduledStartDate: activity.scheduledStartDate ?? undefined,
        scheduledEndDate: activity.scheduledEndDate ?? undefined,
        estimatedDuration: activity.estimatedDuration ?? undefined,
        maxParticipants: activity.maxParticipants ?? undefined,
        requirements: typeof activity.requirements === 'string'
            ? activity.requirements
            : activity.requirements
                ? JSON.stringify(activity.requirements)
                : undefined,
        recurrencePattern,
        recurrenceEndDate: recurrenceEndDate && !Number.isNaN(recurrenceEndDate.getTime())
            ? recurrenceEndDate
            : undefined,
        baseMetadata,
        lastInteraction: Date.now(),
    };
    sessions.set(sessionKey(interaction.guildId, interaction.user.id, activityId), session);
    await interaction.reply({
        embeds: [buildEditEmbed(session)],
        components: buildEditButtons(activityId),
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleEditWizardButton(interaction) {
    const parsed = parseCustomId(interaction.customId);
    if (parsed?.kind !== 'button') {
        return;
    }
    const { field, activityId } = parsed;
    const session = getSession(interaction.guildId, interaction.user.id, activityId);
    if (!session) {
        await interaction.reply({
            content: 'ΓÜá∩╕Å Your edit session has expired. Click **Edit** again to start over.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    switch (field) {
        case 'title':
            return showTextModal(interaction, activityId, 'title', 'Edit Title', 'Title', session.title, {
                style: discord_js_1.TextInputStyle.Short,
                required: true,
                maxLength: MAX_TITLE_LENGTH,
                minLength: 3,
            });
        case 'desc':
            return showTextModal(interaction, activityId, 'desc', 'Edit Description', 'Description', session.description, { style: discord_js_1.TextInputStyle.Paragraph, maxLength: MAX_DESCRIPTION_LENGTH });
        case 'location':
            return showTextModal(interaction, activityId, 'location', 'Edit Location', 'Location', session.location, { style: discord_js_1.TextInputStyle.Short, maxLength: MAX_LOCATION_LENGTH });
        case 'start':
            return showDateTimeModal(interaction, activityId, 'start', 'Edit Start Time', session.scheduledStartDate);
        case 'end':
            return showDateTimeModal(interaction, activityId, 'end', 'Edit End Time', session.scheduledEndDate);
        case 'duration':
            return showNumberModal(interaction, activityId, 'duration', 'Edit Duration', 'Duration in minutes (1-1440)', session.estimatedDuration);
        case 'max':
            return showNumberModal(interaction, activityId, 'max', 'Edit Max Participants', 'Max participants (1-100, empty = unlimited)', session.maxParticipants, false);
        case 'reqs':
            return showTextModal(interaction, activityId, 'reqs', 'Edit Requirements', 'Requirements (free text)', session.requirements, { style: discord_js_1.TextInputStyle.Paragraph, maxLength: MAX_REQUIREMENTS_LENGTH });
        case 'recur':
            return showRecurrenceModal(interaction, activityId, session);
        case 'save':
            return handleSave(interaction, session);
        case 'cancel':
            return handleCancel(interaction, session);
        default:
            await interaction.reply({
                content: 'Γ¥î Unknown edit action.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
    }
}
async function showTextModal(interaction, activityId, field, title, label, currentValue, options) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}modal_${field}_${activityId}`)
        .setTitle(title);
    const input = new discord_js_1.TextInputBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}input_${field}`)
        .setStyle(options.style)
        .setRequired(options.required ?? false);
    if (options.maxLength) {
        input.setMaxLength(options.maxLength);
    }
    if (options.minLength) {
        input.setMinLength(options.minLength);
    }
    if (currentValue) {
        input.setValue(currentValue);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel(label).setTextInputComponent(input));
    await interaction.showModal(modal);
}
async function showNumberModal(interaction, activityId, field, title, label, currentValue, required = true) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}modal_${field}_${activityId}`)
        .setTitle(title);
    const input = new discord_js_1.TextInputBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}input_${field}`)
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(required)
        .setMaxLength(4);
    if (currentValue !== undefined) {
        input.setValue(String(currentValue));
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel(label).setTextInputComponent(input));
    await interaction.showModal(modal);
}
async function showDateTimeModal(interaction, activityId, field, title, currentValue) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}modal_${field}_${activityId}`)
        .setTitle(title);
    const input = new discord_js_1.TextInputBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}input_${field}`)
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(16)
        .setPlaceholder('2026-05-25 19:30');
    if (currentValue) {
        input.setValue(formatDateForInput(currentValue));
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder()
        .setLabel('UTC: YYYY-MM-DD HH:mm (empty to clear)')
        .setTextInputComponent(input));
    await interaction.showModal(modal);
}
async function showRecurrenceModal(interaction, activityId, session) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}modal_recur_${activityId}`)
        .setTitle('Edit Recurrence');
    const patternInput = new discord_js_1.TextInputBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}input_recur`)
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setPlaceholder('none')
        .setValue(session.recurrencePattern ?? 'none');
    const endInput = new discord_js_1.TextInputBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}input_recurend`)
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(16)
        .setPlaceholder('2026-12-31');
    const existingEnd = formatDateOnly(session.recurrenceEndDate);
    if (existingEnd) {
        endInput.setValue(existingEnd);
    }
    modal.addLabelComponents(new discord_js_1.LabelBuilder()
        .setLabel('Repeat: none, daily, weekly, or monthly')
        .setTextInputComponent(patternInput), new discord_js_1.LabelBuilder()
        .setLabel('Repeat until (UTC YYYY-MM-DD, optional)')
        .setTextInputComponent(endInput));
    await interaction.showModal(modal);
}
async function handleEditWizardModal(interaction) {
    const parsed = parseCustomId(interaction.customId);
    if (parsed?.kind !== 'modal') {
        return;
    }
    const { field, activityId } = parsed;
    const session = getSession(interaction.guildId, interaction.user.id, activityId);
    if (!session) {
        await interaction.reply({
            content: 'ΓÜá∩╕Å Your edit session has expired. Click **Edit** again to start over.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const raw = interaction.fields.getTextInputValue(`${CUSTOM_ID_PREFIX}input_${field}`).trim();
    switch (field) {
        case 'title': {
            if (!raw) {
                await interaction.reply({
                    content: 'Γ¥î Title is required.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            session.title = sanitizeText(raw, MAX_TITLE_LENGTH);
            break;
        }
        case 'desc':
            session.description = raw ? sanitizeText(raw, MAX_DESCRIPTION_LENGTH) : undefined;
            break;
        case 'location':
            session.location = raw ? sanitizeText(raw, MAX_LOCATION_LENGTH) : undefined;
            break;
        case 'reqs':
            session.requirements = raw ? sanitizeText(raw, MAX_REQUIREMENTS_LENGTH) : undefined;
            break;
        case 'start': {
            if (!raw) {
                session.scheduledStartDate = undefined;
                break;
            }
            const parsedDate = parseDateInput(raw);
            if (!parsedDate) {
                await interaction.reply({
                    content: 'Γ¥î Invalid date. Use `YYYY-MM-DD HH:mm` in UTC.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            session.scheduledStartDate = parsedDate;
            break;
        }
        case 'end': {
            if (!raw) {
                session.scheduledEndDate = undefined;
                break;
            }
            const parsedDate = parseDateInput(raw);
            if (!parsedDate) {
                await interaction.reply({
                    content: 'Γ¥î Invalid date. Use `YYYY-MM-DD HH:mm` in UTC.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            session.scheduledEndDate = parsedDate;
            break;
        }
        case 'duration': {
            const n = Number.parseInt(raw, 10);
            if (Number.isNaN(n) || n < 1 || n > 1440) {
                await interaction.reply({
                    content: 'Γ¥î Duration must be between 1 and 1440 minutes.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            session.estimatedDuration = n;
            break;
        }
        case 'max': {
            if (!raw) {
                session.maxParticipants = undefined;
                break;
            }
            const n = Number.parseInt(raw, 10);
            if (Number.isNaN(n) || n < 1 || n > 100) {
                await interaction.reply({
                    content: 'Γ¥î Max participants must be between 1 and 100.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            session.maxParticipants = n;
            break;
        }
        case 'recur': {
            const endRaw = interaction.fields
                .getTextInputValue(`${CUSTOM_ID_PREFIX}input_recurend`)
                .trim();
            const result = normalizeRecurrenceInput(raw, endRaw);
            if (!result.ok) {
                await interaction.reply({
                    content: `Γ¥î ${result.error}`,
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            session.recurrencePattern = result.pattern;
            session.recurrenceEndDate = result.endDate;
            break;
        }
        default:
            await interaction.reply({
                content: 'Γ¥î Unknown field.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
    }
    await refreshPanel(interaction, session);
}
async function refreshPanel(interaction, session) {
    const embed = buildEditEmbed(session);
    const buttons = buildEditButtons(session.activityId);
    if (interaction.isModalSubmit()) {
        await interaction.deferUpdate();
        await interaction.editReply({ embeds: [embed], components: buttons });
    }
    else {
        await interaction.update({ embeds: [embed], components: buttons });
    }
}
async function handleCancel(interaction, session) {
    sessions.delete(sessionKey(session.guildId, session.userId, session.activityId));
    await interaction.update({
        content: 'Γ£û∩╕Å Edit cancelled. No changes saved.',
        embeds: [],
        components: [],
    });
}
async function handleSave(interaction, session) {
    await interaction.deferUpdate();
    try {
        const mergedMetadata = {
            ...session.baseMetadata,
        };
        if (session.recurrencePattern !== undefined) {
            mergedMetadata.recurrencePattern = session.recurrencePattern;
        }
        if (session.recurrenceEndDate !== undefined) {
            mergedMetadata.recurrenceEndDate = session.recurrenceEndDate;
        }
        else if (session.recurrencePattern === 'none') {
            delete mergedMetadata.recurrenceEndDate;
        }
        const updates = {
            title: session.title,
            description: session.description ?? null,
            location: session.location ?? null,
            scheduledStartDate: session.scheduledStartDate ?? null,
            scheduledEndDate: session.scheduledEndDate ?? null,
            estimatedDuration: session.estimatedDuration ?? null,
            maxParticipants: session.maxParticipants ?? null,
            requirements: session.requirements ?? null,
            metadata: mergedMetadata,
        };
        await getActivityService().updateActivity(session.activityId, updates);
        sessions.delete(sessionKey(session.guildId, session.userId, session.activityId));
        await interaction.editReply({
            content: 'Γ£à Event updated successfully.',
            embeds: [],
            components: [],
        });
        await refreshEventEmbed(interaction, session);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: session.userId,
            username: session.userName,
            resource: `discord/guild/${session.guildId}/channel/${session.channelId}`,
            action: 'EVENT_EDIT',
            message: `User edited event via wizard: ${session.activityId}`,
            metadata: { activityId: session.activityId, action: 'edit' },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to save event edit', error instanceof Error ? error : new Error(String(error)));
        await interaction.editReply({
            content: `Γ¥î Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
            embeds: [],
            components: [],
        });
    }
}
async function refreshEventEmbed(interaction, session) {
    try {
        const updated = await getActivityService().getActivityById(session.activityId);
        if (!updated || !session.embedMessageId || !interaction.guild) {
            return;
        }
        const channel = interaction.guild.channels.cache.get(session.channelId);
        if (!channel || !('messages' in channel)) {
            return;
        }
        const message = await channel.messages.fetch(session.embedMessageId).catch(() => null);
        if (!message) {
            return;
        }
        const participants = await getParticipantService().getParticipants(session.activityId);
        const discordIdMap = await (0, eventButtons_1.resolveDiscordIdMap)((0, eventButtons_1.collectUserIdsForEmbed)(updated, participants));
        const embedData = (0, eventButtons_1.buildEmbedDataFromActivity)(updated, participants, discordIdMap);
        const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
        const components = (0, eventEmbed_1.buildEventComponentRows)(session.activityId, { includeManage: isActive });
        await message.edit({ embeds: [(0, eventEmbed_1.buildEventEmbed)(embedData)], components });
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(session.activityId, session.userId);
    }
    catch (err) {
        logger_1.logger.debug('Failed to refresh event embed after wizard save', {
            activityId: session.activityId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
//# sourceMappingURL=eventEditWizard.js.map