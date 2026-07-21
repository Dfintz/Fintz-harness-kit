import crypto from 'node:crypto';

import { FindManyOptions, In, QueryRunner } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { enrichFleetCounts, Fleet, FleetType } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Ship } from '../../models/Ship';
import {
  ConflictError,
  FleetNotFoundError,
  NotFoundError,
  ShipNotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, paginateRepository, PaginationOptions } from '../../utils/pagination';
import { addFullTextSearch } from '../../utils/query/fullTextSearch';
import { TenantService } from '../base/TenantService';

import { FleetAuditAction, fleetAuditLogger } from './FleetAuditLogger';
import { FleetTeamService } from './FleetTeamService';

/**
 * Bulk operation result
 */
export interface BulkOperationResult<T> {
  successful: T[];
  failed: Array<{ id?: string; error: string }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

export interface SharedFleetsPage {
  data: Fleet[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface FleetSnapshot {
  fleets: Fleet[];
  shipCounts: Map<string, number>;
}

/**
 * Fleet Service - Manages fleet operations with multi-tenancy support
 *
 * MULTI-TENANCY: All operations automatically filtered by organizationId
 * CACHING: Enabled with 10-minute TTL for improved performance
 * TRANSACTIONS: Bulk operations use database transactions for consistency
 */
/** Recursive fleet tree node for hierarchy operations */
type FleetTreeNode = Fleet & { children: FleetTreeNode[] };

export class FleetService extends TenantService<Fleet> {
  constructor() {
    super(AppDataSource.getRepository(Fleet), {
      enableCache: true,
      cacheTTL: 600, // 10 minutes (same as ShipService)
      cacheCheckPeriod: 120, // 2 minutes
    });
  }

  /** Valid fleet type values derived from the FleetType enum */
  private static readonly VALID_FLEET_TYPES = Object.values(FleetType);

  /**
   * Create a new fleet for an organization
   *
   * Validates uniqueness of fleet name within the organization and normalises
   * the fleet type, defaulting to MIXED when invalid or absent.
   *
   * @param organizationId - Organization (tenant) ID
   * @param fleetData - Fleet creation payload (required: name; optional: description, type, members, plus any Fleet fields)
   * @returns The newly created Fleet
   * @throws ConflictError if the fleet name already exists in the org
   * @throws ValidationError if name is missing
   */
  async createFleet(
    organizationId: string,
    fleetData: {
      name: string;
      description?: string;
      type?: string;
      members?: string[];
    } & Partial<Omit<Fleet, 'name' | 'description' | 'type' | 'members' | 'organizationId'>>
  ): Promise<Fleet> {
    const { name, description, type, members = [], ...rest } = fleetData;

    if (!name?.trim()) {
      throw new ValidationError('Fleet name is required');
    }

    logger.info('FleetService.createFleet', { organizationId, fleetName: name });

    // Check duplicate name within the organization
    const existing = await this.repository.findOne({
      where: { organizationId, name },
    });

    if (existing) {
      throw new ConflictError('A fleet with this name already exists');
    }

    // Normalise fleet type — fall back to MIXED for invalid values
    const fleetType =
      type && FleetService.VALID_FLEET_TYPES.includes(type as FleetType)
        ? (type as FleetType)
        : FleetType.MIXED;

    const fleet = this.repository.create({
      id: crypto.randomUUID(),
      shipIds: [],
      tags: [],
      allowedOrganizations: [],
      ...rest,
      name,
      description: description || undefined,
      type: fleetType,
      members,
      organizationId,
    });

    return this.repository.save(fleet);
  }

  /**
   * Post-creation hook: auto-create a team for the fleet.
   * Called after createFleet so fleet has an ID.
   */
  async postCreateFleet(organizationId: string, fleet: Fleet): Promise<Fleet> {
    fleetAuditLogger.log({
      action: FleetAuditAction.FLEET_CREATED,
      fleetId: fleet.id,
      fleetName: fleet.name,
      organizationId,
      details: { type: fleet.type },
    });

    const fleetTeamService = FleetTeamService.getInstance();
    return fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
  }

  /**
   * Get fleet by ID with tenant validation
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   * @param options - Additional find options
   * @returns Promise resolving to fleet or null
   */
  async getFleetById(
    organizationId: string,
    fleetId: string,
    options?: FindManyOptions<Fleet>
  ): Promise<Fleet | null> {
    logger.debug('FleetService.getFleetById', { organizationId, fleetId });

    return this.findById(organizationId, fleetId, options);
  }

  /**
   * Get all fleets with pagination support
   * @param organizationId - Organization (tenant) ID
   * @param options - Pagination options (page, limit, sortBy, sortOrder)
   * @returns Promise resolving to paginated fleet entries
   */
  async getFleets(
    organizationId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Fleet>> {
    logger.debug('FleetService.getFleets', { organizationId });

    return paginateRepository(
      this.repository,
      options || {},
      { organizationId },
      'name' // Default sort by name
    );
  }

  /**
   * Get all fleets for an organization
   * @param organizationId - Organization (tenant) ID
   * @param options - Find options including pagination
   * @returns Promise resolving to array of fleets
   */
  async getAllFleets(organizationId: string, options?: FindManyOptions<Fleet>): Promise<Fleet[]> {
    logger.debug('FleetService.getAllFleets', { organizationId });

    return this.findAll(organizationId, options);
  }

  /**
   * Return a fleet snapshot for dashboard/panel views.
   * Includes tenant-scoped fleet list and per-fleet ship assignment counts.
   */
  async getFleetSnapshot(organizationId: string): Promise<FleetSnapshot> {
    const fleets = await this.getAllFleets(organizationId, {
      order: { name: 'ASC' },
    });

    if (fleets.length === 0 || !AppDataSource.isInitialized) {
      return {
        fleets,
        shipCounts: new Map(),
      };
    }

    const fleetIds = fleets.map(fleet => fleet.id);
    const rows = await AppDataSource.getRepository(FleetShip)
      .createQueryBuilder('fs')
      .select('fs.fleetId', 'fleetId')
      .addSelect('COUNT(fs.shipId)', 'count')
      .where('fs.organizationId = :organizationId', { organizationId })
      .andWhere('fs.fleetId IN (:...fleetIds)', { fleetIds })
      .groupBy('fs.fleetId')
      .getRawMany<{ fleetId: string; count: string }>();

    const shipCounts = new Map(rows.map(row => [row.fleetId, Number(row.count)]));
    return { fleets, shipCounts };
  }

  /**
   * Update fleet information
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   * @param updates - Partial fleet data to update
   * @returns Promise resolving to updated fleet or null
   */
  async updateFleet(
    organizationId: string,
    fleetId: string,
    updates: Partial<Fleet>
  ): Promise<Fleet | null> {
    logger.info('FleetService.updateFleet', { organizationId, fleetId });

    return this.update(organizationId, fleetId, updates);
  }

  /**
   * Delete a fleet
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet ID
   * @returns Promise resolving when fleet is deleted
   */
  async deleteFleet(organizationId: string, fleetId: string): Promise<void> {
    logger.info('FleetService.deleteFleet', { organizationId, fleetId });

    const fleet = await this.findById(organizationId, fleetId);
    if (fleet) {
      fleetAuditLogger.log({
        action: FleetAuditAction.FLEET_DELETED,
        fleetId,
        fleetName: fleet.name,
        organizationId,
        details: {},
      });
    }

    await this.delete(organizationId, fleetId);
  }

  /**
   * Assign a ship to a fleet.
   *
   * Validates that both the fleet and ship belong to the calling organization,
   * rejects duplicate assignments, persists the `FleetShip` row, syncs the
   * fleet's auto-created team capacity, and emits a `SHIP_ADDED_TO_FLEET`
   * audit entry.
   *
   * Mirrors the persistence flow of `fleetController.addFleetMember` so that
   * REST and GraphQL clients produce identical state.
   *
   * @throws FleetNotFoundError if the fleet does not belong to the organization
   * @throws ShipNotFoundError if the ship does not exist
   * @throws ValidationError if the ship belongs to a different organization
   * @throws ConflictError if the ship is already assigned to the fleet
   */
  async addShipToFleet(
    organizationId: string,
    fleetId: string,
    shipId: string,
    options: { performedById?: string; role?: string; notes?: string } = {}
  ): Promise<{ fleet: Fleet; fleetShip: FleetShip; ship: Ship }> {
    logger.info('FleetService.addShipToFleet', { organizationId, fleetId, shipId });

    const fleet = await this.findById(organizationId, fleetId);
    if (!fleet) {
      throw new FleetNotFoundError(fleetId);
    }

    const shipRepo = AppDataSource.getRepository(Ship);
    const ship = await shipRepo.findOne({ where: { id: shipId } });
    if (!ship) {
      throw new ShipNotFoundError(shipId);
    }

    if (ship.organizationId !== fleet.organizationId) {
      throw new ValidationError('Ship does not belong to the same organization as the fleet');
    }

    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const existingAssignment = await fleetShipRepo.findOne({
      where: { fleetId, shipId },
    });
    if (existingAssignment) {
      throw new ConflictError('Ship is already assigned to this fleet');
    }

    const fleetShip = fleetShipRepo.create({
      fleetId,
      shipId,
      organizationId: fleet.organizationId,
      role: options.role,
      notes: options.notes,
      assignedBy: options.performedById,
    });
    await fleetShipRepo.save(fleetShip);

    // Auto-create team if absent, then sync capacity (matches REST behavior).
    const fleetTeamService = FleetTeamService.getInstance();
    if (!fleet.teamId) {
      await fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
    }
    await fleetTeamService.syncTeamCapacity(organizationId, fleetId);

    fleetAuditLogger.logShipAdded(
      organizationId,
      fleetId,
      fleet.name,
      shipId,
      ship.name,
      options.performedById
    );

    return { fleet, fleetShip, ship };
  }

  /**
   * Remove a ship from a fleet.
   *
   * Validates tenant ownership of the fleet, locates the assignment, removes
   * it, syncs team capacity, and emits a `SHIP_REMOVED_FROM_FLEET` audit
   * entry.
   *
   * Mirrors the persistence flow of `fleetController.removeFleetMember`.
   *
   * @throws FleetNotFoundError if the fleet does not belong to the organization
   * @throws NotFoundError if the ship is not assigned to the fleet
   */
  async removeShipFromFleet(
    organizationId: string,
    fleetId: string,
    shipId: string,
    options: { performedById?: string } = {}
  ): Promise<{ fleet: Fleet }> {
    logger.info('FleetService.removeShipFromFleet', { organizationId, fleetId, shipId });

    const fleet = await this.findById(organizationId, fleetId);
    if (!fleet) {
      throw new FleetNotFoundError(fleetId);
    }

    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const assignment = await fleetShipRepo.findOne({
      where: { fleetId, shipId },
    });
    if (!assignment) {
      throw new ShipNotFoundError(shipId);
    }

    // Resolve ship name for the audit entry before the join row disappears.
    const shipRepo = AppDataSource.getRepository(Ship);
    const ship = await shipRepo.findOne({ where: { id: shipId } });
    const shipName = ship?.name ?? shipId;

    await fleetShipRepo.remove(assignment);

    const fleetTeamService = FleetTeamService.getInstance();
    await fleetTeamService.syncTeamCapacity(organizationId, fleetId);

    fleetAuditLogger.logShipRemoved({
      organizationId,
      fleetId,
      fleetName: fleet.name,
      shipId,
      shipName,
      performedById: options.performedById,
    });

    return { fleet };
  }

  /**
   * Atomically merge ship IDs into a fleet's denormalized `shipIds` array under a
   * `pessimistic_write` row lock so concurrent assignments cannot lose updates
   * (PERF-01). The read-merge-write happens against a freshly locked copy, and the
   * merge is deduplicated so re-adding an already-present ship is an idempotent
   * no-op. The fleet cache is invalidated after the transaction commits (mirroring
   * {@link TenantService.update}, since this persists outside it).
   *
   * @param organizationId - Organization (tenant) ID owning the fleet
   * @param fleetId - Fleet whose `shipIds` array is mutated
   * @param shipIdsToAdd - Ship IDs to add (duplicates and existing entries ignored)
   * @returns The updated fleet
   * @throws FleetNotFoundError if the fleet is absent or belongs to another organization
   */
  async addShipIdsToFleet(
    organizationId: string,
    fleetId: string,
    shipIdsToAdd: string[]
  ): Promise<Fleet> {
    logger.info('FleetService.addShipIdsToFleet', {
      organizationId,
      fleetId,
      count: shipIdsToAdd.length,
    });

    const fleet = await this.withEntityLock(
      fleetId,
      async (locked, queryRunner) => {
        if (locked.organizationId !== organizationId) {
          throw new FleetNotFoundError(fleetId);
        }

        const existing = locked.shipIds ?? [];
        const merged = [...new Set([...existing, ...shipIdsToAdd])];

        // Only persist when membership actually changed (dedup / idempotent).
        if (merged.length !== existing.length) {
          locked.shipIds = merged;
          await queryRunner.manager.getRepository(Fleet).save(locked);
        }

        return locked;
      },
      { onNotFound: () => new FleetNotFoundError(fleetId) }
    );

    this.invalidateCache(this.getCacheKey(organizationId, fleetId));
    return fleet;
  }

  /**
   * Atomically remove ship IDs from a fleet's denormalized `shipIds` array under a
   * `pessimistic_write` row lock so concurrent removals (or a removal racing an
   * assignment) cannot lose updates (PERF-01). The filter runs against a freshly
   * locked copy; removing an absent ship is an idempotent no-op. The fleet cache is
   * invalidated after the transaction commits.
   *
   * @param organizationId - Organization (tenant) ID owning the fleet
   * @param fleetId - Fleet whose `shipIds` array is mutated
   * @param shipIdsToRemove - Ship IDs to remove (absent entries ignored)
   * @returns The updated fleet
   * @throws FleetNotFoundError if the fleet is absent or belongs to another organization
   */
  async removeShipIdsFromFleet(
    organizationId: string,
    fleetId: string,
    shipIdsToRemove: string[]
  ): Promise<Fleet> {
    logger.info('FleetService.removeShipIdsFromFleet', {
      organizationId,
      fleetId,
      count: shipIdsToRemove.length,
    });

    const removalSet = new Set(shipIdsToRemove);

    const fleet = await this.withEntityLock(
      fleetId,
      async (locked, queryRunner) => {
        if (locked.organizationId !== organizationId) {
          throw new FleetNotFoundError(fleetId);
        }

        const existing = locked.shipIds ?? [];
        const filtered = existing.filter(id => !removalSet.has(id));

        // Only persist when membership actually changed (idempotent).
        if (filtered.length !== existing.length) {
          locked.shipIds = filtered;
          await queryRunner.manager.getRepository(Fleet).save(locked);
        }

        return locked;
      },
      { onNotFound: () => new FleetNotFoundError(fleetId) }
    );

    this.invalidateCache(this.getCacheKey(organizationId, fleetId));
    return fleet;
  }

  /**
   * Search fleets by name within organization
   * @param organizationId - Organization (tenant) ID
   * @param searchTerm - Name search term
   * @returns Promise resolving to matching fleets
   */
  async searchFleetsByName(organizationId: string, searchTerm: string): Promise<Fleet[]> {
    logger.debug('FleetService.searchFleetsByName', { organizationId, searchTerm });

    const qb = this.repository
      .createQueryBuilder('fleet')
      .where('fleet.organizationId = :organizationId', { organizationId });
    addFullTextSearch(qb, 'fleet', searchTerm, ['name']);
    qb.addOrderBy('fleet.name', 'ASC');
    const fleets = await qb.getMany();

    return fleets;
  }

  /**
   * Get fleet count for organization
   * @param organizationId - Organization (tenant) ID
   * @returns Promise resolving to fleet count
   */
  async getFleetCount(organizationId: string): Promise<number> {
    logger.debug('FleetService.getFleetCount', { organizationId });

    return this.repository.count({
      where: { organizationId },
    });
  }

  /**
   * Get fleets shared with this organization
   * @param organizationId - Organization (tenant) ID requesting access
   * @returns Promise resolving to shared fleets
   */
  async getSharedFleets(organizationId: string): Promise<Fleet[]> {
    logger.debug('FleetService.getSharedFleets', { organizationId });

    return this.findAllIncludingShared(organizationId);
  }

  /**
   * Get fleets shared with this organization using limit/offset pagination.
   *
   * Legacy compatibility note:
   * - `getSharedFleets` remains unchanged and still returns an unwrapped array.
   * - This method is opt-in for callers that provide pagination params.
   */
  async getSharedFleetsPaginated(
    organizationId: string,
    options: { limit: number; offset: number }
  ): Promise<SharedFleetsPage> {
    const limit = Math.min(Math.max(Math.trunc(options.limit), 1), 100);
    const offset = Math.max(Math.trunc(options.offset), 0);

    logger.debug('FleetService.getSharedFleetsPaginated', {
      organizationId,
      limit,
      offset,
    });

    const query = this.repository
      .createQueryBuilder('fleet')
      .where('fleet.organizationId = :organizationId', { organizationId })
      .orWhere(':organizationId = ANY(fleet.sharedWithOrgs)', { organizationId })
      .orderBy('fleet.name', 'ASC')
      .skip(offset)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  /**
   * Share fleet with another organization
   * @param organizationId - Fleet owner organization ID
   * @param fleetId - Fleet ID to share
   * @param targetOrganizationId - Organization to share with
   * @returns Promise resolving to updated fleet
   */
  async shareFleetWith(
    organizationId: string,
    fleetId: string,
    targetOrganizationId: string
  ): Promise<Fleet | null> {
    return this.shareFleetWithMany(organizationId, fleetId, [targetOrganizationId]);
  }

  /**
   * Share a fleet with multiple organizations in a single mutation.
   */
  async shareFleetWithMany(
    organizationId: string,
    fleetId: string,
    targetOrganizationIds: readonly string[]
  ): Promise<Fleet | null> {
    const normalizedTargets = this.normalizeTargetOrganizationIds(
      organizationId,
      targetOrganizationIds
    );

    logger.info('FleetService.shareFleetWithMany', {
      organizationId,
      fleetId,
      targetCount: normalizedTargets.length,
    });

    if (normalizedTargets.length === 0) {
      return this.getFleetById(organizationId, fleetId);
    }

    return this.shareWith(organizationId, fleetId, normalizedTargets);
  }

  /**
   * Unshare fleet with another organization
   * @param organizationId - Fleet owner organization ID
   * @param fleetId - Fleet ID to unshare
   * @param targetOrganizationId - Organization to remove sharing from
   * @returns Promise resolving to updated fleet
   */
  async unshareFleetWith(
    organizationId: string,
    fleetId: string,
    targetOrganizationId: string
  ): Promise<Fleet | null> {
    return this.unshareFleetWithMany(organizationId, fleetId, [targetOrganizationId]);
  }

  /**
   * Remove fleet sharing for multiple organizations in a single mutation.
   */
  async unshareFleetWithMany(
    organizationId: string,
    fleetId: string,
    targetOrganizationIds: readonly string[]
  ): Promise<Fleet | null> {
    const normalizedTargets = this.normalizeTargetOrganizationIds(
      organizationId,
      targetOrganizationIds
    );

    logger.info('FleetService.unshareFleetWithMany', {
      organizationId,
      fleetId,
      targetCount: normalizedTargets.length,
    });

    if (normalizedTargets.length === 0) {
      return this.getFleetById(organizationId, fleetId);
    }

    return this.unshareWith(organizationId, fleetId, normalizedTargets);
  }

  private normalizeTargetOrganizationIds(
    organizationId: string,
    targetOrganizationIds: readonly string[]
  ): string[] {
    const normalized = targetOrganizationIds
      .map(id => id.trim())
      .filter(id => id.length > 0 && id !== organizationId);

    return [...new Set(normalized)];
  }

  /**
   * Check if fleet is owned by organization
   * @param organizationId - Organization ID to check
   * @param fleetId - Fleet ID
   * @returns Promise resolving to true if owned
   */
  async isFleetOwnedBy(organizationId: string, fleetId: string): Promise<boolean> {
    const fleet = await this.getFleetById(organizationId, fleetId);
    return fleet !== null && fleet.organizationId === organizationId;
  }

  /**
   * Get fleet statistics for organization
   * @param organizationId - Organization (tenant) ID
   * @returns Promise resolving to statistics object
   */
  async getFleetStatistics(organizationId: string): Promise<{
    totalFleets: number;
    sharedFleets: number;
    fleetsWithMembers: number[];
  }> {
    logger.debug('FleetService.getFleetStatistics', { organizationId });

    const [ownedFleets, sharedFleets] = await Promise.all([
      this.getAllFleets(organizationId),
      this.getSharedFleets(organizationId),
    ]);

    return {
      totalFleets: ownedFleets.length,
      sharedFleets: sharedFleets.length,
      fleetsWithMembers: ownedFleets.map(f => f.members?.length || 0),
    };
  }

  // ==================== BULK OPERATIONS WITH TRANSACTIONS ====================

  /**
   * Bulk create fleets with transaction support
   * All fleets are created atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param fleetsData - Array of fleet data to create (max 100)
   * @returns Promise resolving to bulk operation result
   */
  async bulkCreateFleets(
    organizationId: string,
    fleetsData: Partial<Fleet>[]
  ): Promise<BulkOperationResult<Fleet>> {
    if (fleetsData.length === 0) {
      throw new ValidationError('No fleet data provided for bulk create');
    }

    if (fleetsData.length > 100) {
      throw new ValidationError('Cannot create more than 100 fleets in a single bulk operation');
    }

    const result: BulkOperationResult<Fleet> = {
      successful: [],
      failed: [],
      totalProcessed: fleetsData.length,
      successCount: 0,
      failureCount: 0,
    };

    try {
      const created = await this.withTransaction(async queryRunner => {
        const saved: Fleet[] = [];
        for (const fleetData of fleetsData) {
          const fleet = this.repository.create({
            ...fleetData,
            organizationId,
          });
          saved.push(await queryRunner.manager.save(fleet));
        }
        return saved;
      });

      result.successful = created;
      result.successCount = created.length;
      logger.info(`Bulk created ${result.successCount} fleets`, { organizationId });
    } catch (error: unknown) {
      logger.error('Bulk create fleets failed, transaction rolled back', {
        error,
        organizationId,
        count: fleetsData.length,
      });

      result.failureCount = fleetsData.length;
      const primaryError = error instanceof Error ? error.message : 'Transaction failed';
      result.failed = fleetsData.map((fd, i) => ({
        id: fd.id,
        error: i === 0 ? primaryError : 'Rolled back due to earlier failure',
      }));
    }

    return result;
  }

  /**
   * Bulk update fleets with transaction support
   * All updates are applied atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param updates - Array of {id, data} objects for updating (max 100)
   * @returns Promise resolving to bulk operation result
   */
  async bulkUpdateFleets(
    organizationId: string,
    updates: Array<{ id: string; data: Partial<Fleet> }>
  ): Promise<BulkOperationResult<Fleet>> {
    if (updates.length === 0) {
      throw new ValidationError('No updates provided for bulk update');
    }

    if (updates.length > 100) {
      throw new ValidationError('Cannot update more than 100 fleets in a single bulk operation');
    }

    const result: BulkOperationResult<Fleet> = {
      successful: [],
      failed: [],
      totalProcessed: updates.length,
      successCount: 0,
      failureCount: 0,
    };

    try {
      const updated = await this.withTransaction(async queryRunner => {
        const saved: Fleet[] = [];
        for (const { id, data } of updates) {
          const fleet = await queryRunner.manager.findOne(Fleet, {
            where: { id, organizationId },
          });

          if (!fleet) {
            // Internal transaction signal — caught by this method's own catch below
            // and surfaced in result.failed[], so it never propagates to the HTTP layer.
            throw new Error(`Fleet ${id} not found or not accessible`);
          }

          Object.assign(fleet, data);
          saved.push(await queryRunner.manager.save(fleet));
        }
        return saved;
      });

      result.successful = updated;
      result.successCount = updated.length;
      logger.info(`Bulk updated ${result.successCount} fleets`, { organizationId });
    } catch (error: unknown) {
      logger.error('Bulk update fleets failed, transaction rolled back', {
        error,
        organizationId,
        count: updates.length,
      });

      result.failureCount = updates.length;
      const primaryError = error instanceof Error ? error.message : 'Transaction failed';
      result.failed = updates.map((u, i) => ({
        id: u.id,
        error: i === 0 ? primaryError : 'Rolled back due to earlier failure',
      }));
    }

    return result;
  }

  /**
   * Bulk delete fleets with transaction support
   * All deletions are applied atomically - if one fails, all are rolled back
   * @param organizationId - Organization (tenant) ID
   * @param fleetIds - Array of fleet IDs to delete (max 100)
   * @returns Promise resolving to number of deleted fleets
   */
  async bulkDeleteFleets(
    organizationId: string,
    fleetIds: string[]
  ): Promise<{ deletedCount: number; errors: string[] }> {
    if (fleetIds.length === 0) {
      throw new ValidationError('No fleet IDs provided for bulk delete');
    }

    if (fleetIds.length > 100) {
      throw new ValidationError('Cannot delete more than 100 fleets in a single bulk operation');
    }

    try {
      const deletedCount = await this.withTransaction(async queryRunner => {
        // Verify all fleets exist and belong to organization
        const fleets = await queryRunner.manager.find(Fleet, {
          where: {
            id: In(fleetIds),
            organizationId,
          },
        });

        if (fleets.length !== fleetIds.length) {
          const foundIds = new Set(fleets.map(f => f.id));
          const missingIds = fleetIds.filter(id => !foundIds.has(id));
          // Internal transaction signal — caught below and surfaced in the errors[]
          // result array, so it never propagates to the HTTP layer.
          throw new Error(`Fleets not found or not accessible: ${missingIds.join(', ')}`);
        }

        // Delete all fleets
        await queryRunner.manager.delete(Fleet, {
          id: In(fleetIds),
          organizationId,
        });

        return fleetIds.length;
      });

      logger.info(`Bulk deleted ${deletedCount} fleets`, { organizationId });
      return { deletedCount, errors: [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      logger.error('Bulk delete fleets failed, transaction rolled back', {
        error,
        organizationId,
        count: fleetIds.length,
      });

      return { deletedCount: 0, errors: [errorMessage] };
    }
  }

  /**
   * Bulk share fleets with another organization
   * @param organizationId - Fleet owner organization ID
   * @param fleetIds - Array of fleet IDs to share
   * @param targetOrganizationId - Organization to share with
   * @returns Promise resolving to bulk operation result
   */
  async bulkShareFleets(
    organizationId: string,
    fleetIds: string[],
    targetOrganizationId: string
  ): Promise<BulkOperationResult<Fleet>> {
    if (fleetIds.length === 0) {
      throw new ValidationError('No fleet IDs provided for bulk share');
    }

    if (fleetIds.length > 100) {
      throw new ValidationError('Cannot share more than 100 fleets in a single bulk operation');
    }

    const result: BulkOperationResult<Fleet> = {
      successful: [],
      failed: [],
      totalProcessed: fleetIds.length,
      successCount: 0,
      failureCount: 0,
    };

    try {
      const shared = await this.withTransaction(async queryRunner => {
        const results: Fleet[] = [];
        for (const fleetId of fleetIds) {
          const fleet = await queryRunner.manager.findOne(Fleet, {
            where: { id: fleetId, organizationId },
          });

          if (!fleet) {
            // Internal transaction signal — caught by this method's own catch below
            // and surfaced in result.failed[], so it never propagates to the HTTP layer.
            throw new Error(`Fleet ${fleetId} not found or not accessible`);
          }

          // Add to shared list if not already shared
          const sharedWithOrgs = fleet.sharedWithOrgs || [];
          if (sharedWithOrgs.includes(targetOrganizationId)) {
            results.push(fleet);
          } else {
            fleet.sharedWithOrgs = [...sharedWithOrgs, targetOrganizationId];
            results.push(await queryRunner.manager.save(fleet));
          }
        }
        return results;
      });

      result.successful = shared;
      result.successCount = shared.length;
      logger.info(`Bulk shared ${result.successCount} fleets with ${targetOrganizationId}`, {
        organizationId,
      });
    } catch (error: unknown) {
      logger.error('Bulk share fleets failed, transaction rolled back', {
        error,
        organizationId,
        targetOrganizationId,
        count: fleetIds.length,
      });

      result.failureCount = fleetIds.length;
      const primaryError = error instanceof Error ? error.message : 'Transaction failed';
      result.failed = fleetIds.map((id, i) => ({
        id,
        error: i === 0 ? primaryError : 'Rolled back due to earlier failure',
      }));
    }

    return result;
  }

  // ==================== HIERARCHY OPERATIONS (Wave 2.2) ====================

  /**
   * Get the full fleet tree for an organization
   * Returns a flat-to-tree conversion with nested children arrays
   * @param organizationId - Organization (tenant) ID
   * @returns Root-level fleet nodes with nested children
   */
  async getFleetTree(organizationId: string): Promise<FleetTreeNode[]> {
    logger.debug('FleetService.getFleetTree', { organizationId });

    const allFleets = await this.repository
      .createQueryBuilder('fleet')
      .where('fleet.organizationId = :organizationId', { organizationId })
      .orderBy('fleet.level', 'ASC')
      .addOrderBy('fleet.sortOrder', 'ASC')
      .addOrderBy('fleet.name', 'ASC')
      .getMany();

    // Batch-load ship counts
    await this.batchLoadShipCounts(allFleets);

    // Build tree in-memory from flat list
    return this.buildFleetTree(allFleets);
  }

  /**
   * Batch-load ship counts via raw SQL to avoid
   * loadRelationCountAndMap's @DeleteDateColumn sub-select issues.
   */
  private async batchLoadShipCounts(fleets: Fleet[]): Promise<void> {
    const fleetIds = fleets.map(f => f.id);
    if (fleetIds.length === 0) {
      return;
    }

    try {
      const rows = await AppDataSource.query(
        `SELECT "fleetId", COUNT(*)::int AS "count"
         FROM fleet_ships
         WHERE "fleetId" = ANY($1)
         GROUP BY "fleetId"`,
        [fleetIds]
      );
      for (const row of rows as { fleetId: string; count: number }[]) {
        const fleet = fleets.find(f => f.id === row.fleetId);
        if (fleet) {
          fleet.shipCount = row.count;
        }
      }
    } catch (error: unknown) {
      logger.error('Error loading ship counts for fleet tree:', error);
    }
  }

  /**
   * Build a tree structure from a flat list of fleets.
   */
  private buildFleetTree(allFleets: Fleet[]): FleetTreeNode[] {
    type FleetNode = Fleet & { children: FleetNode[] };
    const fleetMap = new Map<string, FleetNode>();
    const roots: FleetNode[] = [];

    // First pass: wrap each fleet with a children array and computed counts
    for (const fleet of allFleets) {
      const enriched = enrichFleetCounts(fleet);
      const node: FleetNode = Object.assign(fleet, {
        children: [] as FleetNode[],
        shipCount: enriched.shipCount,
        memberCount: enriched.memberCount,
      });
      fleetMap.set(fleet.id, node);
    }

    // Second pass: wire parent → child relationships
    for (const fleet of allFleets) {
      const node = fleetMap.get(fleet.id);
      if (!node) {
        continue;
      }
      const parent = fleet.parentFleetId ? fleetMap.get(fleet.parentFleetId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Validate move preconditions and resolve parent context.
   * @returns parent level and path, or throws on invalid move.
   */
  private async validateMoveTarget(
    organizationId: string,
    fleetId: string,
    newParentId: string
  ): Promise<{ parentLevel: number; parentPath: string }> {
    if (newParentId === fleetId) {
      throw new ValidationError('Cannot move a fleet under itself');
    }

    const parent = await this.findById(organizationId, newParentId);
    if (!parent) {
      throw new NotFoundError('Target parent fleet');
    }

    if (await this.isDescendantOf(organizationId, newParentId, fleetId)) {
      throw new ValidationError('Cannot move fleet under its own descendant');
    }

    if (parent.level >= 4) {
      throw new ValidationError('Maximum nesting depth of 5 levels exceeded');
    }

    return {
      parentLevel: parent.level,
      parentPath: parent.hierarchyPath || parent.id,
    };
  }

  /**
   * Move a fleet to a new parent (or to root if newParentId is null)
   * Updates level and hierarchyPath for the fleet and all descendants atomically
   * @param organizationId - Organization (tenant) ID
   * @param fleetId - Fleet to move
   * @param newParentId - Target parent fleet ID (null = move to root)
   * @returns Updated fleet
   */
  async moveFleet(
    organizationId: string,
    fleetId: string,
    newParentId: string | null
  ): Promise<Fleet> {
    logger.info('FleetService.moveFleet', { organizationId, fleetId, newParentId });

    // Validate fleet exists
    const fleet = await this.findById(organizationId, fleetId);
    if (!fleet) {
      throw new FleetNotFoundError();
    }

    // No-op if already at the target parent
    if ((fleet.parentFleetId || null) === newParentId) {
      return fleet;
    }

    // Capture previous parent for audit
    const previousParentId = fleet.parentFleetId || null;
    let previousParent: Fleet | null = null;
    if (previousParentId) {
      previousParent = await this.findById(organizationId, previousParentId);
    }

    // Validate new parent (if not moving to root)
    let parentLevel = -1;
    let parentPath = '';
    if (newParentId) {
      const target = await this.validateMoveTarget(organizationId, fleetId, newParentId);
      parentLevel = target.parentLevel;
      parentPath = target.parentPath;
    }

    // Atomic update in a transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update this fleet
      fleet.parentFleetId = newParentId || undefined;
      fleet.level = parentLevel + 1;
      fleet.hierarchyPath = newParentId ? `${parentPath}.${fleet.id}` : fleet.id;

      // Set sortOrder to last among new siblings
      const maxSortResult = await queryRunner.manager
        .createQueryBuilder(Fleet, 'f')
        .where('f.organizationId = :organizationId', { organizationId })
        .andWhere(newParentId ? 'f.parentFleetId = :parentId' : 'f.parentFleetId IS NULL', {
          parentId: newParentId,
        })
        .andWhere('f.id != :fleetId', { fleetId })
        .select('MAX(f.sortOrder)', 'max')
        .getRawOne();
      fleet.sortOrder = (maxSortResult?.max ?? -1) + 1;

      await queryRunner.manager.save(fleet);

      // Recursively update descendants
      await this.updateDescendantPaths(queryRunner, organizationId, fleet);

      await queryRunner.commitTransaction();
      logger.info('Fleet moved successfully', { fleetId, newParentId, newLevel: fleet.level });

      // Audit logging for nest/unnest
      if (newParentId) {
        const parentFleet = await this.findById(organizationId, newParentId);
        fleetAuditLogger.logFleetNested(
          organizationId,
          fleet.id,
          fleet.name,
          newParentId,
          parentFleet?.name || 'Unknown'
        );
      } else if (previousParentId) {
        fleetAuditLogger.logFleetUnnested(
          organizationId,
          fleet.id,
          fleet.name,
          previousParentId,
          previousParent?.name || 'Unknown'
        );
      }

      // Sync team hierarchy
      const fleetTeamService = FleetTeamService.getInstance();
      const parentFleetForTeam = newParentId
        ? await this.findById(organizationId, newParentId)
        : null;
      await fleetTeamService.syncTeamHierarchy(
        organizationId,
        fleet,
        parentFleetForTeam,
        previousParent
      );

      return fleet;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Failed to move fleet', { error, fleetId, newParentId });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reorder fleets within the same parent
   * @param organizationId - Organization (tenant) ID
   * @param orderedIds - Fleet IDs in the desired display order
   * @param parentFleetId - Parent context (null = root level siblings)
   */
  async reorderFleets(
    organizationId: string,
    orderedIds: string[],
    parentFleetId: string | null
  ): Promise<void> {
    logger.info('FleetService.reorderFleets', {
      organizationId,
      count: orderedIds.length,
      parentFleetId,
    });

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await queryRunner.manager.update(
          Fleet,
          { id: orderedIds[i], organizationId },
          { sortOrder: i }
        );
      }
      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Failed to reorder fleets', { error, organizationId });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if potentialDescendantId is a descendant of ancestorId
   * Uses the materialized hierarchyPath for efficient lookup
   * @param organizationId - Organization (tenant) ID
   * @param potentialDescendantId - Fleet ID to check
   * @param ancestorId - Ancestor fleet ID
   * @returns true if potentialDescendantId is nested under ancestorId
   */
  async isDescendantOf(
    organizationId: string,
    potentialDescendantId: string,
    ancestorId: string
  ): Promise<boolean> {
    const descendant = await this.findById(organizationId, potentialDescendantId);
    if (!descendant?.hierarchyPath) {
      return false;
    }
    // Check if the ancestor ID appears in the descendant's path
    // Path format: "rootId.parentId.childId" — split and check
    const pathParts = descendant.hierarchyPath.split('.');
    return pathParts.includes(ancestorId);
  }

  /**
   * Recursively update level and hierarchyPath for all descendants of a fleet
   * Called within a transaction after a fleet is moved
   */
  private async updateDescendantPaths(
    queryRunner: QueryRunner,
    organizationId: string,
    parentFleet: Fleet
  ): Promise<void> {
    const children = await queryRunner.manager.find(Fleet, {
      where: { organizationId, parentFleetId: parentFleet.id },
    });

    for (const child of children) {
      child.level = parentFleet.level + 1;
      child.hierarchyPath = `${parentFleet.hierarchyPath}.${child.id}`;
      await queryRunner.manager.save(child);
      // Recurse into grandchildren
      await this.updateDescendantPaths(queryRunner, organizationId, child);
    }
  }
}

