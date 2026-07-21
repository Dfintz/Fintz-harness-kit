import { AuthenticationService } from '../services/authentication';

import { logger } from './logger';

/**
 * Start scheduled cleanup job for expired refresh tokens
 * Runs every 24 hours by default
 */
export function startRefreshTokenCleanup(intervalHours: number = 24): NodeJS.Timeout {
    const authService = new AuthenticationService();
    const intervalMs = intervalHours * 60 * 60 * 1000;

    logger.info(`🧹 Starting refresh token cleanup job (runs every ${intervalHours} hours)`);

    const interval = setInterval(async () => {
        try {
            const count = await authService.cleanupExpiredTokens();
            
            if (count > 0) {
                logger.info(`🧹 Cleaned up ${count} expired refresh token(s)`);
            }
        } catch (error) {
            logger.error('Error during refresh token cleanup:', error);
        }
    }, intervalMs);

    return interval;
}
