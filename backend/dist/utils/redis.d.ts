import Redis, { Cluster, RedisOptions } from 'ioredis';
type RedisClientLike = Redis | Cluster;
export interface EntraTokenRefreshHandle {
    stop: () => void;
    refreshNow: () => Promise<void>;
}
export declare function sanitizeRedisErrorForLogging(error: unknown): Record<string, unknown>;
export declare function attachRedisErrorObserver(client: RedisClientLike, clientLabel: string, onWrongPass?: () => void): void;
export declare function setupEntraTokenRefreshForClient(client: RedisClientLike, clientLabel: string): Promise<EntraTokenRefreshHandle | null>;
declare class RedisClient {
    private static instance;
    private client;
    private isConnected;
    private isEnabled;
    private cacheHits;
    private cacheMisses;
    private hasConnectedBefore;
    private tokenRefreshTimer;
    private isRefreshingEntraCredentials;
    private constructor();
    static getInstance(): RedisClient;
    private initialize;
    private initializeSync;
    private initializeAsync;
    private scheduleTokenRefresh;
    private attachEventHandlers;
    private applyEntraCredentialsToClient;
    private reauthenticateWithEntraToken;
    private recoverFromWrongPass;
    private getOrgRegistryKey;
    private getOrganizationIdFromCacheKey;
    private createBatches;
    private emitOrgRegistryMetric;
    private emitOrgRegistrySizeMetric;
    private trackOrgCacheKey;
    private untrackOrgCacheKeys;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
    del(key: string | string[]): Promise<boolean>;
    acquireLock(lockKey: string, ttlSeconds?: number): Promise<boolean>;
    releaseLock(lockKey: string): Promise<void>;
    delPattern(pattern: string): Promise<number>;
    exists(key: string): Promise<boolean>;
    ttl(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    getOrgCacheKeys(organizationId: string): Promise<string[]>;
    delOrgCacheKeys(organizationId: string, keyPrefixes?: string[]): Promise<number>;
    sadd(key: string, ...members: string[]): Promise<number>;
    srem(key: string, ...members: string[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sismember(key: string, member: string): Promise<boolean>;
    scard(key: string): Promise<number>;
    flushAll(): Promise<boolean>;
    getStatus(): {
        connected: boolean;
        enabled: boolean;
    };
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
    };
    resetStats(): void;
    getClient(): Redis | Cluster | null;
    close(): Promise<void>;
}
export declare const redisClient: RedisClient;
export declare const cache: {
    get: <T>(key: string) => Promise<T | null>;
    set: (key: string, value: unknown, ttl?: number) => Promise<boolean>;
    del: (key: string | string[]) => Promise<boolean>;
    delPattern: (pattern: string) => Promise<number>;
    getOrgCacheKeys: (organizationId: string) => Promise<string[]>;
    delOrgCacheKeys: (organizationId: string, keyPrefixes?: string[]) => Promise<number>;
    exists: (key: string) => Promise<boolean>;
    ttl: (key: string) => Promise<number>;
    keys: (pattern: string) => Promise<string[]>;
    sadd: (key: string, ...members: string[]) => Promise<number>;
    srem: (key: string, ...members: string[]) => Promise<number>;
    smembers: (key: string) => Promise<string[]>;
    sismember: (key: string, member: string) => Promise<boolean>;
    scard: (key: string) => Promise<number>;
    flushAll: () => Promise<boolean>;
    getStatus: () => {
        connected: boolean;
        enabled: boolean;
    };
    getStats: () => {
        hits: number;
        misses: number;
        hitRate: number;
    };
    resetStats: () => void;
    close: () => Promise<void>;
};
export declare function getRedisConfig(): RedisOptions | null;
export declare function getRedisConfigAsync(): Promise<RedisOptions | null>;
export {};
//# sourceMappingURL=redis.d.ts.map