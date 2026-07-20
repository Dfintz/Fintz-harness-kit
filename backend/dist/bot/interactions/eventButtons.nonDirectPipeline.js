"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeferredNonDirectPipeline = runDeferredNonDirectPipeline;
const eventButtons_nonDirectActions_1 = require("./eventButtons.nonDirectActions");
const eventButtons_postActionEffects_1 = require("./eventButtons.postActionEffects");
async function runDeferredNonDirectPipeline({ interaction, action, activityId, userId, userName, isDiscordGuest, guestContext, isEphemeralSource, }) {
    const continuePostActionFlow = await (0, eventButtons_nonDirectActions_1.executeNonDirectAction)({
        interaction,
        action,
        activityId,
        userId,
        userName,
        isDiscordGuest,
        guestContext,
    });
    if (!continuePostActionFlow) {
        return;
    }
    await (0, eventButtons_postActionEffects_1.runPostActionEffects)({
        interaction,
        action,
        activityId,
        userId,
        userName,
        isDiscordGuest,
        isEphemeralSource,
    });
}
//# sourceMappingURL=eventButtons.nonDirectPipeline.js.map