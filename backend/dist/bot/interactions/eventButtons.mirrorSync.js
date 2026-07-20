"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerMirrorSync = triggerMirrorSync;
const auditLogger_1 = require("../../utils/auditLogger");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const eventButtons_services_1 = require("./eventButtons.services");
const MIRROR_SYNC_ACTIONS = new Set(['join', 'tentative', 'decline', 'leave']);
function triggerMirrorSync(activityId, userId, userName, action) {
    if (!MIRROR_SYNC_ACTIONS.has(action)) {
        return;
    }
    (0, eventButtons_services_1.getActivityService)()
        .getActivityById(activityId)
        .then(activity => (0, mirrorSyncPublisher_1.publishMirrorSync)({
        activityId,
        userId,
        action: action,
        currentParticipants: activity?.currentParticipants ?? 0,
        maxParticipants: activity?.maxParticipants ?? undefined,
    }))
        .catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `mirror-sync/${activityId}`,
            action: 'MIRROR_SYNC_FAILED',
            message: `Mirror sync failed: ${errorMsg}`,
            metadata: { activityId, action },
        });
    });
}
//# sourceMappingURL=eventButtons.mirrorSync.js.map