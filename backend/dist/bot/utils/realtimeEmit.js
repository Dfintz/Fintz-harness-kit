"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitRealtimeToOrg = emitRealtimeToOrg;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
function emitRealtimeToOrg(organizationId, event, payload) {
    try {
        (0, websocketServer_1.emitToOrganization)(organizationId, event, {
            ...payload,
            source: 'discord-bot',
            emittedAt: new Date().toISOString(),
        });
    }
    catch (err) {
        logger_1.logger.warn('Failed to emit realtime event to organization', {
            organizationId,
            event,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
//# sourceMappingURL=realtimeEmit.js.map