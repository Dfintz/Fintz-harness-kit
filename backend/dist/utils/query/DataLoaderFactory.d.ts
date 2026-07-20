import { ObjectLiteral, Repository } from 'typeorm';
type BatchLoadFn<K, V> = (keys: K[]) => Promise<(V | undefined)[]>;
interface DataLoaderOptions {
    maxBatchSize?: number;
    cache?: boolean;
    batchDelay?: number;
}
export declare class DataLoader<K, V> {
    private readonly batchLoadFn;
    private readonly cache;
    private readonly queue;
    private batchTimeout;
    private readonly options;
    constructor(batchLoadFn: BatchLoadFn<K, V>, options?: DataLoaderOptions);
    load(key: K): Promise<V | undefined>;
    loadMany(keys: K[]): Promise<(V | undefined)[]>;
    clear(key?: K): this;
    prime(key: K, value: V): this;
    private scheduleBatch;
    private executeBatch;
}
export declare class DataLoaderFactory {
    static createEntityLoader<T extends ObjectLiteral>(repository: Repository<T>, idField?: keyof T, additionalWhere?: Partial<T>, options?: DataLoaderOptions): DataLoader<string, T>;
    static createRelationLoader<T extends ObjectLiteral>(repository: Repository<T>, foreignKey: keyof T, additionalWhere?: Partial<T>, options?: DataLoaderOptions): DataLoader<string, T[]>;
    static createCountLoader<T extends ObjectLiteral>(repository: Repository<T>, foreignKey: keyof T, additionalWhere?: Partial<T>, options?: DataLoaderOptions): DataLoader<string, number>;
}
export declare class DataLoaderContext {
    private readonly loaders;
    constructor();
    private toStableScopeString;
    private buildScopeCacheKey;
    private getLoaderOrThrow;
    getEntityLoader<T extends ObjectLiteral>(name: string, repository: Repository<T>, idField?: keyof T, additionalWhere?: Partial<T>): DataLoader<string, T>;
    getRelationLoader<T extends ObjectLiteral>(name: string, repository: Repository<T>, foreignKey: keyof T, additionalWhere?: Partial<T>): DataLoader<string, T[]>;
    getCountLoader<T extends ObjectLiteral>(name: string, repository: Repository<T>, foreignKey: keyof T, additionalWhere?: Partial<T>): DataLoader<string, number>;
    clearAll(): void;
    clearLoader(name: string): void;
}
export {};
//# sourceMappingURL=DataLoaderFactory.d.ts.map