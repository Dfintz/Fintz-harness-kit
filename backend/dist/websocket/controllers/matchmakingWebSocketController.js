"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMatchQualityUpdate = exports.notifySessionFilled = exports.notifyMatchesUpdated = exports.sendMatchSuggestion = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const sendMatchSuggestion = (userId, matches) => {
    const event = {
        type: 'matchmaking:suggestion',
        userId,
        data: {
            matches: matches.slice(0, 5),
            totalMatches: matches.length
        },
        timestamp: Date.now()
    };
    (0, websocketServer_1.emitToUser)(userId, 'matchmaking:suggestion', event);
    logger_1.logger.debug(`Sent match suggestions to user ${userId}: ${matches.length} matches`);
};
exports.sendMatchSuggestion = sendMatchSuggestion;
const notifyMatchesUpdated = (userId, count) => {
    const event = {
        type: 'matchmaking:updated',
        userId,
        data: {
            newMatchCount: count,
            message: `${count} new matches found for you!`
        },
        timestamp: Date.now()
    };
    (0, websocketServer_1.emitToUser)(userId, 'matchmaking:updated', event);
    logger_1.logger.debug(`Notified user ${userId} of ${count} updated matches`);
};
exports.notifyMatchesUpdated = notifyMatchesUpdated;
const notifySessionFilled = (userIds, sessionId, activityType) => {
    userIds.forEach(userId => {
        const event = {
            type: 'matchmaking:session_filled',
            userId,
            data: {
                sessionId,
                activityType,
                message: 'A session you were interested in has filled up'
            },
            timestamp: Date.now()
        };
        (0, websocketServer_1.emitToUser)(userId, 'matchmaking:session_filled', event);
    });
    logger_1.logger.debug(`Notified ${userIds.length} users about filled session ${sessionId}`);
};
exports.notifySessionFilled = notifySessionFilled;
const sendMatchQualityUpdate = (userId, sessionId, quality) => {
    (0, websocketServer_1.emitToUser)(userId, 'matchmaking:quality_update', {
        sessionId,
        quality,
        timestamp: Date.now()
    });
    logger_1.logger.debug(`Sent match quality update to user ${userId} for session ${sessionId}`);
};
exports.sendMatchQualityUpdate = sendMatchQualityUpdate;
//# sourceMappingURL=matchmakingWebSocketController.js.map