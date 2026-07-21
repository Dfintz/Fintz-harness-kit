/**
 * BullMQ Worker Job Registration
 *
 * Registers all background jobs as BullMQ repeatable schedules + workers.
 * Replaces the `setInterval`/`node-cron` patterns in worker.ts.
 *
 * Each job's existing `.execute()` method is wrapped in a BullMQ worker processor.
 * The original job classes are reused — only the scheduling layer changes.
 *
 * Benefits over setInterval:
 * - Automatic retry with exponential backoff on failure
 * - Dead letter queue for debugging persistent failures
 * - Job completion/failure visibility via Bull Board
 * - Proper graceful shutdown (no orphaned intervals)
 * - Repeatable schedules survive process restart (stored in Redis)
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — P8
 */

import { logger } from '../../utils/logger';

import { addRepeatableJob, createWorker, QueueName, shutdownQueues } from './JobQueue';

/**
 * Register all background jobs as BullMQ workers + repeatable schedules.
 * Call once during worker process startup (worker.ts).
 */
export async function registerBullMQJobs(): Promise<void> {
  logger.info('[BullMQ] Registering job workers and schedules...');

  // Ensure each worker is created before scheduling jobs. This keeps startup
  // deterministic and surfaces Redis/Entra auth failures immediately.

  // ==================== GDPR EXPORT PROCESSING ====================
  // Every 5 minutes — processes pending export requests
  await createWorker(QueueName.GDPR_EXPORT, async () => {
    const { GdprExportProcessingJob } = await import('../../jobs/gdprExportProcessing.js');
    const job = new GdprExportProcessingJob();
    await job.execute();
  });
  await addRepeatableJob(QueueName.GDPR_EXPORT, 'process-exports', '*/5 * * * *');

  // ==================== GDPR DATA CLEANUP ====================
  // Daily 3 AM UTC — deletes expired personal data (production only)
  if (process.env.NODE_ENV === 'production') {
    await createWorker(QueueName.GDPR_CLEANUP, async () => {
      const { GdprDataCleanupJob } = await import('../../jobs/gdprDataCleanup.js');
      const job = new GdprDataCleanupJob();
      await job.execute();
    });
    await addRepeatableJob(QueueName.GDPR_CLEANUP, 'cleanup-pii', '0 3 * * *');
  }

  // ==================== ORG DELETION PROCESSOR ====================
  // Every 1 hour — processes confirmed org deletion requests
  await createWorker(QueueName.ORG_DELETION, async () => {
    const { OrganizationDeletionProcessorJob } =
      await import('../../jobs/organizationDeletionProcessor.js');
    const job = new OrganizationDeletionProcessorJob();
    await job.execute();
  });
  await addRepeatableJob(QueueName.ORG_DELETION, 'process-deletions', '0 * * * *');

  // ==================== ORG DELETION REMINDERS ====================
  // Daily 9 AM UTC — sends reminders for pending deletions
  await createWorker(QueueName.ORG_DELETION_REMINDER, async () => {
    const { OrganizationDeletionReminderJob } =
      await import('../../jobs/organizationDeletionReminderJob.js');
    const job = new OrganizationDeletionReminderJob();
    await job.execute();
  });
  await addRepeatableJob(QueueName.ORG_DELETION_REMINDER, 'send-reminders', '0 9 * * *');

  // ==================== CAS COMPUTATION ====================
  // Every 15 minutes — computes org composite activity scores
  await createWorker(QueueName.CAS_COMPUTATION, async () => {
    const { runCASComputationCycle } = await import('../../jobs/casComputationJob.js');
    await runCASComputationCycle();
  });
  await addRepeatableJob(QueueName.CAS_COMPUTATION, 'compute-cas', '*/15 * * * *');

  // ==================== SESSION CLEANUP ====================
  // Every 1 hour — removes expired sessions
  let cachedAuthService: InstanceType<
    typeof import('../../services/authentication/AuthenticationService.js').AuthenticationService
  > | null = null;
  const getAuthService = async (): Promise<
    InstanceType<typeof import('../../services/authentication/AuthenticationService.js').AuthenticationService>
  > => {
    if (!cachedAuthService) {
      const { AuthenticationService } = await import(
        '../../services/authentication/AuthenticationService.js'
      );
      cachedAuthService = new AuthenticationService();
    }
    return cachedAuthService;
  };

  await createWorker(QueueName.SESSION_CLEANUP, async () => {
    const authService = await getAuthService();
    await authService.cleanupExpiredSessions();
  });
  await addRepeatableJob(QueueName.SESSION_CLEANUP, 'cleanup-sessions', '0 * * * *');

  // ==================== REFRESH TOKEN CLEANUP ====================
  // Every 24 hours — removes expired refresh tokens
  await createWorker(QueueName.TOKEN_CLEANUP, async () => {
    const authService = await getAuthService();
    await authService.cleanupExpiredTokens();
  });
  await addRepeatableJob(QueueName.TOKEN_CLEANUP, 'cleanup-tokens', '0 0 * * *');

  // ==================== EXPORT FILE CLEANUP ====================
  // Daily 2:30 AM — deletes expired export files
  await createWorker(QueueName.EXPORT_CLEANUP, async () => {
    const { ExportCleanupJob } = await import('../../jobs/exportCleanupJob.js');
    const job = new ExportCleanupJob();
    await job.execute();
  });
  await addRepeatableJob(QueueName.EXPORT_CLEANUP, 'cleanup-exports', '30 2 * * *');

  // ==================== BACKUP CLEANUP ====================
  // Every 6 hours — cleans up expired backups
  let cachedBackupService: InstanceType<
    typeof import('../../services/backup/BackupService.js').BackupService
  > | null = null;
  await createWorker(QueueName.BACKUP_CLEANUP, async () => {
    if (!cachedBackupService) {
      const { BackupService } = await import('../../services/backup/BackupService.js');
      cachedBackupService = new BackupService();
    }
    await cachedBackupService.cleanupExpiredBackups();
  });
  await addRepeatableJob(QueueName.BACKUP_CLEANUP, 'cleanup-backups', '0 */6 * * *');

  // ==================== POLL AUTO-CLOSE ====================
  // Every 5 minutes — closes expired polls
  let cachedPollService: InstanceType<
    typeof import('../../services/poll/PollService.js').PollService
  > | null = null;
  await createWorker(QueueName.POLL_CLOSE, async () => {
    if (!cachedPollService) {
      const { PollService } = await import('../../services/poll/PollService.js');
      cachedPollService = new PollService();
    }
    await cachedPollService.closeExpiredPolls();
  });
  await addRepeatableJob(QueueName.POLL_CLOSE, 'close-polls', '*/5 * * * *');

  // ==================== INTEL AUDIT LOG ROTATION ====================
  // Daily 4 AM — rotates old intel audit logs (production only)
  if (process.env.NODE_ENV === 'production') {
    await createWorker(QueueName.INTEL_AUDIT_ROTATION, async () => {
      const { IntelAuditLogRotationJob } = await import('../../jobs/intelAuditLogRotation.js');
      const job = new IntelAuditLogRotationJob();
      await job.execute();
    });
    await addRepeatableJob(QueueName.INTEL_AUDIT_ROTATION, 'rotate-audit-logs', '0 4 * * *');
  }

  // ==================== SHIP DATA FETCHER ====================
  // Daily 2 AM — fetches ship catalog from Erkul API
  if (process.env.DISABLE_EXTERNAL_FETCHES !== 'true') {
    await createWorker(QueueName.SHIP_DATA_FETCH, async () => {
      const { ShipDataFetcher } = await import('../../jobs/shipDataFetcher.js');
      await ShipDataFetcher.execute();
    });
    await addRepeatableJob(QueueName.SHIP_DATA_FETCH, 'fetch-ships', '0 2 * * *');
  }

  // ==================== RSI CRAWLER + RSI SYNC ====================
  // These use complex internal guards (isRunning, circuit breaker, distributed locks)
  // tightly coupled to their setInterval pattern. They always run via legacy
  // scheduling in worker.ts (outside the BullMQ if/else block).
  // Future: Export process-once functions from rsiCrawlerJob/rsiSyncScheduler for BullMQ.

  logger.info('[BullMQ] All job workers and schedules registered.');
}

/**
 * Graceful shutdown — close all BullMQ workers and queues.
 */
export async function shutdownBullMQJobs(): Promise<void> {
  await shutdownQueues();
}

