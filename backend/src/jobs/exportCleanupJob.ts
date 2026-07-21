import { AppDataSource } from '../config/database';
import {
  OrganizationDeletionRequest,
  OrgDeletionRequestStatus,
} from '../models/OrganizationDeletionRequest';
import { AzureBlobService } from '../services/cloud/AzureBlobService';
import { withJobLock } from '../services/jobs/DistributedJobLockService';
import { logger } from '../utils/logger';

/**
 * Export Cleanup Job
 * Runs daily to clean up old organization data exports
 *
 * Schedule: Daily at 2 AM
 * Cron: 0 2 * * *
 *
 * Actions:
 * 1. Find all deletion requests with exports older than 30 days
 * 2. Delete the export files from Azure Blob Storage
 * 3. Clear export metadata from the database
 * 4. Log cleanup results
 */
export class ExportCleanupJob {
  private readonly blobService: AzureBlobService;
  private readonly EXPORT_RETENTION_DAYS: number;

  constructor() {
    this.blobService = new AzureBlobService();
    // Allow configuration via environment variable, default to 30 days
    this.EXPORT_RETENTION_DAYS = Number.parseInt(process.env.EXPORT_RETENTION_DAYS || '30', 10);
  }

  /**
   * Execute the cleanup job.
   *
   * Guarded by a job-scope distributed lock so only one instance performs this
   * destructive (deletes export blobs) cleanup at a time, even across replicas.
   */
  public async execute(): Promise<void> {
    const execution = await withJobLock('export-cleanup', () => this.executeUnlocked(), {
      ttlSeconds: 30 * 60,
    });

    if (!execution.acquired) {
      logger.info('Skipping export cleanup run because another instance owns the lock', {
        reason: execution.reason,
      });
      return;
    }

    if (!execution.executed) {
      throw new Error(execution.error ?? 'Export cleanup execution failed');
    }
  }

  private async executeUnlocked(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting export cleanup job...');

    try {
      const deletionRequestRepo = AppDataSource.getRepository(OrganizationDeletionRequest);

      // Calculate cutoff date (30 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.EXPORT_RETENTION_DAYS);

      // Find requests with old exports
      const requestsWithOldExports = await deletionRequestRepo
        .createQueryBuilder('request')
        .where('request.dataExportGenerated = :generated', { generated: true })
        .andWhere('request.exportFilePath IS NOT NULL')
        .andWhere('request.createdAt < :cutoffDate', { cutoffDate })
        .andWhere('request.status IN (:...statuses)', {
          statuses: [
            OrgDeletionRequestStatus.COMPLETED,
            OrgDeletionRequestStatus.CANCELLED,
            OrgDeletionRequestStatus.REJECTED,
            OrgDeletionRequestStatus.FAILED,
          ],
        })
        .getMany();

      if (requestsWithOldExports.length === 0) {
        logger.info('No old exports found for cleanup');
        const duration = Date.now() - startTime;
        logger.info(`Export cleanup job completed in ${duration}ms`);
        return;
      }

      logger.info(`Found ${requestsWithOldExports.length} old export(s) to clean up`);

      let successCount = 0;
      let failureCount = 0;
      const failures: Array<{ requestId: string; filePath: string; error: string }> = [];

      for (const request of requestsWithOldExports) {
        try {
          if (!request.exportFilePath) {
            continue;
          }

          logger.info(`Cleaning up export for request ${request.id}`, {
            filePath: request.exportFilePath,
            createdAt: request.createdAt,
          });

          // Delete from blob storage if configured
          await this.deleteExportBlobSafely(request.exportFilePath);

          // Clear export metadata from database
          request.exportFilePath = null;
          request.exportDownloadToken = null;
          await deletionRequestRepo.save(request);

          successCount++;
          logger.info(`Successfully cleaned up export for request ${request.id}`);
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failures.push({
            requestId: request.id,
            filePath: request.exportFilePath || 'unknown',
            error: errorMessage,
          });
          logger.error(`Failed to clean up export for request ${request.id}`, {
            error,
            filePath: request.exportFilePath,
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Export cleanup job completed', {
        duration: `${duration}ms`,
        totalProcessed: requestsWithOldExports.length,
        successCount,
        failureCount,
        failures: failures.length > 0 ? failures : undefined,
      });
    } catch (error) {
      logger.error('Export cleanup job failed', { error });
      throw error;
    }
  }

  /**
   * Delete an export blob, tolerating an already-deleted/missing blob.
   * A blob-delete failure is logged as a warning and does not abort the
   * surrounding database cleanup for the request.
   */
  private async deleteExportBlobSafely(filePath: string): Promise<void> {
    if (!this.blobService.isConfigured()) {
      return;
    }

    try {
      await this.blobService.deleteImage(filePath);
      logger.info(`Deleted export file from blob storage: ${filePath}`);
    } catch (blobError) {
      logger.warn(`Failed to delete blob, may already be deleted: ${filePath}`, {
        error: blobError,
      });
    }
  }

  /**
   * Get job schedule information
   */
  public getSchedule(): { cron: string; description: string } {
    return {
      cron: '0 2 * * *',
      description: `Runs daily at 2 AM to clean up exports older than ${this.EXPORT_RETENTION_DAYS} days`,
    };
  }
}

/**
 * Execute the job (for standalone execution)
 */
export async function runExportCleanupJob(): Promise<void> {
  const job = new ExportCleanupJob();
  await job.execute();
}

/**
 * Job cleanup handle for graceful shutdown
 */
export interface ExportCleanupJobHandle {
  cleanup: () => void;
}

/**
 * Schedule export cleanup to run daily at 2 AM UTC
 */
export function scheduleExportCleanup(): ExportCleanupJobHandle {
  const job = new ExportCleanupJob();
  let intervalId: NodeJS.Timeout | null = null;

  // Calculate time until next 2:30 AM UTC (staggered from ShipDataFetcher at 2:00 AM)
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(2, 30, 0, 0);
  if (now > nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  const msUntilNextRun = nextRun.getTime() - now.getTime();

  logger.info(`Scheduling export cleanup job to run at ${nextRun.toISOString()}`);

  const timeoutId = setTimeout(async () => {
    try {
      await job.execute();
    } catch (err) {
      logger.error('Export cleanup job failed:', err);
    }

    intervalId = setInterval(
      async () => {
        try {
          await job.execute();
        } catch (err) {
          logger.error('Export cleanup job failed:', err);
        }
      },
      24 * 60 * 60 * 1000 // 24 hours
    );
    intervalId.unref();
  }, msUntilNextRun);

  return {
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      logger.info('Export cleanup job stopped');
    },
  };
}
