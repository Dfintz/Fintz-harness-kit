import { Repository, LessThan, MoreThan } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { RsiSyncAuditLog, SyncType, SyncChangeDetails } from '../../models/RsiSyncAuditLog';
import { logger } from '../../utils/logger';

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
    organizationId: string;
    syncType: SyncType;
    changesDetected: number;
    changesApplied: number;
    errors: number;
    details?: SyncChangeDetails;
}

/**
 * Audit log query options
 */
export interface AuditLogQueryOptions {
    organizationId?: string;
    syncType?: SyncType;
    fromDate?: Date;
    toDate?: Date;
    hasErrors?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Audit statistics for an organization
 */
export interface AuditStatistics {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalChangesApplied: number;
    totalErrors: number;
    averageDurationMs: number | null;
    lastSyncAt: Date | null;
    syncsByType: Record<string, number>;
}

/**
 * RSI Sync Audit Service
 * 
 * Manages audit logging for RSI role sync operations.
 * Part of Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging.
 * 
 * Features:
 * - Create audit log entries
 * - Query audit history
 * - Generate statistics
 * - Log rotation/cleanup
 */
export class RsiSyncAuditService {
    private auditLogRepository: Repository<RsiSyncAuditLog>;

    constructor() {
        this.auditLogRepository = AppDataSource.getRepository(RsiSyncAuditLog);
        logger.info('RsiSyncAuditService initialized');
    }

    // ==================== LOGGING OPERATIONS ====================

    /**
     * Create a new audit log entry
     */
    public async createLog(input: CreateAuditLogInput): Promise<RsiSyncAuditLog> {
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
            
            logger.info(`Created audit log for org ${input.organizationId}`, {
                syncType: input.syncType,
                changesDetected: input.changesDetected,
                changesApplied: input.changesApplied,
                errors: input.errors,
            });

            return saved;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to create audit log', { error: errorMessage, input });
            throw error;
        }
    }

    /**
     * Log a successful sync operation
     */
    public async logSuccess(
        organizationId: string,
        syncType: SyncType,
        changes: {
            detected: number;
            applied: number;
            details?: SyncChangeDetails;
        }
    ): Promise<RsiSyncAuditLog> {
        return this.createLog({
            organizationId,
            syncType,
            changesDetected: changes.detected,
            changesApplied: changes.applied,
            errors: 0,
            details: changes.details,
        });
    }

    /**
     * Log a failed sync operation
     */
    public async logFailure(
        organizationId: string,
        syncType: SyncType,
        errorDetails: {
            message: string;
            changesBeforeFailure?: number;
            details?: SyncChangeDetails;
        }
    ): Promise<RsiSyncAuditLog> {
        const details: SyncChangeDetails = {
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

    // ==================== QUERY OPERATIONS ====================

    /**
     * Get audit log by ID
     */
    public async getLogById(id: string): Promise<RsiSyncAuditLog | null> {
        try {
            return await this.auditLogRepository.findOne({ where: { id } });
        } catch (error: unknown) {
            logger.error('Failed to get audit log by ID', { error, id });
            return null;
        }
    }

    /**
     * Get audit logs with filtering and pagination
     */
    public async getLogs(options: AuditLogQueryOptions): Promise<{
        logs: RsiSyncAuditLog[];
        total: number;
    }> {
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
                } else {
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
        } catch (error: unknown) {
            logger.error('Failed to get audit logs', { error, options });
            return { logs: [], total: 0 };
        }
    }

    /**
     * Get recent audit logs for an organization
     */
    public async getRecentLogs(
        organizationId: string,
        limit: number = 10
    ): Promise<RsiSyncAuditLog[]> {
        const result = await this.getLogs({ organizationId, limit });
        return result.logs;
    }

    /**
     * Get the last successful sync for an organization
     */
    public async getLastSuccessfulSync(
        organizationId: string
    ): Promise<RsiSyncAuditLog | null> {
        try {
            return await this.auditLogRepository.findOne({
                where: {
                    organizationId,
                    errors: 0,
                },
                order: { syncedAt: 'DESC' },
            });
        } catch (error: unknown) {
            logger.error('Failed to get last successful sync', { error, organizationId });
            return null;
        }
    }

    /**
     * Get the last sync (regardless of success) for an organization
     */
    public async getLastSync(
        organizationId: string
    ): Promise<RsiSyncAuditLog | null> {
        try {
            return await this.auditLogRepository.findOne({
                where: { organizationId },
                order: { syncedAt: 'DESC' },
            });
        } catch (error: unknown) {
            logger.error('Failed to get last sync', { error, organizationId });
            return null;
        }
    }

    // ==================== STATISTICS ====================

    /**
     * Get audit statistics for an organization
     */
    public async getStatistics(
        organizationId: string,
        fromDate?: Date
    ): Promise<AuditStatistics> {
        try {
            const queryBuilder = this.auditLogRepository.createQueryBuilder('log')
                .where('log.organizationId = :orgId', { orgId: organizationId });

            if (fromDate) {
                queryBuilder.andWhere('log.syncedAt >= :fromDate', { fromDate });
            }

            const logs = await queryBuilder.getMany();

            const syncsByType: Record<string, number> = {};
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
        } catch (error: unknown) {
            logger.error('Failed to get statistics', { error, organizationId });
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

    /**
     * Get error summary for recent syncs
     */
    public async getRecentErrors(
        organizationId: string,
        limit: number = 5
    ): Promise<Array<{
        syncedAt: Date;
        syncType: SyncType;
        errorCount: number;
        errors: Array<{ userId?: string; rsiHandle?: string; error: string }>;
    }>> {
        try {
            const logs = await this.auditLogRepository.find({
                where: {
                    organizationId,
                    errors: MoreThan(0),
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
        } catch (error: unknown) {
            logger.error('Failed to get recent errors', { error, organizationId });
            return [];
        }
    }

    // ==================== CLEANUP OPERATIONS ====================

    /**
     * Delete old audit logs (log rotation)
     * @param olderThan - Delete logs older than this date
     * @returns Number of deleted records
     */
    public async cleanupOldLogs(olderThan: Date): Promise<number> {
        try {
            const result = await this.auditLogRepository.delete({
                syncedAt: LessThan(olderThan),
            });

            const deletedCount = result.affected || 0;
            logger.info(`Cleaned up ${deletedCount} old audit logs`);
            return deletedCount;
        } catch (error: unknown) {
            logger.error('Failed to cleanup old logs', { error, olderThan });
            return 0;
        }
    }

    /**
     * Delete all audit logs for an organization
     * @returns Number of deleted records
     */
    public async deleteOrgLogs(organizationId: string): Promise<number> {
        try {
            const result = await this.auditLogRepository.delete({ organizationId });
            const deletedCount = result.affected || 0;
            logger.info(`Deleted ${deletedCount} audit logs for org ${organizationId}`);
            return deletedCount;
        } catch (error: unknown) {
            logger.error('Failed to delete org logs', { error, organizationId });
            return 0;
        }
    }
}

// Export singleton instance
export const rsiSyncAuditService = new RsiSyncAuditService();

