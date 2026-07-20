import { RedisStore } from 'rate-limit-redis';
export declare function createRateLimitStore(): RedisStore | undefined;
export declare function getRateLimitStoreStatus(): {
    type: 'redis' | 'memory';
    available: boolean;
    prefix?: string;
};
//# sourceMappingURL=rateLimitStore.d.ts.map