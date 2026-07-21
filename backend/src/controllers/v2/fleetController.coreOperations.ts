import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import {
  buildHateoasLinks,
  selectFieldsFromArray,
  validateFilters,
  validateSortField,
} from '../../middleware/queryParser';
import { Fleet, FleetType } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { FleetService } from '../../services/fleet/FleetService';
import { FleetTeamService } from '../../services/fleet/FleetTeamService';
import { logger } from '../../utils/logger';
import { getAuthenticatedUserId, getOrganizationId } from '../../utils/tenantHelpers';
import {
  emitFleetCreated,
  emitFleetDeleted,
  emitFleetUpdated,
} from '../../websocket/controllers/fleetWebSocketController';

import { loadAuthorizedFleet } from './fleetController.authorization';
import {
  batchMemberCounts,
  batchShipCounts,
  computeFleetCapabilities,
} from './fleetController.capabilities';
import { sendFleetErrorResponse } from './fleetController.errors';

// Allowed fields for sorting and filtering fleets
const FLEET_SORTABLE_FIELDS = ['name', 'createdAt', 'updatedAt', 'status'];
const FLEET_FILTERABLE_FIELDS = ['status', 'name'];

export async function listOrgFleetsHandler(req: Request, res: Response): Promise<void> {
  try {
    const orgId = getOrganizationId(req);
    const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
      limit: 20,
      offset: 0,
      sort: null,
      filters: {},
      search: null,
      fields: null,
    };

    const fleetRepo = AppDataSource.getRepository(Fleet);
    const queryBuilder = fleetRepo
      .createQueryBuilder('fleet')
      .where('fleet.organizationId = :orgId', { orgId });

    if (search) {
      queryBuilder.andWhere('fleet.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const validFilters = validateFilters(filters, FLEET_FILTERABLE_FIELDS);
    Object.entries(validFilters).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        queryBuilder.andWhere(`fleet.${field} IN (:...${field}Values)`, {
          [`${field}Values`]: value,
        });
      } else {
        queryBuilder.andWhere(`fleet.${field} = :${field}Value`, {
          [`${field}Value`]: value,
        });
      }
    });

    const validSort = validateSortField(sort, FLEET_SORTABLE_FIELDS);
    if (validSort) {
      queryBuilder.orderBy(`fleet.${validSort.field}`, validSort.order);
    } else {
      queryBuilder.orderBy('fleet.createdAt', 'DESC');
    }

    const total = await queryBuilder.getCount();
    const fleets = await queryBuilder.skip(offset).take(limit).getMany();

    const fleetIds = fleets.map(f => f.id);
    const [shipCountMap, memberCountMap] = await Promise.all([
      batchShipCounts(fleetIds),
      batchMemberCounts(fleets, orgId),
    ]);

    const fleetCapabilities = await computeFleetCapabilities(fleetIds);

    const enrichedWithCaps = fleets.map(fleet => {
      const shipCount = shipCountMap.get(fleet.id) ?? 0;
      const memberCount = memberCountMap.get(fleet.id) ?? 0;

      return {
        ...fleet,
        shipCount,
        memberCount,
        ...fleetCapabilities.get(fleet.id),
      };
    });

    const filteredFleets = selectFieldsFromArray(enrichedWithCaps, fields);
    const links = buildHateoasLinks(`/api/v2/organizations/${orgId}/fleets`, offset, limit, total, {
      ...(search ? { search } : {}),
    });

    res.paginated(
      filteredFleets,
      {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      links
    );
  } catch (error: unknown) {
    sendFleetErrorResponse(res, error, {
      logMessage: 'Fleet listing failed',
      path: req.path,
    });
  }
}

export async function getFleetOverviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const orgId = getOrganizationId(req);

    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleets = await fleetRepo.find({
      where: { organizationId: orgId },
      order: { name: 'ASC' },
    });

    if (fleets.length === 0) {
      res.success({ fleets: [], shipNameToFleets: {} });
      return;
    }

    const fleetIds = fleets.map(f => f.id);

    const [shipCountMap, memberCountMap, fleetCapabilities] = await Promise.all([
      batchShipCounts(fleetIds),
      batchMemberCounts(fleets, orgId),
      computeFleetCapabilities(fleetIds),
    ]);

    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const fleetShipRows = await fleetShipRepo
      .createQueryBuilder('fs')
      .innerJoin('fs.ship', 'ship')
      .select(['fs.fleetId', 'ship.name'])
      .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
      .getMany();

    const shipNameToFleets: Record<string, string[]> = {};
    const fleetNameById = new Map(fleets.map(f => [f.id, f.name]));
    for (const row of fleetShipRows) {
      const shipName = (row.ship?.name ?? '').toLowerCase();
      if (!shipName) {
        continue;
      }
      const fleetName = fleetNameById.get(row.fleetId) ?? 'Unknown';
      if (!shipNameToFleets[shipName]) {
        shipNameToFleets[shipName] = [];
      }
      if (!shipNameToFleets[shipName].includes(fleetName)) {
        shipNameToFleets[shipName].push(fleetName);
      }
    }

    const enrichedFleets = fleets.map(fleet => ({
      id: fleet.id,
      name: fleet.name,
      description: fleet.description,
      status: fleet.status,
      fleetType: fleet.type,
      shipCount: shipCountMap.get(fleet.id) ?? 0,
      memberCount: memberCountMap.get(fleet.id) ?? 0,
      ...fleetCapabilities.get(fleet.id),
    }));

    res.success({ fleets: enrichedFleets, shipNameToFleets });
  } catch (error: unknown) {
    sendFleetErrorResponse(res, error, {
      logMessage: 'Fleet overview failed',
      path: req.path,
    });
  }
}

export async function getFleetByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const fields = req.queryParams?.fields;

    const fleet = await loadAuthorizedFleet(req, id, 'read');
    const organizationId = fleet.organizationId;

    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const joinShipCount = await fleetShipRepo
      .createQueryBuilder('fs')
      .innerJoin('fs.ship', 'ship')
      .where('fs.fleetId = :fleetId', { fleetId: id })
      .andWhere('fs.organizationId = :organizationId', { organizationId })
      .getCount();
    const shipCount = joinShipCount;

    let memberCount = 0;
    if (fleet.teamId) {
      try {
        const teamMemberCount: Array<{ count: number }> = await AppDataSource.query(
          `SELECT COUNT(*)::int AS "count" FROM team_members
           WHERE "teamId" = $1 AND "organizationId" = $2
             AND status IN ('active', 'deployed')`,
          [fleet.teamId, organizationId]
        );
        memberCount = teamMemberCount?.[0]?.count ?? memberCount;
      } catch (error: unknown) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (
          typeof error === 'number' ||
          typeof error === 'boolean' ||
          typeof error === 'bigint' ||
          typeof error === 'symbol'
        ) {
          errorMessage = String(error);
        }

        logger.warn('Failed to count team members for fleet', {
          fleetId: id,
          teamId: fleet.teamId,
          error: errorMessage,
        });
      }
    }

    const enrichedFleet = {
      ...fleet,
      shipCount,
      memberCount,
    };

    if (fields && fields.length > 0) {
      const filtered: Record<string, unknown> = {};
      const fleetRecord = enrichedFleet as unknown as Record<string, unknown>;
      fields.forEach(field => {
        if (field in enrichedFleet) {
          filtered[field] = fleetRecord[field];
        }
      });
      res.success(filtered);
    } else {
      res.success(enrichedFleet);
    }
  } catch (error: unknown) {
    sendFleetErrorResponse(res, error, {
      logMessage: 'Fleet retrieval failed',
      path: req.path,
    });
  }
}

export async function createFleetHandler(
  req: Request,
  res: Response,
  fleetService: FleetService
): Promise<void> {
  try {
    const { orgId } = req.params;
    const { name, type, description, members } = req.body as {
      name: string;
      type?: string;
      description?: string;
      members?: string[];
    };

    const fleet = await fleetService.createFleet(orgId, {
      name,
      description,
      type,
      members,
    });

    const fleetWithTeam = await fleetService.postCreateFleet(orgId, fleet);
    const userId = getAuthenticatedUserId(req);
    emitFleetCreated(orgId, { ...fleetWithTeam }, userId);

    res.success(fleetWithTeam);
  } catch (error: unknown) {
    sendFleetErrorResponse(res, error, {
      logMessage: 'Fleet creation failed',
      path: req.path,
    });
  }
}

export async function updateFleetHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, type, members } = req.body as {
      name?: string;
      description?: string;
      type?: string;
      members?: string[];
    };

    const fleet = await loadAuthorizedFleet(req, id, 'edit');

    if (name !== undefined) {
      fleet.name = name;
    }
    if (description !== undefined) {
      fleet.description = description;
    }
    if (type !== undefined) {
      if (Object.values(FleetType).includes(type as FleetType)) {
        fleet.type = type as FleetType;
      }
    }
    if (members !== undefined) {
      fleet.members = members;
    }

    const fleetRepo = AppDataSource.getRepository(Fleet);
    await fleetRepo.save(fleet);

    const userId = getAuthenticatedUserId(req);
    emitFleetUpdated(fleet.organizationId, { ...fleet }, userId);

    res.success(fleet);
  } catch (error: unknown) {
    sendFleetErrorResponse(res, error, {
      logMessage: 'Fleet update failed',
      path: req.path,
    });
  }
}

export async function deleteFleetHandler(req: Request, res: Response): Promise<void> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  try {
    const { id } = req.params;

    const tAuth = Date.now();
    const fleet = await loadAuthorizedFleet(req, id, 'delete');
    timings.loadAuthorizedFleet = Date.now() - tAuth;
    const orgId = fleet.organizationId;
    const hadTeam = Boolean(fleet.teamId);
    if (fleet.teamId) {
      const tTeam = Date.now();
      const fleetTeamService = FleetTeamService.getInstance();
      await fleetTeamService.deleteTeamForFleet(orgId, fleet);
      timings.deleteTeamForFleet = Date.now() - tTeam;
    }

    const tRemove = Date.now();
    const fleetRepo = AppDataSource.getRepository(Fleet);
    await fleetRepo.remove(fleet);
    timings.fleetRepoRemove = Date.now() - tRemove;

    const tEmit = Date.now();
    emitFleetDeleted(orgId, id);
    timings.emitFleetDeleted = Date.now() - tEmit;

    timings.total = Date.now() - t0;
    res.success({
      id,
      deleted: true,
      message: 'Fleet deleted successfully',
    });
    logger.info('Fleet deletion timings', { fleetId: id, hadTeam, timings });
  } catch (error: unknown) {
    timings.total = Date.now() - t0;
    sendFleetErrorResponse(res, error, {
      logMessage: 'Fleet deletion failed',
      path: req.path,
      logContext: { timings },
    });
  }
}
