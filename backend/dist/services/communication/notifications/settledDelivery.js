"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDeliveredNotifications = collectDeliveredNotifications;
const logger_1 = require("../../../utils/logger");
function collectDeliveredNotifications(results, recipientIds, label) {
    const delivered = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
            delivered.push(result.value);
            return;
        }
        const error = result.status === 'fulfilled'
            ? (result.value.error ?? 'Notification service reported failure')
            : result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);
        logger_1.logger.warn(`Failed to send ${label} notification`, {
            userId: recipientIds[index],
            error,
        });
    });
    return delivered;
}
//# sourceMappingURL=settledDelivery.js.map