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
exports.handleCancelEventPrompt = handleCancelEventPrompt;
exports.handleCancelEventDismiss = handleCancelEventDismiss;
exports.handleCancelEvent = handleCancelEvent;
const discord_js_1 = require("discord.js");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const eventEmbed_1 = require("../embeds/eventEmbed");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const confirmationPrompt_1 = require("../utils/confirmationPrompt");
const eventButtons_embedData_1 = require("./eventButtons.embedData");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_messages_1 = require("./eventButtons.messages");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
async function handleCancelEventPrompt(interaction, activityId) {
    await interaction.reply((0, confirmationPrompt_1.buildConfirmationPrompt)({
        confirmCustomId: `event_confirmcancel_${activityId}`,
        cancelCustomId: `event_canceldismiss_${activityId}`,
        message: 'cancel this event',
        confirmLabel: 'Cancel Event',
        cancelLabel: 'Keep Event',
        confirmEmoji: '🛑',
        cancelEmoji: '↩️',
    }));
}
async function handleCancelEventDismiss(interaction, _activityId) {
    await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
}
async function handleCancelEvent(interaction, activityId) {
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
                content: '❌ Only the event creator can cancel this event.',
            });
            return;
        }
        const status = (activity.status ?? '').toLowerCase();
        if (status === 'cancelled') {
            await interaction.editReply({ content: '⚠️ This event is already cancelled.' });
            return;
        }
        if (status === 'completed') {
            await interaction.editReply({ content: '⚠️ Cannot cancel a completed event.' });
            return;
        }
        const eventService = new (await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityEventService')))).ActivityEventService();
        await eventService.cancelActivity(activityId, internalUserId ?? userId, 'Cancelled via Discord button', activity.organizationId ?? undefined);
        await interaction.editReply({
            content: '🛑 Event has been cancelled.',
        });
        try {
            const channel = interaction.channel;
            const updated = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
            if (updated && channel && 'messages' in channel) {
                const messages = await channel.messages.fetch({ limit: 20 });
                const eventMessage = messages.find(m => m.embeds.length > 0 && m.embeds[0].footer?.text?.includes(`ID: ${activityId}`));
                if (eventMessage) {
                    const participants = await (0, eventButtons_services_1.getParticipantService)().getParticipants(activityId);
                    const discordIdMap = await (0, eventButtons_embedData_1.resolveDiscordIdMap)((0, eventButtons_embedData_1.collectUserIdsForEmbed)(updated, participants));
                    const embedData = (0, eventButtons_embedData_1.buildEmbedDataFromActivity)(updated, participants, discordIdMap);
                    const embed = (0, eventEmbed_1.buildEventEmbed)(embedData);
                    await eventMessage.edit({
                        embeds: [embed],
                        components: [],
                    });
                }
            }
        }
        catch {
        }
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(activityId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_CANCEL',
            message: `User cancelled event via button: ${activityId}`,
            metadata: { activityId, action: 'cancel' },
        });
    }
    catch (error) {
        await interaction.editReply({
            content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
        });
    }
}
//# sourceMappingURL=eventButtons.cancel.js.map