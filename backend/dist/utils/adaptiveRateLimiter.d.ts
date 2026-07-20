export interface AdaptiveRateLimiterOptions {
    minIntervalMs: number;
    maxIntervalMs: number;
    backoffMultiplier?: number;
    recoveryMultiplier?: number;
    maxCooldownMs?: number;
    label?: string;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}
export interface AdaptiveRateLimiterStats {
    acquisitions: number;
    backpressureEvents: number;
    totalWaitMs: number;
    peakIntervalMs: number;
    currentIntervalMs: number;
}
export declare class AdaptiveRateLimiter {
    private readonly minIntervalMs;
    private readonly maxIntervalMs;
    private readonly backoffMultiplier;
    private readonly recoveryMultiplier;
    private readonly maxCooldownMs;
    private readonly label;
    private readonly now;
    private readonly sleep;
    private currentIntervalMs;
    private nextAllowedAt;
    private acquisitions;
    private backpressureEvents;
    private totalWaitMs;
    private peakIntervalMs;
    constructor(options: AdaptiveRateLimiterOptions);
    acquire(): Promise<number>;
    recordSuccess(): void;
    recordBackpressure(retryAfterMs?: number): void;
    getStats(): AdaptiveRateLimiterStats;
    getLabel(): string;
}
//# sourceMappingURL=adaptiveRateLimiter.d.ts.map