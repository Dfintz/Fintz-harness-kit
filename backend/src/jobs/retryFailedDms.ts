/**
 * Failed DM retry job.
 *
 * Periodically processes the `failed_dm_deliveries` retry queue by delegating to
 * `DmNotificationService.retryFailedDms()`. The service handles all per-row
 * decisions (retry vs. reschedule vs. drop vs. expire); this job is a thin timer
 * shell that survives restarts via the unref'd interval pattern used by other
 * lightweight timer jobs (e.g. `sessionCleanup`, `jwtBlacklistCleanup`).
 *
 * Must be started in the bot process — the underlying retry requires a
 * connected Discord client. If the client isn't initialized when a tick fires,
 * the service short-circuits and the row stays in the queue.
 */

import { DmNotificationService } from '../services/discord/DmNotificationService';
import { logger } from '../utils/logger';

/** Run every 5 minutes — matches the shortest backoff bucket. */
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

async function runRetryPass(): Promise<void> {
  try {
    await DmNotificationService.getInstance().retryFailedDms();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed DM retry job tick failed: ${msg}`);
  }
}

/**
 * Start the failed DM retry job. Returns the underlying interval handle so the
 * caller can clear it on shutdown.
 *
 * The interval is `unref()`'d so it does not keep the event loop alive on its
 * own; bot process lifetime is owned by the Discord client.
 */
export const startFailedDmRetryJob = (): NodeJS.Timeout => {
  // Kick off immediately so a freshly-restarted bot processes any backlog.
  void runRetryPass();
  const interval = setInterval(() => {
    void runRetryPass();
  }, RETRY_INTERVAL_MS);
  interval.unref();
  return interval;
};
