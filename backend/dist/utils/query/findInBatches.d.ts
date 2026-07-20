import { FindOptionsRelations, FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
export declare const DEFAULT_FIND_BATCH_SIZE = 500;
export interface FindInBatchesOptions<T extends ObjectLiteral> {
    where?: FindOptionsWhere<T>;
    relations?: FindOptionsRelations<T>;
    batchSize?: number;
    cursorColumn?: keyof T & string;
}
export declare function findInBatches<T extends ObjectLiteral>(repository: Repository<T>, options: FindInBatchesOptions<T>, handler: (batch: T[]) => Promise<void> | void): Promise<number>;
//# sourceMappingURL=findInBatches.d.ts.map