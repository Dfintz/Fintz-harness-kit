import { AppDataSource } from '../../data-source';
import { OrganizationShip, OrgShipRole } from '../../models/OrganizationShip';
import { Ship } from '../../models/Ship';
import { LoanStatus, ShipLoan } from '../../models/ShipLoan';
import { ShipCondition, ShipOwnershipStatus } from '../../models/UserShip';
import { invalidateFleetSummaryCache } from '../../utils/cacheInvalidation';
import { logger } from '../../utils/logger';
import { PaginatedResponse, paginateRepository, PaginationOptions } from '../../utils/pagination';
import { cache } from '../../utils/redis';
import { TenantService } from '../base/TenantService';

import { applyCommonShipFilters } from './shipServiceHelpers';

export interface OrgShipFilters {
  shipId?: string;
  role?: OrgShipRole | OrgShipRole[];
  status?: ShipOwnershipStatus | ShipOwnershipStatus[];
  condition?: ShipCondition | ShipCondition[];
  isAvailable?: boolean;
  isCapital?: boolean;
  assignedCaptain?: string;
  location?: string;
  needsMaintenance?: boolean;
  search?: string;
}

export interface CreateOrgShipDto {
  shipId: string;
  shipName: string;
  customName?: string;
  role?: OrgShipRole;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  acquisitionMethod?: string;
  acquiredBy?: string;
  acquiredDate?: Date;
  acquisitionCost?: number;
  assignedCaptain?: string;
  assignedCrew?: string[];
  maxCrew?: number;
  location?: string;
  homeBase?: string;
  insuranceLevel?: string;
  insuranceExpires?: Date;
  isCapital?: boolean;
  requiresPermission?: boolean;
  minimumRank?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateOrgShipDto {
  customName?: string;
  role?: OrgShipRole;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  assignedCaptain?: string;
  assignedCrew?: string[];
  maxCrew?: number;
  location?: string;
  homeBase?: string;
  insuranceLevel?: string;
  insuranceExpires?: Date;
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  isAvailable?: boolean;
  requiresPermission?: boolean;
  minimumRank?: string;
  notes?: string;
  tags?: string[];
  modifications?: Record<string, unknown>;
  flightHours?: number;
  missionsCompleted?: number;
  totalEarnings?: number;
  maintenanceCosts?: number;
}

/**
 * Attach catalogue-derived metadata (`shipRole`, `shipSize`, `shipManufacturer`)
 * to a list of ships so clients can filter by game role/size without a
 * secondary catalogue lookup. Matches first by `shipId` then falls back to a
 * case-insensitive `shipName` match.
 */
export async function attachCatalogueMetadata<T extends { shipId?: string; shipName?: string }>(
  ships: T[]
): Promise<T[]> {
  if (ships.length === 0) {
    return ships;
  }

  const shipIds = [...new Set(ships.map(s => s.shipId).filter((v): v is string => !!v))];
  const shipNamesLower = [
    ...new Set(
      ships
        .filter(s => !s.shipId)
        .map(s => (s.shipName ?? '').toLowerCase())
        .filter(v => v.length > 0)
    ),
  ];

  const shipRepo = AppDataSource.getRepository(Ship);
  const qb = shipRepo
    .createQueryBuilder('s')
    .select(['s.id', 's.name', 's.role', 's.size', 's.manufacturer']);

  const conditions: string[] = [];
  if (shipIds.length > 0) {
    qb.setParameter('ids', shipIds);
    conditions.push('s.id IN (:...ids)');
  }
  if (shipNamesLower.length > 0) {
    qb.setParameter('names', shipNamesLower);
    conditions.push('LOWER(s.name) IN (:...names)');
  }

  if (conditions.length === 0) {
    return ships;
  }

  const catalogueRows = await qb.where(conditions.join(' OR ')).getMany();

  const byId = new Map<string, Ship>();
  const byNameLower = new Map<string, Ship>();
  for (const row of catalogueRows) {
    byId.set(row.id, row);
    byNameLower.set(row.name.toLowerCase(), row);
  }

  return ships.map(ship => {
    const match =
      (ship.shipId && byId.get(ship.shipId)) ??
      byNameLower.get((ship.shipName ?? '').toLowerCase());
    if (!match) {
      return ship;
    }
    return Object.assign(ship, {
      shipRole: match.role,
      shipSize: match.size,
      shipManufacturer: match.manufacturer,
    });
  });
}

/**
 * OrganizationShipService - Manages organization-owned ships
 *
 * Handles ships owned by the organization itself (not individual members).
 * Supports crew assignments, maintenance tracking, and capital ship management.
 */
export class OrganizationShipService extends TenantService<OrganizationShip> {
  constructor() {
    super(AppDataSource.getRepository(OrganizationShip), {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      cacheCheckPeriod: 60,
    });
  }

  /**
   * Create a new organization ship
   */
  async createOrgShip(organizationId: string, data: CreateOrgShipDto): Promise<OrganizationShip> {
    logger.info('OrganizationShipService.createOrgShip', {
      organizationId,
      shipName: data.shipName,
    });

    const ship = this.repository.create({
      ...data,
      organizationId,
      role: data.role || OrgShipRole.RESERVE,
      status: data.status || ShipOwnershipStatus.OWNED,
      condition: data.condition || ShipCondition.GOOD,
      isActive: true,
      isAvailable: true,
    });

    const saved = await this.repository.save(ship);
    invalidateFleetSummaryCache(organizationId);
    return saved;
  }

  /**
   * Get org ship by ID
   */
  async getOrgShipById(organizationId: string, shipId: string): Promise<OrganizationShip | null> {
    return this.findById(organizationId, shipId);
  }

  /**
   * Get all org ships with pagination.
   *
   * Each returned ship is augmented with game-catalogue metadata (`shipRole`,
   * `shipSize`, `shipManufacturer`) from the `ships` table so the client can
   * filter by game role/size without depending on a separate catalogue lookup.
   * The intrinsic `role` column (OrgShipRole enum) is preserved unchanged.
   */
  async getOrgShips(
    organizationId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationShip>> {
    const result = await paginateRepository(
      this.repository,
      options || {},
      { organizationId, isActive: true },
      'shipName'
    );
    result.data = await attachCatalogueMetadata(result.data);
    return result;
  }

  /**
   * Find org ships with advanced filtering
   */
  async findOrgShips(
    organizationId: string,
    filters: OrgShipFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationShip>> {
    const query = this.repository
      .createQueryBuilder('ship')
      .where('ship.organizationId = :organizationId', { organizationId })
      .andWhere('ship.isActive = :isActive', { isActive: true });

    if (filters.shipId) {
      query.andWhere('ship.shipId = :shipId', { shipId: filters.shipId });
    }

    if (filters.role) {
      if (Array.isArray(filters.role)) {
        query.andWhere('ship.role IN (:...roles)', { roles: filters.role });
      } else {
        query.andWhere('ship.role = :role', { role: filters.role });
      }
    }

    // Apply common ship filters using helper function
    applyCommonShipFilters(query, filters);

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const sortBy = options?.sortBy || 'shipName';
    const sortOrder = options?.sortOrder || 'ASC';

    query
      .orderBy(`ship.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

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
   * Update org ship
   */
  async updateOrgShip(
    organizationId: string,
    shipId: string,
    updates: UpdateOrgShipDto
  ): Promise<OrganizationShip | null> {
    logger.info('OrganizationShipService.updateOrgShip', { organizationId, shipId });

    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return null;
    }

    Object.assign(ship, updates);
    const saved = await this.repository.save(ship);
    invalidateFleetSummaryCache(organizationId);
    return saved;
  }

  /**
   * Assign captain to ship
   */
  async assignCaptain(
    organizationId: string,
    shipId: string,
    captainId: string
  ): Promise<OrganizationShip | null> {
    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return null;
    }

    ship.assignedCaptain = captainId;
    return this.repository.save(ship);
  }

  /**
   * Assign crew to ship
   */
  async assignCrew(
    organizationId: string,
    shipId: string,
    crewIds: string[]
  ): Promise<OrganizationShip | null> {
    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return null;
    }

    ship.assignedCrew = crewIds;
    return this.repository.save(ship);
  }

  /**
   * Add crew member
   */
  async addCrewMember(
    organizationId: string,
    shipId: string,
    userId: string,
    _role?: string
  ): Promise<OrganizationShip | null> {
    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return null;
    }

    if (!ship.assignedCrew) {
      ship.assignedCrew = [];
    }

    if (!ship.assignedCrew.includes(userId)) {
      ship.assignedCrew.push(userId);
      return this.repository.save(ship);
    }

    return ship;
  }

  /**
   * Remove crew member
   */
  async removeCrewMember(
    organizationId: string,
    shipId: string,
    userId: string
  ): Promise<OrganizationShip | null> {
    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return null;
    }

    if (ship.assignedCrew) {
      ship.assignedCrew = ship.assignedCrew.filter(id => id !== userId);
      return this.repository.save(ship);
    }

    return ship;
  }

  /**
   * Get ships needing maintenance
   */
  async getShipsNeedingMaintenance(organizationId: string): Promise<OrganizationShip[]> {
    const now = new Date();

    return this.repository
      .createQueryBuilder('ship')
      .where('ship.organizationId = :organizationId', { organizationId })
      .andWhere('ship.nextMaintenance IS NOT NULL')
      .andWhere('ship.nextMaintenance <= :now', { now })
      .andWhere('ship.isActive = :isActive', { isActive: true })
      .orderBy('ship.nextMaintenance', 'ASC')
      .getMany();
  }

  /**
   * Get capital ships
   */
  async getCapitalShips(
    organizationId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationShip>> {
    return this.findOrgShips(organizationId, { isCapital: true }, options);
  }

  /**
   * Get ships by role
   */
  async getShipsByRole(
    organizationId: string,
    role: OrgShipRole,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationShip>> {
    return this.findOrgShips(organizationId, { role }, options);
  }

  /**
   * Get available ships (ready for use)
   */
  async getAvailableShips(
    organizationId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationShip>> {
    return this.findOrgShips(
      organizationId,
      { isAvailable: true, status: ShipOwnershipStatus.OWNED },
      options
    );
  }

  /**
   * Get org fleet summary
   */
  async getFleetSummary(organizationId: string): Promise<{
    totalShips: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    byCondition: Record<string, number>;
    capitalShips: number;
    availableShips: number;
    needsMaintenance: number;
    totalValue: number;
    totalMaintenanceCosts: number;
  }> {
    // Redis cache: 5 min TTL (Phase 5.3)
    const cacheKey = `org:${organizationId}:fleet:summary`;
    const cached = await cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached as {
        totalShips: number;
        byRole: Record<string, number>;
        byStatus: Record<string, number>;
        byCondition: Record<string, number>;
        capitalShips: number;
        availableShips: number;
        needsMaintenance: number;
        totalValue: number;
        totalMaintenanceCosts: number;
      };
    }

    // SQL aggregation — replaces loading all ships into memory
    const roleRows = await this.repository
      .createQueryBuilder('s')
      .select('s.role', 'role')
      .addSelect('COUNT(*)::int', 'count')
      .where('s."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('s."isActive" = true')
      .groupBy('s.role')
      .getRawMany<{ role: string; count: number }>();

    const statusRows = await this.repository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('s."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('s."isActive" = true')
      .groupBy('s.status')
      .getRawMany<{ status: string; count: number }>();

    const conditionRows = await this.repository
      .createQueryBuilder('s')
      .select('s.condition', 'condition')
      .addSelect('COUNT(*)::int', 'count')
      .where('s."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('s."isActive" = true')
      .groupBy('s.condition')
      .getRawMany<{ condition: string; count: number }>();

    const aggregates = await this.repository
      .createQueryBuilder('s')
      .select('COUNT(*)::int', 'totalShips')
      .addSelect('SUM(CASE WHEN s."isCapital" = true THEN 1 ELSE 0 END)::int', 'capitalShips')
      .addSelect(
        `SUM(CASE WHEN s.condition NOT IN ('damaged', 'critical')
              AND s.status NOT IN ('destroyed', 'lost')
              AND s."isActive" = true
              AND s."isAvailable" = true
              AND (s."nextMaintenance" IS NULL OR s."nextMaintenance" > NOW())
         THEN 1 ELSE 0 END)::int`,
        'availableShips'
      )
      .addSelect(
        `SUM(CASE WHEN s."nextMaintenance" IS NOT NULL AND s."nextMaintenance" <= NOW()
         THEN 1 ELSE 0 END)::int`,
        'needsMaintenance'
      )
      .addSelect('COALESCE(SUM(s."acquisitionCost"), 0)', 'totalValue')
      .addSelect('COALESCE(SUM(s."maintenanceCosts"), 0)', 'totalMaintenanceCosts')
      .where('s."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('s."isActive" = true')
      .getRawOne<{
        totalShips: number;
        capitalShips: number;
        availableShips: number;
        needsMaintenance: number;
        totalValue: string;
        totalMaintenanceCosts: string;
      }>();

    const byRole: Record<string, number> = {};
    for (const row of roleRows) {
      byRole[row.role] = row.count;
    }

    const byStatus: Record<string, number> = {};
    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }

    const byCondition: Record<string, number> = {};
    for (const row of conditionRows) {
      byCondition[row.condition] = row.count;
    }

    const result = {
      totalShips: aggregates?.totalShips ?? 0,
      byRole,
      byStatus,
      byCondition,
      capitalShips: aggregates?.capitalShips ?? 0,
      availableShips: aggregates?.availableShips ?? 0,
      needsMaintenance: aggregates?.needsMaintenance ?? 0,
      totalValue: Number(aggregates?.totalValue ?? 0),
      totalMaintenanceCosts: Number(aggregates?.totalMaintenanceCosts ?? 0),
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Delete org ship (soft delete)
   */
  async deleteOrgShip(organizationId: string, shipId: string): Promise<boolean> {
    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return false;
    }

    ship.isActive = false;
    await this.repository.save(ship);
    invalidateFleetSummaryCache(organizationId);
    return true;
  }

  /**
   * Loan an org ship to a user.
   * Creates a ShipLoan history record for tracking.
   */
  async loanOrgShip(
    organizationId: string,
    shipId: string,
    borrowerId: string,
    options?: {
      purpose?: string;
      activityId?: string;
      activityName?: string;
    }
  ): Promise<OrganizationShip | null> {
    const ship = await this.findById(organizationId, shipId);
    if (!ship) {
      return null;
    }

    const { purpose, activityId, activityName } = options ?? {};

    ship.status = ShipOwnershipStatus.LOANED;
    ship.assignedCaptain = borrowerId;
    ship.isAvailable = false;
    if (purpose) {
      ship.notes = `Loaned: ${purpose}${ship.notes ? `\n${ship.notes}` : ''}`;
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
        lenderId: organizationId,
        borrowerId,
        organizationId,
        activityId,
        activityName,
        scope: 'organization',
        purpose,
        requestDate: now,
        startDate: now,
        expectedReturnDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: LoanStatus.ACTIVE,
      });
      await loanRepo.save(loan);
      logger.info('Org ShipLoan record created', {
        loanId: loan.id,
        shipId,
        organizationId,
        activityId,
      });
    } catch (err: unknown) {
      logger.error('Failed to create org ShipLoan record', {
        shipId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    invalidateFleetSummaryCache(organizationId);
    return savedShip;
  }

  /**
   * Return a loaned org ship.
   * Closes the active ShipLoan record.
   */
  async returnOrgShipLoan(
    organizationId: string,
    shipId: string
  ): Promise<OrganizationShip | null> {
    const ship = await this.findById(organizationId, shipId);
    if (ship?.status !== ShipOwnershipStatus.LOANED) {
      return null;
    }

    ship.status = ShipOwnershipStatus.OWNED;
    ship.assignedCaptain = undefined;
    ship.isAvailable = true;
    const savedShip = await this.repository.save(ship);

    // Close active ShipLoan record
    try {
      const loanRepo = AppDataSource.getRepository(ShipLoan);
      const activeLoan = await loanRepo.findOne({
        where: { shipId, organizationId, status: LoanStatus.ACTIVE },
        order: { startDate: 'DESC' },
      });
      if (activeLoan) {
        activeLoan.status = LoanStatus.RETURNED;
        activeLoan.actualReturnDate = new Date();
        await loanRepo.save(activeLoan);
        logger.info('Org ShipLoan record closed', { loanId: activeLoan.id, shipId });
      }
    } catch (err: unknown) {
      logger.error('Failed to close org ShipLoan record', {
        shipId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    invalidateFleetSummaryCache(organizationId);
    return savedShip;
  }
}

