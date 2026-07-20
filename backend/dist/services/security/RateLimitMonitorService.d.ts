import { Request } from 'express';
interface RateLimitViolation {
    identifier: string;
    identifierType: 'user' | 'ip' | 'combined';
    endpoint: string;
    timestamp: number;
    userAgent?: string;
    limit: number;
    current: number;
}
interface RateLimitStats {
    violations: number;
    lastViolation: number;
    endpoints: string[];
}
declare class RateLimitMonitorService {
    private static instance;
    private readonly violationCache;
    private readonly STATS_TTL;
    private readonly REDIS_KEY_PREFIX;
    private readonly cleanupTimer;
    private constructor();
    static getInstance(): RateLimitMonitorService;
    logViolation(violation: RateLimitViolation, _req?: Request): Promise<void>;
    getViolationStats(identifierType: 'user' | 'ip' | 'combined', identifier: string): Promise<RateLimitStats | null>;
    getAllViolationStats(): Map<string, RateLimitStats>;
    clearViolationStats(identifierType: 'user' | 'ip' | 'combined', identifier: string): Promise<void>;
    private alertAdmins;
    private trackInApplicationInsights;
    private loadStatsFromRedis;
    private saveStatsToRedis;
    private cleanupOldViolations;
}
export declare const rateLimitMonitor: RateLimitMonitorService;
export {};
//# sourceMappingURL=RateLimitMonitorService.d.ts.map