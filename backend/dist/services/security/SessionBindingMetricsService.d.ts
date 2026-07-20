export interface MismatchReason {
    ip?: boolean;
    userAgent?: boolean;
    deviceFingerprint?: boolean;
}
export interface BindingMetricEvent {
    userId: string;
    success: boolean;
    mismatches?: MismatchReason;
    path: string;
    enforced: boolean;
    timestamp: Date;
}
export declare class SessionBindingMetricsService {
    private static instance;
    private mismatchCount;
    private successCount;
    private mismatchByReason;
    private lastResetTime;
    private rollupInterval;
    private constructor();
    static getInstance(): SessionBindingMetricsService;
    recordMismatch(event: BindingMetricEvent): void;
    recordSuccess(event: Omit<BindingMetricEvent, 'mismatches'>): void;
    getMismatchRate(): number;
    shouldAlertThreshold(): boolean;
    getMismatchByReason(): {
        ip: number;
        userAgent: number;
        deviceFingerprint: number;
    };
    getEventCounts(): {
        mismatchCount: number;
        successCount: number;
        total: number;
    };
    reset(): void;
    private startPeriodicRollup;
    private emitCustomMetric;
    private hashUserId;
}
export declare const sessionBindingMetricsService: SessionBindingMetricsService;
//# sourceMappingURL=SessionBindingMetricsService.d.ts.map