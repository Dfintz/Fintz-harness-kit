"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSessionCleanupJob = void 0;
const authentication_1 = require("../services/authentication");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const authService = new authentication_1.AuthenticationService();
const startSessionCleanupJob = () => {
    logger_1.logger.info('Starting session cleanup job (runs every hour)');
    void cleanupSessions();
    const interval = setInterval(() => {
        void cleanupSessions();
    }, 60 * 60 * 1000);
    interval.unref();
    return interval;
};
exports.startSessionCleanupJob = startSessionCleanupJob;
async function cleanupSessions() {
    try {
        const cleaned = await authService.cleanupExpiredSessions();
        if (cleaned > 0) {
            logger_1.logger.info('Session cleanup job completed', { cleanedCount: cleaned });
        }
        const stats = await authService.getStats();
        logger_1.logger.debug('Authentication service statistics', stats);
    }
    catch (error) {
        logger_1.logger.error('Session cleanup job failed', {
            error: (0, errorHandler_1.getErrorMessage)(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}
//# sourceMappingURL=sessionCleanup.js.map