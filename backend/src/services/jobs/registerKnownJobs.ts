/**
 * Register Known Jobs
 *
 * Registers all known background jobs with the AdminJobRegistry
 * so they appear in the admin operations dashboard and can be
 * manually triggered or enabled/disabled.
 *
 * Called at startup from worker.ts or app.ts.
 */

import { logger } from '../../utils/logger';
import { adminJobRegistry, type JobRegistryConfig } from '../admin/AdminJobRegistry';

/**
 * Register all known jobs with the admin registry.
 * Uses lazy imports to avoid triggering service singleton creation before DB is ready.
 */
export async function registerKnownJobs(): Promise<void> {
  const jobs: JobRegistryConfig[] = [
    {
      id: 'ship-data-fetcher',
      name: 'Ship Data Fetcher',
      description: 'Fetches ship and vehicle data from RSI ship matrix',
      category: 'sync',
      schedule: 'Daily at 02:00 UTC',
      handler: async () => {
        const { ShipDataFetcher } = await import('../../jobs/shipDataFetcher.js');
        await ShipDataFetcher.execute();
      },
    },
    {
      id: 'regolith-data-fetcher',
      name: 'Regolith Data Fetcher',
      description: 'Fetches mining ore and market data from Regolith sources',
      category: 'sync',
      schedule: 'Every 6 hours',
      handler: async () => {
        const { RegolithDataFetcher } = await import('../../jobs/regolithDataFetcher.js');
        await RegolithDataFetcher.execute();
      },
    },
    {
      id: 'gdpr-data-cleanup',
      name: 'GDPR Data Cleanup',
      description:
        'Enforces data retention policies: deletes old access logs, anonymizes activities, processes due deletions',
      category: 'gdpr',
      schedule: 'Daily at 03:00 UTC',
      handler: async () => {
        const { GdprDataCleanupJob } = await import('../../jobs/gdprDataCleanup.js');
        await new GdprDataCleanupJob().execute();
      },
    },
    {
      id: 'gdpr-export-processing',
      name: 'GDPR Export Processing',
      description: 'Processes pending GDPR data export requests',
      category: 'gdpr',
      schedule: 'Every 5 minutes',
      handler: async () => {
        const { GdprExportProcessingJob } = await import('../../jobs/gdprExportProcessing.js');
        await new GdprExportProcessingJob().execute();
      },
    },
    {
      id: 'intel-audit-log-rotation',
      name: 'Intel Audit Log Rotation',
      description: 'Rotates and archives old intel audit log entries beyond retention period',
      category: 'maintenance',
      schedule: 'Daily at 04:00 UTC',
      handler: async () => {
        const { IntelAuditLogRotationJob } = await import('../../jobs/intelAuditLogRotation.js');
        await new IntelAuditLogRotationJob().execute();
      },
    },
    {
      id: 'org-deletion-processor',
      name: 'Organization Deletion Processor',
      description: 'Processes approved organization deletion requests',
      category: 'cleanup',
      schedule: 'Hourly',
      handler: async () => {
        const { runOrganizationDeletionProcessor } =
          await import('../../jobs/organizationDeletionProcessor.js');
        await runOrganizationDeletionProcessor();
      },
    },
    {
      id: 'org-deletion-reminders',
      name: 'Organization Deletion Reminders',
      description: 'Sends reminder notifications for pending organization deletions',
      category: 'cleanup',
      schedule: 'Daily at 09:00 UTC',
      handler: async () => {
        const { runOrganizationDeletionReminderJob } =
          await import('../../jobs/organizationDeletionReminderJob.js');
        await runOrganizationDeletionReminderJob();
      },
    },
    {
      id: 'export-cleanup',
      name: 'Export Cleanup',
      description: 'Cleans up old export files from blob storage',
      category: 'cleanup',
      schedule: 'Daily at 02:30 UTC',
      handler: async () => {
        const { runExportCleanupJob } = await import('../../jobs/exportCleanupJob.js');
        await runExportCleanupJob();
      },
    },
    {
      id: 'cas-computation',
      name: 'CAS Computation',
      description: 'Computes Community Activity Scores for organizations',
      category: 'analytics',
      schedule: 'Every 15 minutes',
      handler: async () => {
        const { runCASComputationCycle } = await import('../../jobs/casComputationJob.js');
        await runCASComputationCycle();
      },
    },
    {
      id: 'poll-close-scheduler',
      name: 'Poll Auto-Close',
      description: 'Automatically closes polls that have passed their expiration date',
      category: 'maintenance',
      schedule: 'Every 5 minutes',
      handler: async () => {
        const { PollService } = await import('../poll/PollService.js');
        const pollService = new PollService();
        await pollService.closeExpiredPolls();
      },
    },
    {
      id: 'session-cleanup',
      name: 'Session Cleanup',
      description: 'Removes expired sessions from the database',
      category: 'security',
      schedule: 'Hourly',
      handler: async () => {
        const { AuthenticationService } = await import('../authentication/AuthenticationService.js');
        const authService = new AuthenticationService();
        const cleaned = await authService.cleanupExpiredSessions();
        logger.info('Manual session cleanup completed', { cleanedCount: cleaned });
      },
    },
    {
      id: 'rsi-sync',
      name: 'RSI Sync Scheduler',
      description: 'Syncs RSI organization member data for linked organizations (auto-managed)',
      category: 'integration',
      schedule: 'Every 15 minutes',
      enabled: true,
      handler: async () => {
        logger.info(
          'RSI Sync runs automatically via distributed scheduler. ' +
            'Use the organization RSI sync page for manual per-org syncs.'
        );
      },
    },
    {
      id: 'rsi-verification-auto-detect',
      name: 'RSI Verification Auto-Detect',
      description:
        'Automatically completes pending RSI user and org verifications by scanning verification links',
      category: 'integration',
      schedule: 'Every 2 minutes',
      enabled: true,
      handler: async () => {
        const { runRsiVerificationAutoDetectOnce } =
          await import('../../jobs/rsiVerificationAutoDetectJob.js');

        const result = await runRsiVerificationAutoDetectOnce();
        if (result.outcome === 'skipped') {
          logger.info('RSI verification auto-detect manual trigger skipped', {
            reason: result.reason,
          });

          return {
            outcome: 'skipped' as const,
            reason: result.reason,
          };
        }

        return {
          outcome: 'executed' as const,
          details: {
            usersChecked: result.usersChecked,
            usersVerified: result.usersVerified,
            organizationsChecked: result.organizationsChecked,
            organizationsVerified: result.organizationsVerified,
          },
        };
      },
    },
    {
      id: 'rsi-affiliation-batch',
      name: 'RSI Affiliation Batch Refresh',
      description:
        'Refreshes RSI handle affiliations and account lifecycle status in configurable batches',
      category: 'integration',
      schedule: 'Every 60 minutes (configurable)',
      enabled: true,
      handler: async () => {
        const { runRsiAffiliationBatchJobNow } = await import('../../jobs/rsiAffiliationBatchJob.js');
        await runRsiAffiliationBatchJobNow();
      },
    },
  ];

  for (const job of jobs) {
    try {
      adminJobRegistry.registerJob(job);
    } catch (error: unknown) {
      logger.warn('Failed to register job in admin registry', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(`Registered ${jobs.length} jobs in admin registry`);
}

