"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startFailedDmRetryJob = void 0;
const DmNotificationService_1 = require("../services/discord/DmNotificationService");
const logger_1 = require("../utils/logger");
const RETRY_INTERVAL_MS = 5 * 60 * 1000;
async function runRetryPass() {
    try {
        await DmNotificationService_1.DmNotificationService.getInstance().retryFailedDms();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger_1.logger.error(`Failed DM retry job tick failed: ${msg}`);
    }
}
const startFailedDmRetryJob = () => {
    void runRetryPass();
    const interval = setInterval(() => {
        void runRetryPass();
    }, RETRY_INTERVAL_MS);
    interval.unref();
    return interval;
};
exports.startFailedDmRetryJob = startFailedDmRetryJob;
//# sourceMappingURL=retryFailedDms.js.map