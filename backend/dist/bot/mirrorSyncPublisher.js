"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIRROR_RSVP_SYNC_ACTION = void 0;
exports.publishMirrorSync = publishMirrorSync;
exports.publishMirrorRefresh = publishMirrorRefresh;
const logger_1 = require("../utils/logger");
const BotIPCService_1 = require("./BotIPCService");
exports.MIRROR_RSVP_SYNC_ACTION = 'mirror:rsvp:sync';
async function publishMirrorSync(payload) {
    const ipcService = BotIPCService_1.BotIPCService.getInstance();
    if (!ipcService.isAvailable()) {
        logger_1.logger.debug('MirrorSync: IPC not available, skipping sync');
        return;
    }
    await ipcService.request(exports.MIRROR_RSVP_SYNC_ACTION, payload);
}
function publishMirrorRefresh(activityId, userId = 'system') {
    publishMirrorSync({
        activityId,
        userId,
        action: 'refresh',
        currentParticipants: 0,
    }).catch(err => {
        logger_1.logger.debug('MirrorSync: refresh publish failed (non-critical)', {
            activityId,
            error: err instanceof Error ? err.message : String(err),
        });
    });
}
//# sourceMappingURL=mirrorSyncPublisher.js.map