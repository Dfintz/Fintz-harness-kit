"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprDataCleanupJob = void 0;
exports.scheduleGdprCleanup = scheduleGdprCleanup;
const database_1 = require("../config/database");
const AccountAccessLog_1 = require("../models/AccountAccessLog");
const UserActivity_1 = require("../models/UserActivity");
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const logger_1 = require("../utils/logger");
const jobSchedulerHelper_1 = require("./jobSchedulerHelper");
class GdprDataCleanupJob {
    async execute() {
        const lockResult = await DistributedJobLockService_1.distributedJobLock.withJobLock('gdpr-data-cleanup', async () => {
            await this.executeUnlocked();
        }, { ttlSeconds: 45 * 60 });
        if (!lockResult.acquired) {
            logger_1.logger.info('Skipping GDPR cleanup run because another instance owns the lock', {
                reason: lockResult.reason,
            });
            return;
        }
        if (!lockResult.executed) {
            throw new Error(lockResult.error ?? 'GDPR cleanup execution failed');
        }
    }
    async executeUnlocked() {
        const startTime = Date.now();
        logger_1.logger.info('Starting GDPR data cleanup job...');
        try {
            const accessLogsDeleted = await this.cleanupAccessLogs();
            const activitiesAnonymized = await this.anonymizeUserActivities();
            const expiredConsents = await this.cleanupExpiredConsents();
            const deletionsProcessed = await this.processDueDeletions();
            const duration = Date.now() - startTime;
            logger_1.logger.info(`GDPR data cleanup completed in ${duration}ms`, {
                accessLogsDeleted,
                activitiesAnonymized,
                expiredConsents,
                deletionsProcessed,
                duration,
            });
        }
        catch (error) {
            logger_1.logger.error('Error during GDPR data cleanup:', error);
            throw error;
        }
    }
    async cleanupAccessLogs() {
        try {
            const accessLogRepository = database_1.AppDataSource.getRepository(AccountAccessLog_1.AccountAccessLog);
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
                logger_1.logger.info(`Deleted ${deleted} AccountAccessLog records older than ${retentionDays} days`);
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up access logs:', error);
            throw error;
        }
    }
    async anonymizeUserActivities() {
        try {
            const activityRepository = database_1.AppDataSource.getRepository(UserActivity_1.UserActivity);
            const retentionDays = Number.parseInt(process.env.USER_ACTIVITY_RETENTION_DAYS || '180', 10);
            const batchSize = Number.parseInt(process.env.GDPR_ACTIVITY_ANONYMIZE_BATCH_SIZE || '500', 10);
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
                    .getRawMany();
                if (rows.length === 0) {
                    break;
                }
                const ids = rows.map(row => row.id);
                await database_1.AppDataSource.query('UPDATE user_activities SET "ipAddress" = NULL, "userAgent" = NULL WHERE id = ANY($1::uuid[])', [ids]);
                anonymized += ids.length;
                if (rows.length < batchSize) {
                    break;
                }
            }
            if (anonymized > 0) {
                logger_1.logger.info(`Anonymized ${anonymized} UserActivity records older than ${retentionDays} days (batch size: ${batchSize})`);
            }
            return anonymized;
        }
        catch (error) {
            logger_1.logger.error('Error anonymizing user activities:', error);
            throw error;
        }
    }
    async cleanupExpiredConsents() {
        try {
            const { UserConsent } = await Promise.resolve().then(() => __importStar(require('../models/UserConsent')));
            const consentRepository = database_1.AppDataSource.getRepository(UserConsent);
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
                logger_1.logger.info(`Revoked ${expired} expired consent records`);
            }
            return expired;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up expired consents:', error);
            throw error;
        }
    }
    async processDueDeletions() {
        try {
            const { getGdprDataDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/user/GdprDataDeletionService')));
            const deletionService = getGdprDataDeletionService();
            const results = await deletionService.processDueDeletions();
            if (results.length > 0) {
                const successful = results.filter(r => r.result.success).length;
                const failed = results.filter(r => !r.result.success).length;
                logger_1.logger.info(`Processed ${results.length} deletion requests: ${successful} successful, ${failed} failed`);
            }
            return results.length;
        }
        catch (error) {
            logger_1.logger.error('Error processing due deletions:', error);
            throw error;
        }
    }
    async getStatistics() {
        try {
            const accessLogRepository = database_1.AppDataSource.getRepository(AccountAccessLog_1.AccountAccessLog);
            const activityRepository = database_1.AppDataSource.getRepository(UserActivity_1.UserActivity);
            const { UserConsent } = await Promise.resolve().then(() => __importStar(require('../models/UserConsent')));
            const consentRepository = database_1.AppDataSource.getRepository(UserConsent);
            const accessLogRetentionDays = Number.parseInt(process.env.ACCESS_LOG_RETENTION_DAYS || '90', 10);
            const activityRetentionDays = Number.parseInt(process.env.USER_ACTIVITY_RETENTION_DAYS || '180', 10);
            const accessLogCutoff = new Date();
            accessLogCutoff.setDate(accessLogCutoff.getDate() - accessLogRetentionDays);
            const activityCutoff = new Date();
            activityCutoff.setDate(activityCutoff.getDate() - activityRetentionDays);
            const [accessLogsCount, oldAccessLogsCount, userActivitiesCount, oldUserActivitiesCount, expiredConsentsCount,] = await Promise.all([
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
        }
        catch (error) {
            logger_1.logger.error('Error getting cleanup statistics:', error);
            throw error;
        }
    }
}
exports.GdprDataCleanupJob = GdprDataCleanupJob;
function scheduleGdprCleanup() {
    const explicitFlag = process.env.JOBS_GDPR_CLEANUP_ENABLED;
    const enabled = explicitFlag === 'true' || (explicitFlag !== 'false' && process.env.NODE_ENV === 'production');
    if (!enabled) {
        logger_1.logger.info('GDPR cleanup job disabled (set JOBS_GDPR_CLEANUP_ENABLED=true to enable in non-production)');
        return null;
    }
    const job = new GdprDataCleanupJob();
    return (0, jobSchedulerHelper_1.scheduleDailyUtcJob)({
        jobName: 'GDPR cleanup job',
        hourUtc: 3,
        minuteUtc: 0,
        run: async () => {
            await job.execute();
        },
    });
}
//# sourceMappingURL=gdprDataCleanup.js.map