/**
 * Fleet Controller V2
 * Handles fleet-related endpoints with standardized responses
 * Implements full API v2 query parameter support per ROADMAP.md section 2.3
 */

import { Request, Response } from 'express';
import { SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import {
  buildHateoasLinks,
  selectFieldsFromArray,
  validateFilters,
  validateSortField,
} from '../../middleware/queryParser';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { OrganizationShip } from '../../models/OrganizationShip';
import { Ship, ShipStatus } from '../../models/Ship';
import { UserShip } from '../../models/UserShip';
import { FleetHealthService } from '../../services/fleet/FleetHealthService';
import { FleetService } from '../../services/fleet/FleetService';
import { FleetTeamService } from '../../services/fleet/FleetTeamService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { getAuthenticatedUserId, getOrganizationId } from '../../utils/tenantHelpers';
import { emitFleetUpdated } from '../../websocket/controllers/fleetWebSocketController';

import {
  createFleetWithAssetsHandler,
  deployFleetHandler,
  dissolveFleetHandler,
  selectCrewPositionHandler,
} from './fleetController.aggregatorCrew';
import { getFleetAuditLogHandler } from './fleetController.audit';
import { loadAuthorizedFleet } from './fleetController.authorization';
import { requireAuthenticatedUser } from './fleetController.bulkGuards';
import {
  createFleetHandler,
  deleteFleetHandler,
  getFleetByIdHandler,
  getFleetOverviewHandler,
  listOrgFleetsHandler,
  updateFleetHandler,
} from './fleetController.coreOperations';
import {
  normalizeApiError,
  resolveErrorStatus,
  rethrowApiOrSendFleetInternalErrorResponse,
  sendFleetDefaultErrorResponse,
  sendFleetLoggedErrorResponse,
} from './fleetController.errors';
import {
  buildFleetShipWithShipQuery,
  loadFleetAssignmentInFleet,
  loadFleetInOrganization,
} from './fleetController.lookup';
import {
  bulkAddMembersHandler,
  bulkDeleteMembersHandler,
  bulkUpdateMembersHandler,
  compareFleetsHandler,
  getCompositionAnalyticsHandler,
  getFleetRolesHandler,
} from './fleetController.rolesAnalyticsBulk';
import {
  createFleetScheduleHandler,
  deleteFleetScheduleHandler,
  getFleetScheduleHandler,
  getFleetSharingHandler,
  updateFleetScheduleHandler,
  updateFleetSharingHandler,
} from './fleetController.sharingSchedules';
import { StatCountResult, toStatRecord } from './fleetController.stats';
import { countTreeNodes } from './fleetController.tree';

// Allowed fields for sorting and filtering fleets
// Allowed fields for sorting and filtering ships
const SHIP_SORTABLE_FIELDS = ['name', 'manufacturer', 'size', 'role', 'status', 'createdAt'];
const SHIP_FILTERABLE_FIELDS = ['manufacturer', 'size', 'role', 'status'];

export class FleetControllerV2 {
  private _fleetService?: FleetService;

  /** Lazy-initialised FleetService singleton to avoid construction-time DB access */
  private get fleetService(): FleetService {
    this._fleetService ??= new FleetService();
    return this._fleetService;
  }

  /**
   * GET /api/v2/organizations/:orgId/fleets
   * List all fleets for an organization with full query parameter support
   */
  async listOrgFleets(req: Request, res: Response): Promise<void> {
    await listOrgFleetsHandler(req, res);
  }

  /**
   * GET /api/v2/organizations/:orgId/fleet-overview
   * Returns all fleets with ship counts, member counts, capabilities, and
   * ship name lists in a SINGLE response — eliminates the N+1 per-fleet
   * HTTP requests from the frontend OrganizationShips page.
   */
  async getFleetOverview(req: Request, res: Response): Promise<void> {
    await getFleetOverviewHandler(req, res);
  }

  /**
   * GET /api/v2/fleets/:id
   * Get a specific fleet by ID (authorized against the fleet's actual organization)
   */
  async getFleetById(req: Request, res: Response): Promise<void> {
    await getFleetByIdHandler(req, res);
  }

  /**
   * POST /api/v2/organizations/:orgId/fleets
   * Create a new fleet
   */
  async createFleet(req: Request, res: Response): Promise<void> {
    await createFleetHandler(req, res, this.fleetService);
  }

  /**
   * PUT /api/v2/fleets/:id
   * Update a fleet (authorized against the fleet's actual organization)
   */
  async updateFleet(req: Request, res: Response): Promise<void> {
    await updateFleetHandler(req, res);
  }

  /**
   * DELETE /api/v2/fleets/:id
   * Delete a fleet and its linked team (authorized against the fleet's actual organization)
   */
  async deleteFleet(req: Request, res: Response): Promise<void> {
    await deleteFleetHandler(req, res);
  }

  /**
   * GET /api/v2/fleets/:id/ships
   * Get all ships in a fleet with full query parameter support (tenant-scoped)
   */
  async getFleetShips(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
        limit: 50,
        offset: 0,
        sort: null,
        filters: {},
        search: null,
        fields: null,
      };
      const organizationId = getOrganizationId(req);

      await loadFleetInOrganization(id, organizationId, {
        notFoundCode: ApiErrorCode.FLEET_NOT_FOUND,
      });

      // Query ships through the FleetShip join table
      const queryBuilder = buildFleetShipWithShipQuery(id);

      // Apply search
      if (search) {
        queryBuilder.andWhere('(ship.name ILIKE :search OR ship.manufacturer ILIKE :search)', {
          search: `%${search}%`,
        });
      }

      // Apply validated filters
      const validFilters = validateFilters(filters, SHIP_FILTERABLE_FIELDS);
      Object.entries(validFilters).forEach(([field, value]) => {
        if (Array.isArray(value)) {
          queryBuilder.andWhere(`ship.${field} IN (:...${field}Values)`, {
            [`${field}Values`]: value,
          });
        } else {
          queryBuilder.andWhere(`ship.${field} = :${field}Value`, {
            [`${field}Value`]: value,
          });
        }
      });

      // Apply validated sorting
      const validSort = validateSortField(sort, SHIP_SORTABLE_FIELDS);
      if (validSort) {
        queryBuilder.orderBy(`ship.${validSort.field}`, validSort.order);
      } else {
        queryBuilder.orderBy('ship.name', 'ASC');
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get paginated results
      const fleetShips = await queryBuilder.skip(offset).take(limit).getMany();

      // Extract ships with assignment metadata
      const shipsWithMetadata = fleetShips.map(fs => ({
        ...fs.ship,
        fleetAssignment: {
          id: fs.id,
          role: fs.role,
          notes: fs.notes,
          assignedAt: fs.assignedAt,
          assignedBy: fs.assignedBy,
        },
      }));

      // Apply field selection
      const filteredShips = selectFieldsFromArray(shipsWithMetadata, fields);

      // Build HATEOAS links
      const links = buildHateoasLinks(`/api/v2/fleets/${id}/ships`, offset, limit, total);

      res.paginated(
        filteredShips,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error: unknown) {
      sendFleetDefaultErrorResponse(res, error);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/fleets/statistics
   * Get fleet statistics for an organization including org ships, member-shared ships,
   * size breakdown, role breakdown, career breakdown, and manufacturer breakdown.
   */
  async getFleetStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      const fleetRepo = AppDataSource.getRepository(Fleet);
      const orgShipRepo = AppDataSource.getRepository(OrganizationShip);
      const userShipRepo = AppDataSource.getRepository(UserShip);

      // Get fleet count
      const totalFleets = await fleetRepo.count({
        where: { organizationId: orgId },
      });

      // Count org-owned ships
      const totalOrgShips = await orgShipRepo.count({
        where: { organizationId: orgId },
      });

      // Base query builder for member-shared ships (reused for counts + breakdowns)
      const memberShipBase = (): SelectQueryBuilder<UserShip> =>
        userShipRepo
          .createQueryBuilder('us')
          .innerJoin(
            'organization_memberships',
            'om',
            'om."userId" = us."userId" AND om."organizationId" = :orgId',
            { orgId }
          )
          .where('us."sharingLevel" IN (:...levels)', {
            levels: ['organization', 'alliance'],
          })
          .andWhere('us."isActive" = true')
          .andWhere('us."deletedAt" IS NULL');

      // Count member-shared ships
      const totalMemberShips = await memberShipBase().getCount();

      // --- Org ship breakdowns (from Ship catalog) ---
      const orgShipsByRole = await orgShipRepo
        .createQueryBuilder('os')
        .innerJoin('ships', 's', 's.id = os."shipId"')
        .select('s.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('os."organizationId" = :orgId', { orgId })
        .groupBy('s.role')
        .getRawMany();

      const orgShipsBySize = await orgShipRepo
        .createQueryBuilder('os')
        .innerJoin('ships', 's', 's.id = os."shipId"')
        .select('s.size', 'size')
        .addSelect('COUNT(*)', 'count')
        .where('os."organizationId" = :orgId', { orgId })
        .groupBy('s.size')
        .getRawMany();

      const orgShipsByManufacturer = await orgShipRepo
        .createQueryBuilder('os')
        .innerJoin('ships', 's', 's.id = os."shipId"')
        .select('s.manufacturer', 'manufacturer')
        .addSelect('COUNT(*)', 'count')
        .where('os."organizationId" = :orgId', { orgId })
        .groupBy('s.manufacturer')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      const orgShipsByCareer = await orgShipRepo
        .createQueryBuilder('os')
        .innerJoin('ships', 's', 's.id = os."shipId"')
        .select('s.career', 'career')
        .addSelect('COUNT(*)', 'count')
        .where('os."organizationId" = :orgId', { orgId })
        .groupBy('s.career')
        .getRawMany();

      // --- Member-shared ship breakdowns (from Ship catalog via name match) ---
      const memberShipsByRole = await memberShipBase()
        .leftJoin(
          'ships',
          's',
          '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))'
        )
        .select('s.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.role')
        .getRawMany();

      const memberShipsBySize = await memberShipBase()
        .leftJoin(
          'ships',
          's',
          '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))'
        )
        .select('s.size', 'size')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.size')
        .getRawMany();

      const memberShipsByManufacturer = await memberShipBase()
        .leftJoin(
          'ships',
          's',
          '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))'
        )
        .select('s.manufacturer', 'manufacturer')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.manufacturer')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      const memberShipsByCareer = await memberShipBase()
        .leftJoin(
          'ships',
          's',
          '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))'
        )
        .select('s.career', 'career')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.career')
        .getRawMany();

      // Merge org + member breakdowns
      const mergeRecords = (
        a: Record<string, number>,
        b: Record<string, number>
      ): Record<string, number> => {
        const merged = { ...a };
        for (const [key, val] of Object.entries(b)) {
          merged[key] = (merged[key] ?? 0) + val;
        }
        return merged;
      };

      const statistics = {
        fleets: {
          total: totalFleets,
        },
        ships: {
          total: totalOrgShips + totalMemberShips,
          orgOwned: totalOrgShips,
          memberShared: totalMemberShips,
          byRole: mergeRecords(
            toStatRecord(orgShipsByRole as StatCountResult[], 'role'),
            toStatRecord(memberShipsByRole as StatCountResult[], 'role')
          ),
          bySize: mergeRecords(
            toStatRecord(orgShipsBySize as StatCountResult[], 'size'),
            toStatRecord(memberShipsBySize as StatCountResult[], 'size')
          ),
          byManufacturer: mergeRecords(
            toStatRecord(orgShipsByManufacturer as StatCountResult[], 'manufacturer'),
            toStatRecord(memberShipsByManufacturer as StatCountResult[], 'manufacturer')
          ),
          byCareer: mergeRecords(
            toStatRecord(orgShipsByCareer as StatCountResult[], 'career'),
            toStatRecord(memberShipsByCareer as StatCountResult[], 'career')
          ),
        },
      };

      res.success(statistics);
    } catch (error: unknown) {
      sendFleetLoggedErrorResponse(res, error, 'Fleet statistics failed', req.path);
    }
  }

  /**
   * GET /api/v2/fleets/:id/composition
   * Get detailed fleet composition and analytics (tenant-scoped)
   */
  async getFleetComposition(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const fleet = await loadFleetInOrganization(id, organizationId, {
      notFoundCode: ApiErrorCode.FLEET_NOT_FOUND,
    });

    const shipRepo = AppDataSource.getRepository(Ship);
    const ships = await shipRepo.find({
      where: { organizationId: fleet.organizationId },
    });

    // Analyze composition
    const composition = {
      fleet: {
        id: fleet.id,
        name: fleet.name,
        memberCount: fleet.members.length,
      },
      ships: {
        total: ships.length,
        byRole: {} as Record<string, number>,
        bySize: {} as Record<string, number>,
        byManufacturer: {} as Record<string, number>,
      },
      readiness: {
        flightReady: 0,
        inConcept: 0,
        inProduction: 0,
      },
    };

    // Analyze ships
    ships.forEach(ship => {
      // By role
      if (ship.role) {
        composition.ships.byRole[ship.role] = (composition.ships.byRole[ship.role] ?? 0) + 1;
      }

      // By size
      if (ship.size) {
        composition.ships.bySize[ship.size] = (composition.ships.bySize[ship.size] ?? 0) + 1;
      }

      // By manufacturer
      composition.ships.byManufacturer[ship.manufacturer] =
        (composition.ships.byManufacturer[ship.manufacturer] ?? 0) + 1;

      // Readiness
      if (ship.status === ShipStatus.FLIGHT_READY) {
        composition.readiness.flightReady++;
      } else if (ship.status === ShipStatus.IN_CONCEPT) {
        composition.readiness.inConcept++;
      } else if (ship.status === ShipStatus.IN_PRODUCTION) {
        composition.readiness.inProduction++;
      }
    });

    res.success(composition);
  }

  /**
   * GET /api/v2/fleets/:id/health
   * Evaluate fleet health using readiness, crew fill (lean/conservative gate), capability, and operational scores (tenant-scoped)
   */
  async getFleetHealth(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const organizationId = getOrganizationId(req);

      const healthService = new FleetHealthService();
      const health = await healthService.calculateFleetHealth(organizationId, id);

      res.success({
        fleetId: health.fleetId,
        fleetName: health.fleetName,
        healthScore: health.healthScore,
        status: health.status,
        breakdown: health.breakdown,
        details: health.details,
        crewHealth: health.crewHealth,
      });
    } catch (error: unknown) {
      const statusCode = resolveErrorStatus(error);
      const message = getErrorMessage(error);
      res
        .status(statusCode)
        .json({ success: false, error: { code: 'FLEET_HEALTH_ERROR', message } });
    }
  }

  // ==================== FLEET MEMBER MANAGEMENT ====================

  /**
   * GET /api/v2/fleets/:id/members
   * Get members of a fleet with pagination
   * Note: This endpoint returns ships assigned to the fleet (FleetShip join table)
   */
  async getFleetMembers(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const { limit = 20, offset = 0, sort } = req.queryParams ?? {};

      await loadAuthorizedFleet(req, fleetId, 'read');

      // Get ships in fleet via FleetShip join table
      const queryBuilder = buildFleetShipWithShipQuery(fleetId);

      // Apply sorting
      if (sort) {
        queryBuilder.orderBy(`ship.${sort.field}`, sort.order);
      } else {
        queryBuilder.orderBy('fleetShip.assignedAt', 'DESC');
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get paginated results
      const fleetShips = await queryBuilder.skip(offset).take(limit).getMany();

      // Format response with ship and assignment details
      const members = fleetShips.map(fs => ({
        ...fs.ship,
        fleetAssignment: {
          id: fs.id,
          role: fs.role,
          notes: fs.notes,
          assignedAt: fs.assignedAt,
          assignedBy: fs.assignedBy,
        },
      }));

      // Build HATEOAS links
      const links = buildHateoasLinks(`/api/v2/fleets/${fleetId}/members`, offset, limit, total);

      res.paginated(
        members,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to get fleet members');
    }
  }

  /**
   * POST /api/v2/fleets/:id/members
   * Add a ship to a fleet
   */
  async addFleetMember(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const { shipId, role, notes } = req.body as {
        shipId?: string;
        role?: string;
        notes?: string;
      };

      if (!shipId) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'shipId is required', 400);
      }

      const fleet = await loadAuthorizedFleet(req, fleetId, 'edit');

      // Get authenticated user ID for audit trail
      const userId = getAuthenticatedUserId(req);

      const { fleetShip, ship } = await this.fleetService.addShipToFleet(
        fleet.organizationId,
        fleetId,
        shipId,
        {
          performedById: userId,
          role,
          notes,
        }
      );

      // Emit WebSocket event for real-time updates
      emitFleetUpdated(fleet.organizationId, { ...fleet }, userId);

      res.success({
        message: 'Ship added to fleet successfully',
        assignment: {
          id: fleetShip.id,
          fleetId: fleetShip.fleetId,
          shipId: fleetShip.shipId,
          role: fleetShip.role,
          notes: fleetShip.notes,
          assignedAt: fleetShip.assignedAt,
          assignedBy: fleetShip.assignedBy,
        },
        ship,
      });
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to add fleet member');
    }
  }

  /**
   * DELETE /api/v2/fleets/:id/members/:shipId
   * Remove a ship from a fleet
   */
  async removeFleetMember(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId, shipId } = req.params;
      const fleet = await loadAuthorizedFleet(req, fleetId, 'edit');

      // Get authenticated user ID for audit trail
      const userId = getAuthenticatedUserId(req);

      await this.fleetService.removeShipFromFleet(fleet.organizationId, fleetId, shipId, {
        performedById: userId,
      });

      // Emit WebSocket event for real-time updates
      emitFleetUpdated(fleet.organizationId, { ...fleet }, userId);

      res.success({
        message: 'Ship removed from fleet successfully',
        fleetId,
        shipId,
      });
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to remove fleet member');
    }
  }

  /**
   * GET /api/v2/fleets/:id/roles
   * Get available roles for fleet members
   */
  async getFleetRoles(req: Request, res: Response): Promise<void> {
    await getFleetRolesHandler(req, res);
  }

  // ==================== FLEET ANALYTICS ====================

  /**
   * GET /api/v2/fleets/:id/analytics/composition
   * Get fleet composition statistics
   */
  async getCompositionAnalytics(req: Request, res: Response): Promise<void> {
    await getCompositionAnalyticsHandler(req, res);
  }

  /**
   * POST /api/v2/fleets/analytics/compare
   * Compare multiple fleets
   */
  async compareFleets(req: Request, res: Response): Promise<void> {
    await compareFleetsHandler(req, res);
  }

  // ==================== FLEET BULK OPERATIONS ====================

  /**
   * POST /api/v2/fleets/:id/members/bulk
   * Bulk add members to fleet
   */
  async bulkAddMembers(req: Request, res: Response): Promise<void> {
    await bulkAddMembersHandler(req, res);
  }

  /**
   * PATCH /api/v2/fleets/members/bulk
   * Bulk update fleet members (FleetShip role/notes)
   *
   * Body: { updates: [{ fleetId, shipId, role?, notes? }, ...] } (max 100)
   * All FleetShip rows are filtered by the requester's organizationId for tenant safety.
   */
  async bulkUpdateMembers(req: Request, res: Response): Promise<void> {
    await bulkUpdateMembersHandler(req, res);
  }

  /**
   * DELETE /api/v2/fleets/members/bulk
   * Bulk delete fleet members (FleetShip assignments)
   *
   * Body: { items: [{ fleetId, shipId }, ...] } (max 100)
   * All FleetShip rows are filtered by the requester's organizationId for tenant safety.
   */
  async bulkDeleteMembers(req: Request, res: Response): Promise<void> {
    await bulkDeleteMembersHandler(req, res);
  }

  // ==================== FLEET ASSIGNMENTS & SHARING ====================

  /**
   * GET /api/v2/fleets/:id/assignments
   * Get ship-to-role assignments
   */
  async getFleetAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const { limit = 20, offset = 0, sort } = req.queryParams ?? {};

      await loadAuthorizedFleet(req, fleetId, 'read');

      const queryBuilder = buildFleetShipWithShipQuery(fleetId);

      // Apply sorting when provided; otherwise default by assignment date
      const validSort = validateSortField(sort ?? null, [...SHIP_SORTABLE_FIELDS, 'assignedAt']);
      if (validSort?.field === 'assignedAt') {
        queryBuilder.orderBy('fleetShip.assignedAt', validSort.order);
      } else if (validSort) {
        queryBuilder.orderBy(`ship.${validSort.field}`, validSort.order);
      } else {
        queryBuilder.orderBy('fleetShip.assignedAt', 'DESC');
      }

      const total = await queryBuilder.getCount();
      const assignments = await queryBuilder.skip(offset).take(limit).getMany();

      const payload = assignments.map(assignment => ({
        id: assignment.id,
        fleetId: assignment.fleetId,
        shipId: assignment.shipId,
        role: assignment.role,
        notes: assignment.notes,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        ship: assignment.ship,
      }));

      const links = buildHateoasLinks(
        `/api/v2/fleets/${fleetId}/assignments`,
        Number(offset),
        Number(limit),
        total
      );

      res.paginated(
        payload,
        {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
        links
      );
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to get fleet assignments');
    }
  }

  /**
   * POST /api/v2/fleets/:id/assignments
   * Create new ship assignment
   */
  async createFleetAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const { shipId, role, notes } = req.body as {
        shipId?: string;
        role?: string;
        notes?: string;
      };

      if (!shipId || !role) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Ship ID and role are required', 400);
      }

      const fleet = await loadAuthorizedFleet(req, fleetId, 'edit');

      const userId = getAuthenticatedUserId(req);

      const { fleetShip } = await this.fleetService.addShipToFleet(
        fleet.organizationId,
        fleetId,
        shipId,
        {
          performedById: userId,
          role,
          notes,
        }
      );

      emitFleetUpdated(fleet.organizationId, { ...fleet }, userId);

      res.status(201).success({
        id: fleetShip.id,
        fleetId: fleetShip.fleetId,
        shipId: fleetShip.shipId,
        role: fleetShip.role,
        notes: fleetShip.notes,
        assignedAt: fleetShip.assignedAt,
        assignedBy: fleetShip.assignedBy,
      });
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to create fleet assignment');
    }
  }

  /**
   * DELETE /api/v2/fleets/:id/assignments/:assignmentId
   * Remove assignment
   */
  async deleteFleetAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId, assignmentId } = req.params;
      const fleet = await loadAuthorizedFleet(req, fleetId, 'edit');

      const assignment: FleetShip = await loadFleetAssignmentInFleet(assignmentId, fleetId, {
        notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
        notFoundMessage: 'Assignment not found',
      });

      const userId = getAuthenticatedUserId(req);

      await this.fleetService.removeShipFromFleet(
        fleet.organizationId,
        fleetId,
        assignment.shipId,
        {
          performedById: userId,
        }
      );

      emitFleetUpdated(fleet.organizationId, { ...fleet }, userId);

      res.status(204).success({ message: 'Assignment removed successfully' });
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to remove fleet assignment');
    }
  }

  /**
   * GET /api/v2/fleets/:id/sharing
   * Get fleet sharing and visibility settings
   */
  async getFleetSharing(req: Request, res: Response): Promise<void> {
    await getFleetSharingHandler(req, res);
  }

  /**
   * PATCH /api/v2/fleets/:id/sharing
   * Update fleet sharing settings
   */
  async updateFleetSharing(req: Request, res: Response): Promise<void> {
    await updateFleetSharingHandler(req, res);
  }

  // ==================== FLEET SCHEDULES ====================

  /**
   * GET /api/v2/fleets/:id/schedule
   * Get fleet operation schedule
   */
  async getFleetSchedule(req: Request, res: Response): Promise<void> {
    await getFleetScheduleHandler(req, res);
  }

  /**
   * POST /api/v2/fleets/:id/schedule
   * Create scheduled fleet operation
   */
  async createFleetSchedule(req: Request, res: Response): Promise<void> {
    await createFleetScheduleHandler(req, res);
  }

  /**
   * PATCH /api/v2/fleets/:id/schedule/:scheduleId
   * Update scheduled fleet operation
   */
  async updateFleetSchedule(req: Request, res: Response): Promise<void> {
    await updateFleetScheduleHandler(req, res);
  }

  /**
   * DELETE /api/v2/fleets/:id/schedule/:scheduleId
   * Cancel scheduled fleet operation
   */
  async deleteFleetSchedule(req: Request, res: Response): Promise<void> {
    await deleteFleetScheduleHandler(req, res);
  }

  // ==================== FLEET HIERARCHY (Wave 2.2) ====================

  /**
   * GET /api/v2/organizations/:orgId/fleets/tree
   * Get fleet hierarchy tree for an organization
   */
  async getFleetTree(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      const tree = await this.fleetService.getFleetTree(orgId);

      res.success({
        tree,
        totalFleets: countTreeNodes(tree),
      });
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to fetch fleet tree');
    }
  }

  /**
   * PUT /api/v2/fleets/:id/move
   * Move a fleet to a new parent (or to root)
   */
  async moveFleet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { parentFleetId } = req.body as { parentFleetId?: string | null };
      const userId = getAuthenticatedUserId(req);
      const organizationId = getOrganizationId(req);

      // Verify fleet exists and belongs to the user's organization
      const fleet = await loadFleetInOrganization(id, organizationId, {
        notFoundCode: ApiErrorCode.FLEET_NOT_FOUND,
      });

      const updated = await this.fleetService.moveFleet(organizationId, id, parentFleetId ?? null);

      emitFleetUpdated(
        fleet.organizationId,
        {
          id: updated.id,
          name: updated.name,
        },
        userId
      );

      res.success(updated);
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to move fleet');
    }
  }

  /**
   * PUT /api/v2/organizations/:orgId/fleets/reorder
   * Reorder fleets within a parent
   */
  async reorderFleets(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { orderedIds, parentFleetId } = req.body as {
        orderedIds: string[];
        parentFleetId?: string | null;
      };

      await this.fleetService.reorderFleets(orgId, orderedIds, parentFleetId ?? null);

      res.success({ message: 'Fleets reordered successfully' });
    } catch (error: unknown) {
      throw normalizeApiError(error, 'Failed to reorder fleets');
    }
  }

  // ==================== AGGREGATOR ENDPOINTS ====================

  /**
   * POST /api/v2/organizations/:orgId/fleets/create-full
   * Create fleet with ships, squadrons, and inventory in one operation (saga)
   */
  async createFleetWithAssets(req: Request, res: Response): Promise<void> {
    await createFleetWithAssetsHandler(req, res);
  }

  /**
   * POST /api/v2/fleets/:id/deploy
   * Deploy fleet to a location with mission parameters
   */
  async deployFleet(req: Request, res: Response): Promise<void> {
    await deployFleetHandler(req, res);
  }

  /**
   * POST /api/v2/fleets/:id/dissolve
   * Dissolve fleet, optionally reassigning ships (saga)
   */
  async dissolveFleet(req: Request, res: Response): Promise<void> {
    await dissolveFleetHandler(req, res);
  }

  // ── Crew Self-Select ──────────────────────────────────────────

  /**
   * POST /api/v2/fleets/:id/crew/select
   * Allow a team member to select their ship and crew position within a fleet.
   * The caller must be an active member of the fleet's linked team.
   */
  async selectCrewPosition(req: Request, res: Response): Promise<void> {
    await selectCrewPositionHandler(req, res);
  }

  /**
   * DELETE /api/v2/fleets/:id/crew/select
   * Allow a team member to unselect / vacate their crew position.
   */
  async unselectCrewPosition(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const organizationId = getOrganizationId(req);
      const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

      const fleetTeamService = FleetTeamService.getInstance();
      await fleetTeamService.unselectCrewPosition(organizationId, fleetId, userId);

      res.success({ message: 'Crew position vacated' });
    } catch (error: unknown) {
      rethrowApiOrSendFleetInternalErrorResponse(
        res,
        error,
        'Crew position unselect failed',
        req.path
      );
    }
  }

  /**
   * GET /api/v2/fleets/:id/crew/positions
   * Get crew positions for all ships in the fleet, showing who is assigned where.
   */
  async getCrewPositions(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const organizationId = getOrganizationId(req);

      const fleetTeamService = FleetTeamService.getInstance();
      const positions = await fleetTeamService.getCrewPositions(organizationId, fleetId);

      res.success(positions);
    } catch (error: unknown) {
      rethrowApiOrSendFleetInternalErrorResponse(res, error, 'Get crew positions failed', req.path);
    }
  }

  /**
   * GET /api/v2/fleets/:id/crew/members
   * Get all crew members for a fleet, with their ship assignments.
   */
  async getFleetCrewMembers(req: Request, res: Response): Promise<void> {
    try {
      const { id: fleetId } = req.params;
      const organizationId = getOrganizationId(req);

      const fleetTeamService = FleetTeamService.getInstance();
      const result = await fleetTeamService.getFleetCrewMembers(organizationId, fleetId);

      res.success(result);
    } catch (error: unknown) {
      sendFleetLoggedErrorResponse(res, error, 'Get fleet crew members failed', req.path);
    }
  }

  // ── Fleet Audit Log ──────────────────────────────────────────

  /**
   * GET /api/v2/fleets/:id/audit
   * Get audit log entries for a specific fleet.
   * Supports optional query params: action, limit.
   */
  async getFleetAuditLog(req: Request, res: Response): Promise<void> {
    await getFleetAuditLogHandler(req, res);
  }
}
