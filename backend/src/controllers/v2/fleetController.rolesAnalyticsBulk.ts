import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { FleetTeamService } from '../../services/fleet/FleetTeamService';
import { ApiErrorCode } from '../../types/api';
import { logger } from '../../utils/logger';
import { getAuthenticatedUserId, getOrganizationId } from '../../utils/tenantHelpers';

import {
  requireAuthenticatedUser,
  validateBulkDeleteRequest,
  validateBulkUpdateRequest,
} from './fleetController.bulkGuards';
import {
  applyBulkDelete,
  applyBulkUpdate,
  validateBulkDeleteItems,
  validateBulkUpdates,
  type BulkMemberDeleteMutation,
  type BulkMemberUpdateMutation,
} from './fleetController.bulkMembers';
import { normalizeApiError } from './fleetController.errors';
import { buildFleetShipWithShipQuery, loadFleetInOrganization } from './fleetController.lookup';
import {
  emitTouchedFleetUpdates,
  syncTeamCapacityForFleets,
} from './fleetController.postBulkUpdates';
import { resolveShipIds } from './fleetController.shipResolution';

export async function getFleetRolesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const organizationId = getOrganizationId(req);

    await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.FLEET_NOT_FOUND,
    });

    const roles = [
      { value: 'commander', label: 'Commander', description: 'Fleet commander' },
      { value: 'officer', label: 'Officer', description: 'Fleet officer' },
      { value: 'pilot', label: 'Pilot', description: 'Fleet pilot' },
      { value: 'crew', label: 'Crew', description: 'Fleet crew member' },
    ];

    res.success({ roles });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      `Failed to get fleet roles: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

export async function getCompositionAnalyticsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const organizationId = getOrganizationId(req);

    await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const fleetShipRows = await buildFleetShipWithShipQuery(fleetId).getMany();
    const ships = fleetShipRows.map(row => row.ship as unknown as Record<string, unknown>);
    const composition = {
      total: ships.length,
      byManufacturer: {} as Record<string, number>,
      bySize: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    ships.forEach((ship: Record<string, unknown>) => {
      const manufacturer = (ship.manufacturer as string) ?? 'Unknown';
      composition.byManufacturer[manufacturer] =
        (composition.byManufacturer[manufacturer] ?? 0) + 1;

      const size = (ship.size as string) ?? 'Unknown';
      composition.bySize[size] = (composition.bySize[size] ?? 0) + 1;

      const role = (ship.role as string) ?? 'Unknown';
      composition.byRole[role] = (composition.byRole[role] ?? 0) + 1;

      const status = (ship.status as string) ?? 'active';
      composition.byStatus[status] = (composition.byStatus[status] ?? 0) + 1;
    });

    res.success({
      fleetId,
      composition,
    });
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to get composition analytics');
  }
}

export async function compareFleetsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { fleetIds } = req.body as { fleetIds?: string[] };

    if (!Array.isArray(fleetIds) || fleetIds.length < 2) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'At least 2 fleet IDs required for comparison',
        400
      );
    }

    if (fleetIds.length > 10) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Maximum 10 fleets can be compared at once',
        400
      );
    }

    const organizationId = getOrganizationId(req);
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleets = await fleetRepo.find({
      where: fleetIds.map(id => ({ id, organizationId })),
    });

    if (fleets.length !== fleetIds.length) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'One or more fleets not found', 404);
    }

    const comparison = fleets.map(fleet => ({
      id: fleet.id,
      name: fleet.name,
      shipCount:
        ((fleet as unknown as Record<string, unknown>).ships as unknown[] | undefined)?.length ?? 0,
      memberCount: fleet.members?.length ?? 0,
      status: fleet.status,
      createdAt: fleet.createdAt,
    }));

    res.success({
      comparison,
      count: fleets.length,
    });
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to compare fleets');
  }
}

export async function bulkAddMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const { shipIds } = req.body as { shipIds?: string[] };

    if (!Array.isArray(shipIds) || shipIds.length === 0) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Ship IDs array is required', 400);
    }

    if (shipIds.length > 100) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Maximum 100 ships can be added at once', 400);
    }

    const organizationId = getOrganizationId(req);
    const userId = getAuthenticatedUserId(req);

    const fleet = await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const allResolved = await resolveShipIds(shipIds, organizationId);
    const unresolvedFinal = shipIds.filter((id: string) => !allResolved.has(id));

    if (unresolvedFinal.length > 0) {
      logger.warn('Bulk add ships: unresolved ship IDs', {
        fleetId,
        organizationId,
        unresolvedIds: unresolvedFinal,
        totalRequested: shipIds.length,
        resolvedCount: allResolved.size,
      });
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        `${unresolvedFinal.length} ship(s) not found or do not belong to your organization`,
        400
      );
    }

    const catalogShipIds = [...new Set(allResolved.values())];
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);

    let existingShipIds = new Set<string>();
    if (catalogShipIds.length > 0) {
      const existing = await fleetShipRepo
        .createQueryBuilder('fs')
        .where('fs.fleetId = :fleetId', { fleetId })
        .andWhere('fs.shipId IN (:...catalogShipIds)', { catalogShipIds })
        .getMany();
      existingShipIds = new Set(existing.map(fs => fs.shipId));
    }

    const newCatalogShipIds = catalogShipIds.filter(id => !existingShipIds.has(id));

    let addedCount = 0;
    if (newCatalogShipIds.length > 0) {
      const assignments = newCatalogShipIds.map(catalogShipId =>
        fleetShipRepo.create({
          fleetId,
          shipId: catalogShipId,
          organizationId,
          assignedBy: userId,
        })
      );
      await fleetShipRepo.save(assignments);
      addedCount = assignments.length;
    }

    const skipped = shipIds.length - addedCount;

    if (addedCount > 0) {
      const fleetTeamService = FleetTeamService.getInstance();
      if (!fleet.teamId) {
        await fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
      }
      await fleetTeamService.syncTeamCapacity(organizationId, fleetId);
    }

    logger.info('Bulk added ships to fleet', {
      fleetId,
      addedCount,
      skipped,
      organizationId,
    });

    const skippedMsg = skipped > 0 ? ` (${skipped} already assigned)` : '';

    res.success({
      message: `${addedCount} ship(s) added to fleet successfully${skippedMsg}`,
      count: addedCount,
      skipped,
      fleetId,
    });
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to bulk add members');
  }
}

export async function bulkUpdateMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { updates } = req.body as { updates: BulkMemberUpdateMutation[] };

    validateBulkUpdateRequest(updates);

    const organizationId = getOrganizationId(req);
    const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

    validateBulkUpdates(updates);

    const touchedFleetIds = new Set<string>();
    const notFound: Array<{ fleetId: string; shipId: string }> = [];
    let updatedCount = 0;

    await AppDataSource.transaction(async manager => {
      const txRepo = manager.getRepository(FleetShip);
      for (const update of updates) {
        const result = await applyBulkUpdate(txRepo, organizationId, update);
        if (result.updated) {
          touchedFleetIds.add(update.fleetId);
          updatedCount++;
        } else {
          notFound.push({ fleetId: update.fleetId, shipId: update.shipId });
        }
      }
    });

    await emitTouchedFleetUpdates(organizationId, userId, touchedFleetIds);

    logger.info('Bulk updated fleet members', {
      organizationId,
      updatedCount,
      notFoundCount: notFound.length,
      fleetCount: touchedFleetIds.size,
    });

    res.success({
      message: `${updatedCount} fleet member(s) updated successfully`,
      count: updatedCount,
      notFound,
    });
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to bulk update members');
  }
}

export async function bulkDeleteMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { items } = req.body as { items: BulkMemberDeleteMutation[] };

    validateBulkDeleteRequest(items);
    validateBulkDeleteItems(items);

    const organizationId = getOrganizationId(req);
    const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

    const touchedFleetIds = new Set<string>();
    const notFound: Array<{ fleetId: string; shipId: string }> = [];
    let deletedCount = 0;

    await AppDataSource.transaction(async manager => {
      const txRepo = manager.getRepository(FleetShip);
      for (const item of items) {
        const removed = await applyBulkDelete(txRepo, organizationId, item);
        if (removed) {
          touchedFleetIds.add(item.fleetId);
          deletedCount++;
        } else {
          notFound.push({ fleetId: item.fleetId, shipId: item.shipId });
        }
      }
    });

    const fleets = await emitTouchedFleetUpdates(organizationId, userId, touchedFleetIds);
    await syncTeamCapacityForFleets(organizationId, fleets);

    logger.info('Bulk deleted fleet members', {
      organizationId,
      deletedCount,
      notFoundCount: notFound.length,
      fleetCount: touchedFleetIds.size,
    });

    res.success({
      message: `${deletedCount} fleet member(s) removed successfully`,
      count: deletedCount,
      notFound,
    });
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to bulk delete members');
  }
}
