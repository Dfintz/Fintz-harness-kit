"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRefreshTokenCleanup = startRefreshTokenCleanup;
const authentication_1 = require("../services/authentication");
const logger_1 = require("./logger");
function startRefreshTokenCleanup(intervalHours = 24) {
    const authService = new authentication_1.AuthenticationService();
    const intervalMs = intervalHours * 60 * 60 * 1000;
    logger_1.logger.info(`🧹 Starting refresh token cleanup job (runs every ${intervalHours} hours)`);
    const interval = setInterval(async () => {
        try {
            const count = await authService.cleanupExpiredTokens();
            if (count > 0) {
                logger_1.logger.info(`🧹 Cleaned up ${count} expired refresh token(s)`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error during refresh token cleanup:', error);
        }
    }, intervalMs);
    return interval;
}
//# sourceMappingURL=cleanupJobs.js.map