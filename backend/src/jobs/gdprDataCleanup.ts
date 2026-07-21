import { AppDataSource } from '../config/database';
import { AccountAccessLog } from '../models/AccountAccessLog';
import { UserActivity } from '../models/UserActivity';
import { distributedJobLock } from '../services/jobs/DistributedJobLockService';
import { logger } from '../utils/logger';

import { scheduleDailyUtcJob } from './jobSchedulerHelper';

/**
 * GDPR Data Cleanup Job
 * Runs daily to enforce data retention policies
 *
 * Schedule: Daily at 3:00 AM (low traffic period)
 * Cron: 0 3 * * *
 *
 * Actions:
 * 1. Delete AccountAccessLog records beyond retention period (90 days)
 * 2. Anonymize UserActivity records beyond retention period (180 days)
 * 3. Clean up expired consent records
 */
export class GdprDataCleanupJob {
  /**
   * Execute data cleanup job
   */
  public async execute(): Promise<void> {
    const lockResult = await distributedJobLock.withJobLock(
      'gdpr-data-cleanup',
      async () => {
        await this.executeUnlocked();
      },
      { ttlSeconds: 45 * 60 }
    );

    if (!lockResult.acquired) {
      logger.info('Skipping GDPR cleanup run because another instance owns the lock', {
        reason: lockResult.reason,
      });
      return;
    }

    if (!lockResult.executed) {
      throw new Error(lockResult.error ?? 'GDPR cleanup execution failed');
    }
  }

  private async executeUnlocked(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting GDPR data cleanup job...');

    try {
      // Cleanup access logs
      const accessLogsDeleted = await this.cleanupAccessLogs();

      // Anonymize user activities
      const activitiesAnonymized = await this.anonymizeUserActivities();

      // Clean up expired consents
      const expiredConsents = await this.cleanupExpiredConsents();

      // Process due deletion requests
      const deletionsProcessed = await this.processDueDeletions();

      const duration = Date.now() - startTime;
      logger.info(`GDPR data cleanup completed in ${duration}ms`, {
        accessLogsDeleted,
        activitiesAnonymized,
        expiredConsents,
        deletionsProcessed,
        duration,
      });
    } catch (error) {
      logger.error('Error during GDPR data cleanup:', error);
      throw error;
    }
  }

  /**
   * Delete old AccountAccessLog records
   */
  private async cleanupAccessLogs(): Promise<number> {
    try {
      const accessLogRepository = AppDataSource.getRepository(AccountAccessLog);
      // Access logs: shorter retention (90 days)
      const retentionDays = Number.parseInt(process.env.ACCESS_LOG_RETENTION_DAYS || '90', 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await accessLogRepository
        .createQueryBuilder()
        .delete()
        .where('"createdAt" < :cutoffDate', { cutoffDate })
        .execute();

      const deleted = result.affected || 0;

      if (deleted > 0) {
        logger.info(`Deleted ${deleted} AccountAccessLog records older than ${retentionDays} days`);
      }

      return deleted;
    } catch (error) {
      logger.error('Error cleaning up access logs:', error);
      return 0;
    }
  }

  /**
   * Anonymize old UserActivity records
   * Removes IP addresses and user agents while keeping activity data for analytics
   */
  private async anonymizeUserActivities(): Promise<number> {
    try {
      const activityRepository = AppDataSource.getRepository(UserActivity);
      // User activities: longer retention (180 days) for analytics
      const retentionDays = Number.parseInt(process.env.USER_ACTIVITY_RETENTION_DAYS || '180', 10);
      const batchSize = Number.parseInt(
        process.env.GDPR_ACTIVITY_ANONYMIZE_BATCH_SIZE || '500',
        10
      );
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let anonymized = 0;

      while (true) {
        const rows = await activityRepository
          .createQueryBuilder('activity')
          .select('activity.id', 'id')
          .where('activity.timestamp < :cutoffDate', { cutoffDate })
          .andWhere('(activity.ipAddress IS NOT NULL OR activity.userAgent IS NOT NULL)')
          .orderBy('activity.timestamp', 'ASC')
          .limit(batchSize)
          .getRawMany<{ id: string }>();

        if (rows.length === 0) {
          break;
        }

        const ids = rows.map(row => row.id);

        await AppDataSource.query(
          'UPDATE user_activities SET "ipAddress" = NULL, "userAgent" = NULL WHERE id = ANY($1::uuid[])',
          [ids]
        );

        anonymized += ids.length;

        if (rows.length < batchSize) {
          break;
        }
      }

      if (anonymized > 0) {
        logger.info(
          `Anonymized ${anonymized} UserActivity records older than ${retentionDays} days (batch size: ${batchSize})`
        );
      }

      return anonymized;
    } catch (error) {
      logger.error('Error anonymizing user activities:', error);
      return 0;
    }
  }

  /**
   * Clean up expired consent records
   * Mark expired consents as revoked
   */
  private async cleanupExpiredConsents(): Promise<number> {
    try {
      const { UserConsent } = await import('../models/UserConsent');
      const consentRepository = AppDataSource.getRepository(UserConsent);
      const now = new Date();

      const result = await consentRepository
        .createQueryBuilder()
        .update()
        .set({ granted: false })
        .where('granted = :granted', { granted: true })
        .andWhere('expiresAt IS NOT NULL')
        .andWhere('expiresAt < :now', { now })
        .execute();

      const expired = result.affected || 0;

      if (expired > 0) {
        logger.info(`Revoked ${expired} expired consent records`);
      }

      return expired;
    } catch (error) {
      logger.error('Error cleaning up expired consents:', error);
      return 0;
    }
  }

  /**
   * Process due deletion requests
   * Execute deletions for requests that have passed their grace period
   */
  private async processDueDeletions(): Promise<number> {
    try {
      const { getGdprDataDeletionService } =
        await import('../services/user/GdprDataDeletionService');
      const deletionService = getGdprDataDeletionService();

      const results = await deletionService.processDueDeletions();

      if (results.length > 0) {
        const successful = results.filter(r => r.result.success).length;
        const failed = results.filter(r => !r.result.success).length;
        logger.info(
          `Processed ${results.length} deletion requests: ${successful} successful, ${failed} failed`
        );
      }

      return results.length;
    } catch (error) {
      logger.error('Error processing due deletions:', error);
      return 0;
    }
  }

  /**
   * Get job statistics
   */
  public async getStatistics(): Promise<{
    accessLogsCount: number;
    oldAccessLogsCount: number;
    userActivitiesCount: number;
    oldUserActivitiesCount: number;
    expiredConsentsCount: number;
  }> {
    try {
      const accessLogRepository = AppDataSource.getRepository(AccountAccessLog);
      const activityRepository = AppDataSource.getRepository(UserActivity);
      const { UserConsent } = await import('../models/UserConsent');
      const consentRepository = AppDataSource.getRepository(UserConsent);

      const accessLogRetentionDays = Number.parseInt(
        process.env.ACCESS_LOG_RETENTION_DAYS || '90',
        10
      );
      const activityRetentionDays = Number.parseInt(
        process.env.USER_ACTIVITY_RETENTION_DAYS || '180',
        10
      );

      const accessLogCutoff = new Date();
      accessLogCutoff.setDate(accessLogCutoff.getDate() - accessLogRetentionDays);

      const activityCutoff = new Date();
      activityCutoff.setDate(activityCutoff.getDate() - activityRetentionDays);

      const [
        accessLogsCount,
        oldAccessLogsCount,
        userActivitiesCount,
        oldUserActivitiesCount,
        expiredConsentsCount,
      ] = await Promise.all([
        accessLogRepository.count(),
        accessLogRepository
          .createQueryBuilder()
          .where('"createdAt" < :cutoff', { cutoff: accessLogCutoff })
          .getCount(),
        activityRepository.count(),
        activityRepository
          .createQueryBuilder('activity')
          .where('activity.timestamp < :cutoffDate', { cutoffDate: activityCutoff })
          .andWhere('(activity.ipAddress IS NOT NULL OR activity.userAgent IS NOT NULL)')
          .getCount(),
        consentRepository
          .createQueryBuilder()
          .where('granted = :granted', { granted: true })
          .andWhere('expiresAt IS NOT NULL')
          .andWhere('expiresAt < :now', { now: new Date() })
          .getCount(),
      ]);

      return {
        accessLogsCount,
        oldAccessLogsCount,
        userActivitiesCount,
        oldUserActivitiesCount,
        expiredConsentsCount,
      };
    } catch (error) {
      logger.error('Error getting cleanup statistics:', error);
      throw error;
    }
  }
}

/**
 * Job cleanup handle for graceful shutdown
 */
export interface GdprCleanupJobHandle {
  cleanup: () => void;
}

/**
 * Schedule the job to run daily at 3:00 AM
 * Call this function from app.ts or worker.ts on startup
 */
export function scheduleGdprCleanup(): GdprCleanupJobHandle | null {
  // Runs in production by default. Set JOBS_GDPR_CLEANUP_ENABLED=true to opt in for
  // staging/dev, or =false to disable in production (e.g. for maintenance windows).
  const explicitFlag = process.env.JOBS_GDPR_CLEANUP_ENABLED;
  const enabled =
    explicitFlag === 'true' || (explicitFlag !== 'false' && process.env.NODE_ENV === 'production');

  if (!enabled) {
    logger.info(
      'GDPR cleanup job disabled (set JOBS_GDPR_CLEANUP_ENABLED=true to enable in non-production)'
    );
    return null;
  }

  const job = new GdprDataCleanupJob();

  return scheduleDailyUtcJob({
    jobName: 'GDPR cleanup job',
    hourUtc: 3,
    minuteUtc: 0,
    run: async () => {
      await job.execute();
    },
  });
}
