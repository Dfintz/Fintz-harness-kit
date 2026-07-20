export declare const DATA_RETENTION_PERIODS: {
    userActivityLogs: number;
    accountAccessLogs: number;
    intelAuditLogs: number;
    tokenBlacklist: number;
    inactiveSessions: number;
    passwordResetTokens: number;
    usedRecoveryCodes: number;
};
export interface RetentionCleanupResult {
    entity: string;
    deletedCount: number;
    retentionDays: number;
    cutoffDate: Date;
    success: boolean;
    error?: string;
}
export declare class DataRetentionService {
    private isRunning;
    private cleanupEntity;
    runCleanup(): Promise<RetentionCleanupResult[]>;
    getRetentionConfig(): typeof DATA_RETENTION_PERIODS;
}
export declare const scheduleDataRetentionCleanup: () => void;
export declare const getDataRetentionService: () => DataRetentionService;
//# sourceMappingURL=DataRetentionService.d.ts.map