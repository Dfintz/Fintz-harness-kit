"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeNonDirectAction = executeNonDirectAction;
const discord_js_1 = require("discord.js");
const eventButtons_preJoinChecks_1 = require("./eventButtons.preJoinChecks");
const eventButtons_rsvp_1 = require("./eventButtons.rsvp");
const eventButtons_services_1 = require("./eventButtons.services");
async function executeNonDirectAction({ interaction, action, activityId, userId, userName, isDiscordGuest, guestContext, }) {
    if (action === 'join' || action === 'tentative') {
        const joinCheck = await (0, eventButtons_preJoinChecks_1.preJoinChecks)(interaction, activityId, userId, isDiscordGuest, guestContext);
        if (!joinCheck.allowed) {
            await interaction.followUp({
                content: joinCheck.reason ?? '❌ Unable to join this event right now.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return false;
        }
    }
    if (action in eventButtons_rsvp_1.RSVP_ACTIONS) {
        const guestMeta = isDiscordGuest
            ? { discordGuest: true, discordId: interaction.user.id }
            : undefined;
        await (0, eventButtons_rsvp_1.handleRSVPAction)(activityId, userId, userName, action, guestMeta);
        return true;
    }
    if (action === 'leave') {
        await (0, eventButtons_services_1.getActivityService)().leaveActivity(activityId, userId);
        return true;
    }
    if (action === 'leavecrew') {
        await (0, eventButtons_services_1.getActivityService)().leaveShipCrew(activityId, userId);
        return true;
    }
    if (action === 'leavepassenger') {
        await (0, eventButtons_services_1.getActivityService)().leaveShipAsPassenger(activityId, userId);
        return true;
    }
    return true;
}
//# sourceMappingURL=eventButtons.nonDirectActions.js.map