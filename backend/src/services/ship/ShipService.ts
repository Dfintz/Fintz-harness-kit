import type {
  RoleShipRequirement,
  ShipRequirement,
  SpecificShipRequirement,
} from '@sc-fleet-manager/shared-types';
import { FindOptionsWhere, ILike, In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Ship, ShipSize, ShipStatus } from '../../models/Ship';
import { resolveDisplayCareer } from '../../utils/careerMapping';
import { logger } from '../../utils/logger';
import { addFullTextSearch } from '../../utils/query/fullTextSearch';
import { TenantService } from '../base/TenantService';

export interface ShipFilters {
  manufacturer?: string;
  size?: ShipSize;
  role?: string;
  status?: ShipStatus;
  isVehicle?: boolean;
  isActive?: boolean;
  search?: string;
}

/**
 * Ship Service - Manages user-owned ships
 * Multi-tenancy: Each ship belongs to an organization
 * Features: Caching enabled for improved performance
 *
 * Note: Ship entity has nullable organizationId for reference ships
 */
export class ShipService extends TenantService<Ship> {
  constructor() {
    const shipRepository = AppDataSource.getRepository(Ship);
    // Enable caching with 10-minute TTL
    super(shipRepository, {
      enableCache: true,
      cacheTTL: 600, // 10 minutes
      cacheCheckPeriod: 120, // Check every 2 minutes
    });
  }

  /**
   * Find ships with filters
   */
  async findWithFilters(organizationId: string, filters: ShipFilters): Promise<Ship[]> {
    logger.debug('ShipService.findWithFilters', { organizationId, filters });

    const queryBuilder = this.repository
      .createQueryBuilder('ship')
      .where('ship.organizationId = :organizationId', { organizationId });

    // Apply filters
    if (filters.manufacturer) {
      queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', {
        manufacturer: filters.manufacturer,
      });
    }

    if (filters.size) {
      queryBuilder.andWhere('ship.size = :size', { size: filters.size });
    }

    if (filters.role) {
      queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', {
        role: `%${filters.role}%`,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('ship.status = :status', { status: filters.status });
    }

    if (filters.isVehicle !== undefined) {
      queryBuilder.andWhere('ship.isVehicle = :isVehicle', {
        isVehicle: filters.isVehicle,
      });
    }

    if (filters.isActive !== undefined) {
      queryBuilder.andWhere('ship.isActive = :isActive', {
        isActive: filters.isActive,
      });
    } else {
      // Default: only show active ships
      queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });
    }

    if (filters.search) {
      addFullTextSearch(queryBuilder, 'ship', filters.search, ['name', 'manufacturer']);
    }

    if (filters.search) {
      queryBuilder.addOrderBy('ship.name', 'ASC');
    } else {
      queryBuilder.orderBy('ship.name', 'ASC');
    }

    return queryBuilder.getMany();
  }

  /**
   * Find multiple ships by IDs in a single query (batch fetch)
   * Eliminates N+1 query patterns when loading fleet ship lists
   */
  async findByIds(organizationId: string, shipIds: string[]): Promise<Ship[]> {
    if (shipIds.length === 0) {
      return [];
    }
    logger.debug('ShipService.findByIds', { organizationId, count: shipIds.length });

    return this.repository.find({
      where: {
        id: In(shipIds),
        organizationId,
      } as FindOptionsWhere<Ship>,
    });
  }

  /**
   * Find ships by manufacturer
   */
  async findByManufacturer(organizationId: string, manufacturer: string): Promise<Ship[]> {
    logger.debug('ShipService.findByManufacturer', { organizationId, manufacturer });

    return this.repository.find({
      where: {
        organizationId,
        manufacturer: ILike(manufacturer),
        isActive: true,
      } as FindOptionsWhere<Ship>,
      order: { name: 'ASC' },
    });
  }

  /**
   * Find ships by size
   */
  async findBySize(organizationId: string, size: ShipSize): Promise<Ship[]> {
    logger.debug('ShipService.findBySize', { organizationId, size });

    return this.repository.find({
      where: {
        organizationId,
        size,
        isActive: true,
      } as FindOptionsWhere<Ship>,
      order: { name: 'ASC' },
    });
  }

  /**
   * Find ships by role
   */
  async findByRole(organizationId: string, role: string): Promise<Ship[]> {
    logger.debug('ShipService.findByRole', { organizationId, role });

    return this.repository
      .createQueryBuilder('ship')
      .where('ship.organizationId = :organizationId', { organizationId })
      .andWhere('ship.isActive = :isActive', { isActive: true })
      .andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` })
      .orderBy('ship.name', 'ASC')
      .getMany();
  }

  /**
   * Get ship statistics for organization
   */
  async getStatistics(organizationId: string): Promise<{
    total: number;
    byManufacturer: Record<string, number>;
    bySize: Record<string, number>;
    byStatus: Record<string, number>;
    totalValue: number;
  }> {
    logger.debug('ShipService.getStatistics', { organizationId });

    // Use SQL GROUP BY queries instead of loading all ships into memory
    const baseQb = this.repository
      .createQueryBuilder('ship')
      .where('ship.organizationId = :organizationId', { organizationId })
      .andWhere('ship.isActive = :isActive', { isActive: true });

    const [totalAndValue, manufacturerStats, sizeStats, statusStats] = await Promise.all([
      // Total count + sum of price
      baseQb
        .clone()
        .select('COUNT(*)', 'total')
        .addSelect('COALESCE(SUM(ship.price), 0)', 'totalValue')
        .getRawOne<{ total: string; totalValue: string }>(),
      // Group by manufacturer
      baseQb
        .clone()
        .select('ship.manufacturer', 'manufacturer')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ship.manufacturer')
        .getRawMany<{ manufacturer: string; count: string }>(),
      // Group by size
      baseQb
        .clone()
        .select('ship.size', 'size')
        .addSelect('COUNT(*)', 'count')
        .where('ship.organizationId = :organizationId', { organizationId })
        .andWhere('ship.isActive = :isActive', { isActive: true })
        .andWhere('ship.size IS NOT NULL')
        .groupBy('ship.size')
        .getRawMany<{ size: string; count: string }>(),
      // Group by status
      baseQb
        .clone()
        .select('ship.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ship.status')
        .getRawMany<{ status: string; count: string }>(),
    ]);

    const byManufacturer: Record<string, number> = {};
    for (const row of manufacturerStats) {
      byManufacturer[row.manufacturer] = Number.parseInt(row.count, 10);
    }

    const bySize: Record<string, number> = {};
    for (const row of sizeStats) {
      bySize[row.size] = Number.parseInt(row.count, 10);
    }

    const byStatus: Record<string, number> = {};
    for (const row of statusStats) {
      byStatus[row.status] = Number.parseInt(row.count, 10);
    }

    return {
      total: Number.parseInt(totalAndValue?.total ?? '0', 10),
      byManufacturer,
      bySize,
      byStatus,
      totalValue: Number.parseFloat(totalAndValue?.totalValue ?? '0'),
    };
  }

  /**
   * Search ships by name
   */
  async search(organizationId: string, searchTerm: string): Promise<Ship[]> {
    logger.debug('ShipService.search', { organizationId, searchTerm });

    return this.repository
      .createQueryBuilder('ship')
      .where('ship.organizationId = :organizationId', { organizationId })
      .andWhere('ship.isActive = :isActive', { isActive: true })
      .andWhere(
        '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
        { search: `%${searchTerm}%` }
      )
      .orderBy('ship.name', 'ASC')
      .limit(50)
      .getMany();
  }

  /**
   * Deactivate ship (soft delete)
   */
  async deactivate(organizationId: string, id: string): Promise<Ship | null> {
    logger.info('ShipService.deactivate', { organizationId, id });

    const ship = await this.findById(organizationId, id);
    if (!ship) {
      return null;
    }

    ship.isActive = false;
    return this.repository.save(ship);
  }

  /**
   * Reactivate ship
   */
  async reactivate(organizationId: string, id: string): Promise<Ship | null> {
    logger.info('ShipService.reactivate', { organizationId, id });

    // Find even if inactive
    const ship = await this.repository.findOne({
      where: { id, organizationId },
    });

    if (!ship) {
      return null;
    }

    ship.isActive = true;
    return this.repository.save(ship);
  }

  /**
   * Get the average maxCrew for all active ships with a given role.
   * Uses the global catalogue (no tenant scoping) since Ship roles are reference data.
   * Returns 1 as fallback if no ships found for the role.
   */
  async getAverageCrewByRole(role: string): Promise<number> {
    logger.debug('ShipService.getAverageCrewByRole', { role });

    const result = await this.repository
      .createQueryBuilder('ship')
      .select('AVG(COALESCE(ship.maxCrew, ship.crew, 1))', 'avgCrew')
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('LOWER(ship.role) = LOWER(:role)', { role })
      .andWhere('(ship.maxCrew IS NOT NULL OR ship.crew IS NOT NULL)')
      .getRawOne<{ avgCrew: string | null }>();

    const avg = Number.parseFloat(result?.avgCrew ?? '0');
    return avg > 0 ? Math.ceil(avg) : 1;
  }

  /**
   * Look up a ship's crew capacity by name from the catalogue.
   * Returns maxCrew ?? crew ?? 1 for the first active match.
   */
  async getCrewByShipName(shipName: string): Promise<number> {
    logger.debug('ShipService.getCrewByShipName', { shipName });

    const ship = await this.repository.findOne({
      where: { name: shipName, isActive: true },
      select: ['maxCrew', 'crew'],
    });

    return ship?.maxCrew ?? ship?.crew ?? 1;
  }

  /**
   * Calculate total crew spots from a list of ship requirements.
   * Batch-fetches crew data to avoid N+1 queries.
   */
  async calculateCrewFromRequirements(requirements: ShipRequirement[]): Promise<number> {
    logger.debug('ShipService.calculateCrewFromRequirements', {
      count: requirements.length,
    });

    // Collect names and roles that need DB lookups (where client value is missing)
    const shipNamesToLookup = requirements
      .filter(
        (r): r is SpecificShipRequirement => r.requirementType === 'specific' && r.crewPerShip <= 0
      )
      .map(r => r.shipName);
    const rolesToLookup = requirements
      .filter(
        (r): r is RoleShipRequirement => r.requirementType === 'role' && r.avgCrewPerShip <= 0
      )
      .map(r => r.role);

    // Batch-fetch crew data in at most 2 queries (instead of N)
    const crewByName = await this.batchGetCrewByNames(shipNamesToLookup);
    const crewByRole = await this.batchGetCrewByRoles(rolesToLookup);

    // Calculate totals using the pre-fetched maps
    let totalCrew = 0;
    for (const req of requirements) {
      if (req.requirementType === 'specific') {
        const crewPerShip =
          req.crewPerShip > 0 ? req.crewPerShip : (crewByName.get(req.shipName) ?? 1);
        totalCrew += req.count * crewPerShip;
      } else if (req.requirementType === 'role') {
        const avgCrew =
          req.avgCrewPerShip > 0
            ? req.avgCrewPerShip
            : (crewByRole.get(req.role.toLowerCase()) ?? 1);
        totalCrew += req.count * avgCrew;
      }
    }

    return totalCrew;
  }

  /** Batch-fetch crew capacity for multiple ship names in a single query */
  private async batchGetCrewByNames(shipNames: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (shipNames.length === 0) {
      return result;
    }

    const uniqueNames = [...new Set(shipNames)];
    const ships = await this.repository
      .createQueryBuilder('ship')
      .select(['ship.name', 'ship.maxCrew', 'ship.crew'])
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('ship.name IN (:...names)', { names: uniqueNames })
      .getMany();

    for (const ship of ships) {
      result.set(ship.name, ship.maxCrew ?? ship.crew ?? 1);
    }
    return result;
  }

  /** Batch-fetch average crew for multiple ship roles in a single query */
  private async batchGetCrewByRoles(roles: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (roles.length === 0) {
      return result;
    }

    const uniqueRoles = [...new Set(roles)];
    const rows = await this.repository
      .createQueryBuilder('ship')
      .select('LOWER(ship.role)', 'role')
      .addSelect('AVG(COALESCE(ship.maxCrew, ship.crew, 1))', 'avgCrew')
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('LOWER(ship.role) IN (:...roles)', { roles: uniqueRoles.map(r => r.toLowerCase()) })
      .andWhere('(ship.maxCrew IS NOT NULL OR ship.crew IS NOT NULL)')
      .groupBy('LOWER(ship.role)')
      .getRawMany<{ role: string; avgCrew: string }>();

    for (const row of rows) {
      const avg = Number.parseFloat(row.avgCrew);
      result.set(row.role.toLowerCase(), avg > 0 ? Math.ceil(avg) : 1);
    }
    return result;
  }

  /**
   * Batch-fetch cargo (SCU) and quantum fuel capacity for multiple ship names.
   * Returns a map of lowercased ship name → { cargo, quantumFuelCapacity }.
   *
   * NOTE: Intentionally queries the global ship catalog (no organizationId scoping).
   * Ships here are reference/catalog entries used for enrichment — not tenant-owned data.
   */
  async batchGetShipSpecsByNames(
    shipNames: string[]
  ): Promise<Map<string, { cargo: number; quantumFuelCapacity: number }>> {
    const result = new Map<string, { cargo: number; quantumFuelCapacity: number }>();
    if (shipNames.length === 0) {
      return result;
    }

    const uniqueNames = [...new Set(shipNames.map(n => n.toLowerCase()))];
    const ships = await this.repository
      .createQueryBuilder('ship')
      .select(['ship.name', 'ship.cargo', 'ship.quantumFuelCapacity'])
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('LOWER(ship.name) IN (:...names)', { names: uniqueNames })
      .getMany();

    for (const ship of ships) {
      result.set(ship.name.toLowerCase(), {
        cargo: ship.cargo ?? 0,
        quantumFuelCapacity: ship.quantumFuelCapacity ?? 0,
      });
    }
    return result;
  }

  /**
   * Batch-fetch career classification for multiple ship names.
   * Returns a map of lowercased ship name → display career string.
   *
   * Raw catalogue careers are transformed into user-facing display categories
   * via {@link resolveDisplayCareer} (e.g. Transporter → Hauling).
   *
   * NOTE: Intentionally queries the global ship catalog (no organizationId scoping).
   * Ships here are reference/catalog entries used for enrichment — not tenant-owned data.
   */
  async batchGetShipCareersByNames(shipNames: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (shipNames.length === 0) {
      return result;
    }

    const uniqueNames = [...new Set(shipNames.map(n => n.toLowerCase()))];
    const ships = await this.repository
      .createQueryBuilder('ship')
      .select(['ship.name', 'ship.career', 'ship.role', 'ship.size'])
      .where('ship.isActive = :isActive', { isActive: true })
      .andWhere('LOWER(ship.name) IN (:...names)', { names: uniqueNames })
      .getMany();

    for (const ship of ships) {
      const displayCareer = resolveDisplayCareer(
        ship.career ?? '',
        ship.role,
        ship.size,
        ship.name
      );
      if (displayCareer && displayCareer !== 'Unknown') {
        result.set(ship.name.toLowerCase(), displayCareer);
      }
    }
    return result;
  }
}
