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
exports.events = void 0;
exports.parseFleetInviteButtonId = parseFleetInviteButtonId;
const discord_js_1 = require("discord.js");
const activity_1 = require("../../services/activity");
const UserService_1 = require("../../services/user/UserService");
const eventsEmbeds_1 = require("../embeds/eventsEmbeds");
const mirroredEventMessage_1 = require("../embeds/mirroredEventMessage");
const eventButtons_1 = require("../interactions/eventButtons");
const eventCreationWizard_1 = require("../interactions/eventCreationWizard");
const eventEditWizard_1 = require("../interactions/eventEditWizard");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
const guildContext_1 = require("../utils/guildContext");
const eventHandlers_1 = require("./eventHandlers");
exports.events = {
    data: new discord_js_1.SlashCommandBuilder().setName('events').setDescription('Manage and view fleet events'),
    category: 'events',
    async execute(interaction) {
        const panelConfig = {
            prefix: 'event',
            title: '\ud83d\udcc5 Events',
            description: 'Create, manage, and join events.',
            buttons: [
                {
                    subcommand: 'list',
                    label: 'List Events',
                    emoji: '\ud83d\udccb',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                {
                    subcommand: 'create',
                    label: 'Create Event',
                    emoji: '\u2795',
                    style: discord_js_1.ButtonStyle.Success,
                },
                { subcommand: 'my', label: 'My Events', emoji: '\ud83d\udc64' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
    async handleButton(interaction) {
        if (await tryHandleEventPanelButton(interaction)) {
            return;
        }
        if ((0, eventCreationWizard_1.isWizardButtonId)(interaction.customId)) {
            await (0, eventCreationWizard_1.handleWizardButton)(interaction);
            return;
        }
        if ((0, eventEditWizard_1.isEditWizardButtonId)(interaction.customId)) {
            await (0, eventEditWizard_1.handleEditWizardButton)(interaction);
            return;
        }
        const mirrorCreateMatch = /^event_mirrorcreate_(.+)$/.exec(interaction.customId);
        if (mirrorCreateMatch) {
            await presentCreateMirrorForEvent(interaction, mirrorCreateMatch[1]);
            return;
        }
        const mirrorResyncMatch = /^event_mirrorresync_(.+)$/.exec(interaction.customId);
        if (mirrorResyncMatch) {
            await presentManualMirrorResync(interaction, mirrorResyncMatch[1]);
            return;
        }
        if (await tryHandleFleetInviteButton(interaction)) {
            return;
        }
        await (0, eventButtons_1.handleEventButton)(interaction);
    },
    async handleModal(interaction) {
        const { customId } = interaction;
        const setPassMatch = /^event_mirror_setpass_(.+)$/.exec(customId);
        if (setPassMatch) {
            await handleCreateMirrorPassModal(interaction, setPassMatch[1]);
            return;
        }
        if (customId === 'event_mirror_post_modal') {
            await handlePostMirrorModal(interaction);
            return;
        }
        if ((0, eventCreationWizard_1.isWizardModalId)(customId)) {
            await (0, eventCreationWizard_1.handleWizardModal)(interaction);
            return;
        }
        if ((0, eventEditWizard_1.isEditWizardModalId)(customId)) {
            await (0, eventEditWizard_1.handleEditWizardModal)(interaction);
            return;
        }
        const bringShipMatch = /^event_bringship_modal_(.+)$/.exec(customId);
        if (bringShipMatch) {
            await (0, eventButtons_1.handleBringShipModal)(interaction, bringShipMatch[1]);
            return;
        }
        const editMatch = /^event_edit_modal_(.+)$/.exec(customId);
        if (editMatch) {
            await (0, eventButtons_1.handleEditEventModal)(interaction, editMatch[1]);
            return;
        }
        const reqShipMatch = /^event_reqship_modal_(.+)$/.exec(customId);
        if (reqShipMatch) {
            await (0, eventButtons_1.handleReqShipModal)(interaction, reqShipMatch[1]);
            return;
        }
        const manageSlotsMatch = /^event_manageslots_modal_(.+?)__(.+)$/.exec(customId);
        if (manageSlotsMatch) {
            await (0, eventButtons_1.handleManageSlotsModal)(interaction, manageSlotsMatch[1], decodeURIComponent(manageSlotsMatch[2]));
            return;
        }
        await interaction.reply({
            content: 'Γ¥î Unknown modal submission.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
    async handleSelectMenu(interaction) {
        const { customId } = interaction;
        if ((0, eventCreationWizard_1.isWizardSelectId)(customId)) {
            await (0, eventCreationWizard_1.handleWizardSelectMenu)(interaction);
            return;
        }
        if (customId === 'event_mirror_create_select') {
            await handleCreateMirrorEventSelected(interaction);
            return;
        }
        const crewSelectMatch = /^event_crewselect_(.+)$/.exec(customId);
        if (crewSelectMatch) {
            await (0, eventButtons_1.handleCrewSelectMenu)(interaction, crewSelectMatch[1]);
            return;
        }
        const passengerSelectMatch = /^event_passengerselect_(.+)$/.exec(customId);
        if (passengerSelectMatch) {
            await (0, eventButtons_1.handlePassengerSelectMenu)(interaction, passengerSelectMatch[1]);
            return;
        }
        const manageSlotsSelectMatch = /^event_manageslotsselect_(.+)$/.exec(customId);
        if (manageSlotsSelectMatch) {
            await (0, eventButtons_1.handleManageSlotsShipSelect)(interaction, manageSlotsSelectMatch[1]);
            return;
        }
        const bringFleetSelectMatch = /^event_bringfleetselect_(.+)$/.exec(customId);
        if (bringFleetSelectMatch) {
            await (0, eventButtons_1.handleBringFleetSelect)(interaction, bringFleetSelectMatch[1]);
            return;
        }
        const removeShipSelectMatch = /^event_removeshipselect_(.+)$/.exec(customId);
        if (removeShipSelectMatch) {
            await (0, eventButtons_1.handleRemoveShipSelectMenu)(interaction, removeShipSelectMatch[1]);
            return;
        }
        const hangarPageMatch = /^event_hangarpage_(.+)$/.exec(customId);
        if (hangarPageMatch) {
            await (0, eventButtons_1.handleHangarPageSelect)(interaction, hangarPageMatch[1]);
            return;
        }
        const nestShipMatch = /^event_nestship_([^_]+)_(.+)$/.exec(customId);
        if (nestShipMatch) {
            await (0, eventButtons_1.handleNestShipSelect)(interaction, nestShipMatch[1], nestShipMatch[2]);
            return;
        }
        const hangarShipMatch = /^event_hangarship_(.+)$/.exec(customId);
        if (hangarShipMatch) {
            await (0, eventButtons_1.handleHangarShipSelect)(interaction, hangarShipMatch[1]);
            return;
        }
        const reqRoleMatch = /^event_reqshiprole_(.+)$/.exec(customId);
        if (reqRoleMatch) {
            await (0, eventButtons_1.handleReqShipRoleSelect)(interaction, reqRoleMatch[1]);
            return;
        }
        const reqTypeMatch = /^event_reqshiptype_([^_]+)_(.+)$/.exec(customId);
        if (reqTypeMatch) {
            await (0, eventButtons_1.handleReqShipTypeSelect)(interaction, reqTypeMatch[1], reqTypeMatch[2]);
            return;
        }
        await interaction.reply({
            content: 'Γ¥î Unknown select menu.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
};
let _mirrorActivityService = null;
let _mirrorEventMirrorService = null;
let _mirrorUserService = null;
function getMirrorActivityService() {
    _mirrorActivityService ??= new activity_1.ActivityService();
    return _mirrorActivityService;
}
function getMirrorService() {
    _mirrorEventMirrorService ??= activity_1.EventMirrorService.getInstance();
    return _mirrorEventMirrorService;
}
function getMirrorUserService() {
    _mirrorUserService ??= new UserService_1.UserService();
    return _mirrorUserService;
}
function truncate(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}ΓÇª` : value;
}
async function canManageMirrorResync(interaction, activity) {
    if (activity.creatorId === interaction.user.id) {
        return true;
    }
    const internalUser = await getMirrorUserService().getUserByDiscordId(interaction.user.id);
    return Boolean(internalUser?.id && activity.creatorId === internalUser.id);
}
async function presentManualMirrorResync(interaction, eventId) {
    if (!eventId) {
        await interaction.reply({ content: 'Γ¥î No event selected.', flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const activity = await getMirrorActivityService().getActivityById(eventId);
    if (!activity) {
        await interaction.reply({
            content: `Γ¥î Activity not found: \`${eventId}\``,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const canManage = await canManageMirrorResync(interaction, activity);
    if (!canManage) {
        await interaction.reply({
            content: 'Γ¥î Only the event creator can trigger a manual mirror resync.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const mirrors = await getMirrorService().findRelatedMirrors(eventId);
    const totalMirrors = mirrors.length;
    const syncableMirrors = mirrors.filter(mirror => mirror.canSync()).length;
    const postedMirrors = mirrors.filter(mirror => mirror.canSync() && Boolean(mirror.mirrorMessageId)).length;
    (0, mirrorSyncPublisher_1.publishMirrorRefresh)(eventId, interaction.user.id);
    const summary = totalMirrors > 0
        ? [
            `≡ƒ¬₧ **Mirror Sync Visibility** for **${activity.title}**`,
            `ΓÇó Related mirrors: **${totalMirrors}**`,
            `ΓÇó Syncable mirrors: **${syncableMirrors}**`,
            `ΓÇó Mirrors with posted messages: **${postedMirrors}**`,
            '',
            '≡ƒöä Manual resync signal sent. Mirrors and source message will refresh shortly.',
        ].join('\n')
        : [
            `≡ƒ¬₧ **Mirror Sync Visibility** for **${activity.title}**`,
            'ΓÇó Related mirrors: **0**',
            '',
            '≡ƒöä Manual resync signal sent. No mirrors are currently linked to this event.',
        ].join('\n');
    await interaction.reply({
        content: summary,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function showMirrorSubPanel(interaction) {
    const embed = (0, eventsEmbeds_1.buildEventMirrorSubPanelEmbed)();
    const createBtn = new discord_js_1.ButtonBuilder()
        .setCustomId('event_panel_mirror_create')
        .setLabel('Create Mirror')
        .setEmoji('≡ƒôñ')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const postBtn = new discord_js_1.ButtonBuilder()
        .setCustomId('event_panel_mirror_post')
        .setLabel('Post Mirror')
        .setEmoji('≡ƒôÑ')
        .setStyle(discord_js_1.ButtonStyle.Success);
    const row = new discord_js_1.ActionRowBuilder().addComponents(createBtn, postBtn);
    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function showCreateMirrorPicker(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({
            content: 'Γ¥î This can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const upcoming = await getMirrorActivityService().getUpcomingActivities({ limit: 50 });
    const candidates = upcoming.filter(a => a.metadata?.discordServerId === guildId);
    if (candidates.length === 0) {
        await interaction.reply({
            content: 'Γ¥î No upcoming events found on this server. Create an event first, then generate a mirror invite.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const options = candidates.slice(0, 25).map(activity => {
        const dateStr = activity.scheduledStartDate
            ? new Date(activity.scheduledStartDate).toLocaleString()
            : 'Not scheduled';
        const hasCode = activity.metadata?.mirrorInviteCode ? ' (code exists)' : '';
        return {
            label: truncate(activity.title || 'Untitled event', 100),
            value: activity.id,
            description: truncate(`${dateStr}${hasCode}`, 100),
        };
    });
    const select = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('event_mirror_create_select')
        .setPlaceholder('Select an event to share')
        .addOptions(options);
    const row = new discord_js_1.ActionRowBuilder().addComponents(select);
    await interaction.reply({
        content: '≡ƒôñ **Create Mirror** ΓÇö Choose an event to generate an invite code for:',
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function tryHandleEventPanelButton(interaction) {
    const panelSub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'event');
    if (!panelSub) {
        return false;
    }
    try {
        if (panelSub === 'list' || panelSub === 'my') {
            await (0, eventHandlers_1.handleEventList)(interaction);
        }
        else if (panelSub === 'create') {
            await (0, eventHandlers_1.handleEventCreate)(interaction);
        }
        else if (panelSub === 'schedule') {
            const { embed, components } = (0, commandPanelBuilder_1.buildCommandPanel)({
                prefix: 'schedule',
                title: '\ud83d\udcc6 Schedule & Availability',
                description: 'Manage your availability and find the best event times.',
                buttons: [
                    {
                        subcommand: 'set',
                        label: 'Set Availability',
                        emoji: '\ud83d\uddd3\ufe0f',
                        style: discord_js_1.ButtonStyle.Primary,
                    },
                    { subcommand: 'view', label: 'View Heatmap', emoji: '\ud83d\uddfa\ufe0f' },
                    { subcommand: 'my', label: 'My Conflicts', emoji: '\ud83d\udc64' },
                    { subcommand: 'best', label: 'Find Best Time', emoji: '\u2b50' },
                    { subcommand: 'conflicts', label: 'Check Conflicts', emoji: '\u26a0\ufe0f' },
                ],
            });
            await interaction.reply({ embeds: [embed], components, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else if (panelSub === 'attendance') {
            const { embed, components } = (0, commandPanelBuilder_1.buildCommandPanel)({
                prefix: 'attend',
                title: '\u2705 Attendance',
                description: 'Manage event attendance and view your history.',
                buttons: [
                    {
                        subcommand: 'history',
                        label: 'My History',
                        emoji: '\ud83d\udcc5',
                        style: discord_js_1.ButtonStyle.Primary,
                    },
                    { subcommand: 'leaderboard', label: 'Leaderboard', emoji: '\ud83c\udfc6' },
                    {
                        subcommand: 'confirm',
                        label: 'Confirm Attendance',
                        emoji: '\u2705',
                        style: discord_js_1.ButtonStyle.Success,
                    },
                    { subcommand: 'stats', label: 'Event Stats', emoji: '\ud83d\udcca' },
                    { subcommand: 'report', label: 'Event Report', emoji: '\ud83d\udccb' },
                ],
            });
            await interaction.reply({ embeds: [embed], components, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else if (panelSub === 'reminders') {
            const { embed, components } = (0, commandPanelBuilder_1.buildCommandPanel)({
                prefix: 'reminder',
                title: '\u23f0 Event Reminders',
                description: 'Manage reminders for events.',
                buttons: [
                    {
                        subcommand: 'create',
                        label: 'Create Reminder',
                        emoji: '\u2795',
                        style: discord_js_1.ButtonStyle.Success,
                    },
                    { subcommand: 'list', label: 'List Reminders', emoji: '\ud83d\udccb' },
                    {
                        subcommand: 'cancel',
                        label: 'Cancel Reminder',
                        emoji: '\u274c',
                        style: discord_js_1.ButtonStyle.Danger,
                    },
                ],
            });
            await interaction.reply({ embeds: [embed], components, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else if (panelSub === 'mirror') {
            await showMirrorSubPanel(interaction);
        }
        else if (panelSub === 'mirror_create') {
            await showCreateMirrorPicker(interaction);
        }
        else if (panelSub === 'mirror_post') {
            await showPostMirrorModal(interaction);
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An error occurred';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `\u274c ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else {
            await interaction.reply({ content: `\u274c ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
    return true;
}
async function tryHandleFleetInviteButton(interaction) {
    const parsed = parseFleetInviteButtonId(interaction.customId);
    if (!parsed) {
        return false;
    }
    await (0, eventButtons_1.handleFleetInviteResponse)(interaction, parsed.action, parsed.activityId, parsed.fleetId);
    return true;
}
function parseFleetInviteButtonId(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== 'event') {
        return null;
    }
    const actionByPrefix = {
        fleetjoinship: 'joinship',
        fleetjoinonly: 'joinonly',
        fleetdecline: 'decline',
    };
    const action = actionByPrefix[parsed.action];
    const [activityId = '', fleetId = ''] = parsed.params;
    if (!action || !activityId || !fleetId) {
        return null;
    }
    return { action, activityId, fleetId };
}
async function presentCreateMirrorForEvent(interaction, eventId) {
    if (!eventId) {
        await interaction.reply({ content: 'Γ¥î No event selected.', flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const activity = await getMirrorActivityService().getActivityById(eventId);
    if (!activity) {
        await interaction.reply({
            content: `Γ¥î Activity not found: \`${eventId}\``,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (activity.metadata?.mirrorInviteCode) {
        const code = activity.metadata.mirrorInviteCode;
        const hasPass = activity.metadata.mirrorKeyHash
            ? '≡ƒöÉ Password protected'
            : '≡ƒöô No password';
        await interaction.reply({
            content: `≡ƒ¬₧ **${activity.title}** already has a mirror invite code:\n\n` +
                `\`\`\`\n${code}\n\`\`\`\n` +
                `${hasPass}\n\n` +
                `Share this code with other servers. They can use **Post Mirror** to mirror this event.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`event_mirror_setpass_${eventId}`)
        .setTitle('Create Mirror Invite');
    const passInput = new discord_js_1.TextInputBuilder()
        .setCustomId('password')
        .setPlaceholder('Leave blank for an open invite')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Password (optional)').setTextInputComponent(passInput));
    await interaction.showModal(modal);
}
async function handleCreateMirrorEventSelected(interaction) {
    await presentCreateMirrorForEvent(interaction, interaction.values[0]);
}
async function handleCreateMirrorPassModal(interaction, eventId) {
    const password = interaction.fields.getTextInputValue('password').trim() || undefined;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const result = await getMirrorService().generateInviteCode(eventId, password);
    if (!result.success || !result.inviteCode) {
        await interaction.editReply({ content: `Γ¥î ${result.message}` });
        return;
    }
    const activity = await getMirrorActivityService().getActivityById(eventId);
    const eventTitle = activity?.title ?? 'Untitled event';
    const hasPass = password ? '≡ƒöÉ Password protected' : '≡ƒöô No password';
    let federationNote = '';
    if (activity && interaction.client) {
        const propagated = await propagateToFederation(interaction.client, activity, eventId, password);
        if (propagated > 0) {
            federationNote = `\n\n≡ƒîÉ **Federation**: Auto-mirrored to **${propagated}** federated server${propagated === 1 ? '' : 's'} with event channels configured.`;
        }
    }
    await interaction.editReply({
        content: `Γ£à Mirror invite code created for **${eventTitle}**:\n\n` +
            `\`\`\`\n${result.inviteCode}\n\`\`\`\n` +
            `${hasPass}\n\n` +
            `Share this code with other servers. They can use the **Post Mirror** button to mirror this event in their channel.${federationNote}`,
    });
}
async function showPostMirrorModal(interaction) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('event_mirror_post_modal').setTitle('Post Mirror');
    const codeInput = new discord_js_1.TextInputBuilder()
        .setCustomId('invite_code')
        .setPlaceholder('e.g. FLEET-A7X3')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);
    const passInput = new discord_js_1.TextInputBuilder()
        .setCustomId('password')
        .setPlaceholder('Leave blank if no password was set')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Invite code').setTextInputComponent(codeInput), new discord_js_1.LabelBuilder().setLabel('Password (if required)').setTextInputComponent(passInput));
    await interaction.showModal(modal);
}
async function handlePostMirrorModal(interaction) {
    const inviteCode = interaction.fields.getTextInputValue('invite_code').trim().toUpperCase();
    const password = interaction.fields.getTextInputValue('password').trim() || undefined;
    if (!inviteCode) {
        await interaction.reply({
            content: 'Γ¥î Invite code is required.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    if (!guildId || !channelId) {
        await interaction.reply({
            content: 'Γ¥î This can only be used in a server channel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const activity = await getMirrorService().findActivityByInviteCode(inviteCode);
    if (!activity) {
        await interaction.editReply({
            content: `Γ¥î No event found for invite code \`${inviteCode}\`. Check the code and try again.`,
        });
        return;
    }
    await executeMirror(interaction, activity.id, password, guildId, channelId);
}
async function executeMirror(interaction, eventId, mirrorKey, targetGuildId, targetChannelId) {
    const guildId = targetGuildId || interaction.guildId;
    const channelId = targetChannelId || interaction.channelId;
    if (!guildId || !channelId) {
        await interaction.reply({
            content: 'Γ¥î Could not determine target server or channel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    const editOrReply = async (content) => {
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content });
        }
        else {
            await interaction.followUp({ content, flags: discord_js_1.MessageFlags.Ephemeral });
        }
    };
    const sourceActivity = await getMirrorActivityService().getActivityById(eventId);
    if (!sourceActivity) {
        await editOrReply(`Γ¥î Activity not found with ID: \`${eventId}\``);
        return;
    }
    if (sourceActivity.metadata?.mirrorKeyHash) {
        if (!mirrorKey) {
            await editOrReply('≡ƒöæ This event requires a password. Use **Post Mirror** and enter the password.');
            return;
        }
        const isValidKey = await getMirrorService().validateMirrorKey(eventId, mirrorKey);
        if (!isValidKey) {
            await editOrReply('Γ¥î Invalid password.');
            return;
        }
    }
    const sourceGuildId = sourceActivity.metadata?.discordServerId;
    if (!sourceGuildId) {
        await editOrReply('Γ¥î This event does not have a Discord server ID. It may have been created via the API.');
        return;
    }
    if (guildId === sourceGuildId) {
        await editOrReply('Γ¥î You cannot mirror an event to its source server.');
        return;
    }
    const targetOrgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
    if (!targetOrgId) {
        await editOrReply('Γ¥î This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.');
        return;
    }
    const mirrorResult = await getMirrorService().createMirror({
        sourceActivityId: eventId,
        sourceGuildId,
        sourceOrganizationId: sourceActivity.organizationId ?? '',
        mirrorGuildId: guildId,
        mirrorChannelId: channelId,
        mirrorKey,
        targetOrganizationId: targetOrgId,
    });
    if (!mirrorResult.success) {
        await editOrReply(`Γ¥î ${mirrorResult.message}`);
        return;
    }
    if (!mirrorResult.mirror) {
        await editOrReply('Γ¥î Mirror creation returned no mirror data.');
        return;
    }
    const mirrorMessageId = await postMirrorEmbed(interaction.client, sourceActivity, mirrorResult.mirror.id, guildId, channelId);
    if (!mirrorMessageId) {
        await editOrReply('Γ¥î Mirror record was created, but posting the mirrored event message failed. Check bot send/embed permissions in the target channel and try again.');
        return;
    }
    await getMirrorService().setMirrorMessageId(mirrorResult.mirror.id, mirrorMessageId);
    const targetGuild = interaction.client.guilds.cache.get(guildId);
    const targetServerName = targetGuild?.name ?? 'this server';
    await editOrReply(`Γ£à Event **${sourceActivity.title}** mirrored to **${targetServerName}** successfully! RSVP changes will sync across servers.`);
}
async function postMirrorEmbed(client, sourceActivity, mirrorId, guildId, channelId) {
    const embed = await (0, mirroredEventMessage_1.buildMirroredEventEmbed)(sourceActivity, mirrorId);
    const components = (0, mirroredEventMessage_1.buildMirroredEventComponents)(sourceActivity.id);
    const targetGuild = client.guilds.cache.get(guildId);
    const targetChannel = targetGuild?.channels.cache.get(channelId);
    if (targetChannel && targetChannel.isTextBased() && 'send' in targetChannel) {
        const msg = await targetChannel.send({ embeds: [embed], components });
        return msg.id;
    }
    return undefined;
}
async function propagateToFederation(client, activity, activityId, mirrorKey) {
    const sourceGuildId = activity.metadata?.discordServerId;
    const sourceOrgId = activity.organizationId;
    if (!sourceGuildId || !sourceOrgId) {
        return 0;
    }
    try {
        const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../data-source')));
        const { FederationMember } = await Promise.resolve().then(() => __importStar(require('../../models/FederationMember')));
        const { DiscordGuildSettings } = await Promise.resolve().then(() => __importStar(require('../../models/DiscordGuildSettings')));
        const memberRepo = AppDataSource.getRepository(FederationMember);
        const settingsRepo = AppDataSource.getRepository(DiscordGuildSettings);
        const sourceMembership = await memberRepo.findOne({
            where: { organizationId: sourceOrgId, status: 'active' },
        });
        if (!sourceMembership) {
            return 0;
        }
        const federationId = sourceMembership.federationId;
        const members = await memberRepo.find({
            where: { federationId, status: 'active' },
        });
        const otherMembers = members.filter(m => m.organizationId !== sourceOrgId);
        if (otherMembers.length === 0) {
            return 0;
        }
        let propagated = 0;
        for (const member of otherMembers) {
            const guildSettings = await settingsRepo.find({
                where: { organizationId: member.organizationId },
            });
            for (const gs of guildSettings) {
                const eventChannelId = gs.eventSettings?.eventAnnouncementChannelId;
                if (!eventChannelId) {
                    continue;
                }
                if (gs.guildId === sourceGuildId) {
                    continue;
                }
                const guild = client.guilds.cache.get(gs.guildId);
                if (!guild) {
                    continue;
                }
                const channel = guild.channels.cache.get(eventChannelId);
                if (!channel || !channel.isTextBased() || !('send' in channel)) {
                    continue;
                }
                const mirrorResult = await getMirrorService().createMirror({
                    sourceActivityId: activityId,
                    sourceGuildId,
                    sourceOrganizationId: sourceOrgId,
                    mirrorGuildId: gs.guildId,
                    mirrorChannelId: eventChannelId,
                    mirrorKey,
                    targetOrganizationId: member.organizationId,
                });
                if (!mirrorResult.success || !mirrorResult.mirror) {
                    continue;
                }
                const msgId = await postMirrorEmbed(client, activity, mirrorResult.mirror.id, gs.guildId, eventChannelId);
                if (!msgId) {
                    continue;
                }
                await getMirrorService().setMirrorMessageId(mirrorResult.mirror.id, msgId);
                propagated++;
            }
        }
        return propagated;
    }
    catch (err) {
        const { logger } = await Promise.resolve().then(() => __importStar(require('../../utils/logger')));
        logger.warn('Federation auto-propagation failed (non-critical)', {
            activityId,
            error: err instanceof Error ? err.message : String(err),
        });
        return 0;
    }
}
//# sourceMappingURL=events.js.map