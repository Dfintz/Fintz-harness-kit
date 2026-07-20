import type { RateLimitResult } from './rateLimitPolicy';
export type { RateLimitResult };
export declare class RedisRateLimiter {
    private static instance;
    private readonly memoryStore;
    private readonly memorySweep;
    private constructor();
    static getInstance(): RedisRateLimiter;
    check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
    private checkMemory;
    resetForTests(): void;
}
export declare const redisRateLimiter: RedisRateLimiter;
//# sourceMappingURL=RedisRateLimiter.d.ts.map