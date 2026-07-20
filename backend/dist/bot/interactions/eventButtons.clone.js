"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLONE_SCHEDULE_SHIFT_MS = void 0;
exports.handleCloneEvent = handleCloneEvent;
const discord_js_1 = require("discord.js");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const eventEmbed_1 = require("../embeds/eventEmbed");
const eventButtons_embedData_1 = require("./eventButtons.embedData");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_messages_1 = require("./eventButtons.messages");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
const CLONE_SCHEDULE_SHIFT_MS = 7 * 24 * 60 * 60 * 1000;
exports.CLONE_SCHEDULE_SHIFT_MS = CLONE_SCHEDULE_SHIFT_MS;
async function handleCloneEvent(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const original = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!original) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (original.creatorId !== internalUserId && original.creatorId !== interaction.user.id) {
            await interaction.editReply({
                content: '❌ Only the event creator can clone this event.',
            });
            return;
        }
        const overrides = {};
        if (original.scheduledStartDate) {
            overrides.scheduledStartDate = new Date(new Date(original.scheduledStartDate).getTime() + CLONE_SCHEDULE_SHIFT_MS);
        }
        if (original.scheduledEndDate) {
            overrides.scheduledEndDate = new Date(new Date(original.scheduledEndDate).getTime() + CLONE_SCHEDULE_SHIFT_MS);
        }
        const cloned = await (0, eventButtons_services_1.getActivityService)().cloneActivity(activityId, overrides);
        const channel = interaction.channel;
        if (channel && channel.isTextBased() && 'send' in channel) {
            const embed = (0, eventEmbed_1.buildEventEmbed)((0, eventButtons_embedData_1.buildEmbedDataFromActivity)(cloned, [], new Map()));
            const components = (0, eventEmbed_1.buildEventComponentRows)(cloned.id, { includeManage: true });
            await channel.send({ embeds: [embed], components });
        }
        const whenLine = cloned.scheduledStartDate
            ? ` scheduled for <t:${Math.floor(new Date(cloned.scheduledStartDate).getTime() / 1000)}:F>`
            : ' with no date set yet';
        await interaction.editReply({
            content: `✅ Cloned **${original.title}** into a new draft${whenLine}.\n` +
                'Sign-ups start empty — use the **Edit Event** button on the new post to adjust details.',
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: internalUserId ?? interaction.user.id,
            username: interaction.user.username,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_CLONE',
            message: `User cloned event ${activityId} → ${cloned.id}`,
            metadata: { sourceActivityId: activityId, clonedActivityId: cloned.id },
        });
    }
    catch (error) {
        await interaction.editReply({
            content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
        });
    }
}
//# sourceMappingURL=eventButtons.clone.js.map