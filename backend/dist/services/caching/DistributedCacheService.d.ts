export declare enum CacheBackend {
    REDIS = "redis",
    MEMORY = "memory",
    HYBRID = "hybrid"
}
export interface DistributedCacheConfig {
    backend: CacheBackend;
    defaultTTL: number;
    keyPrefix?: string;
    checkPeriod?: number;
}
export interface CacheStats {
    backend: CacheBackend;
    hits: number;
    misses: number;
    keys: number;
    ksize?: number;
    vsize?: number;
}
export declare class DistributedCacheService {
    private readonly config;
    private memoryCache;
    private readonly stats;
    constructor(config: DistributedCacheConfig);
    private buildKey;
    private getActiveBackend;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
    del(key: string | string[]): Promise<boolean>;
    delPattern(pattern: string): Promise<number>;
    exists(key: string): Promise<boolean>;
    keys(): Promise<string[]>;
    flushAll(): Promise<boolean>;
    getStats(): Promise<CacheStats>;
    ttl(key: string): Promise<number>;
    close(): Promise<void>;
}
export declare function createDistributedCache(config?: Partial<DistributedCacheConfig>): DistributedCacheService;
//# sourceMappingURL=DistributedCacheService.d.ts.map