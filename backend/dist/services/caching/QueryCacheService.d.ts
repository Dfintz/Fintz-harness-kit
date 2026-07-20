import NodeCache from 'node-cache';
declare class QueryCacheService {
    private cache;
    private defaultTTL;
    constructor();
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttl?: number): boolean;
    del(key: string): number;
    delPattern(pattern: string): number;
    flushAll(): void;
    getStats(): NodeCache.Stats;
    wrap<T>(key: string, queryFn: () => Promise<T>, ttl?: number): Promise<T>;
}
export declare const queryCacheService: QueryCacheService;
export {};
//# sourceMappingURL=QueryCacheService.d.ts.map