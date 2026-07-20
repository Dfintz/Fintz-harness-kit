"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitLfgSessionCancelled = exports.emitLfgSessionUpdated = exports.emitLfgMemberLeft = exports.emitLfgMemberJoined = exports.emitLfgSessionCreated = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const emitLfgSessionCreated = (organizationId, sessionId, userId) => {
    const event = {
        type: 'lfg:session-created',
        organizationId,
        sessionId,
        userId,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'lfg:session-created', event);
    logger_1.logger.debug(`Emitted lfg:session-created for session ${sessionId} in org ${organizationId}`);
};
exports.emitLfgSessionCreated = emitLfgSessionCreated;
const emitLfgMemberJoined = (organizationId, sessionId, userId) => {
    const event = {
        type: 'lfg:member-joined',
        organizationId,
        sessionId,
        userId,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'lfg:member-joined', event);
    logger_1.logger.debug(`Emitted lfg:member-joined for session ${sessionId} in org ${organizationId}`);
};
exports.emitLfgMemberJoined = emitLfgMemberJoined;
const emitLfgMemberLeft = (organizationId, sessionId, userId) => {
    const event = {
        type: 'lfg:member-left',
        organizationId,
        sessionId,
        userId,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'lfg:member-left', event);
    logger_1.logger.debug(`Emitted lfg:member-left for session ${sessionId} in org ${organizationId}`);
};
exports.emitLfgMemberLeft = emitLfgMemberLeft;
const emitLfgSessionUpdated = (organizationId, sessionId, userId) => {
    const event = {
        type: 'lfg:session-updated',
        organizationId,
        sessionId,
        userId,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'lfg:session-updated', event);
    logger_1.logger.debug(`Emitted lfg:session-updated for session ${sessionId} in org ${organizationId}`);
};
exports.emitLfgSessionUpdated = emitLfgSessionUpdated;
const emitLfgSessionCancelled = (organizationId, sessionId, userId) => {
    const event = {
        type: 'lfg:session-cancelled',
        organizationId,
        sessionId,
        userId,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'lfg:session-cancelled', event);
    logger_1.logger.debug(`Emitted lfg:session-cancelled for session ${sessionId} in org ${organizationId}`);
};
exports.emitLfgSessionCancelled = emitLfgSessionCancelled;
//# sourceMappingURL=lfgWebSocketController.js.map