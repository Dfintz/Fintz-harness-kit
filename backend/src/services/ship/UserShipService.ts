import { Brackets, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { Ship } from '../../models/Ship';
import { LoanStatus, ShipLoan } from '../../models/ShipLoan';
import { User } from '../../models/User';
import {
  ShipCondition,
  ShipOwnershipStatus,
  ShipSharingLevel,
  UserShip,
} from '../../models/UserShip';
import { logger } from '../../utils/logger';
import { PaginatedResponse, paginateRepository, PaginationOptions } from '../../utils/pagination';

import { attachCatalogueMetadata } from './OrganizationShipService';
import { applyCommonShipFilters } from './shipServiceHelpers';
// Filter/DTO/result types live in a sibling module (E5 decomposition); imported
// back for internal use and re-exported so importers (incl. userShipController)
// are unchanged.
import type {
  CreateUserShipDto,
  ShipInsuranceStatus,
  UpdateUserShipDto,
  UserShipFilters,
  UserShipListFilters,
  UserShipListOptions,
  UserShipListResult,
} from './UserShipService.types';

export type {
  CreateUserShipDto,
  ShipInsuranceStatus,
  UpdateUserShipDto,
  UserShipFilters,
  UserShipListFilters,
  UserShipListOptions,
  UserShipListResult,
} from './UserShipService.types';

// Constants
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Allowed sort fields for UserShip queries.
 * Prevents SQL injection by restricting sort fields to known entity columns.
 */
const ALLOWED_SORT_FIELDS = new Set([
  'shipName',
  'customName',
  'status',
  'condition',
  'location',
  'insuranceLevel',
  'insuranceExpires',
  'sharingLevel',
  'createdAt',
  'updatedAt',
  'acquiredDate',
  'flightHours',
  'missionsCompleted',
  'totalEarnings',
]);

/**
 * Validate and return a safe sort field, falling back to default if invalid.
 */
function validateSortField(field: string | undefined, defaultField = 'createdAt'): string {
  if (field && ALLOWED_SORT_FIELDS.has(field)) {
    return field;
  }
  return defaultField;
}

/**
 * UserShipService - Manages individual ship ownership
 *
 * Handles ships owned by specific users.
 * Supports ship loans, insurance tracking, and classification.
 */
export class UserShipService {
  protected repository: Repository<UserShip>;

  // Cache for ship name → shipId lookups to reduce N+1 queries
  // NOTE: This is an in-memory cache per Node.js instance. In multi-instance deployments,
  // each instance maintains its own cache. Consider Redis for shared caching if needed.
  private readonly shipNameCache: Map<string, string | null> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamp = 0;

  constructor() {
    this.repository = AppDataSource.getRepository(UserShip);
  }

  /**
   * Resolve ship ID from ship name using cache
   * @param shipName - The name of the ship to look up
   * @returns Ship ID or undefined if not found
   */
  private async resolveShipId(shipName: string): Promise<string | undefined> {
    // Check cache validity
    const now = Date.now();
    if (now - this.cacheTimestamp > this.cacheTTL) {
      this.shipNameCache.clear();
      this.cacheTimestamp = now;
    }

    // Check cache
    if (this.shipNameCache.has(shipName)) {
      // Return undefined for null entries (cached misses), otherwise return the cached shipId
      return this.shipNameCache.get(shipName) ?? undefined;
    }

    // Lookup in database
    try {
      const shipRepo = AppDataSource.getRepository(Ship);
      const catalogueShip = await shipRepo.findOne({
        where: { name: shipName },
      });

      // Cache the result (null for not found, string for found)
      const shipId = catalogueShip?.id ?? null;
      this.shipNameCache.set(shipName, shipId);

      if (shipId) {
        logger.info('Resolved ship from catalogue', {
          shipName,
          shipId,
        });
      }

      return shipId ?? undefined;
    } catch (err: unknown) {
      logger.warn('Failed to resolve ship from catalogue', {
        shipName,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  /**
   * Create a new user ship
   */
  async createUserShip(data: CreateUserShipDto): Promise<UserShip> {
    logger.info('UserShipService.createUserShip', {
      userId: data.userId,
      shipName: data.shipName,
    });

    // If no shipId provided, try to resolve from ship catalogue by name
    let resolvedShipId = data.shipId;
    if (!resolvedShipId && data.shipName) {
      resolvedShipId = await this.resolveShipId(data.shipName);
    }

    const ship = this.repository.create({
      ...data,
      shipId: resolvedShipId || undefined,
      status: data.status || ShipOwnershipStatus.OWNED,
      condition: data.condition || ShipCondition.GOOD,
      sharingLevel: data.sharingLevel || ShipSharingLevel.PRIVATE,
      isActive: true,
      visibleToOrganization: true, // Default to visible
    });

    return this.repository.save(ship);
  }

  /**
   * Bulk-create user ships in a single database transaction.
   * Used by the JSON import flow to avoid per-ship rate limiting.
   */
  async bulkCreateUserShips(
    userId: string,
    shipsData: Omit<CreateUserShipDto, 'userId'>[]
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    const MAX_BULK = 200;
    if (shipsData.length > MAX_BULK) {
      throw new Error(`Bulk import limited to ${MAX_BULK} ships per request`);
    }

    const errors: string[] = [];
    const entities: UserShip[] = [];

    for (const data of shipsData) {
      try {
        let resolvedShipId = data.shipId;
        if (!resolvedShipId && data.shipName) {
          resolvedShipId = await this.resolveShipId(data.shipName);
        }

        const ship = this.repository.create({
          ...data,
          userId,
          shipId: resolvedShipId || undefined,
          status: data.status || ShipOwnershipStatus.OWNED,
          condition: data.condition || ShipCondition.GOOD,
          sharingLevel: data.sharingLevel || ShipSharingLevel.PRIVATE,
          isActive: true,
          visibleToOrganization: true,
        });
        entities.push(ship);
      } catch (err: unknown) {
        errors.push(
          `${data.shipName || 'unknown'}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (entities.length > 0) {
      await this.repository.save(entities);
    }

    logger.info('UserShipService.bulkCreateUserShips', {
      userId,
      requested: shipsData.length,
      created: entities.length,
      failed: errors.length,
    });

    return { created: entities.length, failed: errors.length, errors };
  }

  /**
   * Get user ship by ID
   */
  async getUserShipById(shipId: string): Promise<UserShip | null> {
    return this.repository.findOne({ where: { id: shipId } });
  }

  /**
   * Get all ships owned by a user
   */
  async getUserShips(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<UserShip>> {
    return paginateRepository(this.repository, options || {}, { userId, isActive: true });
  }

  /**
   * Find the current user's ships with filters, search, and pagination.
   * Used by GET /api/v2/users/me/ships.
   */
  async findMyShips(
    userId: string,
    filters: UserShipListFilters,
    options: UserShipListOptions
  ): Promise<UserShipListResult> {
    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.userId = :userId', { userId })
      .andWhere('ship.isActive = :isActive', { isActive: true });

    if (filters.manufacturer) {
      query.andWhere('ship.manufacturer = :manufacturer', {
        manufacturer: filters.manufacturer,
      });
    }
    if (filters.status) {
      query.andWhere('ship.status = :status', { status: filters.status });
    }
    if (filters.condition) {
      query.andWhere('ship.condition = :condition', { condition: filters.condition });
    }
    if (filters.sharingLevel) {
      query.andWhere('ship.sharingLevel = :sharingLevel', {
        sharingLevel: filters.sharingLevel,
      });
    }
    if (filters.search) {
      query.andWhere(
        '(ship.shipName ILIKE :search OR ship.customName ILIKE :search OR ship.description ILIKE :search OR ship.notes ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }
    if (filters.productionStatus) {
      query.leftJoin(Ship, 'catalog', 'catalog.id = ship.shipId').andWhere(
        new Brackets(qb => {
          qb.where('catalog.status = :productionStatus', {
            productionStatus: filters.productionStatus,
          }).orWhere(
            `ship.shipId IS NULL AND EXISTS (
                SELECT 1 FROM ships s
                WHERE LOWER(s.name) = LOWER(ship."shipName")
                AND s.status = :productionStatus
              )`
          );
        })
      );
    }

    const sortField = validateSortField(options.sortField);
    const sortOrder = options.sortOrder ?? 'DESC';
    query.orderBy(`ship.${sortField}`, sortOrder);

    const total = await query.getCount();
    const ships = await query.skip(options.offset).take(options.limit).getMany();

    const enriched = await this.enrichWithCatalogStatus(ships);
    return { data: enriched, total };
  }

  /**
   * Find a user's ships with privacy constraints for public viewing.
   * Used by GET /api/v2/users/:id/ships.
   */
  async findPublicShips(
    targetUserId: string,
    requestingUserId: string,
    options: UserShipListOptions
  ): Promise<UserShipListResult> {
    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.userId = :targetUserId', { targetUserId });

    const isOwnProfile = requestingUserId === targetUserId;
    if (!isOwnProfile) {
      query.andWhere('ship.sharingLevel = :sharingLevel', { sharingLevel: 'public' });
    }

    const sortField = validateSortField(options.sortField);
    const sortOrder = options.sortOrder ?? 'DESC';
    query.orderBy(`ship.${sortField}`, sortOrder);

    const total = await query.getCount();
    const ships = await query.skip(options.offset).take(options.limit).getMany();

    const enriched = await this.enrichWithCatalogStatus(ships);
    return { data: enriched, total };
  }

  /**
   * Find user ships with advanced filtering
   * Note: organizationId parameter kept for compatibility but no longer used
   */
  async findUserShips(
    organizationId: string,
    filters: UserShipFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<UserShip>> {
    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.isActive = :isActive', { isActive: true });

    if (filters.userId) {
      query.andWhere('ship.userId = :userId', { userId: filters.userId });
    }

    if (filters.shipId) {
      query.andWhere('ship.shipId = :shipId', { shipId: filters.shipId });
    }

    if (filters.shipName) {
      query.andWhere('ship.shipName ILIKE :shipName', {
        shipName: `%${filters.shipName}%`,
      });
    }

    // Apply common ship filters using helper function
    applyCommonShipFilters(query, filters);

    // Filter by sharing level
    if (filters.sharingLevel) {
      if (Array.isArray(filters.sharingLevel)) {
        query.andWhere('ship.sharingLevel IN (:...sharingLevels)', {
          sharingLevels: filters.sharingLevel,
        });
      } else {
        query.andWhere('ship.sharingLevel = :sharingLevel', {
          sharingLevel: filters.sharingLevel,
        });
      }
    }

    // Filter ships accessible to a specific user (owner or in sharedWithUsers list)
    // Note: All values are properly parameterized to prevent SQL injection
    if (filters.accessibleToUser) {
      query.andWhere(
        new Brackets(qb => {
          qb.where('ship.userId = :accessibleUserId', {
            accessibleUserId: filters.accessibleToUser,
          })
            .orWhere(
              new Brackets(subQb => {
                subQb
                  .where('ship.sharingLevel = :sharedUsersLevel', {
                    sharedUsersLevel: ShipSharingLevel.SHARED_USERS,
                  })
                  .andWhere(":accessibleUserId = ANY(string_to_array(ship.sharedWithUsers, ','))", {
                    accessibleUserId: filters.accessibleToUser,
                  });
              })
            )
            .orWhere('ship.sharingLevel IN (:...sharedLevels)', {
              sharedLevels: [ShipSharingLevel.ORGANIZATION, ShipSharingLevel.ALLIANCE],
            });
        })
      );
    }

    // Filter ships shared with a specific organization
    if (filters.sharedWithOrg) {
      query.andWhere(":sharedOrgId = ANY(string_to_array(ship.sharedWithOrgs, ','))", {
        sharedOrgId: filters.sharedWithOrg,
      });
    }

    if (filters.isLoaned !== undefined) {
      query.andWhere('ship.status = :loanedStatus', {
        loanedStatus: ShipOwnershipStatus.LOANED,
      });
    }

    if (filters.location) {
      query.andWhere('ship.location = :location', { location: filters.location });
    }

    if (filters.tags && filters.tags.length > 0) {
      query.andWhere('ship.tags && ARRAY[:...tags]::text[]', { tags: filters.tags });
    }

    query.andWhere('ship.isActive = :isActive', { isActive: true });

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const sortBy = validateSortField(options?.sortBy, 'shipName');
    const sortOrder = options?.sortOrder || 'ASC';

    query
      .orderBy(`ship.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    // Enrich results with catalog production status (flight_ready, in_concept, etc.)
    const enrichedData = await this.enrichWithCatalogStatus(data);

    return {
      data: enrichedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update user ship
   */
  async updateUserShip(
    organizationId: string,
    shipId: string,
    updates: UpdateUserShipDto
  ): Promise<UserShip | null> {
    logger.info('UserShipService.updateUserShip', { organizationId, shipId });

    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    Object.assign(ship, updates);
    return this.repository.save(ship);
  }

  /**
   * Offer ship for loan — marks the ship as available for loan
   * with a given scope (organization or alliance) and optional date range.
   * Also creates a ShipLoan history record for tracking.
   */
  async loanShip(
    organizationId: string,
    shipId: string,
    loanedTo: string,
    options?: {
      expiresAt?: Date;
      scope?: string;
      startDate?: Date;
      purpose?: string;
      activityId?: string;
      activityName?: string;
    }
  ): Promise<UserShip | null> {
    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    const { expiresAt, scope, startDate, purpose, activityId, activityName } = options ?? {};

    ship.status = ShipOwnershipStatus.LOANED;
    ship.loanedFrom = ship.userId;
    ship.loanedTo = loanedTo;
    ship.loanExpires = expiresAt;

    // Set sharing level based on scope
    if (scope === 'alliance') {
      ship.sharingLevel = ShipSharingLevel.ALLIANCE;
    } else {
      ship.sharingLevel = ShipSharingLevel.ORGANIZATION;
    }

    const savedShip = await this.repository.save(ship);

    // Create ShipLoan history record
    try {
      const loanRepo = AppDataSource.getRepository(ShipLoan);
      const now = new Date();
      const loan = loanRepo.create({
        id: `loan-${Date.now()}`,
        shipId,
        shipName: ship.shipName,
        lenderId: ship.userId,
        borrowerId: loanedTo,
        organizationId: organizationId || undefined,
        activityId,
        activityName,
        scope: scope || 'organization',
        purpose,
        requestDate: now,
        startDate: startDate || now,
        expectedReturnDate: expiresAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: LoanStatus.ACTIVE,
      });
      await loanRepo.save(loan);
      logger.info('ShipLoan record created', { loanId: loan.id, shipId, activityId });
    } catch (err: unknown) {
      logger.error('Failed to create ShipLoan record', {
        shipId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return savedShip;
  }

  /**
   * Return loaned ship — resets status and closes the ShipLoan record.
   */
  async returnLoanedShip(organizationId: string, shipId: string): Promise<UserShip | null> {
    const ship = await this.getUserShipById(shipId);
    if (ship?.status !== ShipOwnershipStatus.LOANED) {
      return null;
    }

    ship.status = ShipOwnershipStatus.OWNED;
    ship.loanedTo = undefined;
    ship.loanExpires = undefined;

    const savedShip = await this.repository.save(ship);

    // Close active ShipLoan record
    try {
      const loanRepo = AppDataSource.getRepository(ShipLoan);
      const activeLoan = await loanRepo.findOne({
        where: { shipId, status: LoanStatus.ACTIVE },
        order: { startDate: 'DESC' },
      });
      if (activeLoan) {
        activeLoan.status = LoanStatus.RETURNED;
        activeLoan.actualReturnDate = new Date();
        await loanRepo.save(activeLoan);
        logger.info('ShipLoan record closed', { loanId: activeLoan.id, shipId });
      }
    } catch (err: unknown) {
      logger.error('Failed to close ShipLoan record', {
        shipId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return savedShip;
  }

  /**
   * Get ships needing insurance renewal
   * @param userId - Optional user ID to filter ships by owner. If not provided, returns all ships needing insurance.
   * @param daysThreshold - Number of days before expiration to include (default: 30)
   * @returns Ships with insurance expiring within the threshold, enriched with days until expiration
   */
  async getShipsNeedingInsurance(
    userId?: string,
    daysThreshold: number = 30
  ): Promise<ShipInsuranceStatus[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.insuranceExpires IS NOT NULL')
      .andWhere('ship.insuranceExpires <= :thresholdDate', { thresholdDate })
      .andWhere('ship.isActive = :isActive', { isActive: true });

    // Add userId filter if provided
    if (userId) {
      query.andWhere('ship.userId = :userId', { userId });
    }

    query.orderBy('ship.insuranceExpires', 'ASC');

    const ships = await query.getMany();

    // Enrich ships with daysUntilExpiration
    const now = new Date();
    return ships.map((ship: UserShip) => {
      // Insurance expiration is guaranteed to exist due to query filter
      const expirationTime = ship.insuranceExpires?.getTime() ?? now.getTime();
      return {
        ship,
        daysUntilExpiration: Math.floor((expirationTime - now.getTime()) / MS_PER_DAY),
      };
    });
  }

  // Valid sort fields for UserShip queries — prevents SQL injection via sortBy
  private static readonly ALLOWED_SORT_FIELDS = [
    'shipName',
    'customName',
    'status',
    'condition',
    'location',
    'sharingLevel',
    'acquiredDate',
    'createdAt',
    'updatedAt',
  ];

  /**
   * Get active member userIds for an organization.
   * Shared helper to avoid duplicating the membership lookup.
   */
  private async getOrgMemberUserIds(organizationId: string): Promise<string[]> {
    const memberRepo = AppDataSource.getRepository(OrganizationMembership);
    const members = await memberRepo.find({
      where: { organizationId, isActive: true },
      select: ['userId'],
    });
    return members.map(m => m.userId);
  }

  /** Build an empty PaginatedResponse for when there are no results to query. */
  private emptyPaginatedResponse<T>(options?: PaginationOptions): PaginatedResponse<T> {
    return {
      data: [],
      pagination: {
        page: options?.page || 1,
        limit: options?.limit || 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  /** Validate sortBy against the allowlist; falls back to a safe default. */
  private safeSortBy(sortBy?: string): string {
    return sortBy && UserShipService.ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'shipName';
  }

  /**
   * Get ships available for org use.
   * Only returns ships owned by active members of the specified organization
   * that are shared at ORGANIZATION, ALLIANCE, or PUBLIC level with OWNED status.
   */
  async getOrgAvailableShips(
    organizationId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<UserShip & { ownerName?: string }>> {
    // Single query with JOIN instead of 3 separate queries (avoids 25K IN-clause for members)
    const page = options?.page || 1;
    const limit = options?.limit || 100;
    const sortBy = this.safeSortBy(options?.sortBy);
    const sortOrder = options?.sortOrder || 'ASC';

    const query = this.repository
      .createQueryBuilder('ship')
      .innerJoin(
        OrganizationMembership,
        'm',
        'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true',
        { orgId: organizationId }
      )
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('ship.sharingLevel IN (:...sharingLevels)', {
        sharingLevels: [
          ShipSharingLevel.ORGANIZATION,
          ShipSharingLevel.ALLIANCE,
          ShipSharingLevel.PUBLIC,
        ],
      })
      .andWhere('ship.status IN (:...statuses)', {
        statuses: [
          ShipOwnershipStatus.OWNED,
          ShipOwnershipStatus.PLEDGED,
          ShipOwnershipStatus.GIFTED,
        ],
      })
      .orderBy(`ship.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [ships, total] = await query.getManyAndCount();

    // Get owner names via a lightweight second query (only for the page's owner IDs)
    const ownerIds = [...new Set(ships.map(s => s.userId))];
    const ownerMap = new Map<string, string>();

    if (ownerIds.length > 0) {
      const userRepo = AppDataSource.getRepository(User);
      const users = await userRepo
        .createQueryBuilder('u')
        .select(['u.id', 'u.username'])
        .where('u.id IN (:...ownerIds)', { ownerIds })
        .getMany();
      for (const u of users) {
        ownerMap.set(u.id, u.username);
      }
    }

    const data = ships.map(ship => Object.assign(ship, { ownerName: ownerMap.get(ship.userId) }));

    return {
      data: await attachCatalogueMetadata(data),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get user's ship inventory summary
   */
  async getUserShipSummary(
    organizationId: string,
    userId: string
  ): Promise<{
    totalShips: number;
    byStatus: Record<string, number>;
    byCondition: Record<string, number>;
    bySharingLevel: Record<string, number>;
    bySize: Record<string, number>;
    byRole: Record<string, number>;
    byCareer: Record<string, number>;
    byManufacturer: Record<string, number>;
    totalValue: number;
    needsInsurance: number;
  }> {
    // SQL aggregation for status/condition/sharing/value (avoids loading all entities)
    const statusRows = await this.repository
      .createQueryBuilder('s')
      .select('s.status', 'key')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.userId = :userId', { userId })
      .andWhere('s.isActive = :isActive', { isActive: true })
      .groupBy('s.status')
      .getRawMany<{ key: string; count: number }>();

    const conditionRows = await this.repository
      .createQueryBuilder('s')
      .select('s.condition', 'key')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.userId = :userId', { userId })
      .andWhere('s.isActive = :isActive', { isActive: true })
      .groupBy('s.condition')
      .getRawMany<{ key: string; count: number }>();

    const sharingRows = await this.repository
      .createQueryBuilder('s')
      .select('s.sharingLevel', 'key')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.userId = :userId', { userId })
      .andWhere('s.isActive = :isActive', { isActive: true })
      .groupBy('s.sharingLevel')
      .getRawMany<{ key: string; count: number }>();

    const totals = await this.repository
      .createQueryBuilder('s')
      .select('COUNT(*)::int', 'totalShips')
      .addSelect('COALESCE(SUM(s.acquiredPrice), 0)', 'totalValue')
      .addSelect(
        `COALESCE(SUM(CASE WHEN s.insuranceExpires IS NOT NULL AND s.insuranceExpires <= NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END), 0)::int`,
        'needsInsurance'
      )
      .where('s.userId = :userId', { userId })
      .andWhere('s.isActive = :isActive', { isActive: true })
      .getRawOne<{ totalShips: number; totalValue: string; needsInsurance: number }>();

    const summary = {
      totalShips: totals?.totalShips ?? 0,
      byStatus: Object.fromEntries(statusRows.map(r => [r.key, r.count])) as Record<string, number>,
      byCondition: Object.fromEntries(conditionRows.map(r => [r.key, r.count])) as Record<
        string,
        number
      >,
      bySharingLevel: Object.fromEntries(sharingRows.map(r => [r.key, r.count])) as Record<
        string,
        number
      >,
      bySize: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byCareer: {} as Record<string, number>,
      byManufacturer: {} as Record<string, number>,
      totalValue: Number(totals?.totalValue ?? 0),
      needsInsurance: totals?.needsInsurance ?? 0,
    };

    // Catalog enrichment still needs ship IDs — lightweight select
    const ships = await this.repository.find({
      where: { userId, isActive: true },
      select: ['shipId', 'shipName'],
    });

    // Lookup catalog entries by shipId, then count per user ship (not per catalog entry)
    const shipCatalogRepo = AppDataSource.getRepository(Ship);
    const shipsWithId = ships.filter((s): s is typeof s & { shipId: string } => !!s.shipId);
    const nameOnlyShips = ships.filter(s => !s.shipId);

    if (shipsWithId.length > 0) {
      const uniqueIds = [...new Set(shipsWithId.map(s => s.shipId))];
      const catalogById = await shipCatalogRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.size', 's.role', 's.career', 's.manufacturer'])
        .where('s.id IN (:...ids)', { ids: uniqueIds })
        .getMany();

      const catalogMap = new Map(catalogById.map(c => [c.id, c]));
      for (const ship of shipsWithId) {
        this.incrementCatalogBreakdown(summary, catalogMap.get(ship.shipId));
      }
    }

    // Lookup by name for imported ships (shipId = null)
    if (nameOnlyShips.length > 0) {
      const names = [...new Set(nameOnlyShips.map(s => s.shipName.toLowerCase()))];
      const catalogByName = await shipCatalogRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.name', 's.size', 's.role', 's.career', 's.manufacturer'])
        .where('LOWER(s.name) IN (:...names)', { names })
        .getMany();

      const catalogMap = new Map(catalogByName.map(c => [c.name.toLowerCase(), c]));
      for (const ship of nameOnlyShips) {
        const cat = catalogMap.get(ship.shipName.toLowerCase());
        this.incrementCatalogBreakdown(summary, cat);
      }
    }

    return summary;
  }

  /**
   * Enrich user ships with catalog data (productionStatus, manufacturer).
   * Returns the same data with extra properties appended.
   */
  private async enrichWithCatalogStatus(
    ships: UserShip[]
  ): Promise<Array<UserShip & { productionStatus?: string; manufacturer?: string }>> {
    if (ships.length === 0) {
      return ships;
    }

    const shipCatalogRepo = AppDataSource.getRepository(Ship);
    const shipsWithId = ships.filter((s): s is UserShip & { shipId: string } => !!s.shipId);
    const nameOnlyShips = ships.filter(s => !s.shipId);

    const catalogMap = new Map<string, { status: string; manufacturer: string }>();

    // Lookup by shipId
    if (shipsWithId.length > 0) {
      const uniqueIds = [...new Set(shipsWithId.map(s => s.shipId))];
      const catalog = await shipCatalogRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.status', 's.manufacturer'])
        .where('s.id IN (:...ids)', { ids: uniqueIds })
        .getMany();
      for (const c of catalog) {
        catalogMap.set(`id:${c.id}`, {
          status: c.status ?? '',
          manufacturer: c.manufacturer ?? '',
        });
      }
    }

    // Lookup by name for imported ships
    if (nameOnlyShips.length > 0) {
      const names = [...new Set(nameOnlyShips.map(s => s.shipName.toLowerCase()))];
      const catalog = await shipCatalogRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.name', 's.status', 's.manufacturer'])
        .where('LOWER(s.name) IN (:...names)', { names })
        .getMany();
      for (const c of catalog) {
        catalogMap.set(`name:${c.name.toLowerCase()}`, {
          status: c.status ?? '',
          manufacturer: c.manufacturer ?? '',
        });
      }
    }

    return ships.map(ship => {
      const key = ship.shipId ? `id:${ship.shipId}` : `name:${ship.shipName.toLowerCase()}`;
      const catalogEntry = catalogMap.get(key);
      return Object.assign(ship, {
        productionStatus: catalogEntry?.status ?? undefined,
        manufacturer: catalogEntry?.manufacturer ?? undefined,
      });
    });
  }

  /** Increment bySize/byRole/byCareer/byManufacturer breakdown from a joined Ship catalog record. */
  private incrementCatalogBreakdown(
    summary: {
      bySize: Record<string, number>;
      byRole: Record<string, number>;
      byCareer: Record<string, number>;
      byManufacturer: Record<string, number>;
    },
    catalog: { size?: string; role?: string; career?: string; manufacturer?: string } | undefined
  ): void {
    if (!catalog) {
      return;
    }
    if (catalog.size) {
      summary.bySize[catalog.size] = (summary.bySize[catalog.size] ?? 0) + 1;
    }
    if (catalog.role) {
      summary.byRole[catalog.role] = (summary.byRole[catalog.role] ?? 0) + 1;
    }
    if (catalog.career) {
      summary.byCareer[catalog.career] = (summary.byCareer[catalog.career] ?? 0) + 1;
    }
    if (catalog.manufacturer) {
      summary.byManufacturer[catalog.manufacturer] =
        (summary.byManufacturer[catalog.manufacturer] ?? 0) + 1;
    }
  }

  /**
   * Delete user ship (soft delete)
   * Sets isActive=false and triggers TypeORM @DeleteDateColumn for proper soft-delete.
   */
  async deleteUserShip(organizationId: string, shipId: string): Promise<boolean> {
    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return false;
    }

    ship.isActive = false;
    // softRemove sets deletedAt AND saves — single DB write
    await this.repository.softRemove(ship);
    return true;
  }

  /**
   * Bulk-delete all user ships for a given user (soft delete).
   * Used by the "Clear All Ships" UI action. Mirrors deleteUserShip semantics:
   * sets isActive=false and triggers @DeleteDateColumn via softRemove, which
   * preserves audit history and avoids FK-constraint failures from referencing
   * rows (loans, fleet/crew assignments, etc.).
   */
  async bulkDeleteAllUserShips(userId: string): Promise<number> {
    const ships = await this.repository.find({ where: { userId, isActive: true } });
    if (ships.length === 0) {
      logger.info('UserShipService.bulkDeleteAllUserShips', { userId, deleted: 0 });
      return 0;
    }

    for (const ship of ships) {
      ship.isActive = false;
    }
    await this.repository.softRemove(ships);

    logger.info('UserShipService.bulkDeleteAllUserShips', {
      userId,
      deleted: ships.length,
    });
    return ships.length;
  }

  /**
   * Update ship sharing level
   */
  async updateSharingLevel(
    organizationId: string,
    shipId: string,
    sharingLevel: ShipSharingLevel,
    sharedWithUsers?: string[]
  ): Promise<UserShip | null> {
    logger.info('UserShipService.updateSharingLevel', {
      organizationId,
      shipId,
      sharingLevel,
    });

    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    ship.sharingLevel = sharingLevel;

    // Update sharedWithUsers if provided
    if (sharedWithUsers !== undefined) {
      ship.sharedWithUsers = sharedWithUsers;
    }

    // Clear sharedWithUsers if not sharing with specific users
    if (sharingLevel !== ShipSharingLevel.SHARED_USERS) {
      ship.sharedWithUsers = undefined;
    }

    return this.repository.save(ship);
  }

  /**
   * Share ship with specific users
   */
  async shareWithUsers(
    organizationId: string,
    shipId: string,
    userIds: string[]
  ): Promise<UserShip | null> {
    logger.info('UserShipService.shareWithUsers', {
      organizationId,
      shipId,
      userCount: userIds.length,
    });

    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    ship.sharingLevel = ShipSharingLevel.SHARED_USERS;
    const existingUsers = ship.sharedWithUsers || [];
    ship.sharedWithUsers = [...new Set([...existingUsers, ...userIds])];

    return this.repository.save(ship);
  }

  /**
   * Remove user from ship sharing
   */
  async unshareFromUser(
    organizationId: string,
    shipId: string,
    userId: string
  ): Promise<UserShip | null> {
    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    ship.sharedWithUsers = (ship.sharedWithUsers || []).filter(id => id !== userId);

    // If no users left, revert to personal
    if (ship.sharedWithUsers.length === 0 && ship.sharingLevel === ShipSharingLevel.SHARED_USERS) {
      ship.sharingLevel = ShipSharingLevel.PRIVATE;
    }

    return this.repository.save(ship);
  }

  /**
   * Share ship with organizations (cross-org sharing)
   */
  async shareWithOrganizations(shipId: string, targetOrgIds: string[]): Promise<UserShip | null> {
    logger.info('UserShipService.shareWithOrganizations', {
      shipId,
      orgCount: targetOrgIds.length,
    });

    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    // Update visibility to organization
    ship.visibleToOrganization = true;

    return this.repository.save(ship);
  }

  /**
   * Get ships shared with organization (from org members).
   * Filters to ships owned by the given userIds that are visible to the organization.
   */
  async getShipsSharedWithOrg(
    userIds: string[],
    options?: PaginationOptions
  ): Promise<PaginatedResponse<UserShip>> {
    if (userIds.length === 0) {
      return this.emptyPaginatedResponse(options);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const sortBy = this.safeSortBy(options?.sortBy);
    const sortOrder = options?.sortOrder || 'ASC';

    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('ship.userId IN (:...userIds)', { userIds })
      .andWhere('ship.visibleToOrganization = :visible', { visible: true })
      .orderBy(`ship.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get ships accessible by a specific user
   */
  async getAccessibleShips(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<UserShip>> {
    return paginateRepository(this.repository, options || {}, { userId, isActive: true });
  }

  /**
   * Get ships at alliance sharing level.
   * Only returns ships owned by active members of the specified organization
   * that are shared at ALLIANCE level.
   */
  async getAllianceSharedShips(
    organizationId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<UserShip>> {
    const memberUserIds = await this.getOrgMemberUserIds(organizationId);

    if (memberUserIds.length === 0) {
      return this.emptyPaginatedResponse(options);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const sortBy = this.safeSortBy(options?.sortBy);
    const sortOrder = options?.sortOrder || 'ASC';

    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('ship.userId IN (:...memberUserIds)', { memberUserIds })
      .andWhere('ship.sharingLevel = :sharingLevel', {
        sharingLevel: ShipSharingLevel.ALLIANCE,
      })
      .orderBy(`ship.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update Erkul.games loadout URL for a ship
   */
  async updateErkulLoadoutUrl(
    organizationId: string,
    shipId: string,
    erkulLoadoutUrl: string
  ): Promise<UserShip | null> {
    logger.info('UserShipService.updateErkulLoadoutUrl', {
      shipId,
    });

    const ship = await this.getUserShipById(shipId);
    if (!ship) {
      return null;
    }

    ship.erkulLoadoutUrl = erkulLoadoutUrl;

    return this.repository.save(ship);
  }

  /**
   * Get fleet summary including sharing statistics.
   * Scoped to active members of the specified organization.
   */
  async getOrgFleetSummary(organizationId: string): Promise<{
    totalShips: number;
    byStatus: Record<string, number>;
    byCondition: Record<string, number>;
    bySharingLevel: Record<string, number>;
    totalValue: number;
    sharedWithOrg: number;
    sharedWithAlliance: number;
  }> {
    const memberUserIds = await this.getOrgMemberUserIds(organizationId);

    if (memberUserIds.length === 0) {
      return {
        totalShips: 0,
        byStatus: {},
        byCondition: {},
        bySharingLevel: {},
        totalValue: 0,
        sharedWithOrg: 0,
        sharedWithAlliance: 0,
      };
    }

    const ships = await this.repository
      .createQueryBuilder('ship')
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('ship.userId IN (:...memberUserIds)', { memberUserIds })
      .getMany();

    const summary = {
      totalShips: ships.length,
      byStatus: {} as Record<string, number>,
      byCondition: {} as Record<string, number>,
      bySharingLevel: {} as Record<string, number>,
      totalValue: 0,
      sharedWithOrg: 0,
      sharedWithAlliance: 0,
    };

    ships.forEach((ship: UserShip) => {
      summary.byStatus[ship.status] = (summary.byStatus[ship.status] || 0) + 1;
      summary.byCondition[ship.condition] = (summary.byCondition[ship.condition] || 0) + 1;
      summary.bySharingLevel[ship.sharingLevel] =
        (summary.bySharingLevel[ship.sharingLevel] || 0) + 1;

      if (ship.acquiredPrice) {
        summary.totalValue += Number(ship.acquiredPrice);
      }

      if (ship.isSharedWithOrg()) {
        summary.sharedWithOrg++;
      }

      if (ship.isSharedWithAlliance()) {
        summary.sharedWithAlliance++;
      }
    });

    return summary;
  }
}

