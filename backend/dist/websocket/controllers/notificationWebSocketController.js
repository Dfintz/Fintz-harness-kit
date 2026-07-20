"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendErrorNotification = exports.sendWarningNotification = exports.sendTradingNotification = exports.sendActivityNotification = exports.sendFleetNotification = exports.sendOrganizationNotification = exports.sendUserNotification = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const sendUserNotification = (userId, notification) => {
    const fullNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false
    };
    const event = {
        type: 'notification:new',
        notification: fullNotification,
        userId
    };
    (0, websocketServer_1.emitToUser)(userId, 'notification:new', event);
    logger_1.logger.debug(`Sent notification to user ${userId}: ${notification.title}`);
};
exports.sendUserNotification = sendUserNotification;
const sendOrganizationNotification = (organizationId, notification) => {
    const fullNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false
    };
    const event = {
        type: 'notification:new',
        notification: fullNotification,
        organizationId
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'notification:new', event);
    logger_1.logger.debug(`Sent notification to org ${organizationId}: ${notification.title}`);
};
exports.sendOrganizationNotification = sendOrganizationNotification;
const sendFleetNotification = (organizationId, title, message, data) => {
    (0, exports.sendOrganizationNotification)(organizationId, {
        type: 'info',
        title,
        message,
        category: 'fleet',
        data
    });
};
exports.sendFleetNotification = sendFleetNotification;
const sendActivityNotification = (organizationId, title, message, data) => {
    (0, exports.sendOrganizationNotification)(organizationId, {
        type: 'info',
        title,
        message,
        category: 'activity',
        data
    });
};
exports.sendActivityNotification = sendActivityNotification;
const sendTradingNotification = (userId, title, message, data) => {
    (0, exports.sendUserNotification)(userId, {
        type: 'info',
        title,
        message,
        category: 'trading',
        data
    });
};
exports.sendTradingNotification = sendTradingNotification;
const sendWarningNotification = (userId, title, message, data) => {
    (0, exports.sendUserNotification)(userId, {
        type: 'warning',
        title,
        message,
        category: 'system',
        data
    });
};
exports.sendWarningNotification = sendWarningNotification;
const sendErrorNotification = (userId, title, message, data) => {
    (0, exports.sendUserNotification)(userId, {
        type: 'error',
        title,
        message,
        category: 'system',
        data
    });
};
exports.sendErrorNotification = sendErrorNotification;
//# sourceMappingURL=notificationWebSocketController.js.map