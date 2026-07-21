import { In, ObjectLiteral, Repository } from 'typeorm';

/**
 * Batch loading function type
 * Takes an array of keys and returns an array of values (or undefined for missing)
 */
type BatchLoadFn<K, V> = (keys: K[]) => Promise<(V | undefined)[]>;

/**
 * Options for DataLoader
 */
interface DataLoaderOptions {
  /** Maximum batch size (default: 100) */
  maxBatchSize?: number;
  /** Whether to cache results within the loader instance (default: true) */
  cache?: boolean;
  /** Batch delay in milliseconds (default: 0) */
  batchDelay?: number;
}

/**
 * A simple DataLoader implementation for batching and caching database queries.
 * Prevents N+1 query problems by batching multiple requests into a single query.
 *
 * @template K Key type (typically string for entity IDs)
 * @template V Value type (the entity being loaded)
 *
 * @example
 * ```typescript
 * const shipLoader = DataLoaderFactory.createEntityLoader(
 *   shipRepository,
 *   'id',
 *   { organizationId: 'org-123' }
 * );
 *
 * // These calls will be batched into a single query
 * const ship1 = await shipLoader.load('ship-1');
 * const ship2 = await shipLoader.load('ship-2');
 * const ship3 = await shipLoader.load('ship-3');
 * ```
 */
export class DataLoader<K, V> {
  private readonly cache: Map<K, Promise<V | undefined>>;
  private readonly queue: Array<{
    key: K;
    resolve: (value: V | undefined) => void;
    reject: (error: Error) => void;
  }>;
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly options: Required<DataLoaderOptions>;

  constructor(
    private readonly batchLoadFn: BatchLoadFn<K, V>,
    options: DataLoaderOptions = {}
  ) {
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 100,
      cache: options.cache ?? true,
      batchDelay: options.batchDelay ?? 0,
    };
    this.cache = new Map();
    this.queue = [];
  }

  /**
   * Load a single value by key.
   * If the key was already loaded, returns cached result.
   * Otherwise, adds to batch queue.
   */
  load(key: K): Promise<V | undefined> {
    // Check cache first
    if (this.options.cache) {
      const cachedPromise = this.cache.get(key);
      if (cachedPromise) {
        return cachedPromise;
      }
    }

    // Create promise for this load
    const promise = new Promise<V | undefined>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      this.scheduleBatch();
    });

    // Cache the promise
    if (this.options.cache) {
      this.cache.set(key, promise);
    }

    return promise;
  }

  /**
   * Load multiple values by keys.
   */
  async loadMany(keys: K[]): Promise<(V | undefined)[]> {
    return Promise.all(keys.map(key => this.load(key)));
  }

  /**
   * Clear the cache for a specific key or all keys.
   */
  clear(key?: K): this {
    if (key === undefined) {
      this.cache.clear();
      return this;
    }

    this.cache.delete(key);
    return this;
  }

  /**
   * Prime the cache with a known value.
   */
  prime(key: K, value: V): this {
    if (this.options.cache && !this.cache.has(key)) {
      this.cache.set(key, Promise.resolve(value));
    }
    return this;
  }

  private scheduleBatch(): void {
    if (this.batchTimeout !== null) {
      return; // Already scheduled
    }

    if (this.options.batchDelay > 0) {
      this.batchTimeout = setTimeout(() => {
        void this.executeBatch();
      }, this.options.batchDelay);
    } else {
      // Use setImmediate/nextTick for immediate batching
      this.batchTimeout = setImmediate(() => {
        void this.executeBatch();
      }) as unknown as NodeJS.Timeout;
    }
  }

  private async executeBatch(): Promise<void> {
    this.batchTimeout = null;

    if (this.queue.length === 0) {
      return;
    }

    // Get current batch (up to maxBatchSize)
    const batch = this.queue.splice(0, this.options.maxBatchSize);
    const keys = batch.map(item => item.key);

    try {
      const results = await this.batchLoadFn(keys);

      // Validate results length
      if (results.length !== keys.length) {
        throw new Error(
          `DataLoader batch function returned ${results.length} results for ${keys.length} keys`
        );
      }

      // Resolve promises
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach(item => {
        item.reject(error instanceof Error ? error : new Error(String(error)));
        // Clear cache on error
        if (this.options.cache) {
          this.cache.delete(item.key);
        }
      });
    }

    // If there are more items, schedule another batch
    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }
}

/**
 * Factory for creating DataLoader instances for common use cases.
 */
export class DataLoaderFactory {
  /**
   * Create a DataLoader for loading entities by ID.
   *
   * @param repository - TypeORM repository
   * @param idField - Field name containing the ID (default: 'id')
   * @param additionalWhere - Additional WHERE conditions (e.g., { organizationId: 'xxx' })
   * @param options - DataLoader options
   *
   * @example
   * ```typescript
   * const fleetLoader = DataLoaderFactory.createEntityLoader(
   *   fleetRepository,
   *   'id',
   *   { organizationId: tenantId }
   * );
   *
   * const fleet = await fleetLoader.load('fleet-123');
   * ```
   */
  static createEntityLoader<T extends ObjectLiteral>(
    repository: Repository<T>,
    idField: keyof T = 'id',
    additionalWhere: Partial<T> = {},
    options: DataLoaderOptions = {}
  ): DataLoader<string, T> {
    return new DataLoader<string, T>(async (ids: string[]) => {
      const entities = await repository.find({
        where: {
          [idField]: In(ids),
          ...additionalWhere,
        },
      });

      // Create a map for O(1) lookup
      const entityMap = new Map<string, T>();
      entities.forEach(entity => {
        const idValue = entity[idField as string];
        if (idValue !== undefined && idValue !== null) {
          entityMap.set(String(idValue), entity);
        }
      });

      // Return in same order as input keys
      return ids.map(id => entityMap.get(id));
    }, options);
  }

  /**
   * Create a DataLoader for loading related entities (one-to-many).
   * Groups related entities by foreign key.
   *
   * @param repository - TypeORM repository
   * @param foreignKey - Foreign key field name
   * @param additionalWhere - Additional WHERE conditions
   * @param options - DataLoader options
   *
   * @example
   * ```typescript
   * // Load all ships for multiple fleets in one query
   * const shipsLoader = DataLoaderFactory.createRelationLoader(
   *   shipRepository,
   *   'fleetId',
   *   { organizationId: tenantId }
   * );
   *
   * const fleet1Ships = await shipsLoader.load('fleet-1'); // Returns Ship[]
   * const fleet2Ships = await shipsLoader.load('fleet-2'); // Returns Ship[]
   * ```
   */
  static createRelationLoader<T extends ObjectLiteral>(
    repository: Repository<T>,
    foreignKey: keyof T,
    additionalWhere: Partial<T> = {},
    options: DataLoaderOptions = {}
  ): DataLoader<string, T[]> {
    return new DataLoader<string, T[]>(async (parentIds: string[]) => {
      const entities = await repository.find({
        where: {
          [foreignKey]: In(parentIds),
          ...additionalWhere,
        },
      });

      // Group entities by foreign key
      const entityGroups = new Map<string, T[]>();
      parentIds.forEach(id => entityGroups.set(id, []));

      entities.forEach(entity => {
        const parentIdValue = entity[foreignKey as string];
        if (parentIdValue === undefined || parentIdValue === null) {
          return;
        }
        const parentId = String(parentIdValue);
        const group = entityGroups.get(parentId);
        if (group) {
          group.push(entity);
        }
      });

      // Return arrays in same order as input keys
      return parentIds.map(id => entityGroups.get(id) || []);
    }, options);
  }

  /**
   * Create a DataLoader for counting related entities.
   * Useful for statistics without loading full entities.
   *
   * @param repository - TypeORM repository
   * @param foreignKey - Foreign key field name
   * @param additionalWhere - Additional WHERE conditions
   * @param options - DataLoader options
   *
   * @example
   * ```typescript
   * const shipCountLoader = DataLoaderFactory.createCountLoader(
   *   shipRepository,
   *   'fleetId',
   *   { organizationId: tenantId }
   * );
   *
   * const fleet1Count = await shipCountLoader.load('fleet-1'); // Returns number
   * ```
   */
  static createCountLoader<T extends ObjectLiteral>(
    repository: Repository<T>,
    foreignKey: keyof T,
    additionalWhere: Partial<T> = {},
    options: DataLoaderOptions = {}
  ): DataLoader<string, number> {
    return new DataLoader<string, number>(async (parentIds: string[]) => {
      const results = await repository
        .createQueryBuilder('entity')
        .select(`entity.${String(foreignKey)}`, 'parentId')
        .addSelect('COUNT(*)', 'count')
        .where(`entity.${String(foreignKey)} IN (:...parentIds)`, { parentIds })
        .andWhere(additionalWhere)
        .groupBy(`entity.${String(foreignKey)}`)
        .getRawMany<{ parentId: string; count: string }>();

      // Create a map for O(1) lookup
      const countMap = new Map<string, number>();
      results.forEach(result => {
        countMap.set(result.parentId, Number.parseInt(result.count, 10));
      });

      // Return counts in same order as input keys (0 for missing)
      return parentIds.map(id => countMap.get(id) ?? 0);
    }, options);
  }
}

/**
 * Context-scoped DataLoader manager.
 * Creates and caches DataLoaders per request to prevent cross-request caching issues.
 *
 * @example
 * ```typescript
 * // In middleware
 * app.use((req, res, next) => {
 *   req.loaders = new DataLoaderContext();
 *   next();
 * });
 *
 * // In controller
 * const fleet = await req.loaders.fleet.load(fleetId);
 * const ships = await req.loaders.shipsForFleet.load(fleetId);
 * ```
 */
export class DataLoaderContext {
  private readonly loaders: Map<string, unknown>;

  constructor() {
    this.loaders = new Map();
  }

  private toStableScopeString(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map(item => this.toStableScopeString(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right)
      );
      return `{${entries
        .map(
          ([key, entryValue]) => `${JSON.stringify(key)}:${this.toStableScopeString(entryValue)}`
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private buildScopeCacheKey(additionalWhere: ObjectLiteral): string {
    return this.toStableScopeString(additionalWhere);
  }

  private getLoaderOrThrow<TLoader>(key: string): TLoader {
    const loader = this.loaders.get(key);
    if (!loader) {
      throw new Error(`Loader '${key}' is not initialized`);
    }
    return loader as TLoader;
  }

  /**
   * Get or create a DataLoader for entities by ID
   */
  getEntityLoader<T extends ObjectLiteral>(
    name: string,
    repository: Repository<T>,
    idField: keyof T = 'id',
    additionalWhere: Partial<T> = {}
  ): DataLoader<string, T> {
    const key = `entity:${name}:${String(idField)}:${this.buildScopeCacheKey(additionalWhere)}`;
    if (!this.loaders.has(key)) {
      this.loaders.set(
        key,
        DataLoaderFactory.createEntityLoader(repository, idField, additionalWhere)
      );
    }
    return this.getLoaderOrThrow<DataLoader<string, T>>(key);
  }

  /**
   * Get or create a DataLoader for related entities
   */
  getRelationLoader<T extends ObjectLiteral>(
    name: string,
    repository: Repository<T>,
    foreignKey: keyof T,
    additionalWhere: Partial<T> = {}
  ): DataLoader<string, T[]> {
    const key = `relation:${name}:${String(foreignKey)}:${this.buildScopeCacheKey(additionalWhere)}`;
    if (!this.loaders.has(key)) {
      this.loaders.set(
        key,
        DataLoaderFactory.createRelationLoader(repository, foreignKey, additionalWhere)
      );
    }
    return this.getLoaderOrThrow<DataLoader<string, T[]>>(key);
  }

  /**
   * Get or create a DataLoader for counting related entities
   */
  getCountLoader<T extends ObjectLiteral>(
    name: string,
    repository: Repository<T>,
    foreignKey: keyof T,
    additionalWhere: Partial<T> = {}
  ): DataLoader<string, number> {
    const key = `count:${name}:${String(foreignKey)}:${this.buildScopeCacheKey(additionalWhere)}`;
    if (!this.loaders.has(key)) {
      this.loaders.set(
        key,
        DataLoaderFactory.createCountLoader(repository, foreignKey, additionalWhere)
      );
    }
    return this.getLoaderOrThrow<DataLoader<string, number>>(key);
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.loaders.forEach(loader => (loader as DataLoader<unknown, unknown>).clear());
  }

  /**
   * Clear cached data for a specific loader
   */
  clearLoader(name: string): void {
    const keyPrefixes = ['entity', 'relation', 'count'].map(prefix => `${prefix}:${name}:`);

    this.loaders.forEach((loader, key) => {
      if (keyPrefixes.some(prefix => key.startsWith(prefix))) {
        (loader as DataLoader<unknown, unknown>).clear();
      }
    });
  }
}
