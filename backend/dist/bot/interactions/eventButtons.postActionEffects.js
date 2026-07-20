"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPostActionEffects = runPostActionEffects;
const auditLogger_1 = require("../../utils/auditLogger");
const eventButtons_directActions_1 = require("./eventButtons.directActions");
const eventButtons_mirrorSync_1 = require("./eventButtons.mirrorSync");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_tempRoles_1 = require("./eventButtons.tempRoles");
async function runPostActionEffects({ interaction, action, activityId, userId, userName, isDiscordGuest, isEphemeralSource, }) {
    if (!isDiscordGuest) {
        (0, eventButtons_tempRoles_1.handleTempRoleUpdate)(interaction, activityId, userId, action);
    }
    if (isEphemeralSource) {
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        await interaction.editReply({
            content: (0, eventButtons_directActions_1.getEphemeralLeaveConfirmation)(action),
            components: [],
        });
    }
    else {
        await (0, eventButtons_refresh_1.refreshEventEmbed)(interaction, activityId);
    }
    (0, eventButtons_mirrorSync_1.triggerMirrorSync)(activityId, userId, userName, action);
    (0, auditLogger_1.logAuditEvent)({
        eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
        userId,
        username: userName,
        resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
        action: `EVENT_${action.toUpperCase()}`,
        message: `User ${action} event via button: ${activityId}`,
        metadata: { activityId, action, isDiscordGuest },
    });
}
//# sourceMappingURL=eventButtons.postActionEffects.js.map