/**
 * Discord Reconciliation Job
 *
 * Periodically runs the DiscordReconciliationService to detect and correct
 * drift between Discord guild roles and platform organization memberships.
 *
 * Checks every 5 minutes whether any guild is due for reconciliation based
 * on its roleSyncSettings.syncIntervalMinutes (default: 60 minutes). The
 * actual per-guild interval is respected — this job is just a lightweight
 * poll loop.
 *
 * Must be started in the bot process — the service requires a connected
 * Discord client. If the client isn't ready when a tick fires, the pass
 * is silently skipped.
 */

import { DiscordReconciliationService } from '../services/discord/DiscordReconciliationService';
import { logger } from '../utils/logger';

/** How often this job checks for guilds that are due (5 minutes). */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runReconciliationPass(): Promise<void> {
  try {
    const result = await DiscordReconciliationService.getInstance().runPass();
    if (result.guildsProcessed > 0) {
      logger.info(
        `Discord reconciliation pass: ${result.guildsProcessed} guild(s), ` +
          `${result.totalRolesAssigned} assigned, ${result.totalRolesRemoved} removed, ` +
          `${result.totalErrors} error(s) in ${result.durationMs}ms`
      );
    }
  } catch (err: unknown) {
    logger.error('Discord reconciliation job tick failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Start the Discord reconciliation job. Returns the underlying interval
 * handle so the caller can clear it on shutdown.
 *
 * The interval is `unref()`'d so it does not keep the event loop alive
 * on its own; bot process lifetime is owned by the Discord client.
 */
export const startDiscordReconciliationJob = (): NodeJS.Timeout => {
  logger.info(
    `Starting Discord reconciliation job (check interval: ${CHECK_INTERVAL_MS / 60_000} min)`
  );

  // Don't run immediately on startup — give the bot time to populate caches
  // and process any pending event-driven syncs first.
  const interval = setInterval(() => {
    void runReconciliationPass();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  return interval;
};
