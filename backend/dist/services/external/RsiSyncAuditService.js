"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiSyncAuditService = exports.RsiSyncAuditService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const RsiSyncAuditLog_1 = require("../../models/RsiSyncAuditLog");
const logger_1 = require("../../utils/logger");
class RsiSyncAuditService {
    auditLogRepository;
    constructor() {
        this.auditLogRepository = data_source_1.AppDataSource.getRepository(RsiSyncAuditLog_1.RsiSyncAuditLog);
        logger_1.logger.info('RsiSyncAuditService initialized');
    }
    async createLog(input) {
        try {
            const log = this.auditLogRepository.create({
                organizationId: input.organizationId,
                syncType: input.syncType,
                changesDetected: input.changesDetected,
                changesApplied: input.changesApplied,
                errors: input.errors,
                details: input.details,
            });
            const saved = await this.auditLogRepository.save(log);
            logger_1.logger.info(`Created audit log for org ${input.organizationId}`, {
                syncType: input.syncType,
                changesDetected: input.changesDetected,
                changesApplied: input.changesApplied,
                errors: input.errors,
            });
            return saved;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Failed to create audit log', { error: errorMessage, input });
            throw error;
        }
    }
    async logSuccess(organizationId, syncType, changes) {
        return this.createLog({
            organizationId,
            syncType,
            changesDetected: changes.detected,
            changesApplied: changes.applied,
            errors: 0,
            details: changes.details,
        });
    }
    async logFailure(organizationId, syncType, errorDetails) {
        const details = {
            ...errorDetails.details,
            errors: [
                ...(errorDetails.details?.errors || []),
                { error: errorDetails.message },
            ],
        };
        return this.createLog({
            organizationId,
            syncType,
            changesDetected: errorDetails.changesBeforeFailure || 0,
            changesApplied: 0,
            errors: 1,
            details,
        });
    }
    async getLogById(id) {
        try {
            return await this.auditLogRepository.findOne({ where: { id } });
        }
        catch (error) {
            logger_1.logger.error('Failed to get audit log by ID', { error, id });
            return null;
        }
    }
    async getLogs(options) {
        try {
            const queryBuilder = this.auditLogRepository.createQueryBuilder('log');
            if (options.organizationId) {
                queryBuilder.andWhere('log.organizationId = :orgId', {
                    orgId: options.organizationId,
                });
            }
            if (options.syncType) {
                queryBuilder.andWhere('log.syncType = :syncType', {
                    syncType: options.syncType,
                });
            }
            if (options.fromDate) {
                queryBuilder.andWhere('log.syncedAt >= :fromDate', {
                    fromDate: options.fromDate,
                });
            }
            if (options.toDate) {
                queryBuilder.andWhere('log.syncedAt <= :toDate', {
                    toDate: options.toDate,
                });
            }
            if (options.hasErrors !== undefined) {
                if (options.hasErrors) {
                    queryBuilder.andWhere('log.errors > 0');
                }
                else {
                    queryBuilder.andWhere('log.errors = 0');
                }
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('log.syncedAt', 'DESC')
                .skip(options.offset || 0)
                .take(options.limit || 20);
            const logs = await queryBuilder.getMany();
            return { logs, total };
        }
        catch (error) {
            logger_1.logger.error('Failed to get audit logs', { error, options });
            return { logs: [], total: 0 };
        }
    }
    async getRecentLogs(organizationId, limit = 10) {
        const result = await this.getLogs({ organizationId, limit });
        return result.logs;
    }
    async getLastSuccessfulSync(organizationId) {
        try {
            return await this.auditLogRepository.findOne({
                where: {
                    organizationId,
                    errors: 0,
                },
                order: { syncedAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get last successful sync', { error, organizationId });
            return null;
        }
    }
    async getLastSync(organizationId) {
        try {
            return await this.auditLogRepository.findOne({
                where: { organizationId },
                order: { syncedAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get last sync', { error, organizationId });
            return null;
        }
    }
    async getStatistics(organizationId, fromDate) {
        try {
            const queryBuilder = this.auditLogRepository.createQueryBuilder('log')
                .where('log.organizationId = :orgId', { orgId: organizationId });
            if (fromDate) {
                queryBuilder.andWhere('log.syncedAt >= :fromDate', { fromDate });
            }
            const logs = await queryBuilder.getMany();
            const syncsByType = {};
            let totalDurationMs = 0;
            let durationCount = 0;
            for (const log of logs) {
                syncsByType[log.syncType] = (syncsByType[log.syncType] || 0) + 1;
                if (log.details?.durationMs) {
                    totalDurationMs += log.details.durationMs;
                    durationCount++;
                }
            }
            const successfulSyncs = logs.filter(l => l.errors === 0).length;
            const failedSyncs = logs.filter(l => l.errors > 0).length;
            const totalChangesApplied = logs.reduce((sum, l) => sum + l.changesApplied, 0);
            const totalErrors = logs.reduce((sum, l) => sum + l.errors, 0);
            const lastLog = logs.length > 0 ?
                logs.reduce((latest, log) => log.syncedAt > latest.syncedAt ? log : latest) :
                null;
            return {
                totalSyncs: logs.length,
                successfulSyncs,
                failedSyncs,
                totalChangesApplied,
                totalErrors,
                averageDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : null,
                lastSyncAt: lastLog?.syncedAt || null,
                syncsByType,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get statistics', { error, organizationId });
            return {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                totalChangesApplied: 0,
                totalErrors: 0,
                averageDurationMs: null,
                lastSyncAt: null,
                syncsByType: {},
            };
        }
    }
    async getRecentErrors(organizationId, limit = 5) {
        try {
            const logs = await this.auditLogRepository.find({
                where: {
                    organizationId,
                    errors: (0, typeorm_1.MoreThan)(0),
                },
                order: { syncedAt: 'DESC' },
                take: limit,
            });
            return logs.map(log => ({
                syncedAt: log.syncedAt,
                syncType: log.syncType,
                errorCount: log.errors,
                errors: log.details?.errors || [],
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get recent errors', { error, organizationId });
            return [];
        }
    }
    async cleanupOldLogs(olderThan) {
        try {
            const result = await this.auditLogRepository.delete({
                syncedAt: (0, typeorm_1.LessThan)(olderThan),
            });
            const deletedCount = result.affected || 0;
            logger_1.logger.info(`Cleaned up ${deletedCount} old audit logs`);
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup old logs', { error, olderThan });
            return 0;
        }
    }
    async deleteOrgLogs(organizationId) {
        try {
            const result = await this.auditLogRepository.delete({ organizationId });
            const deletedCount = result.affected || 0;
            logger_1.logger.info(`Deleted ${deletedCount} audit logs for org ${organizationId}`);
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to delete org logs', { error, organizationId });
            return 0;
        }
    }
}
exports.RsiSyncAuditService = RsiSyncAuditService;
exports.rsiSyncAuditService = new RsiSyncAuditService();
//# sourceMappingURL=RsiSyncAuditService.js.map