"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelAuditLogRotationJob = void 0;
exports.scheduleIntelAuditLogRotation = scheduleIntelAuditLogRotation;
const database_1 = require("../config/database");
const IntelAuditLog_1 = require("../models/IntelAuditLog");
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const logger_1 = require("../utils/logger");
class IntelAuditLogRotationJob {
    retentionDays;
    constructor() {
        this.retentionDays = Number.parseInt(process.env.INTEL_AUDIT_LOG_RETENTION_DAYS || '30', 10);
    }
    async execute() {
        const execution = await (0, DistributedJobLockService_1.withJobLock)('intel-audit-log-rotation', () => this.executeUnlocked(), {
            ttlSeconds: 30 * 60,
        });
        if (!execution.acquired) {
            logger_1.logger.info('Skipping Intel audit log rotation because another instance owns the lock', {
                reason: execution.reason,
            });
            return { logsDeleted: 0, logsArchived: 0, duration: 0 };
        }
        if (!execution.executed || !execution.result) {
            throw new Error(execution.error ?? 'Intel audit log rotation execution failed');
        }
        return execution.result;
    }
    async executeUnlocked() {
        const startTime = Date.now();
        logger_1.logger.info('Starting Intel audit log rotation job...', {
            retentionDays: this.retentionDays,
        });
        try {
            const auditLogRepository = database_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
            const totalCount = await auditLogRepository.count();
            if (totalCount === 0) {
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Intel audit log rotation skipped — table is empty (${duration}ms)`);
                return { logsDeleted: 0, logsArchived: 0, duration };
            }
            const logsToRotate = await this.countLogsToRotate();
            const logsArchived = await this.archiveOldLogs();
            const logsDeleted = await this.deleteOldLogs();
            const duration = Date.now() - startTime;
            logger_1.logger.info(`Intel audit log rotation completed in ${duration}ms`, {
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
        }
        catch (error) {
            logger_1.logger.error('Error during Intel audit log rotation:', error);
            throw error;
        }
    }
    async countLogsToRotate() {
        try {
            const auditLogRepository = database_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
            const cutoffDate = this.getCutoffDate();
            const count = await auditLogRepository
                .createQueryBuilder('log')
                .where('log.createdAt < :cutoffDate', { cutoffDate })
                .getCount();
            return count;
        }
        catch (error) {
            logger_1.logger.error('Error counting logs to rotate:', error);
            return 0;
        }
    }
    async archiveOldLogs() {
        try {
            const shouldArchive = process.env.INTEL_AUDIT_LOG_ARCHIVE === 'true';
            if (!shouldArchive) {
                return 0;
            }
            const auditLogRepository = database_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
            const cutoffDate = this.getCutoffDate();
            const logsToArchive = await auditLogRepository
                .createQueryBuilder('log')
                .where('log.createdAt < :cutoffDate', { cutoffDate })
                .orderBy('log.createdAt', 'ASC')
                .getMany();
            if (logsToArchive.length === 0) {
                return 0;
            }
            const archiveSummary = logsToArchive.map(log => ({
                id: log.id,
                organizationId: log.organizationId,
                action: log.action,
                severity: log.severity,
                createdAt: log.createdAt,
                hasMetadata: !!log.metadata,
            }));
            logger_1.logger.info('Intel audit log archive summary', {
                totalLogs: archiveSummary.length,
                dateRange: {
                    oldest: archiveSummary[0]?.createdAt,
                    newest: archiveSummary.at(-1)?.createdAt,
                },
                actionBreakdown: this.getActionBreakdown(logsToArchive),
                severityBreakdown: this.getSeverityBreakdown(logsToArchive),
            });
            return logsToArchive.length;
        }
        catch (error) {
            logger_1.logger.error('Error archiving audit logs:', error);
            return 0;
        }
    }
    async deleteOldLogs() {
        try {
            const auditLogRepository = database_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
            const cutoffDate = this.getCutoffDate();
            const result = await auditLogRepository
                .createQueryBuilder()
                .delete()
                .where('createdAt < :cutoffDate', { cutoffDate })
                .execute();
            const deleted = result.affected || 0;
            if (deleted > 0) {
                logger_1.logger.info(`Deleted ${deleted} Intel audit log records older than ${this.retentionDays} days`);
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error('Error deleting old audit logs:', error);
            return 0;
        }
    }
    getCutoffDate() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
        return cutoffDate;
    }
    getActionBreakdown(logs) {
        const breakdown = {};
        for (const log of logs) {
            breakdown[log.action] = (breakdown[log.action] || 0) + 1;
        }
        return breakdown;
    }
    getSeverityBreakdown(logs) {
        const breakdown = {};
        for (const log of logs) {
            breakdown[log.severity] = (breakdown[log.severity] || 0) + 1;
        }
        return breakdown;
    }
    async getStatistics() {
        try {
            const auditLogRepository = database_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
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
        }
        catch (error) {
            logger_1.logger.error('Error getting Intel audit log statistics:', error);
            throw error;
        }
    }
}
exports.IntelAuditLogRotationJob = IntelAuditLogRotationJob;
function scheduleIntelAuditLogRotation() {
    const explicitFlag = process.env.JOBS_INTEL_AUDIT_ROTATION_ENABLED;
    const enabled = explicitFlag === 'true' || (explicitFlag !== 'false' && process.env.NODE_ENV === 'production');
    if (!enabled) {
        logger_1.logger.info('Intel audit log rotation job disabled (set JOBS_INTEL_AUDIT_ROTATION_ENABLED=true to enable in non-production)');
        return null;
    }
    const job = new IntelAuditLogRotationJob();
    let intervalId = null;
    const now = new Date();
    const next4AM = new Date();
    next4AM.setUTCHours(4, 0, 0, 0);
    if (now > next4AM) {
        next4AM.setDate(next4AM.getDate() + 1);
    }
    const msUntilNext4AM = next4AM.getTime() - now.getTime();
    logger_1.logger.info(`Scheduling Intel audit log rotation job to run at ${next4AM.toISOString()}`, {
        retentionDays: Number.parseInt(process.env.INTEL_AUDIT_LOG_RETENTION_DAYS || '30', 10),
    });
    const timeoutId = setTimeout(async () => {
        try {
            await job.execute();
        }
        catch (err) {
            logger_1.logger.error('Intel audit log rotation job failed:', err);
        }
        intervalId = setInterval(async () => {
            try {
                await job.execute();
            }
            catch (err) {
                logger_1.logger.error('Intel audit log rotation job failed:', err);
            }
        }, 24 * 60 * 60 * 1000);
        intervalId.unref();
    }, msUntilNext4AM);
    return {
        cleanup: () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (intervalId) {
                clearInterval(intervalId);
            }
            logger_1.logger.info('Intel audit log rotation job stopped');
        },
    };
}
//# sourceMappingURL=intelAuditLogRotation.js.map