export interface CacheMetrics {
    hits: number;
    misses: number;
    keys: number;
    hitRate: number;
    ksize: number;
    vsize: number;
    lastReset: Date;
    avgHitLatency?: number;
    avgMissLatency?: number;
}
export interface CacheWarmingConfig {
    key: string;
    loader: () => Promise<unknown>;
    ttl?: number;
    priority: 'high' | 'medium' | 'low';
    schedule?: 'startup' | 'periodic' | 'on-demand';
    interval?: number;
}
interface MetricsSnapshot {
    timestamp: Date;
    hitRate: number;
    keys: number;
    memoryUsage: number;
}
export declare class EnhancedCacheService {
    private cache;
    private defaultTTL;
    private metricsResetTime;
    private warmingConfigs;
    private warmingIntervals;
    private metricsInterval;
    private tagIndex;
    private metricsHistory;
    private hitLatencies;
    private missLatencies;
    private readonly maxLatencyHistory;
    private readonly maxMetricsHistory;
    constructor(options?: {
        stdTTL?: number;
        checkperiod?: number;
        useClones?: boolean;
        maxKeys?: number;
        enableMetricsSnapshots?: boolean;
    });
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
    }): boolean;
    del(key: string): number;
    delByTag(tag: string): number;
    delByPattern(pattern: string): number;
    flushAll(): void;
    getMetrics(): CacheMetrics;
    resetMetrics(): void;
    getMetricsHistory(): MetricsSnapshot[];
    registerWarming(config: CacheWarmingConfig): void;
    startPeriodicWarming(key: string): void;
    stopPeriodicWarming(key: string): void;
    warmStartupKeys(): Promise<void>;
    warmKey(key: string): Promise<boolean>;
    wrap<T>(key: string, queryFn: () => Promise<T>, options?: {
        ttl?: number;
        tags?: string[];
    }): Promise<T>;
    getKeyInfo(key: string): {
        exists: boolean;
        ttl?: number;
        metadata?: {
            createdAt: Date;
            accessCount: number;
            lastAccessed: Date;
            tags?: string[];
        };
    };
    keys(): string[];
    getKeysByTag(tag: string): string[];
    getTags(): string[];
    has(key: string): boolean;
    ttl(key: string): number | undefined;
    shutdown(): void;
    private addToTagIndex;
    private removeFromTagIndex;
    private recordLatency;
    private calculateAverageLatency;
    private collectMetricsSnapshot;
}
export declare const enhancedCacheService: EnhancedCacheService;
export {};
//# sourceMappingURL=EnhancedCacheService.d.ts.map