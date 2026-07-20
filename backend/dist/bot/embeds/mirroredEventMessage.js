"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMirroredEventEmbed = buildMirroredEventEmbed;
exports.buildMirroredEventComponents = buildMirroredEventComponents;
exports.buildSourceEventMessage = buildSourceEventMessage;
const activity_1 = require("../../services/activity");
const eventButtons_1 = require("../interactions/eventButtons");
const eventEmbed_1 = require("./eventEmbed");
let _activityParticipantService = null;
function getActivityParticipantService() {
    _activityParticipantService ??= new activity_1.ActivityParticipantService();
    return _activityParticipantService;
}
async function buildMirroredEventEmbed(activity, mirrorId) {
    const participants = await getActivityParticipantService().getParticipants(activity.id);
    const discordIdMap = await (0, eventButtons_1.resolveDiscordIdMap)((0, eventButtons_1.collectUserIdsForEmbed)(activity, participants));
    const embedData = (0, eventButtons_1.buildEmbedDataFromActivity)(activity, participants, discordIdMap);
    if (!embedData.title.startsWith('Mirrored:')) {
        embedData.title = `Mirrored: ${embedData.title}`;
    }
    const embed = (0, eventEmbed_1.buildEventEmbed)(embedData);
    const footerNotes = [];
    if (mirrorId) {
        footerNotes.push(`Mirror ID: ${mirrorId}`);
    }
    footerNotes.push('RSVP syncs across servers');
    const existingFooter = embed.data.footer?.text?.trim();
    embed.setFooter({
        text: existingFooter
            ? `${existingFooter}  •  ${footerNotes.join('  •  ')}`
            : footerNotes.join('  •  '),
    });
    const inviteCode = activity.metadata?.mirrorInviteCode;
    if (typeof inviteCode === 'string' && inviteCode.trim().length > 0) {
        embed.addFields({
            name: '🎟️ Invite Code',
            value: `\`${inviteCode}\``,
            inline: true,
        });
    }
    return embed;
}
function buildMirroredEventComponents(activityId) {
    return [(0, eventEmbed_1.buildEventButtons)(activityId), (0, eventEmbed_1.buildEventActionsRow)(activityId)];
}
async function buildSourceEventMessage(activity) {
    const participants = await getActivityParticipantService().getParticipants(activity.id);
    const discordIdMap = await (0, eventButtons_1.resolveDiscordIdMap)((0, eventButtons_1.collectUserIdsForEmbed)(activity, participants));
    const embedData = (0, eventButtons_1.buildEmbedDataFromActivity)(activity, participants, discordIdMap);
    const embed = (0, eventEmbed_1.buildEventEmbed)(embedData);
    const status = (activity.status ?? '').toLowerCase();
    const isActive = !['cancelled', 'completed'].includes(status);
    const components = (0, eventEmbed_1.buildEventComponentRows)(activity.id, { includeManage: isActive });
    return { embed, components };
}
//# sourceMappingURL=mirroredEventMessage.js.map