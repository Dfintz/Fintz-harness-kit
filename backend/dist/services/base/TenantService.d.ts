import NodeCache from 'node-cache';
import { DeepPartial, FindManyOptions, FindOneOptions, FindOptionsWhere, QueryRunner, Repository } from 'typeorm';
import { OptionalTenantEntity } from '../../models/base/OptionalTenantEntity';
import { TenantEntity } from '../../models/base/TenantEntity';
import { ServiceHealthCheck } from '../../types/health';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface TenantServiceOptions {
    enableCache?: boolean;
    cacheTTL?: number;
    cacheCheckPeriod?: number;
    useClones?: boolean;
}
export declare abstract class TenantService<T extends TenantEntity | OptionalTenantEntity> {
    protected repository: Repository<T>;
    protected cache?: NodeCache;
    protected cacheEnabled: boolean;
    private readonly organizationCacheIndex?;
    protected readonly entityName: string;
    constructor(repository: Repository<T>, options?: TenantServiceOptions);
    protected getCacheKey(organizationId: string, id: string): string;
    protected getListCacheKey(organizationId: string, suffix?: string): string;
    private getOrganizationIdFromCacheKey;
    private addKeyToOrganizationIndex;
    private removeKeyFromOrganizationIndex;
    protected getFromCache<V>(key: string): V | undefined;
    protected setInCache<V>(key: string, value: V, ttl?: number): void;
    protected invalidateCache(key: string): void;
    protected invalidateOrgCache(organizationId: string): void;
    protected invalidateAllCache(): void;
    getCacheStats(): NodeCache.Stats | null;
    private getFormattedCacheStats;
    private checkDatabaseConnection;
    protected withTransaction<R>(callback: (queryRunner: QueryRunner) => Promise<R>): Promise<R>;
    protected withEntityLock<R>(id: string, callback: (entity: T, queryRunner: QueryRunner) => Promise<R>, options?: {
        onNotFound?: () => Error;
    }): Promise<R>;
    healthCheck(): Promise<ServiceHealthCheck>;
    protected addTenantFilter(organizationId: string, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): FindOptionsWhere<T> | FindOptionsWhere<T>[];
    findAll(organizationId: string, options?: FindManyOptions<T>): Promise<T[]>;
    findAllIncludingShared(organizationId: string): Promise<T[]>;
    findOne(organizationId: string, where: FindOptionsWhere<T>, options?: FindOneOptions<T>): Promise<T | null>;
    findByIdSimple(id: string): Promise<T | null>;
    findById(organizationId: string, id: string, options?: FindOneOptions<T>): Promise<T | null>;
    findByIdIncludingShared(organizationId: string, id: string, options?: FindOneOptions<T>): Promise<T | null>;
    create(organizationId: string, data: DeepPartial<T>): Promise<T>;
    createMany(organizationId: string, dataArray: DeepPartial<T>[]): Promise<T[]>;
    update(organizationId: string, id: string, data: DeepPartial<T>): Promise<T | null>;
    delete(organizationId: string, id: string): Promise<void>;
    deleteMany(organizationId: string, ids: string[]): Promise<number>;
    count(organizationId: string, where?: FindOptionsWhere<T>): Promise<number>;
    exists(organizationId: string, where: FindOptionsWhere<T>): Promise<boolean>;
    shareWith(organizationId: string, id: string, targetOrgIds: string[]): Promise<T | null>;
    unshareWith(organizationId: string, id: string, targetOrgIds: string[]): Promise<T | null>;
    getSharedOrgs(organizationId: string, id: string): Promise<string[]>;
    findAllPaginated(organizationId: string, options: PaginationOptions, where?: FindOptionsWhere<T>): Promise<PaginatedResponse<T>>;
    findAllPaginatedWithQuery(organizationId: string, options: PaginationOptions, queryBuilderCallback?: (qb: ReturnType<Repository<T>['createQueryBuilder']>) => void): Promise<PaginatedResponse<T>>;
    softDelete(organizationId: string, id: string, deletedBy?: string): Promise<T | null>;
    restore(organizationId: string, id: string): Promise<T | null>;
    findAllActive(organizationId: string, options?: FindManyOptions<T>): Promise<T[]>;
    findAllIncludingDeleted(organizationId: string): Promise<T[]>;
    findDeleted(organizationId: string): Promise<T[]>;
    permanentDelete(organizationId: string, id: string): Promise<boolean>;
    bulkSoftDelete(organizationId: string, ids: string[], deletedBy?: string): Promise<number>;
}
//# sourceMappingURL=TenantService.d.ts.map