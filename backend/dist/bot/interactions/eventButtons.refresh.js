"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshEventEmbed = refreshEventEmbed;
exports.refreshEventEmbedFromChannel = refreshEventEmbedFromChannel;
const discord_js_1 = require("discord.js");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const eventEmbed_1 = require("../embeds/eventEmbed");
const mirroredEventMessage_1 = require("../embeds/mirroredEventMessage");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const eventButtons_embedData_1 = require("./eventButtons.embedData");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
const MIRROR_ID_MARKER = 'Mirror ID:';
function hasActivityFooter(footer, activityId) {
    return Boolean(footer?.includes(`ID: ${activityId}`));
}
function extractMirrorId(footer) {
    if (!footer) {
        return undefined;
    }
    const match = /Mirror ID:\s*([^•\s]+)/.exec(footer);
    return match?.[1];
}
async function refreshEventEmbed(interaction, activityId) {
    const updated = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
    if (!updated) {
        await interaction.followUp({
            content: MSG_ACTIVITY_NOT_FOUND,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const participants = await (0, eventButtons_services_1.getParticipantService)().getParticipants(activityId);
    const discordIdMap = await (0, eventButtons_embedData_1.resolveDiscordIdMap)((0, eventButtons_embedData_1.collectUserIdsForEmbed)(updated, participants));
    const embedData = (0, eventButtons_embedData_1.buildEmbedDataFromActivity)(updated, participants, discordIdMap);
    const embed = (0, eventEmbed_1.buildEventEmbed)(embedData);
    const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
    const components = (0, eventEmbed_1.buildEventComponentRows)(activityId, { includeManage: isActive });
    await interaction.editReply({
        embeds: [embed],
        components,
    });
    (0, mirrorSyncPublisher_1.publishMirrorRefresh)(activityId);
}
async function refreshEventEmbedFromChannel(interaction, activityId) {
    try {
        if (!interaction.channel || !('messages' in interaction.channel)) {
            return;
        }
        const currentMessage = 'message' in interaction && interaction.message?.embeds?.length
            ? interaction.message
            : undefined;
        const eventMessage = hasActivityFooter(currentMessage?.embeds[0]?.footer?.text, activityId)
            ? currentMessage
            : (await interaction.channel.messages.fetch({ limit: 20 })).find(m => hasActivityFooter(m.embeds[0]?.footer?.text, activityId));
        if (!eventMessage) {
            return;
        }
        const updated = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!updated) {
            return;
        }
        const footerText = eventMessage.embeds[0]?.footer?.text;
        const isMirrorMessage = footerText?.includes(MIRROR_ID_MARKER) ?? false;
        if (isMirrorMessage) {
            const mirrorId = extractMirrorId(footerText);
            const embed = await (0, mirroredEventMessage_1.buildMirroredEventEmbed)(updated, mirrorId);
            const components = (0, mirroredEventMessage_1.buildMirroredEventComponents)(activityId);
            await eventMessage.edit({
                embeds: [embed],
                components,
            });
        }
        else {
            const participants = await (0, eventButtons_services_1.getParticipantService)().getParticipants(activityId);
            const discordIdMap = await (0, eventButtons_embedData_1.resolveDiscordIdMap)((0, eventButtons_embedData_1.collectUserIdsForEmbed)(updated, participants));
            const embedData = (0, eventButtons_embedData_1.buildEmbedDataFromActivity)(updated, participants, discordIdMap);
            const embed = (0, eventEmbed_1.buildEventEmbed)(embedData);
            const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
            const components = (0, eventEmbed_1.buildEventComponentRows)(activityId, { includeManage: isActive });
            await eventMessage.edit({
                embeds: [embed],
                components,
            });
        }
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(activityId);
    }
    catch (err) {
        logger_1.logger.warn('Failed to refresh event embed from channel', {
            activityId,
            error: (0, errorHandler_1.getErrorMessage)(err),
        });
    }
}
//# sourceMappingURL=eventButtons.refresh.js.map