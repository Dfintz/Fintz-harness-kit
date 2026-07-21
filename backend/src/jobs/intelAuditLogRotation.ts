import { AppDataSource } from '../config/database';
import { IntelAuditLog } from '../models/IntelAuditLog';
import { withJobLock } from '../services/jobs/DistributedJobLockService';
import { logger } from '../utils/logger';

/**
 * Intel Audit Log Rotation Job
 * Runs daily to enforce 30-day retention policy for Intel Vault audit logs
 *
 * Schedule: Daily at 4:00 AM (low traffic period)
 * Cron: 0 4 * * *
 *
 * Actions:
 * 1. Archive Intel audit logs older than retention period (30 days by default)
 * 2. Optionally export archived logs to external storage before deletion
 * 3. Clean up old audit records
 */
export class IntelAuditLogRotationJob {
  private readonly retentionDays: number;

  constructor() {
    this.retentionDays = Number.parseInt(process.env.INTEL_AUDIT_LOG_RETENTION_DAYS || '30', 10);
  }

  /**
   * Execute audit log rotation job.
   *
   * Guarded by a job-scope distributed lock so only one instance performs this
   * destructive (deletes audit logs) rotation at a time, even across replicas.
   */
  public async execute(): Promise<{
    logsDeleted: number;
    logsArchived: number;
    duration: number;
  }> {
    const execution = await withJobLock('intel-audit-log-rotation', () => this.executeUnlocked(), {
      ttlSeconds: 30 * 60,
    });

    if (!execution.acquired) {
      logger.info('Skipping Intel audit log rotation because another instance owns the lock', {
        reason: execution.reason,
      });
      return { logsDeleted: 0, logsArchived: 0, duration: 0 };
    }

    if (!execution.executed || !execution.result) {
      throw new Error(execution.error ?? 'Intel audit log rotation execution failed');
    }

    return execution.result;
  }

  private async executeUnlocked(): Promise<{
    logsDeleted: number;
    logsArchived: number;
    duration: number;
  }> {
    const startTime = Date.now();
    logger.info('Starting Intel audit log rotation job...', {
      retentionDays: this.retentionDays,
    });

    try {
      // Short-circuit: skip all queries if the table is empty
      const auditLogRepository = AppDataSource.getRepository(IntelAuditLog);
      const totalCount = await auditLogRepository.count();
      if (totalCount === 0) {
        const duration = Date.now() - startTime;
        logger.info(`Intel audit log rotation skipped — table is empty (${duration}ms)`);
        return { logsDeleted: 0, logsArchived: 0, duration };
      }

      // Get count of logs to be rotated before deletion
      const logsToRotate = await this.countLogsToRotate();

      // Archive logs if configured (for compliance)
      const logsArchived = await this.archiveOldLogs();

      // Delete old logs
      const logsDeleted = await this.deleteOldLogs();

      const duration = Date.now() - startTime;

      logger.info(`Intel audit log rotation completed in ${duration}ms`, {
        logsDeleted,
        logsArchived,
        logsToRotate,
        duration,
      });

      return {
        logsDeleted,
        logsArchived,
        duration,
      };
    } catch (error) {
      logger.error('Error during Intel audit log rotation:', error);
      throw error;
    }
  }

  /**
   * Count logs that will be rotated
   */
  private async countLogsToRotate(): Promise<number> {
    try {
      const auditLogRepository = AppDataSource.getRepository(IntelAuditLog);
      const cutoffDate = this.getCutoffDate();

      const count = await auditLogRepository
        .createQueryBuilder('log')
        .where('log.createdAt < :cutoffDate', { cutoffDate })
        .getCount();

      return count;
    } catch (error) {
      logger.error('Error counting logs to rotate:', error);
      return 0;
    }
  }

  /**
   * Archive old audit logs before deletion
   * This exports summary data for compliance purposes
   */
  private async archiveOldLogs(): Promise<number> {
    try {
      const shouldArchive = process.env.INTEL_AUDIT_LOG_ARCHIVE === 'true';

      if (!shouldArchive) {
        return 0;
      }

      const auditLogRepository = AppDataSource.getRepository(IntelAuditLog);
      const cutoffDate = this.getCutoffDate();

      // Get logs to archive (ordered oldest to newest)
      const logsToArchive = await auditLogRepository
        .createQueryBuilder('log')
        .where('log.createdAt < :cutoffDate', { cutoffDate })
        .orderBy('log.createdAt', 'ASC')
        .getMany();

      if (logsToArchive.length === 0) {
        return 0;
      }

      // Create archive summary (removing sensitive details)
      const archiveSummary = logsToArchive.map(log => ({
        id: log.id,
        organizationId: log.organizationId,
        action: log.action,
        severity: log.severity,
        createdAt: log.createdAt,
        // Don't include IP addresses or user agents in archive
        // Include only action counts per user (anonymized)
        hasMetadata: !!log.metadata,
      }));

      // Log archive summary for compliance (could be extended to export to blob storage)
      // Note: logs are ordered ASC so first is oldest, last is newest
      logger.info('Intel audit log archive summary', {
        totalLogs: archiveSummary.length,
        dateRange: {
          oldest: archiveSummary[0]?.createdAt,
          newest: archiveSummary.at(-1)?.createdAt,
        },
        actionBreakdown: this.getActionBreakdown(logsToArchive),
        severityBreakdown: this.getSeverityBreakdown(logsToArchive),
      });

      return logsToArchive.length;
    } catch (error) {
      logger.error('Error archiving audit logs:', error);
      return 0;
    }
  }

  /**
   * Delete audit logs older than retention period
   */
  private async deleteOldLogs(): Promise<number> {
    try {
      const auditLogRepository = AppDataSource.getRepository(IntelAuditLog);
      const cutoffDate = this.getCutoffDate();

      const result = await auditLogRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      const deleted = result.affected || 0;

      if (deleted > 0) {
        logger.info(
          `Deleted ${deleted} Intel audit log records older than ${this.retentionDays} days`
        );
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting old audit logs:', error);
      return 0;
    }
  }

  /**
   * Get cutoff date based on retention period
   */
  private getCutoffDate(): Date {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    return cutoffDate;
  }

  /**
   * Get breakdown of actions in logs
   */
  private getActionBreakdown(logs: IntelAuditLog[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const log of logs) {
      breakdown[log.action] = (breakdown[log.action] || 0) + 1;
    }
    return breakdown;
  }

  /**
   * Get breakdown of severities in logs
   */
  private getSeverityBreakdown(logs: IntelAuditLog[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const log of logs) {
      breakdown[log.severity] = (breakdown[log.severity] || 0) + 1;
    }
    return breakdown;
  }

  /**
   * Get job statistics
   */
  public async getStatistics(): Promise<{
    totalLogs: number;
    logsOlderThanRetention: number;
    retentionDays: number;
    oldestLog: Date | null;
    newestLog: Date | null;
  }> {
    try {
      const auditLogRepository = AppDataSource.getRepository(IntelAuditLog);
      const cutoffDate = this.getCutoffDate();

      const [totalLogs, logsOlderThanRetention, oldestLog, newestLog] = await Promise.all([
        auditLogRepository.count(),
        auditLogRepository
          .createQueryBuilder('log')
          .where('log.createdAt < :cutoffDate', { cutoffDate })
          .getCount(),
        auditLogRepository.createQueryBuilder('log').orderBy('log.createdAt', 'ASC').getOne(),
        auditLogRepository.createQueryBuilder('log').orderBy('log.createdAt', 'DESC').getOne(),
      ]);

      return {
        totalLogs,
        logsOlderThanRetention,
        retentionDays: this.retentionDays,
        oldestLog: oldestLog?.createdAt || null,
        newestLog: newestLog?.createdAt || null,
      };
    } catch (error) {
      logger.error('Error getting Intel audit log statistics:', error);
      throw error;
    }
  }
}

/**
 * Job cleanup function for testing and graceful shutdown
 */
export interface IntelAuditLogJobHandle {
  cleanup: () => void;
}

/**
 * Schedule the job to run daily at 4:00 AM
 * Call this function from app.ts on startup
 */
export function scheduleIntelAuditLogRotation(): IntelAuditLogJobHandle | null {
  // Runs in production by default. Set JOBS_INTEL_AUDIT_ROTATION_ENABLED=true to opt in for
  // staging/dev, or =false to disable in production.
  const explicitFlag = process.env.JOBS_INTEL_AUDIT_ROTATION_ENABLED;
  const enabled =
    explicitFlag === 'true' || (explicitFlag !== 'false' && process.env.NODE_ENV === 'production');

  if (!enabled) {
    logger.info(
      'Intel audit log rotation job disabled (set JOBS_INTEL_AUDIT_ROTATION_ENABLED=true to enable in non-production)'
    );
    return null;
  }

  const job = new IntelAuditLogRotationJob();
  let intervalId: NodeJS.Timeout | null = null;

  // Calculate time until next 4 AM
  const now = new Date();
  const next4AM = new Date();
  next4AM.setUTCHours(4, 0, 0, 0);

  // If it's already past 4 AM today, schedule for tomorrow
  if (now > next4AM) {
    next4AM.setDate(next4AM.getDate() + 1);
  }

  const msUntilNext4AM = next4AM.getTime() - now.getTime();

  logger.info(`Scheduling Intel audit log rotation job to run at ${next4AM.toISOString()}`, {
    retentionDays: Number.parseInt(process.env.INTEL_AUDIT_LOG_RETENTION_DAYS || '30', 10),
  });

  // Run the job at 4 AM
  const timeoutId = setTimeout(async () => {
    try {
      await job.execute();
    } catch (err) {
      logger.error('Intel audit log rotation job failed:', err);
    }

    // Schedule to run every 24 hours after the first run
    intervalId = setInterval(
      async () => {
        try {
          await job.execute();
        } catch (err) {
          logger.error('Intel audit log rotation job failed:', err);
        }
      },
      24 * 60 * 60 * 1000
    ); // 24 hours
    intervalId.unref();
  }, msUntilNext4AM);

  // Return cleanup function for graceful shutdown
  return {
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      logger.info('Intel audit log rotation job stopped');
    },
  };
}
