export interface BaseServiceOptions {
    skipValidation?: boolean;
    skipNotifications?: boolean;
    userId?: string;
}
export interface FindOptions extends BaseServiceOptions {
    includeDeleted?: boolean;
    relations?: string[];
    select?: string[];
    lock?: {
        mode: 'optimistic';
        version: number | Date;
    } | {
        mode: 'pessimistic_read' | 'pessimistic_write';
    };
}
export interface CreateOptions extends BaseServiceOptions {
    includeRelations?: boolean;
}
export interface UpdateOptions extends BaseServiceOptions {
    partial?: boolean;
    merge?: boolean;
}
export interface DeleteOptions extends BaseServiceOptions {
    hardDelete?: boolean;
    cascade?: boolean;
}
export interface BulkOperationOptions extends BaseServiceOptions {
    continueOnError?: boolean;
    batchSize?: number;
}
export interface TransactionOptions {
    isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
}
export interface CacheOptions {
    ttl?: number;
    skipCache?: boolean;
    invalidateCache?: boolean;
}
export interface ExportOptions extends BaseServiceOptions {
    format?: 'json' | 'csv' | 'xlsx';
    includeArchived?: boolean;
    fields?: string[];
}
//# sourceMappingURL=options.d.ts.map