import { AuthenticationService } from '../services/authentication';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const authService = new AuthenticationService();

/**
 * Cleanup expired JWT tokens from blacklist every 6 hours
 * Removes tokens that have naturally expired and no longer need tracking
 *
 * UPDATED: Phase 3.1 - Now uses unified AuthenticationService
 */
export const startJwtBlacklistCleanupJob = (): void => {
  logger.info('Starting JWT blacklist cleanup job (runs every 6 hours)');

  // Run immediately on startup
  void cleanupBlacklist();

  // Then run every 6 hours
  setInterval(
    () => {
      void cleanupBlacklist();
    },
    6 * 60 * 60 * 1000
  ).unref(); // 6 hours
};

/**
 * Execute cleanup and log results
 */
async function cleanupBlacklist(): Promise<void> {
  try {
    const cleaned = await authService.cleanupExpiredBlacklist();

    if (cleaned > 0) {
      logger.info('JWT blacklist cleanup completed', { cleanedCount: cleaned });
    }

    // Log statistics
    const stats = await authService.getStats();
    logger.debug('Authentication service statistics', stats);

    // Alert if blacklist is growing too large
    if (stats.blacklistedTokens > 100000) {
      logger.warn('JWT blacklist size exceeds threshold', {
        activeCount: stats.blacklistedTokens,
        threshold: 100000,
      });
    }
  } catch (error: unknown) {
    logger.error('JWT blacklist cleanup job failed', {
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
