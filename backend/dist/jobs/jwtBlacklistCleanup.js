"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJwtBlacklistCleanupJob = void 0;
const authentication_1 = require("../services/authentication");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const authService = new authentication_1.AuthenticationService();
const startJwtBlacklistCleanupJob = () => {
    logger_1.logger.info('Starting JWT blacklist cleanup job (runs every 6 hours)');
    void cleanupBlacklist();
    setInterval(() => {
        void cleanupBlacklist();
    }, 6 * 60 * 60 * 1000).unref();
};
exports.startJwtBlacklistCleanupJob = startJwtBlacklistCleanupJob;
async function cleanupBlacklist() {
    try {
        const cleaned = await authService.cleanupExpiredBlacklist();
        if (cleaned > 0) {
            logger_1.logger.info('JWT blacklist cleanup completed', { cleanedCount: cleaned });
        }
        const stats = await authService.getStats();
        logger_1.logger.debug('Authentication service statistics', stats);
        if (stats.blacklistedTokens > 100000) {
            logger_1.logger.warn('JWT blacklist size exceeds threshold', {
                activeCount: stats.blacklistedTokens,
                threshold: 100000,
            });
        }
    }
    catch (error) {
        logger_1.logger.error('JWT blacklist cleanup job failed', {
            error: (0, errorHandler_1.getErrorMessage)(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
}
//# sourceMappingURL=jwtBlacklistCleanup.js.map