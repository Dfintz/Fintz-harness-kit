import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

/**
 * Sort direction for query ordering
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Options for pagination
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Abstract base class for type-safe, composable query builders.
 * Provides a fluent API for building complex queries with caching,
 * pagination, and relation loading.
 *
 * @template T The entity type this query builder operates on
 *
 * @example
 * ```typescript
 * class FleetQueryBuilder extends BaseQueryBuilder<Fleet> {
 *   constructor(repository: Repository<Fleet>) {
 *     super(repository, 'fleet');
 *   }
 *
 *   withShips(): this {
 *     this.qb.leftJoinAndSelect('fleet.ships', 'ship');
 *     return this;
 *   }
 *
 *   forOrganization(orgId: string): this {
 *     this.qb.andWhere('fleet.organizationId = :orgId', { orgId });
 *     return this;
 *   }
 * }
 *
 * // Usage
 * const fleets = await new FleetQueryBuilder(repo)
 *   .forOrganization(orgId)
 *   .withShips()
 *   .paginate(1, 10)
 *   .getMany();
 * ```
 */
export abstract class BaseQueryBuilder<T extends ObjectLiteral> {
  protected qb: SelectQueryBuilder<T>;
  protected readonly alias: string;

  /**
   * Create a new query builder
   * @param repository - TypeORM repository for the entity
   * @param alias - Table alias to use in queries
   */
  constructor(
    protected readonly repository: Repository<T>,
    alias: string
  ) {
    this.alias = alias;
    this.qb = repository.createQueryBuilder(alias);
  }

  /**
   * Add a WHERE clause for the organization (tenant)
   * @param organizationId - Organization ID to filter by
   */
  forOrganization(organizationId: string): this {
    this.qb.andWhere(`${this.alias}.organizationId = :organizationId`, { organizationId });
    return this;
  }

  /**
   * Add sorting to the query
   * @param field - Field name to sort by
   * @param direction - Sort direction (ASC or DESC)
   */
  orderBy(field: string, direction: SortDirection = 'ASC'): this {
    this.qb.orderBy(`${this.alias}.${field}`, direction);
    return this;
  }

  /**
   * Add secondary sorting
   * @param field - Field name to sort by
   * @param direction - Sort direction (ASC or DESC)
   */
  addOrderBy(field: string, direction: SortDirection = 'ASC'): this {
    this.qb.addOrderBy(`${this.alias}.${field}`, direction);
    return this;
  }

  /**
   * Apply pagination to the query
   * @param page - Page number (1-indexed)
   * @param limit - Number of items per page
   */
  paginate(page: number, limit: number): this {
    const offset = (page - 1) * limit;
    this.qb.skip(offset).take(limit);
    return this;
  }

  /**
   * Limit the number of results
   * @param limit - Maximum number of results
   */
  limit(limit: number): this {
    this.qb.take(limit);
    return this;
  }

  /**
   * Skip a number of results
   * @param offset - Number of results to skip
   */
  offset(offset: number): this {
    this.qb.skip(offset);
    return this;
  }

  /**
   * Add a WHERE condition for a specific field
   * @param field - Field name
   * @param value - Value to match
   */
  whereEquals(field: string, value: unknown): this {
    this.qb.andWhere(`${this.alias}.${field} = :${field}`, { [field]: value });
    return this;
  }

  /**
   * Add a LIKE condition for a specific field
   * @param field - Field name
   * @param pattern - Pattern to match (automatically wrapped with %)
   */
  whereLike(field: string, pattern: string): this {
    this.qb.andWhere(`${this.alias}.${field} ILIKE :${field}Pattern`, {
      [`${field}Pattern`]: `%${pattern}%`,
    });
    return this;
  }

  /**
   * Add a WHERE IN condition
   * @param field - Field name
   * @param values - Array of values to match
   */
  whereIn(field: string, values: unknown[]): this {
    if (values.length > 0) {
      this.qb.andWhere(`${this.alias}.${field} IN (:...${field}Values)`, {
        [`${field}Values`]: values,
      });
    }
    return this;
  }

  /**
   * Add a WHERE condition for date range
   * @param field - Field name
   * @param from - Start date (optional)
   * @param to - End date (optional)
   */
  whereDateRange(field: string, from?: Date, to?: Date): this {
    if (from) {
      this.qb.andWhere(`${this.alias}.${field} >= :${field}From`, {
        [`${field}From`]: from,
      });
    }
    if (to) {
      this.qb.andWhere(`${this.alias}.${field} <= :${field}To`, {
        [`${field}To`]: to,
      });
    }
    return this;
  }

  /**
   * Enable query caching
   * @param milliseconds - Cache duration in milliseconds
   * @param id - Optional cache ID for targeted invalidation
   */
  cache(milliseconds: number, id?: string): this {
    this.qb.cache(id ?? true, milliseconds);
    return this;
  }

  /**
   * Get the raw SQL query for debugging
   */
  getSql(): string {
    return this.qb.getSql();
  }

  /**
   * Get query parameters for debugging
   */
  getParameters(): Record<string, unknown> {
    return this.qb.getParameters();
  }

  /**
   * Execute query and return all matching entities
   */
  async getMany(): Promise<T[]> {
    return this.qb.getMany();
  }

  /**
   * Execute query and return entities with total count
   */
  async getManyAndCount(): Promise<[T[], number]> {
    return this.qb.getManyAndCount();
  }

  /**
   * Execute query and return a single entity or null
   */
  async getOne(): Promise<T | null> {
    return this.qb.getOne();
  }

  /**
   * Execute query and return paginated result
   * @param options - Pagination options
   */
  async getPaginated(options: PaginationOptions): Promise<PaginatedResult<T>> {
    this.paginate(options.page, options.limit);
    const [data, total] = await this.getManyAndCount();
    const totalPages = Math.ceil(total / options.limit);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNext: options.page < totalPages,
      hasPrev: options.page > 1,
    };
  }

  /**
   * Get the count of matching entities
   */
  async getCount(): Promise<number> {
    return this.qb.getCount();
  }

  /**
   * Check if any matching entity exists
   */
  async exists(): Promise<boolean> {
    const count = await this.qb.getCount();
    return count > 0;
  }
}

/**
 * Query builder for Fleet entities with common fleet-specific queries
 */
export class FleetQueryBuilder extends BaseQueryBuilder<{
  id: string;
  name: string;
  organizationId: string;
  members?: unknown[];
  ships?: unknown[];
  sharedWith?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}> {
  constructor(repository: Repository<ObjectLiteral>) {
    super(repository as Repository<{ id: string; name: string; organizationId: string }>, 'fleet');
  }

  /**
   * Load ships relation
   */
  withShips(): this {
    this.qb.leftJoinAndSelect('fleet.ships', 'ship');
    return this;
  }

  /**
   * Load members relation
   */
  withMembers(): this {
    this.qb.leftJoinAndSelect('fleet.members', 'member');
    return this;
  }

  /**
   * Load all common relations
   */
  withAllRelations(): this {
    return this.withShips().withMembers();
  }

  /**
   * Filter by fleet name pattern
   */
  searchByName(name: string): this {
    return this.whereLike('name', name);
  }

  /**
   * Include fleets shared with the organization
   */
  includeShared(organizationId: string): this {
    this.qb.orWhere(`:orgId = ANY(fleet.sharedWith)`, { orgId: organizationId });
    return this;
  }

  /**
   * Filter by creation date range
   */
  createdBetween(from?: Date, to?: Date): this {
    return this.whereDateRange('createdAt', from, to);
  }
}

/**
 * Query builder for Ship entities with common ship-specific queries
 */
export class ShipQueryBuilder extends BaseQueryBuilder<{
  id: string;
  name: string;
  organizationId: string;
  fleetId?: string;
  userId?: string;
  manufacturer?: string;
  status?: string;
}> {
  constructor(repository: Repository<ObjectLiteral>) {
    super(repository as Repository<{ id: string; name: string; organizationId: string }>, 'ship');
  }

  /**
   * Load owner relation
   */
  withOwner(): this {
    this.qb.leftJoinAndSelect('ship.owner', 'owner');
    return this;
  }

  /**
   * Load fleet relation
   */
  withFleet(): this {
    this.qb.leftJoinAndSelect('ship.fleet', 'fleet');
    return this;
  }

  /**
   * Filter by fleet ID
   */
  forFleet(fleetId: string): this {
    return this.whereEquals('fleetId', fleetId);
  }

  /**
   * Filter by user ID (owner)
   */
  forUser(userId: string): this {
    return this.whereEquals('userId', userId);
  }

  /**
   * Filter by manufacturer
   */
  byManufacturer(manufacturer: string): this {
    return this.whereLike('manufacturer', manufacturer);
  }

  /**
   * Filter by status
   */
  withStatus(status: string): this {
    return this.whereEquals('status', status);
  }

  /**
   * Filter by multiple statuses
   */
  withStatuses(statuses: string[]): this {
    return this.whereIn('status', statuses);
  }
}

/**
 * Query builder for Activity entities
 */
export class ActivityQueryBuilder extends BaseQueryBuilder<{
  id: string;
  name: string;
  organizationId: string;
  type?: string;
  status?: string;
  startTime?: Date;
  endTime?: Date;
}> {
  constructor(repository: Repository<ObjectLiteral>) {
    super(
      repository as Repository<{ id: string; name: string; organizationId: string }>,
      'activity'
    );
  }

  /**
   * Load participants relation
   */
  withParticipants(): this {
    this.qb.leftJoinAndSelect('activity.participants', 'participant');
    return this;
  }

  /**
   * Filter by activity type
   */
  ofType(type: string): this {
    return this.whereEquals('type', type);
  }

  /**
   * Filter by multiple types
   */
  ofTypes(types: string[]): this {
    return this.whereIn('type', types);
  }

  /**
   * Filter by status
   */
  withStatus(status: string): this {
    return this.whereEquals('status', status);
  }

  /**
   * Filter upcoming activities
   */
  upcoming(): this {
    this.qb.andWhere('activity.startTime > :now', { now: new Date() });
    return this.orderBy('startTime', 'ASC');
  }

  /**
   * Filter past activities
   */
  past(): this {
    this.qb.andWhere('activity.endTime < :now', { now: new Date() });
    return this.orderBy('startTime', 'DESC');
  }

  /**
   * Filter activities in date range
   */
  inDateRange(from: Date, to: Date): this {
    this.qb.andWhere('activity.startTime >= :from', { from });
    this.qb.andWhere('activity.startTime <= :to', { to });
    return this;
  }
}

/**
 * Query builder for Organization entities
 */
export class OrganizationQueryBuilder extends BaseQueryBuilder<{
  id: string;
  name: string;
  organizationId: string;
}> {
  constructor(repository: Repository<ObjectLiteral>) {
    super(
      repository as Repository<{ id: string; name: string; organizationId: string }>,
      'organization'
    );
  }

  /**
   * @deprecated Organization.members is a simple-array column, not a relation.
   * Use OrganizationMembership queries instead.
   */
  withMembers(): this {
    // No-op: Organization.members is a simple-array column, not a joinable relation.
    // Use OrganizationMembership repository queries for member data.
    return this;
  }

  /**
   * Load fleets relation
   */
  withFleets(): this {
    this.qb.leftJoinAndSelect('organization.fleets', 'fleet');
    return this;
  }

  /**
   * Search by organization name
   */
  searchByName(name: string): this {
    return this.whereLike('name', name);
  }
}
