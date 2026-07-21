import { AuthenticationService } from '../services/authentication';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const authService = new AuthenticationService();

/**
 * Cleanup expired sessions every hour
 * Removes sessions that have exceeded absolute or idle timeout
 *
 * UPDATED: Phase 3.1 - Now uses unified AuthenticationService
 */
export const startSessionCleanupJob = (): NodeJS.Timeout => {
  logger.info('Starting session cleanup job (runs every hour)');

  // Run immediately on startup
  void cleanupSessions();

  // Then run every hour
  const interval = setInterval(
    () => {
      void cleanupSessions();
    },
    60 * 60 * 1000
  ); // 1 hour
  interval.unref();
  return interval;
};

/**
 * Execute cleanup and log results
 */
async function cleanupSessions(): Promise<void> {
  try {
    const cleaned = await authService.cleanupExpiredSessions();

    if (cleaned > 0) {
      logger.info('Session cleanup job completed', { cleanedCount: cleaned });
    }

    // Log statistics
    const stats = await authService.getStats();
    logger.debug('Authentication service statistics', stats);
  } catch (error: unknown) {
    logger.error('Session cleanup job failed', {
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
