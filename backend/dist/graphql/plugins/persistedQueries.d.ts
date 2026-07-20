import { ApolloServerPlugin, BaseContext } from '@apollo/server';
export interface PersistedQueryStorage {
    get(hash: string): Promise<string | null>;
    set(hash: string, query: string): Promise<void>;
    has(hash: string): Promise<boolean>;
    delete(hash: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    size(): Promise<number>;
}
export declare class InMemoryPersistedQueryStorage implements PersistedQueryStorage {
    private queries;
    private maxSize;
    constructor(maxSize?: number);
    get(hash: string): Promise<string | null>;
    set(hash: string, query: string): Promise<void>;
    has(hash: string): Promise<boolean>;
    delete(hash: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    size(): Promise<number>;
}
export declare class RedisPersistedQueryStorage implements PersistedQueryStorage {
    private prefix;
    private ttl;
    private fallbackStorage;
    constructor(prefix?: string, ttl?: number);
    private getKey;
    get(hash: string): Promise<string | null>;
    set(hash: string, query: string): Promise<void>;
    has(hash: string): Promise<boolean>;
    delete(hash: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    size(): Promise<number>;
}
export interface PersistedQueriesPluginOptions {
    storage?: PersistedQueryStorage;
    allowAutoRegister?: boolean;
    hashAlgorithm?: string;
    maxQuerySize?: number;
    allowedHashes?: Set<string>;
    logEvents?: boolean;
}
export interface PersistedQueryStats {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    registrations: number;
    hitRate: number;
    storedQueries: number;
}
export declare class PersistedQueriesManager {
    private storage;
    private options;
    private stats;
    constructor(options?: PersistedQueriesPluginOptions);
    computeHash(query: string): string;
    getQuery(hash: string): Promise<string | null>;
    registerQuery(query: string, providedHash?: string): Promise<string>;
    hasQuery(hash: string): Promise<boolean>;
    deleteQuery(hash: string): Promise<boolean>;
    clearAll(): Promise<void>;
    getStats(): Promise<PersistedQueryStats>;
    resetStats(): void;
    getStoredHashes(): Promise<string[]>;
    private updateHitRate;
}
export declare function createPersistedQueriesPlugin(options?: PersistedQueriesPluginOptions): ApolloServerPlugin;
export declare const persistedQueriesManager: PersistedQueriesManager;
export declare const persistedQueriesPlugin: ApolloServerPlugin<BaseContext>;
//# sourceMappingURL=persistedQueries.d.ts.map