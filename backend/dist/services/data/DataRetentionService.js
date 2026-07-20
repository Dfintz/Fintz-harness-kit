"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataRetentionService = exports.scheduleDataRetentionCleanup = exports.DataRetentionService = exports.DATA_RETENTION_PERIODS = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const data_source_1 = require("../../data-source");
const AccountAccessLog_1 = require("../../models/AccountAccessLog");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const TokenBlacklist_1 = require("../../models/TokenBlacklist");
const UserActivity_1 = require("../../models/UserActivity");
const logger_1 = require("../../utils/logger");
exports.DATA_RETENTION_PERIODS = {
    userActivityLogs: Number(process.env.RETENTION_USER_ACTIVITY_DAYS || 365),
    accountAccessLogs: Number(process.env.RETENTION_ACCESS_LOGS_DAYS || 180),
    intelAuditLogs: Number(process.env.RETENTION_INTEL_AUDIT_DAYS || 730),
    tokenBlacklist: Number(process.env.RETENTION_TOKEN_BLACKLIST_DAYS || 30),
    inactiveSessions: Number(process.env.RETENTION_INACTIVE_SESSIONS_DAYS || 90),
    passwordResetTokens: Number(process.env.RETENTION_PASSWORD_RESET_DAYS || 7),
    usedRecoveryCodes: Number(process.env.RETENTION_RECOVERY_CODES_DAYS || 30),
};
class DataRetentionService {
    isRunning = false;
    async cleanupEntity(entityClass, entityName, dateColumn, retentionDays) {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        try {
            const repository = data_source_1.AppDataSource.getRepository(entityClass);
            const result = await repository
                .createQueryBuilder()
                .delete()
                .where(`${dateColumn} < :cutoffDate`, { cutoffDate })
                .execute();
            const deletedCount = result.affected || 0;
            if (deletedCount > 0) {
                logger_1.logger.info(`Data retention cleanup: Deleted ${deletedCount} ${entityName} records older than ${retentionDays} days`);
            }
            return {
                entity: entityName,
                deletedCount,
                retentionDays,
                cutoffDate,
                success: true
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Data retention cleanup failed for ${entityName}:`, error);
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
    async runCleanup() {
        if (this.isRunning) {
            logger_1.logger.warn('Data retention cleanup already running, skipping');
            return [];
        }
        this.isRunning = true;
        const results = [];
        const startTime = Date.now();
        logger_1.logger.info('Starting data retention enforcement...');
        try {
            results.push(await this.cleanupEntity(UserActivity_1.UserActivity, 'UserActivity', 'timestamp', exports.DATA_RETENTION_PERIODS.userActivityLogs));
            results.push(await this.cleanupEntity(AccountAccessLog_1.AccountAccessLog, 'AccountAccessLog', 'createdAt', exports.DATA_RETENTION_PERIODS.accountAccessLogs));
            results.push(await this.cleanupEntity(IntelAuditLog_1.IntelAuditLog, 'IntelAuditLog', 'createdAt', exports.DATA_RETENTION_PERIODS.intelAuditLogs));
            results.push(await this.cleanupEntity(TokenBlacklist_1.TokenBlacklist, 'TokenBlacklist', 'expiresAt', 0));
            const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
            const failedCount = results.filter(r => !r.success).length;
            const duration = Date.now() - startTime;
            logger_1.logger.info('Data retention enforcement completed', {
                totalDeleted,
                entitiesProcessed: results.length,
                failedCount,
                durationMs: duration
            });
        }
        catch (error) {
            logger_1.logger.error('Data retention enforcement failed:', error);
        }
        finally {
            this.isRunning = false;
        }
        return results;
    }
    getRetentionConfig() {
        return { ...exports.DATA_RETENTION_PERIODS };
    }
}
exports.DataRetentionService = DataRetentionService;
const scheduleDataRetentionCleanup = () => {
    if (process.env.NODE_ENV !== 'production') {
        logger_1.logger.info('Data retention cleanup job disabled in non-production environment');
        return;
    }
    const retentionService = new DataRetentionService();
    node_cron_1.default.schedule('0 2 * * *', async () => {
        logger_1.logger.info('Running scheduled data retention cleanup...');
        await retentionService.runCleanup();
    });
    logger_1.logger.info('Data retention cleanup job scheduled for 2 AM daily');
};
exports.scheduleDataRetentionCleanup = scheduleDataRetentionCleanup;
let instance = null;
const getDataRetentionService = () => {
    if (!instance) {
        instance = new DataRetentionService();
    }
    return instance;
};
exports.getDataRetentionService = getDataRetentionService;
//# sourceMappingURL=DataRetentionService.js.map