export declare class IntelAuditLogRotationJob {
    private readonly retentionDays;
    constructor();
    execute(): Promise<{
        logsDeleted: number;
        logsArchived: number;
        duration: number;
    }>;
    private executeUnlocked;
    private countLogsToRotate;
    private archiveOldLogs;
    private deleteOldLogs;
    private getCutoffDate;
    private getActionBreakdown;
    private getSeverityBreakdown;
    getStatistics(): Promise<{
        totalLogs: number;
        logsOlderThanRetention: number;
        retentionDays: number;
        oldestLog: Date | null;
        newestLog: Date | null;
    }>;
}
export interface IntelAuditLogJobHandle {
    cleanup: () => void;
}
export declare function scheduleIntelAuditLogRotation(): IntelAuditLogJobHandle | null;
//# sourceMappingURL=intelAuditLogRotation.d.ts.map