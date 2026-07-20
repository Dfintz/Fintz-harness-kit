"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEditEventModal = handleEditEventModal;
exports.handleEditEvent = handleEditEvent;
const discord_js_1 = require("discord.js");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const eventEmbed_1 = require("../embeds/eventEmbed");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const eventButtons_embedData_1 = require("./eventButtons.embedData");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_messages_1 = require("./eventButtons.messages");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const eventEditWizard_1 = require("./eventEditWizard");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
async function handleEditEvent(interaction, activityId) {
    const userId = interaction.user.id;
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.reply({
                content: MSG_ACTIVITY_NOT_FOUND,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(userId);
        if (activity.creatorId !== internalUserId && activity.creatorId !== userId) {
            await interaction.reply({
                content: '❌ Only the event creator can edit this event.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const status = (activity.status ?? '').toLowerCase();
        if (status === 'cancelled' || status === 'completed') {
            await interaction.reply({
                content: `⚠️ Cannot edit a ${status} event.`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await (0, eventEditWizard_1.launchEventEditWizard)(interaction, activityId);
    }
    catch (error) {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else {
            await interaction.reply({
                content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
}
async function handleEditEventModal(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const userName = interaction.user.username;
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(userId);
        if (activity.creatorId !== internalUserId && activity.creatorId !== userId) {
            await interaction.editReply({
                content: '❌ Only the event creator can edit this event.',
            });
            return;
        }
        const payload = buildEditUpdates(interaction);
        if (payload.error) {
            await interaction.editReply({ content: payload.error });
            return;
        }
        const updates = payload.updates;
        await (0, eventButtons_services_1.getActivityService)().updateActivity(activityId, updates);
        await interaction.editReply({ content: '✅ Event updated successfully.' });
        await refreshEditedEventMessage(interaction, activityId);
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(activityId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_EDIT',
            message: `User edited event via button: ${activityId}`,
            metadata: { activityId, action: 'edit', updates },
        });
    }
    catch (error) {
        await interaction.editReply({
            content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
        });
    }
}
function buildEditUpdates(interaction) {
    const title = interaction.fields.getTextInputValue('edit_title').trim();
    if (!title) {
        return {
            updates: {},
            error: '❌ Title is required.',
        };
    }
    const updates = {
        title,
        description: interaction.fields.getTextInputValue('edit_description').trim() || null,
        location: interaction.fields.getTextInputValue('edit_location').trim() || null,
    };
    const maxParticipantsRaw = interaction.fields.getTextInputValue('edit_max_participants').trim();
    if (maxParticipantsRaw) {
        const max = Number.parseInt(maxParticipantsRaw, 10);
        if (Number.isNaN(max) || max < 1 || max > 100) {
            return {
                updates: {},
                error: '❌ Max participants must be between 1 and 100.',
            };
        }
        updates.maxParticipants = max;
    }
    else {
        updates.maxParticipants = null;
    }
    const startDateRaw = interaction.fields.getTextInputValue('edit_start_date').trim();
    if (startDateRaw) {
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(startDateRaw)
            ? `${startDateRaw.replace(' ', 'T')}:00Z`
            : startDateRaw;
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            return {
                updates: {},
                error: '❌ Invalid date. Use format `YYYY-MM-DD HH:mm` in UTC.',
            };
        }
        updates.scheduledStartDate = parsed;
    }
    return { updates };
}
async function refreshEditedEventMessage(interaction, activityId) {
    try {
        const updated = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!updated || !interaction.message) {
            return;
        }
        const participants = await (0, eventButtons_services_1.getParticipantService)().getParticipants(activityId);
        const discordIdMap = await (0, eventButtons_embedData_1.resolveDiscordIdMap)((0, eventButtons_embedData_1.collectUserIdsForEmbed)(updated, participants));
        const embedData = (0, eventButtons_embedData_1.buildEmbedDataFromActivity)(updated, participants, discordIdMap);
        const embed = (0, eventEmbed_1.buildEventEmbed)(embedData);
        const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
        const components = (0, eventEmbed_1.buildEventComponentRows)(activityId, { includeManage: isActive });
        await interaction.message.edit({ embeds: [embed], components });
    }
    catch {
    }
}
//# sourceMappingURL=eventButtons.edit.js.map