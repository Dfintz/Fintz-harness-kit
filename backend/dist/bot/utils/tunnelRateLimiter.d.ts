import type { BlockableRateLimitResult } from '../../services/shared/rateLimitPolicy';
export interface RateLimitConfig {
    maxMessages: number;
    windowMs: number;
    blockDurationMs: number;
}
export type RateLimitResult = BlockableRateLimitResult;
export declare class TunnelRateLimiter {
    private static instance;
    private userLimits;
    private defaultConfig;
    private tunnelConfigs;
    private constructor();
    static getInstance(): TunnelRateLimiter;
    checkRateLimit(tunnelId: string, userId: string): RateLimitResult;
    recordMessage(tunnelId: string, userId: string): void;
    setTunnelConfig(tunnelId: string, config: Partial<RateLimitConfig>): void;
    getTunnelConfig(tunnelId: string): RateLimitConfig;
    clearUserLimit(tunnelId: string, userId: string): boolean;
    clearTunnelLimits(tunnelId: string): boolean;
    getUserStatus(tunnelId: string, userId: string): {
        messageCount: number;
        windowStart: Date;
        isBlocked: boolean;
        blockedUntil?: Date;
    } | null;
    getStats(): {
        totalTunnels: number;
        totalUsers: number;
        blockedUsers: number;
        byTunnel: Array<{
            tunnelId: string;
            activeUsers: number;
            blockedUsers: number;
            config: RateLimitConfig;
        }>;
    };
    private startCleanupTask;
    private cleanup;
}
//# sourceMappingURL=tunnelRateLimiter.d.ts.map