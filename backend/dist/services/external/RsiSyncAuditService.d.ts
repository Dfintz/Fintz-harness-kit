import { RsiSyncAuditLog, SyncType, SyncChangeDetails } from '../../models/RsiSyncAuditLog';
export interface CreateAuditLogInput {
    organizationId: string;
    syncType: SyncType;
    changesDetected: number;
    changesApplied: number;
    errors: number;
    details?: SyncChangeDetails;
}
export interface AuditLogQueryOptions {
    organizationId?: string;
    syncType?: SyncType;
    fromDate?: Date;
    toDate?: Date;
    hasErrors?: boolean;
    limit?: number;
    offset?: number;
}
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
export declare class RsiSyncAuditService {
    private auditLogRepository;
    constructor();
    createLog(input: CreateAuditLogInput): Promise<RsiSyncAuditLog>;
    logSuccess(organizationId: string, syncType: SyncType, changes: {
        detected: number;
        applied: number;
        details?: SyncChangeDetails;
    }): Promise<RsiSyncAuditLog>;
    logFailure(organizationId: string, syncType: SyncType, errorDetails: {
        message: string;
        changesBeforeFailure?: number;
        details?: SyncChangeDetails;
    }): Promise<RsiSyncAuditLog>;
    getLogById(id: string): Promise<RsiSyncAuditLog | null>;
    getLogs(options: AuditLogQueryOptions): Promise<{
        logs: RsiSyncAuditLog[];
        total: number;
    }>;
    getRecentLogs(organizationId: string, limit?: number): Promise<RsiSyncAuditLog[]>;
    getLastSuccessfulSync(organizationId: string): Promise<RsiSyncAuditLog | null>;
    getLastSync(organizationId: string): Promise<RsiSyncAuditLog | null>;
    getStatistics(organizationId: string, fromDate?: Date): Promise<AuditStatistics>;
    getRecentErrors(organizationId: string, limit?: number): Promise<Array<{
        syncedAt: Date;
        syncType: SyncType;
        errorCount: number;
        errors: Array<{
            userId?: string;
            rsiHandle?: string;
            error: string;
        }>;
    }>>;
    cleanupOldLogs(olderThan: Date): Promise<number>;
    deleteOrgLogs(organizationId: string): Promise<number>;
}
export declare const rsiSyncAuditService: RsiSyncAuditService;
//# sourceMappingURL=RsiSyncAuditService.d.ts.map