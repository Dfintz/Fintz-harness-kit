"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSVP_ACTIONS = void 0;
exports.handleRSVPAction = handleRSVPAction;
const Activity_1 = require("../../models/Activity");
const errorHandler_1 = require("../../utils/errorHandler");
const eventButtons_services_1 = require("./eventButtons.services");
exports.RSVP_ACTIONS = {
    join: { status: 'accepted', role: Activity_1.ParticipantRole.MEMBER },
    tentative: { status: 'standby', role: Activity_1.ParticipantRole.ANY, postStatus: 'standby' },
    decline: { status: 'declined', role: Activity_1.ParticipantRole.ANY, postStatus: 'declined' },
};
async function handleRSVPAction(activityId, userId, userName, action, metadata) {
    const config = exports.RSVP_ACTIONS[action];
    if (!config) {
        return;
    }
    try {
        await (0, eventButtons_services_1.getActivityService)().updateRSVPStatus(activityId, userId, config.status, action === 'join' ? config.role : undefined);
    }
    catch (err) {
        const msg = (0, errorHandler_1.getErrorMessage)(err).toLowerCase();
        if (msg.includes('not found') || msg.includes('participant')) {
            await (0, eventButtons_services_1.getActivityService)().joinActivity(activityId, {
                userId,
                userName,
                role: config.role,
                metadata,
            });
            if (config.postStatus) {
                await (0, eventButtons_services_1.getActivityService)().updateRSVPStatus(activityId, userId, config.postStatus);
            }
        }
        else {
            throw err;
        }
    }
}
//# sourceMappingURL=eventButtons.rsvp.js.map