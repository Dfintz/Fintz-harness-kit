interface AnalyticsSnapshot {
    period: string;
    user: {
        initiated: number;
        completed: number;
        successful: number;
        failed: number;
        successRate: string;
        avgCompletionTimeMs: number | null;
    };
    organization: {
        initiated: number;
        completed: number;
        successful: number;
        failed: number;
        successRate: string;
    };
    failureReasons: Record<string, number>;
    recentEvents: number;
}
export declare class RsiVerificationAnalytics {
    private events;
    private readonly initiationTimestamps;
    private readonly pruneTimer;
    private readonly summaryTimer;
    private readonly WINDOW_MS;
    constructor();
    recordInitiation(userId: string): void;
    recordCompletion(userId: string, success: boolean, failureReason?: string): void;
    recordOrgInitiation(_orgId: string): void;
    recordOrgCompletion(_orgId: string, success: boolean, failureReason?: string): void;
    getSnapshot(): AnalyticsSnapshot;
    private categorizeFailure;
    private pruneOldEvents;
}
export declare const rsiVerificationAnalytics: RsiVerificationAnalytics;
export {};
//# sourceMappingURL=RsiVerificationAnalytics.d.ts.map