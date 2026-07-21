import cron from 'node-cron';

import { AppDataSource } from '../../data-source';
import { AccountAccessLog } from '../../models/AccountAccessLog';
import { IntelAuditLog } from '../../models/IntelAuditLog';
import { TokenBlacklist } from '../../models/TokenBlacklist';
import { UserActivity } from '../../models/UserActivity';
import { logger } from '../../utils/logger';

/**
 * Data Retention Configuration
 * 
 * Defines retention periods for different data types in days.
 * These values can be overridden via environment variables.
 */
export const DATA_RETENTION_PERIODS = {
    // Activity logs - keep for compliance auditing
    userActivityLogs: Number(process.env.RETENTION_USER_ACTIVITY_DAYS || 365),
    
    // Access logs - security audit trail
    accountAccessLogs: Number(process.env.RETENTION_ACCESS_LOGS_DAYS || 180),
    
    // Intel audit logs - sensitive operations audit trail
    intelAuditLogs: Number(process.env.RETENTION_INTEL_AUDIT_DAYS || 730), // 2 years
    
    // Token blacklist - can be shorter as tokens expire
    tokenBlacklist: Number(process.env.RETENTION_TOKEN_BLACKLIST_DAYS || 30),
    
    // Inactive user sessions
    inactiveSessions: Number(process.env.RETENTION_INACTIVE_SESSIONS_DAYS || 90),
    
    // Expired password reset tokens
    passwordResetTokens: Number(process.env.RETENTION_PASSWORD_RESET_DAYS || 7),
    
    // Recovery codes that have been used
    usedRecoveryCodes: Number(process.env.RETENTION_RECOVERY_CODES_DAYS || 30),
};

/**
 * Data Retention Cleanup Result
 */
export interface RetentionCleanupResult {
    entity: string;
    deletedCount: number;
    retentionDays: number;
    cutoffDate: Date;
    success: boolean;
    error?: string;
}

/**
 * Data Retention Service
 * 
 * Implements automatic data retention enforcement for GDPR compliance.
 * Runs periodic cleanup of data that has exceeded retention periods.
 * 
 * GDPR Article 5(1)(e) requires that personal data be kept in a form which permits
 * identification of data subjects for no longer than is necessary.
 */
export class DataRetentionService {
    private isRunning: boolean = false;

    /**
     * Run a cleanup for a specific entity type
     */
    private async cleanupEntity<T extends object>(
        entityClass: { new (): T },
        entityName: string,
        dateColumn: string,
        retentionDays: number
    ): Promise<RetentionCleanupResult> {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        try {
            const repository = AppDataSource.getRepository(entityClass);
            const result = await repository
                .createQueryBuilder()
                .delete()
                .where(`${dateColumn} < :cutoffDate`, { cutoffDate })
                .execute();

            const deletedCount = result.affected || 0;
            
            if (deletedCount > 0) {
                logger.info(`Data retention cleanup: Deleted ${deletedCount} ${entityName} records older than ${retentionDays} days`);
            }

            return {
                entity: entityName,
                deletedCount,
                retentionDays,
                cutoffDate,
                success: true
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Data retention cleanup failed for ${entityName}:`, error);
            
            return {
                entity: entityName,
                deletedCount: 0,
                retentionDays,
                cutoffDate,
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Run all data retention cleanup tasks
     */
    public async runCleanup(): Promise<RetentionCleanupResult[]> {
        if (this.isRunning) {
            logger.warn('Data retention cleanup already running, skipping');
            return [];
        }

        this.isRunning = true;
        const results: RetentionCleanupResult[] = [];
        const startTime = Date.now();

        logger.info('Starting data retention enforcement...');

        try {
            // Clean up user activity logs
            results.push(await this.cleanupEntity(
                UserActivity,
                'UserActivity',
                'timestamp',
                DATA_RETENTION_PERIODS.userActivityLogs
            ));

            // Clean up account access logs
            results.push(await this.cleanupEntity(
                AccountAccessLog,
                'AccountAccessLog',
                'createdAt',
                DATA_RETENTION_PERIODS.accountAccessLogs
            ));

            // Clean up intel audit logs (keep longer for security)
            results.push(await this.cleanupEntity(
                IntelAuditLog,
                'IntelAuditLog',
                'createdAt',
                DATA_RETENTION_PERIODS.intelAuditLogs
            ));

            // Clean up expired token blacklist entries
            results.push(await this.cleanupEntity(
                TokenBlacklist,
                'TokenBlacklist',
                'expiresAt',
                0 // Delete expired entries immediately
            ));

            // Calculate summary
            const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
            const failedCount = results.filter(r => !r.success).length;
            const duration = Date.now() - startTime;

            logger.info('Data retention enforcement completed', {
                totalDeleted,
                entitiesProcessed: results.length,
                failedCount,
                durationMs: duration
            });

        } catch (error: unknown) {
            logger.error('Data retention enforcement failed:', error);
        } finally {
            this.isRunning = false;
        }

        return results;
    }

    /**
     * Get current retention configuration
     */
    public getRetentionConfig(): typeof DATA_RETENTION_PERIODS {
        return { ...DATA_RETENTION_PERIODS };
    }
}

/**
 * Schedule data retention cleanup job
 * 
 * Runs daily at 2 AM to minimize impact on active users.
 * Only runs in production environment.
 */
export const scheduleDataRetentionCleanup = (): void => {
    if (process.env.NODE_ENV !== 'production') {
        logger.info('Data retention cleanup job disabled in non-production environment');
        return;
    }

    const retentionService = new DataRetentionService();

    // Run at 2 AM daily
    cron.schedule('0 2 * * *', async () => {
        logger.info('Running scheduled data retention cleanup...');
        await retentionService.runCleanup();
    });

    logger.info('Data retention cleanup job scheduled for 2 AM daily');
};

// Singleton instance
let instance: DataRetentionService | null = null;

export const getDataRetentionService = (): DataRetentionService => {
    if (!instance) {
        instance = new DataRetentionService();
    }
    return instance;
};

