import { claimWorkItem, withJobLock } from '../services/jobs/DistributedJobLockService';
import { OrganizationDeletionService } from '../services/organization/OrganizationDeletionService';
import { logger } from '../utils/logger';

import { scheduleFixedIntervalJob } from './jobSchedulerHelper';

/**
 * Organization Deletion Processor Job
 * Runs hourly to process approved organization deletion requests
 *
 * Schedule: Hourly at :00 minutes
 * Cron: 0 * * * *
 *
 * Actions:
 * 1. Find all approved deletion requests past their grace period
 * 2. Execute the deletion (archive) for each organization
 * 3. Log results and any failures
 */
export class OrganizationDeletionProcessorJob {
  private readonly deletionService: OrganizationDeletionService;

  constructor() {
    this.deletionService = new OrganizationDeletionService();
  }

  /**
   * Execute the job to process pending deletions
   */
  public async execute(): Promise<void> {
    const lockResult = await withJobLock(
      'organization-deletion-processor',
      async () => {
        await this.executeUnlocked();
      },
      { ttlSeconds: 55 * 60 }
    );

    if (!lockResult.acquired) {
      logger.info(
        'Skipping organization deletion processor run because another instance owns the lock',
        {
          reason: lockResult.reason,
        }
      );
      return;
    }

    if (!lockResult.executed) {
      throw new Error(lockResult.error ?? 'Organization deletion processor execution failed');
    }
  }

  private async executeUnlocked(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting organization deletion processor job...');

    try {
      const requests = await this.deletionService.getRequestsReadyForExecution();

      if (requests.length === 0) {
        logger.info('No organization deletion requests ready for execution');
        return;
      }

      logger.info(`Found ${requests.length} organization deletion request(s) ready for execution`);

      let successCount = 0;
      let failureCount = 0;
      const failures: Array<{ requestId: string; organizationId: string; error: string }> = [];

      for (const request of requests) {
        try {
          logger.info(
            `Processing deletion request ${request.id} for organization ${request.organizationId}`
          );

          const claimResult = await claimWorkItem(
            `organization-deletion-request:${request.id}`,
            async () => {
              await this.deletionService.executeDeletion(request.id);
            },
            { ttlSeconds: 20 * 60 }
          );

          if (!claimResult.claimed) {
            logger.info('Organization deletion request already claimed by another worker', {
              requestId: request.id,
              organizationId: request.organizationId,
              reason: claimResult.skippedReason,
            });
            continue;
          }

          if (claimResult.error) {
            throw new Error(claimResult.error);
          }

          successCount++;
          logger.info(`Successfully executed deletion for organization ${request.organizationId}`);
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failures.push({
            requestId: request.id,
            organizationId: request.organizationId,
            error: errorMessage,
          });
          logger.error(
            `Failed to execute deletion for organization ${request.organizationId}:`,
            error
          );
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Organization deletion processor completed in ${duration}ms`, {
        totalRequests: requests.length,
        successCount,
        failureCount,
        failures: failures.length > 0 ? failures : undefined,
        duration,
      });

      // Log summary
      if (failureCount > 0) {
        logger.warn(`${failureCount} organization deletion(s) failed`, { failures });
      }
    } catch (error) {
      logger.error('Error during organization deletion processing:', error);
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  public async getStats(): Promise<{
    pendingApproval: number;
    readyForExecution: number;
  }> {
    try {
      const pendingRequests = await this.deletionService.getPendingRequests();
      const readyRequests = await this.deletionService.getRequestsReadyForExecution();

      return {
        pendingApproval: pendingRequests.length,
        readyForExecution: readyRequests.length,
      };
    } catch (error) {
      logger.error('Error getting deletion job stats:', error);
      return {
        pendingApproval: 0,
        readyForExecution: 0,
      };
    }
  }
}

// Export a singleton instance for use in cron scheduler
export const organizationDeletionProcessor = new OrganizationDeletionProcessorJob();

/**
 * Run the job immediately (for testing or manual execution)
 */
export async function runOrganizationDeletionProcessor(): Promise<void> {
  await organizationDeletionProcessor.execute();
}

/**
 * Job cleanup handle for graceful shutdown
 */
export interface OrgDeletionProcessorJobHandle {
  cleanup: () => void;
}

/**
 * Schedule the org deletion processor to run hourly
 */
export function scheduleOrgDeletionProcessor(): OrgDeletionProcessorJobHandle {
  const job = new OrganizationDeletionProcessorJob();

  return scheduleFixedIntervalJob({
    jobName: 'Organization deletion processor job',
    intervalMs: 60 * 60 * 1000,
    runOnStartup: true,
    run: async () => {
      await job.execute();
    },
  });
}
