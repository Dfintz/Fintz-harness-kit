export declare class GdprDataCleanupJob {
    execute(): Promise<void>;
    private executeUnlocked;
    private cleanupAccessLogs;
    private anonymizeUserActivities;
    private cleanupExpiredConsents;
    private processDueDeletions;
    getStatistics(): Promise<{
        accessLogsCount: number;
        oldAccessLogsCount: number;
        userActivitiesCount: number;
        oldUserActivitiesCount: number;
        expiredConsentsCount: number;
    }>;
}
export interface GdprCleanupJobHandle {
    cleanup: () => void;
}
export declare function scheduleGdprCleanup(): GdprCleanupJobHandle | null;
//# sourceMappingURL=gdprDataCleanup.d.ts.map