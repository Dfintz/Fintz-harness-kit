import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { ShipLoadout } from '../../models/ShipLoadout';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

export class ShipLoadoutService {
  private loadoutRepository: Repository<ShipLoadout>;

  constructor() {
    this.loadoutRepository = AppDataSource.getRepository(ShipLoadout);
  }

  /**
   * Create a new ship loadout
   */
  public async createLoadout(loadoutData: Partial<ShipLoadout>): Promise<ShipLoadout> {
    const loadout = this.loadoutRepository.create({
      ...loadoutData,
      version: 1,
      isLatestVersion: true,
    });
    return this.loadoutRepository.save(loadout);
  }

  /**
   * Get loadout by ID
   */
  public async getLoadoutById(id: string): Promise<ShipLoadout | null> {
    return this.loadoutRepository.findOne({ where: { id } });
  }

  /**
   * Get all loadouts for an owner with optional filtering and pagination
   */
  public async getLoadoutsByOwner(
    ownerId: string,
    paginationOptions: PaginationOptions,
    filters?: { shipName?: string; latestOnly?: boolean }
  ): Promise<PaginatedResponse<ShipLoadout>> {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = paginationOptions.sortBy || 'createdAt';
    const sortOrder = paginationOptions.sortOrder || 'DESC';

    const query = this.loadoutRepository
      .createQueryBuilder('loadout')
      .where('loadout.ownerId = :ownerId', { ownerId });

    if (filters?.shipName) {
      query.andWhere('loadout.shipName = :shipName', { shipName: filters.shipName });
    }

    if (filters?.latestOnly) {
      query.andWhere('loadout.isLatestVersion = :latest', { latest: true });
    }

    const [data, total] = await query
      .orderBy(`loadout.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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
   * Get shared loadouts (accessible to a user) with pagination
   */
  public async getSharedLoadouts(
    userId: string,
    paginationOptions: PaginationOptions
  ): Promise<PaginatedResponse<ShipLoadout>> {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = paginationOptions.sortBy || 'createdAt';
    const sortOrder = paginationOptions.sortOrder || 'DESC';

    const [data, total] = await this.loadoutRepository
      .createQueryBuilder('loadout')
      .where('loadout.sharedWithFleet = :shared', { shared: true })
      .orWhere('loadout.sharedWithOrg = :shared', { shared: true })
      .orWhere('loadout.sharedWithAlliance = :shared', { shared: true })
      .orWhere('loadout.sharedWithUsers @> ARRAY[:userId]::text[]', { userId })
      .andWhere('loadout.ownerId != :userId', { userId })
      .orderBy(`loadout.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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
   * Update loadout
   */
  public async updateLoadout(
    id: string,
    updates: Partial<ShipLoadout>
  ): Promise<ShipLoadout | null> {
    const loadout = await this.getLoadoutById(id);
    if (!loadout) {
      return null;
    }

    Object.assign(loadout, updates);
    return this.loadoutRepository.save(loadout);
  }

  /**
   * Delete loadout
   */
  public async deleteLoadout(id: string): Promise<boolean> {
    const result = await this.loadoutRepository.delete(id);
    return (result.affected || 0) > 0;
  }

  /**
   * Create a new version of a loadout
   */
  public async createVersion(
    parentLoadoutId: string,
    updates: Partial<ShipLoadout>
  ): Promise<ShipLoadout | null> {
    const parentLoadout = await this.getLoadoutById(parentLoadoutId);
    if (!parentLoadout) {
      return null;
    }

    // Mark the parent as not the latest version
    parentLoadout.isLatestVersion = false;
    await this.loadoutRepository.save(parentLoadout);

    // Create new version
    const newVersion = this.loadoutRepository.create({
      ...parentLoadout,
      id: undefined, // Let TypeORM generate new ID
      ...updates,
      version: parentLoadout.version + 1,
      parentLoadoutId: parentLoadout.id,
      isLatestVersion: true,
      createdAt: undefined,
      updatedAt: undefined,
    });

    return this.loadoutRepository.save(newVersion);
  }

  /**
   * Get version history for a loadout
   */
  public async getVersionHistory(loadoutId: string): Promise<ShipLoadout[]> {
    const loadout = await this.getLoadoutById(loadoutId);
    if (!loadout) {
      return [];
    }

    // Find the root loadout (original version)
    let rootLoadoutId = loadoutId;
    if (loadout.parentLoadoutId) {
      // Traverse up to find the root
      let current = loadout;
      while (current.parentLoadoutId) {
        const parent = await this.getLoadoutById(current.parentLoadoutId);
        if (!parent) {
          break;
        }
        current = parent;
      }
      rootLoadoutId = current.id;
    }

    // Get all versions in the chain
    const versions = await this.loadoutRepository
      .createQueryBuilder('loadout')
      .where('loadout.id = :rootId', { rootId: rootLoadoutId })
      .orWhere('loadout.parentLoadoutId = :rootId', { rootId: rootLoadoutId })
      .orderBy('loadout.version', 'ASC')
      .getMany();

    return versions;
  }

  /**
   * Compare two loadouts
   */
  public compareLoadouts(
    loadout1: ShipLoadout,
    loadout2: ShipLoadout
  ): {
    componentDifferences: Array<{
      slot: string;
      loadout1Component: string | null;
      loadout2Component: string | null;
    }>;
    statisticsDifferences: { [key: string]: { loadout1: unknown; loadout2: unknown } };
  } {
    // Compare components
    const componentDifferences: Array<{
      slot: string;
      loadout1Component: string | null;
      loadout2Component: string | null;
    }> = [];

    const allSlots = new Set([
      ...loadout1.components.map(c => c.slot),
      ...loadout2.components.map(c => c.slot),
    ]);

    allSlots.forEach(slot => {
      const comp1 = loadout1.components.find(c => c.slot === slot);
      const comp2 = loadout2.components.find(c => c.slot === slot);

      if (comp1?.componentName !== comp2?.componentName) {
        componentDifferences.push({
          slot,
          loadout1Component: comp1?.componentName || null,
          loadout2Component: comp2?.componentName || null,
        });
      }
    });

    // Compare statistics
    const statisticsDifferences: { [key: string]: { loadout1: unknown; loadout2: unknown } } = {};
    const stats1 = loadout1.statistics || {};
    const stats2 = loadout2.statistics || {};

    const allStatKeys = new Set([...Object.keys(stats1), ...Object.keys(stats2)]);

    allStatKeys.forEach(key => {
      if (stats1[key] !== stats2[key]) {
        statisticsDifferences[key] = {
          loadout1: stats1[key],
          loadout2: stats2[key],
        };
      }
    });

    return { componentDifferences, statisticsDifferences };
  }

  /**
   * Share loadout with specific users
   */
  public async shareWithUsers(loadoutId: string, userIds: string[]): Promise<ShipLoadout | null> {
    const loadout = await this.getLoadoutById(loadoutId);
    if (!loadout) {
      return null;
    }

    const existingUsers = loadout.sharedWithUsers || [];
    loadout.sharedWithUsers = [...new Set([...existingUsers, ...userIds])];

    return this.loadoutRepository.save(loadout);
  }

  /**
   * Update sharing settings
   */
  public async updateSharingSettings(
    loadoutId: string,
    settings: {
      sharedWithFleet?: boolean;
      sharedWithOrg?: boolean;
      sharedWithAlliance?: boolean;
    }
  ): Promise<ShipLoadout | null> {
    return this.updateLoadout(loadoutId, settings);
  }

  /**
   * Generate Erkul Games URL for a loadout.
   * Uses localName from ship metadata when available for accurate URLs.
   */
  public generateErkulGamesUrl(loadout: ShipLoadout): string {
    const baseUrl = 'https://www.erkul.games/live/calculator';
    const params = new URLSearchParams();

    // Use localName from ship name (convert to Erkul format)
    const erkulShipName = loadout.shipName.toUpperCase().replace(/\s+/g, '_');
    params.append('ship', erkulShipName);

    // Map component slots to Erkul URL params
    // Erkul uses: power1, cooler1, shield1, qd1, weapon1, turret1, missile1, etc.
    loadout.components.forEach(component => {
      const erkulName = component.componentName.toUpperCase().replace(/\s+/g, '_');
      params.append(component.slot, erkulName);
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Update loadout with Erkul Games URL
   */
  public async updateErkulGamesUrl(loadoutId: string, url: string): Promise<ShipLoadout | null> {
    return this.updateLoadout(loadoutId, { erkulGamesUrl: url });
  }

  /**
   * Get loadouts for a specific ship
   */
  public async getLoadoutsByShip(
    shipName: string,
    paginationOptions: PaginationOptions
  ): Promise<PaginatedResponse<ShipLoadout>> {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = paginationOptions.sortBy || 'createdAt';
    const sortOrder = paginationOptions.sortOrder || 'DESC';

    const [data, total] = await this.loadoutRepository
      .createQueryBuilder('loadout')
      .where('loadout.shipName = :shipName', { shipName })
      .andWhere('loadout.isLatestVersion = :latest', { latest: true })
      .orderBy(`loadout.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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
   * Get popular loadouts (most shared)
   */
  public async getPopularLoadouts(
    paginationOptions: PaginationOptions
  ): Promise<PaginatedResponse<ShipLoadout>> {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.loadoutRepository
      .createQueryBuilder('loadout')
      .where('loadout.isLatestVersion = :latest', { latest: true })
      .andWhere(
        '(loadout.sharedWithFleet = true OR loadout.sharedWithOrg = true OR loadout.sharedWithAlliance = true)'
      )
      .orderBy('loadout.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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
   * Share loadout with specific organizations
   */
  public async shareWithOrganizations(
    loadoutId: string,
    organizationIds: string[]
  ): Promise<ShipLoadout | null> {
    const loadout = await this.getLoadoutById(loadoutId);
    if (!loadout) {
      return null;
    }

    const existingOrgs = loadout.sharedWithOrgs || [];
    loadout.sharedWithOrgs = [...new Set([...existingOrgs, ...organizationIds])];

    return this.loadoutRepository.save(loadout);
  }

  /**
   * Unshare loadout from specific organizations
   */
  public async unshareFromOrganizations(
    loadoutId: string,
    organizationIds: string[]
  ): Promise<ShipLoadout | null> {
    const loadout = await this.getLoadoutById(loadoutId);
    if (!loadout) {
      return null;
    }

    loadout.sharedWithOrgs = (loadout.sharedWithOrgs || []).filter(
      orgId => !organizationIds.includes(orgId)
    );

    return this.loadoutRepository.save(loadout);
  }

  /**
   * Get loadouts accessible to a user based on their organization memberships
   */
  public async getLoadoutsForUser(
    userId: string,
    userOrgIds: string[],
    paginationOptions: PaginationOptions
  ): Promise<PaginatedResponse<ShipLoadout>> {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.loadoutRepository
      .createQueryBuilder('loadout')
      .where('loadout.isLatestVersion = :latest', { latest: true });

    // Build complex OR conditions for access
    const conditions: string[] = [];
    const parameters: Record<string, unknown> = {};

    // User owns the loadout
    conditions.push('loadout.ownerId = :userId');
    parameters.userId = userId;

    // Shared with user's organizations
    if (userOrgIds.length > 0) {
      userOrgIds.forEach((orgId, index) => {
        const paramName = `orgId${index}`;
        conditions.push(`loadout.sharedWithOrgs LIKE :${paramName}`);
        parameters[paramName] = `%${orgId}%`;
      });
    }

    // Shared with fleet/org/alliance (globally accessible)
    conditions.push('loadout.sharedWithFleet = true');
    conditions.push('loadout.sharedWithOrg = true');
    conditions.push('loadout.sharedWithAlliance = true');

    queryBuilder.andWhere(`(${conditions.join(' OR ')})`, parameters);

    const sortBy = paginationOptions.sortBy || 'createdAt';
    const sortOrder = paginationOptions.sortOrder || 'DESC';
    queryBuilder.orderBy(`loadout.${sortBy}`, sortOrder).skip(skip).take(limit);

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
}

