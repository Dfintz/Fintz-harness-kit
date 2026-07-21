import NodeCache from 'node-cache';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  IsNull,
  QueryRunner,
  Repository,
} from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OptionalTenantEntity } from '../../models/base/OptionalTenantEntity';
import { TenantEntity } from '../../models/base/TenantEntity';
import { CacheStats, HealthStatus, ServiceHealthCheck } from '../../types/health';
import { NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

/**
 * Configuration options for TenantService
 */
export interface TenantServiceOptions {
  /** Enable caching for this service */
  enableCache?: boolean;
  /** Cache TTL in seconds (default: 300 = 5 minutes) */
  cacheTTL?: number;
  /** Cache check period in seconds (default: 60) */
  cacheCheckPeriod?: number;
  /** Use clones for cached objects (default: false for performance) */
  useClones?: boolean;
}

/**
 * Base service for tenant-scoped operations
 * Automatically filters all queries by organizationId
 *
 * All services operating on tenant-scoped entities should extend this class
 * to ensure proper tenant isolation.
 *
 * Features:
 * - Automatic tenant filtering
 * - Optional caching with automatic invalidation
 * - Sharing entities across organizations
 * - Bulk operations
 */
export abstract class TenantService<T extends TenantEntity | OptionalTenantEntity> {
  protected cache?: NodeCache;
  protected cacheEnabled: boolean;
  private readonly organizationCacheIndex?: Map<string, Set<string>>;
  protected readonly entityName: string;

  constructor(
    protected repository: Repository<T>,
    options?: TenantServiceOptions
  ) {
    this.entityName = repository.metadata.name;
    this.cacheEnabled = options?.enableCache ?? false;

    if (this.cacheEnabled) {
      this.cache = new NodeCache({
        stdTTL: options?.cacheTTL ?? 300, // 5 minutes default
        checkperiod: options?.cacheCheckPeriod ?? 60,
        useClones: options?.useClones ?? false,
      });
      this.organizationCacheIndex = new Map();

      // Keep the registry synchronized for TTL-based evictions.
      this.cache.on('expired', (key: string) => {
        this.removeKeyFromOrganizationIndex(key);
      });

      logger.info('Cache enabled for service', {
        entity: this.entityName,
        ttl: options?.cacheTTL ?? 300,
        checkPeriod: options?.cacheCheckPeriod ?? 60,
      });
    }
  }

  /**
   * Generate cache key for entity
   */
  protected getCacheKey(organizationId: string, id: string): string {
    return `${this.entityName}:${organizationId}:${id}`;
  }

  /**
   * Generate cache key for list queries
   */
  protected getListCacheKey(organizationId: string, suffix?: string): string {
    return suffix
      ? `${this.entityName}:${organizationId}:list:${suffix}`
      : `${this.entityName}:${organizationId}:list`;
  }

  /** Extract organization id from this service's cache keys */
  private getOrganizationIdFromCacheKey(key: string): string | null {
    const prefix = `${this.entityName}:`;
    if (!key.startsWith(prefix)) {
      return null;
    }

    const parts = key.split(':', 3);
    if (parts.length < 3 || !parts[1]) {
      return null;
    }

    return parts[1];
  }

  /** Add key to per-organization cache key index */
  private addKeyToOrganizationIndex(key: string): void {
    if (!this.organizationCacheIndex) {
      return;
    }

    const organizationId = this.getOrganizationIdFromCacheKey(key);
    if (!organizationId) {
      return;
    }

    const existing = this.organizationCacheIndex.get(organizationId);
    if (existing) {
      existing.add(key);
      return;
    }

    this.organizationCacheIndex.set(organizationId, new Set([key]));
  }

  /** Remove key from per-organization cache key index */
  private removeKeyFromOrganizationIndex(key: string): void {
    if (!this.organizationCacheIndex) {
      return;
    }

    const organizationId = this.getOrganizationIdFromCacheKey(key);
    if (!organizationId) {
      return;
    }

    const existing = this.organizationCacheIndex.get(organizationId);
    if (!existing) {
      return;
    }

    existing.delete(key);
    if (existing.size === 0) {
      this.organizationCacheIndex.delete(organizationId);
    }
  }

  /**
   * Get from cache
   */
  protected getFromCache<V>(key: string): V | undefined {
    if (!this.cacheEnabled || !this.cache) {
      return undefined;
    }
    return this.cache.get<V>(key);
  }

  /**
   * Set in cache
   */
  protected setInCache<V>(key: string, value: V, ttl?: number): void {
    if (!this.cacheEnabled || !this.cache) {
      return;
    }
    if (ttl) {
      this.cache.set(key, value, ttl);
    } else {
      this.cache.set(key, value);
    }
    this.addKeyToOrganizationIndex(key);
    logger.debug('Cache set', { key, entity: this.entityName });
  }

  /**
   * Invalidate specific cache key
   */
  protected invalidateCache(key: string): void {
    if (!this.cacheEnabled || !this.cache) {
      return;
    }
    this.cache.del(key);
    this.removeKeyFromOrganizationIndex(key);
    logger.debug('Cache invalidated', { key, entity: this.entityName });
  }

  /**
   * Invalidate all cache keys for an organization
   */
  protected invalidateOrgCache(organizationId: string): void {
    if (!this.cacheEnabled || !this.cache || !this.organizationCacheIndex) {
      return;
    }

    const orgKeys = this.organizationCacheIndex.get(organizationId);
    if (!orgKeys || orgKeys.size === 0) {
      return;
    }

    const keys = Array.from(orgKeys);
    const count = this.cache.del(keys);
    this.organizationCacheIndex.delete(organizationId);

    if (count > 0) {
      logger.debug('Organization cache invalidated', {
        organizationId,
        entity: this.entityName,
        keysInvalidated: count,
      });
    }
  }

  /**
   * Invalidate all caches
   */
  protected invalidateAllCache(): void {
    if (!this.cacheEnabled || !this.cache) {
      return;
    }
    this.cache.flushAll();
    this.organizationCacheIndex?.clear();
    logger.debug('All cache invalidated', { entity: this.entityName });
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): NodeCache.Stats | null {
    if (!this.cacheEnabled || !this.cache) {
      return null;
    }
    return this.cache.getStats();
  }

  /**
   * Get formatted cache statistics for health checks
   */
  private getFormattedCacheStats(): CacheStats | undefined {
    if (!this.cacheEnabled || !this.cache) {
      return undefined;
    }

    const stats = this.cache.getStats();
    const hitRate =
      stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0;

    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      hitRate: Math.round(hitRate * 100) / 100,
      ksize: stats.ksize,
      vsize: stats.vsize,
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.repository.query('SELECT 1');
      return true;
    } catch (error: unknown) {
      logger.error('Database health check failed', {
        entity: this.entityName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Execute a callback within a database transaction.
   * Handles connection, commit, rollback, and release automatically.
   * @param callback - Async function receiving a QueryRunner for transactional operations
   * @returns The result of the callback
   * @throws Re-throws any error after rolling back the transaction
   */
  protected async withTransaction<R>(
    callback: (queryRunner: QueryRunner) => Promise<R>
  ): Promise<R> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    logger.debug('Transaction started', { entity: this.entityName });

    try {
      const result = await callback(queryRunner);
      await queryRunner.commitTransaction();
      logger.debug('Transaction committed', { entity: this.entityName });
      return result;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Transaction rolled back', {
        entity: this.entityName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a callback with a `pessimistic_write` lock held on a single entity row.
   *
   * Loads this service's entity by its primary key inside a transaction (reusing
   * {@link withTransaction}) with `pessimistic_write`, so the callback can safely
   * read-modify-write the row without racing concurrent callers on the same row.
   * Commit, rollback, and release are handled by {@link withTransaction}.
   *
   * Side effects that must run only after the transaction commits (audit logging,
   * websocket emits) belong in the caller, after this method resolves — not inside
   * the callback.
   *
   * @param id - Primary key value of the entity to lock
   * @param callback - Receives the locked entity and the active QueryRunner
   * @param options - `onNotFound` supplies the error thrown when no row matches `id`
   *   (defaults to `NotFoundError(entityName, id)`)
   * @returns The result of the callback
   * @throws The `onNotFound` error (or `NotFoundError`) when the row is absent
   */
  protected async withEntityLock<R>(
    id: string,
    callback: (entity: T, queryRunner: QueryRunner) => Promise<R>,
    options?: { onNotFound?: () => Error }
  ): Promise<R> {
    return this.withTransaction(async queryRunner => {
      const primaryColumn = this.repository.metadata.primaryColumns[0].propertyName;

      const entity = await queryRunner.manager
        .getRepository(this.repository.target)
        .createQueryBuilder('entity')
        .where(`entity.${primaryColumn} = :id`, { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!entity) {
        throw options?.onNotFound?.() ?? new NotFoundError(this.entityName, id);
      }

      return callback(entity, queryRunner);
    });
  }

  /**
   * Perform health check on this service
   */
  public async healthCheck(): Promise<ServiceHealthCheck> {
    const startTime = Date.now();
    const databaseConnected = await this.checkDatabaseConnection();
    const responseTime = Date.now() - startTime;

    let status: HealthStatus = HealthStatus.HEALTHY;

    // Determine health status
    if (!databaseConnected) {
      status = HealthStatus.UNHEALTHY;
    } else if (responseTime > 1000) {
      status = HealthStatus.DEGRADED;
    }

    // Get cache stats if caching is enabled
    const cacheStats = this.getFormattedCacheStats();

    // Check cache performance
    if (this.cacheEnabled && cacheStats) {
      if (cacheStats.hitRate < 50 && cacheStats.hits + cacheStats.misses > 100) {
        status = HealthStatus.DEGRADED;
      }
    }

    return {
      service: this.entityName,
      status,
      cacheEnabled: this.cacheEnabled,
      cacheStats,
      databaseConnected,
      responseTime,
      lastCheck: new Date(),
      details: {
        cacheKeys: cacheStats?.keys || 0,
        memoryUsage: cacheStats ? `${cacheStats.ksize + cacheStats.vsize} bytes` : 'N/A',
      },
    };
  }

  /**
   * Add tenant filter to where clause
   * @param organizationId - Tenant organization ID
   * @param where - Additional where conditions
   * @returns Where clause with tenant filter
   */
  protected addTenantFilter(
    organizationId: string,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (Array.isArray(where)) {
      return where.map(w => ({
        ...w,
        organizationId,
      }));
    }

    return {
      ...where,
      organizationId,
    } as FindOptionsWhere<T>;
  }

  /**
   * Find all entities for a tenant
   * @param organizationId - Tenant organization ID
   * @param options - Additional find options
   * @returns Array of entities
   */
  async findAll(organizationId: string, options?: FindManyOptions<T>): Promise<T[]> {
    logger.debug('TenantService.findAll', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    return this.repository.find({
      ...options,
      where: this.addTenantFilter(organizationId, options?.where),
    });
  }

  /**
   * Find all entities including those shared with the tenant
   * @param organizationId - Tenant organization ID
   * @returns Array of entities (owned + shared)
   */
  async findAllIncludingShared(organizationId: string): Promise<T[]> {
    logger.debug('TenantService.findAllIncludingShared', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    // Find entities where:
    // 1. organizationId matches (owned)
    // 2. sharedWithOrgs array contains the organizationId (shared)
    return this.repository
      .createQueryBuilder('entity')
      .where('entity.organizationId = :organizationId', { organizationId })
      .orWhere(':organizationId = ANY(entity.sharedWithOrgs)', { organizationId })
      .getMany();
  }

  /**
   * Find one entity for a tenant
   * @param organizationId - Tenant organization ID
   * @param where - Where conditions
   * @returns Entity or null
   */
  async findOne(
    organizationId: string,
    where: FindOptionsWhere<T>,
    options?: FindOneOptions<T>
  ): Promise<T | null> {
    logger.debug('TenantService.findOne', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    return this.repository.findOne({
      ...options,
      where: this.addTenantFilter(organizationId, where),
    });
  }

  /**
   * Find entity by ID (simple, no tenant check)
   * @param id - Entity ID
   * @returns Entity or null
   */
  async findByIdSimple(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  /**
   * Find entity by ID with tenant check and caching
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @param options - Additional find options
   * @returns Entity or null
   */
  async findById(
    organizationId: string,
    id: string,
    options?: FindOneOptions<T>
  ): Promise<T | null> {
    logger.debug('TenantService.findById', {
      organizationId,
      id,
      entityType: this.repository.metadata.name,
    });

    // Try cache first
    const cacheKey = this.getCacheKey(organizationId, id);
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      logger.debug('Cache hit', { cacheKey, entity: this.entityName });
      return cached;
    }

    // Fetch from database
    const entity = await this.repository.findOne({
      ...options,
      where: this.addTenantFilter(organizationId, { id } as unknown as FindOptionsWhere<T>),
    });

    // Store in cache if found
    if (entity) {
      this.setInCache(cacheKey, entity);
    }

    return entity;
  }

  /**
   * Find entity by ID including shared entities
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @returns Entity or null
   */
  async findByIdIncludingShared(
    organizationId: string,
    id: string,
    options?: FindOneOptions<T>
  ): Promise<T | null> {
    logger.debug('TenantService.findByIdIncludingShared', {
      organizationId,
      id,
      entityType: this.repository.metadata.name,
    });

    const entity = await this.repository.findOne({
      ...options,
      where: { id } as unknown as FindOptionsWhere<T>,
    });

    if (!entity) {
      return null;
    }

    // Check if user's org owns or has access
    if (entity.organizationId === organizationId || entity.isSharedWith(organizationId)) {
      return entity;
    }

    return null;
  }

  /**
   * Create entity with automatic tenant assignment
   * @param organizationId - Tenant organization ID
   * @param data - Entity data
   * @returns Created entity
   */
  async create(organizationId: string, data: DeepPartial<T>): Promise<T> {
    logger.info('TenantService.create', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    const entity = this.repository.create({
      ...data,
      organizationId,
    } as DeepPartial<T>);

    const saved = await this.repository.save(entity);

    // Cache the new entity
    if ('id' in saved && typeof saved.id === 'string') {
      this.setInCache(this.getCacheKey(organizationId, saved.id), saved);
    }

    return saved;
  }

  /**
   * Create multiple entities with automatic tenant assignment
   * @param organizationId - Tenant organization ID
   * @param dataArray - Array of entity data
   * @returns Array of created entities
   */
  async createMany(organizationId: string, dataArray: DeepPartial<T>[]): Promise<T[]> {
    logger.info('TenantService.createMany', {
      organizationId,
      count: dataArray.length,
      entityType: this.repository.metadata.name,
    });

    const entities = dataArray.map(data =>
      this.repository.create({
        ...data,
        organizationId,
      } as DeepPartial<T>)
    );

    return this.repository.save(entities);
  }

  /**
   * Update entity with tenant check and cache invalidation
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @param data - Update data
   * @returns Updated entity or null
   */
  async update(organizationId: string, id: string, data: DeepPartial<T>): Promise<T | null> {
    logger.info('TenantService.update', {
      organizationId,
      id,
      entityType: this.repository.metadata.name,
    });

    const entity = await this.findById(organizationId, id);
    if (!entity) {
      logger.warn('TenantService.update: Entity not found or access denied', {
        organizationId,
        id,
        entityType: this.repository.metadata.name,
      });
      return null;
    }

    // Don't allow changing organizationId
    const { organizationId: _, ...updateData } = data as Record<string, unknown>;

    Object.assign(entity, updateData);
    const updated = await this.repository.save(entity);

    // Invalidate cache
    this.invalidateCache(this.getCacheKey(organizationId, id));

    return updated;
  }

  /**
   * Delete entity with tenant check and cache invalidation
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @returns true if deleted, false otherwise
   */
  async delete(organizationId: string, id: string): Promise<void> {
    logger.info('TenantService.delete', {
      organizationId,
      id,
      entityType: this.repository.metadata.name,
    });

    // First check if entity exists and belongs to tenant
    const entity = await this.findById(organizationId, id);
    if (!entity) {
      logger.warn('TenantService.delete: Entity not found or access denied', {
        organizationId,
        id,
        entityType: this.repository.metadata.name,
      });
      throw new Error('Entity not found or access denied');
    }

    await this.repository.delete({ id } as unknown as FindOptionsWhere<T>);

    // Invalidate cache
    this.invalidateCache(this.getCacheKey(organizationId, id));
  }
  /**
   * Delete multiple entities with tenant check
   * @param organizationId - Tenant organization ID
   * @param ids - Array of entity IDs
   * @returns Number of deleted entities
   */
  async deleteMany(organizationId: string, ids: string[]): Promise<number> {
    logger.info('TenantService.deleteMany', {
      organizationId,
      count: ids.length,
      entityType: this.repository.metadata.name,
    });

    const result = await this.repository.delete({
      id: ids as unknown,
      organizationId,
    } as unknown as FindOptionsWhere<T>);

    return result.affected || 0;
  }

  /**
   * Count entities for tenant
   * @param organizationId - Tenant organization ID
   * @param where - Additional where conditions
   * @returns Count of entities
   */
  async count(organizationId: string, where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({
      where: this.addTenantFilter(organizationId, where),
    });
  }

  /**
   * Check if entity exists for tenant
   * @param organizationId - Tenant organization ID
   * @param where - Where conditions
   * @returns true if exists
   */
  async exists(organizationId: string, where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.count(organizationId, where);
    return count > 0;
  }

  /**
   * Share entity with other organizations
   * @param organizationId - Owner organization ID
   * @param id - Entity ID
   * @param targetOrgIds - Organizations to share with
   * @returns Updated entity or null
   */
  async shareWith(organizationId: string, id: string, targetOrgIds: string[]): Promise<T | null> {
    logger.info('TenantService.shareWith', {
      organizationId,
      id,
      targetOrgIds,
      entityType: this.repository.metadata.name,
    });

    const entity = await this.findById(organizationId, id);
    if (!entity) {
      return null;
    }

    // Add to shared orgs
    targetOrgIds.forEach(orgId => entity.addSharedOrg(orgId));

    return this.repository.save(entity);
  }

  /**
   * Unshare entity from organizations
   * @param organizationId - Owner organization ID
   * @param id - Entity ID
   * @param targetOrgIds - Organizations to unshare from
   * @returns Updated entity or null
   */
  async unshareWith(organizationId: string, id: string, targetOrgIds: string[]): Promise<T | null> {
    logger.info('TenantService.unshareWith', {
      organizationId,
      id,
      targetOrgIds,
      entityType: this.repository.metadata.name,
    });

    const entity = await this.findById(organizationId, id);
    if (!entity) {
      return null;
    }

    // Remove from shared orgs
    targetOrgIds.forEach(orgId => entity.removeSharedOrg(orgId));

    return this.repository.save(entity);
  }

  /**
   * Get all organizations an entity is shared with
   * @param organizationId - Owner organization ID
   * @param id - Entity ID
   * @returns Array of organization IDs
   */
  async getSharedOrgs(organizationId: string, id: string): Promise<string[]> {
    const entity = await this.findById(organizationId, id);
    return entity?.sharedWithOrgs || [];
  }

  // =========================================
  // PAGINATION METHODS
  // =========================================

  /**
   * Find all entities for a tenant with pagination
   * @param organizationId - Tenant organization ID
   * @param options - Pagination options (page, limit, sortBy, sortOrder)
   * @param where - Additional where conditions
   * @returns Paginated response with data and pagination metadata
   */
  async findAllPaginated(
    organizationId: string,
    options: PaginationOptions,
    where?: FindOptionsWhere<T>
  ): Promise<PaginatedResponse<T>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';

    logger.debug('TenantService.findAllPaginated', {
      organizationId,
      page,
      limit,
      sortBy,
      sortOrder,
      entityType: this.repository.metadata.name,
    });

    const findOptions: FindManyOptions<T> = {
      where: this.addTenantFilter(organizationId, where),
      skip,
      take: limit,
      order: { [sortBy]: sortOrder } as FindManyOptions<T>['order'],
    };

    const [data, total] = await this.repository.findAndCount(findOptions);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find all entities with advanced filtering and pagination using query builder
   * @param organizationId - Tenant organization ID
   * @param options - Pagination options
   * @param queryBuilderCallback - Optional callback to customize query builder
   * @returns Paginated response
   */
  async findAllPaginatedWithQuery(
    organizationId: string,
    options: PaginationOptions,
    queryBuilderCallback?: (qb: ReturnType<Repository<T>['createQueryBuilder']>) => void
  ): Promise<PaginatedResponse<T>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';

    logger.debug('TenantService.findAllPaginatedWithQuery', {
      organizationId,
      page,
      limit,
      entityType: this.repository.metadata.name,
    });

    const queryBuilder = this.repository
      .createQueryBuilder('entity')
      .where('entity.organizationId = :organizationId', { organizationId });

    // Apply custom query builder modifications
    if (queryBuilderCallback) {
      queryBuilderCallback(queryBuilder);
    }

    // Apply pagination and sorting
    queryBuilder.skip(skip).take(limit).orderBy(`entity.${sortBy}`, sortOrder);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // =========================================
  // SOFT DELETE METHODS
  // =========================================

  /**
   * Soft delete entity (sets deletedAt timestamp)
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @param deletedBy - User ID performing the delete
   * @returns Updated entity or null
   */
  async softDelete(organizationId: string, id: string, deletedBy?: string): Promise<T | null> {
    logger.info('TenantService.softDelete', {
      organizationId,
      id,
      deletedBy,
      entityType: this.repository.metadata.name,
    });

    const entity = await this.findById(organizationId, id);
    if (!entity) {
      logger.warn('TenantService.softDelete: Entity not found or access denied', {
        organizationId,
        id,
        entityType: this.repository.metadata.name,
      });
      return null;
    }

    // Update with soft delete fields
    const updateData: Record<string, unknown> = {
      deletedAt: new Date(),
    };

    if (deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repository.update({ id } as unknown as FindOptionsWhere<T>, updateData as any);

    // Invalidate cache
    this.invalidateCache(this.getCacheKey(organizationId, id));

    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
      withDeleted: true,
    });
  }

  /**
   * Restore a soft-deleted entity
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @returns Restored entity or null
   */
  async restore(organizationId: string, id: string): Promise<T | null> {
    logger.info('TenantService.restore', {
      organizationId,
      id,
      entityType: this.repository.metadata.name,
    });

    // Find the entity including soft-deleted ones
    const entity = await this.repository.findOne({
      where: this.addTenantFilter(organizationId, { id } as unknown as FindOptionsWhere<T>),
      withDeleted: true,
    });

    if (!entity) {
      logger.warn('TenantService.restore: Entity not found', {
        organizationId,
        id,
        entityType: this.repository.metadata.name,
      });
      return null;
    }

    // Check if it's actually deleted
    if (!(entity as unknown as Record<string, unknown>).deletedAt) {
      logger.warn('TenantService.restore: Entity is not deleted', {
        organizationId,
        id,
        entityType: this.repository.metadata.name,
      });
      return entity;
    }

    // Restore by clearing deletedAt and deletedBy
    await this.repository.update(
      { id } as unknown as FindOptionsWhere<T>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { deletedAt: null, deletedBy: null } as any
    );

    // Invalidate cache
    this.invalidateCache(this.getCacheKey(organizationId, id));

    return this.findById(organizationId, id);
  }

  /**
   * Find all active (non-deleted) entities
   * @param organizationId - Tenant organization ID
   * @param options - Additional find options
   * @returns Array of active entities
   */
  async findAllActive(organizationId: string, options?: FindManyOptions<T>): Promise<T[]> {
    logger.debug('TenantService.findAllActive', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    const whereWithDeletedFilter = this.addTenantFilter(organizationId, {
      ...options?.where,
      deletedAt: IsNull(),
    } as FindOptionsWhere<T>);

    return this.repository.find({
      ...options,
      where: whereWithDeletedFilter,
    });
  }

  /**
   * Find all entities including soft-deleted ones
   * @param organizationId - Tenant organization ID
   * @returns Array of all entities
   */
  async findAllIncludingDeleted(organizationId: string): Promise<T[]> {
    logger.debug('TenantService.findAllIncludingDeleted', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    return this.repository.find({
      where: this.addTenantFilter(organizationId),
      withDeleted: true,
    });
  }

  /**
   * Find only soft-deleted entities
   * @param organizationId - Tenant organization ID
   * @returns Array of deleted entities
   */
  async findDeleted(organizationId: string): Promise<T[]> {
    logger.debug('TenantService.findDeleted', {
      organizationId,
      entityType: this.repository.metadata.name,
    });

    return this.repository
      .createQueryBuilder('entity')
      .withDeleted()
      .where('entity.organizationId = :organizationId', { organizationId })
      .andWhere('entity.deletedAt IS NOT NULL')
      .getMany();
  }

  /**
   * Permanently delete a soft-deleted entity
   * @param organizationId - Tenant organization ID
   * @param id - Entity ID
   * @returns true if permanently deleted
   */
  async permanentDelete(organizationId: string, id: string): Promise<boolean> {
    logger.info('TenantService.permanentDelete', {
      organizationId,
      id,
      entityType: this.repository.metadata.name,
    });

    // First verify entity exists and belongs to this org
    const entity = await this.repository.findOne({
      where: this.addTenantFilter(organizationId, { id } as unknown as FindOptionsWhere<T>),
      withDeleted: true,
    });

    if (!entity) {
      logger.warn('TenantService.permanentDelete: Entity not found', {
        organizationId,
        id,
        entityType: this.repository.metadata.name,
      });
      return false;
    }

    await this.repository.delete({ id } as unknown as FindOptionsWhere<T>);

    // Invalidate cache
    this.invalidateCache(this.getCacheKey(organizationId, id));

    return true;
  }

  /**
   * Bulk soft delete multiple entities
   * @param organizationId - Tenant organization ID
   * @param ids - Array of entity IDs
   * @param deletedBy - User ID performing the delete
   * @returns Number of soft-deleted entities
   */
  async bulkSoftDelete(organizationId: string, ids: string[], deletedBy?: string): Promise<number> {
    logger.info('TenantService.bulkSoftDelete', {
      organizationId,
      count: ids.length,
      deletedBy,
      entityType: this.repository.metadata.name,
    });

    const updateData: Record<string, unknown> = {
      deletedAt: new Date(),
    };

    if (deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    const result = await this.repository
      .createQueryBuilder()
      .update()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateData as any)
      .where('organizationId = :organizationId', { organizationId })
      .andWhere('id IN (:...ids)', { ids })
      .execute();

    // Invalidate cache for all deleted entities
    ids.forEach(id => {
      this.invalidateCache(this.getCacheKey(organizationId, id));
    });

    return result.affected || 0;
  }
}

