"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const Fleet_1 = require("../../models/Fleet");
const OrganizationShip_1 = require("../../models/OrganizationShip");
const Ship_1 = require("../../models/Ship");
const UserShip_1 = require("../../models/UserShip");
const FleetHealthService_1 = require("../../services/fleet/FleetHealthService");
const FleetService_1 = require("../../services/fleet/FleetService");
const FleetTeamService_1 = require("../../services/fleet/FleetTeamService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetWebSocketController_1 = require("../../websocket/controllers/fleetWebSocketController");
const fleetController_aggregatorCrew_1 = require("./fleetController.aggregatorCrew");
const fleetController_audit_1 = require("./fleetController.audit");
const fleetController_authorization_1 = require("./fleetController.authorization");
const fleetController_bulkGuards_1 = require("./fleetController.bulkGuards");
const fleetController_coreOperations_1 = require("./fleetController.coreOperations");
const fleetController_errors_1 = require("./fleetController.errors");
const fleetController_lookup_1 = require("./fleetController.lookup");
const fleetController_rolesAnalyticsBulk_1 = require("./fleetController.rolesAnalyticsBulk");
const fleetController_sharingSchedules_1 = require("./fleetController.sharingSchedules");
const fleetController_stats_1 = require("./fleetController.stats");
const fleetController_tree_1 = require("./fleetController.tree");
const SHIP_SORTABLE_FIELDS = ['name', 'manufacturer', 'size', 'role', 'status', 'createdAt'];
const SHIP_FILTERABLE_FIELDS = ['manufacturer', 'size', 'role', 'status'];
class FleetControllerV2 {
    _fleetService;
    get fleetService() {
        this._fleetService ??= new FleetService_1.FleetService();
        return this._fleetService;
    }
    async listOrgFleets(req, res) {
        await (0, fleetController_coreOperations_1.listOrgFleetsHandler)(req, res);
    }
    async getFleetOverview(req, res) {
        await (0, fleetController_coreOperations_1.getFleetOverviewHandler)(req, res);
    }
    async getFleetById(req, res) {
        await (0, fleetController_coreOperations_1.getFleetByIdHandler)(req, res);
    }
    async createFleet(req, res) {
        await (0, fleetController_coreOperations_1.createFleetHandler)(req, res, this.fleetService);
    }
    async updateFleet(req, res) {
        await (0, fleetController_coreOperations_1.updateFleetHandler)(req, res);
    }
    async deleteFleet(req, res) {
        await (0, fleetController_coreOperations_1.deleteFleetHandler)(req, res);
    }
    async getFleetShips(req, res) {
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
            const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
            await (0, fleetController_lookup_1.loadFleetInOrganization)(id, organizationId, {
                notFoundCode: api_1.ApiErrorCode.FLEET_NOT_FOUND,
            });
            const queryBuilder = (0, fleetController_lookup_1.buildFleetShipWithShipQuery)(id);
            if (search) {
                queryBuilder.andWhere('(ship.name ILIKE :search OR ship.manufacturer ILIKE :search)', {
                    search: `%${search}%`,
                });
            }
            const validFilters = (0, queryParser_1.validateFilters)(filters, SHIP_FILTERABLE_FIELDS);
            Object.entries(validFilters).forEach(([field, value]) => {
                if (Array.isArray(value)) {
                    queryBuilder.andWhere(`ship.${field} IN (:...${field}Values)`, {
                        [`${field}Values`]: value,
                    });
                }
                else {
                    queryBuilder.andWhere(`ship.${field} = :${field}Value`, {
                        [`${field}Value`]: value,
                    });
                }
            });
            const validSort = (0, queryParser_1.validateSortField)(sort, SHIP_SORTABLE_FIELDS);
            if (validSort) {
                queryBuilder.orderBy(`ship.${validSort.field}`, validSort.order);
            }
            else {
                queryBuilder.orderBy('ship.name', 'ASC');
            }
            const total = await queryBuilder.getCount();
            const fleetShips = await queryBuilder.skip(offset).take(limit).getMany();
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
            const filteredShips = (0, queryParser_1.selectFieldsFromArray)(shipsWithMetadata, fields);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/fleets/${id}/ships`, offset, limit, total);
            res.paginated(filteredShips, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            (0, fleetController_errors_1.sendFleetDefaultErrorResponse)(res, error);
        }
    }
    async getFleetStatistics(req, res) {
        try {
            const { orgId } = req.params;
            const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
            const orgShipRepo = database_1.AppDataSource.getRepository(OrganizationShip_1.OrganizationShip);
            const userShipRepo = database_1.AppDataSource.getRepository(UserShip_1.UserShip);
            const totalFleets = await fleetRepo.count({
                where: { organizationId: orgId },
            });
            const totalOrgShips = await orgShipRepo.count({
                where: { organizationId: orgId },
            });
            const memberShipBase = () => userShipRepo
                .createQueryBuilder('us')
                .innerJoin('organization_memberships', 'om', 'om."userId" = us."userId" AND om."organizationId" = :orgId', { orgId })
                .where('us."sharingLevel" IN (:...levels)', {
                levels: ['organization', 'alliance'],
            })
                .andWhere('us."isActive" = true')
                .andWhere('us."deletedAt" IS NULL');
            const totalMemberShips = await memberShipBase().getCount();
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
            const memberShipsByRole = await memberShipBase()
                .leftJoin('ships', 's', '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))')
                .select('s.role', 'role')
                .addSelect('COUNT(*)', 'count')
                .groupBy('s.role')
                .getRawMany();
            const memberShipsBySize = await memberShipBase()
                .leftJoin('ships', 's', '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))')
                .select('s.size', 'size')
                .addSelect('COUNT(*)', 'count')
                .groupBy('s.size')
                .getRawMany();
            const memberShipsByManufacturer = await memberShipBase()
                .leftJoin('ships', 's', '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))')
                .select('s.manufacturer', 'manufacturer')
                .addSelect('COUNT(*)', 'count')
                .groupBy('s.manufacturer')
                .orderBy('count', 'DESC')
                .limit(10)
                .getRawMany();
            const memberShipsByCareer = await memberShipBase()
                .leftJoin('ships', 's', '(us."shipId" IS NOT NULL AND s.id = us."shipId") OR (us."shipId" IS NULL AND LOWER(s.name) = LOWER(us."shipName"))')
                .select('s.career', 'career')
                .addSelect('COUNT(*)', 'count')
                .groupBy('s.career')
                .getRawMany();
            const mergeRecords = (a, b) => {
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
                    byRole: mergeRecords((0, fleetController_stats_1.toStatRecord)(orgShipsByRole, 'role'), (0, fleetController_stats_1.toStatRecord)(memberShipsByRole, 'role')),
                    bySize: mergeRecords((0, fleetController_stats_1.toStatRecord)(orgShipsBySize, 'size'), (0, fleetController_stats_1.toStatRecord)(memberShipsBySize, 'size')),
                    byManufacturer: mergeRecords((0, fleetController_stats_1.toStatRecord)(orgShipsByManufacturer, 'manufacturer'), (0, fleetController_stats_1.toStatRecord)(memberShipsByManufacturer, 'manufacturer')),
                    byCareer: mergeRecords((0, fleetController_stats_1.toStatRecord)(orgShipsByCareer, 'career'), (0, fleetController_stats_1.toStatRecord)(memberShipsByCareer, 'career')),
                },
            };
            res.success(statistics);
        }
        catch (error) {
            (0, fleetController_errors_1.sendFleetLoggedErrorResponse)(res, error, 'Fleet statistics failed', req.path);
        }
    }
    async getFleetComposition(req, res) {
        const { id } = req.params;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(id, organizationId, {
            notFoundCode: api_1.ApiErrorCode.FLEET_NOT_FOUND,
        });
        const shipRepo = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const ships = await shipRepo.find({
            where: { organizationId: fleet.organizationId },
        });
        const composition = {
            fleet: {
                id: fleet.id,
                name: fleet.name,
                memberCount: fleet.members.length,
            },
            ships: {
                total: ships.length,
                byRole: {},
                bySize: {},
                byManufacturer: {},
            },
            readiness: {
                flightReady: 0,
                inConcept: 0,
                inProduction: 0,
            },
        };
        ships.forEach(ship => {
            if (ship.role) {
                composition.ships.byRole[ship.role] = (composition.ships.byRole[ship.role] ?? 0) + 1;
            }
            if (ship.size) {
                composition.ships.bySize[ship.size] = (composition.ships.bySize[ship.size] ?? 0) + 1;
            }
            composition.ships.byManufacturer[ship.manufacturer] =
                (composition.ships.byManufacturer[ship.manufacturer] ?? 0) + 1;
            if (ship.status === Ship_1.ShipStatus.FLIGHT_READY) {
                composition.readiness.flightReady++;
            }
            else if (ship.status === Ship_1.ShipStatus.IN_CONCEPT) {
                composition.readiness.inConcept++;
            }
            else if (ship.status === Ship_1.ShipStatus.IN_PRODUCTION) {
                composition.readiness.inProduction++;
            }
        });
        res.success(composition);
    }
    async getFleetHealth(req, res) {
        try {
            const { id } = req.params;
            const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
            const healthService = new FleetHealthService_1.FleetHealthService();
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
        }
        catch (error) {
            const statusCode = (0, fleetController_errors_1.resolveErrorStatus)(error);
            const message = (0, errorHandler_1.getErrorMessage)(error);
            res
                .status(statusCode)
                .json({ success: false, error: { code: 'FLEET_HEALTH_ERROR', message } });
        }
    }
    async getFleetMembers(req, res) {
        try {
            const { id: fleetId } = req.params;
            const { limit = 20, offset = 0, sort } = req.queryParams ?? {};
            await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, fleetId, 'read');
            const queryBuilder = (0, fleetController_lookup_1.buildFleetShipWithShipQuery)(fleetId);
            if (sort) {
                queryBuilder.orderBy(`ship.${sort.field}`, sort.order);
            }
            else {
                queryBuilder.orderBy('fleetShip.assignedAt', 'DESC');
            }
            const total = await queryBuilder.getCount();
            const fleetShips = await queryBuilder.skip(offset).take(limit).getMany();
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
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/fleets/${fleetId}/members`, offset, limit, total);
            res.paginated(members, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to get fleet members');
        }
    }
    async addFleetMember(req, res) {
        try {
            const { id: fleetId } = req.params;
            const { shipId, role, notes } = req.body;
            if (!shipId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'shipId is required', 400);
            }
            const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, fleetId, 'edit');
            const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
            const { fleetShip, ship } = await this.fleetService.addShipToFleet(fleet.organizationId, fleetId, shipId, {
                performedById: userId,
                role,
                notes,
            });
            (0, fleetWebSocketController_1.emitFleetUpdated)(fleet.organizationId, { ...fleet }, userId);
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
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to add fleet member');
        }
    }
    async removeFleetMember(req, res) {
        try {
            const { id: fleetId, shipId } = req.params;
            const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, fleetId, 'edit');
            const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
            await this.fleetService.removeShipFromFleet(fleet.organizationId, fleetId, shipId, {
                performedById: userId,
            });
            (0, fleetWebSocketController_1.emitFleetUpdated)(fleet.organizationId, { ...fleet }, userId);
            res.success({
                message: 'Ship removed from fleet successfully',
                fleetId,
                shipId,
            });
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to remove fleet member');
        }
    }
    async getFleetRoles(req, res) {
        await (0, fleetController_rolesAnalyticsBulk_1.getFleetRolesHandler)(req, res);
    }
    async getCompositionAnalytics(req, res) {
        await (0, fleetController_rolesAnalyticsBulk_1.getCompositionAnalyticsHandler)(req, res);
    }
    async compareFleets(req, res) {
        await (0, fleetController_rolesAnalyticsBulk_1.compareFleetsHandler)(req, res);
    }
    async bulkAddMembers(req, res) {
        await (0, fleetController_rolesAnalyticsBulk_1.bulkAddMembersHandler)(req, res);
    }
    async bulkUpdateMembers(req, res) {
        await (0, fleetController_rolesAnalyticsBulk_1.bulkUpdateMembersHandler)(req, res);
    }
    async bulkDeleteMembers(req, res) {
        await (0, fleetController_rolesAnalyticsBulk_1.bulkDeleteMembersHandler)(req, res);
    }
    async getFleetAssignments(req, res) {
        try {
            const { id: fleetId } = req.params;
            const { limit = 20, offset = 0, sort } = req.queryParams ?? {};
            await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, fleetId, 'read');
            const queryBuilder = (0, fleetController_lookup_1.buildFleetShipWithShipQuery)(fleetId);
            const validSort = (0, queryParser_1.validateSortField)(sort ?? null, [...SHIP_SORTABLE_FIELDS, 'assignedAt']);
            if (validSort?.field === 'assignedAt') {
                queryBuilder.orderBy('fleetShip.assignedAt', validSort.order);
            }
            else if (validSort) {
                queryBuilder.orderBy(`ship.${validSort.field}`, validSort.order);
            }
            else {
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
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/fleets/${fleetId}/assignments`, Number(offset), Number(limit), total);
            res.paginated(payload, {
                total,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: Number(offset) + Number(limit) < total,
            }, links);
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to get fleet assignments');
        }
    }
    async createFleetAssignment(req, res) {
        try {
            const { id: fleetId } = req.params;
            const { shipId, role, notes } = req.body;
            if (!shipId || !role) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Ship ID and role are required', 400);
            }
            const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, fleetId, 'edit');
            const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
            const { fleetShip } = await this.fleetService.addShipToFleet(fleet.organizationId, fleetId, shipId, {
                performedById: userId,
                role,
                notes,
            });
            (0, fleetWebSocketController_1.emitFleetUpdated)(fleet.organizationId, { ...fleet }, userId);
            res.status(201).success({
                id: fleetShip.id,
                fleetId: fleetShip.fleetId,
                shipId: fleetShip.shipId,
                role: fleetShip.role,
                notes: fleetShip.notes,
                assignedAt: fleetShip.assignedAt,
                assignedBy: fleetShip.assignedBy,
            });
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to create fleet assignment');
        }
    }
    async deleteFleetAssignment(req, res) {
        try {
            const { id: fleetId, assignmentId } = req.params;
            const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, fleetId, 'edit');
            const assignment = await (0, fleetController_lookup_1.loadFleetAssignmentInFleet)(assignmentId, fleetId, {
                notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
                notFoundMessage: 'Assignment not found',
            });
            const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
            await this.fleetService.removeShipFromFleet(fleet.organizationId, fleetId, assignment.shipId, {
                performedById: userId,
            });
            (0, fleetWebSocketController_1.emitFleetUpdated)(fleet.organizationId, { ...fleet }, userId);
            res.status(204).success({ message: 'Assignment removed successfully' });
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to remove fleet assignment');
        }
    }
    async getFleetSharing(req, res) {
        await (0, fleetController_sharingSchedules_1.getFleetSharingHandler)(req, res);
    }
    async updateFleetSharing(req, res) {
        await (0, fleetController_sharingSchedules_1.updateFleetSharingHandler)(req, res);
    }
    async getFleetSchedule(req, res) {
        await (0, fleetController_sharingSchedules_1.getFleetScheduleHandler)(req, res);
    }
    async createFleetSchedule(req, res) {
        await (0, fleetController_sharingSchedules_1.createFleetScheduleHandler)(req, res);
    }
    async updateFleetSchedule(req, res) {
        await (0, fleetController_sharingSchedules_1.updateFleetScheduleHandler)(req, res);
    }
    async deleteFleetSchedule(req, res) {
        await (0, fleetController_sharingSchedules_1.deleteFleetScheduleHandler)(req, res);
    }
    async getFleetTree(req, res) {
        try {
            const { orgId } = req.params;
            const tree = await this.fleetService.getFleetTree(orgId);
            res.success({
                tree,
                totalFleets: (0, fleetController_tree_1.countTreeNodes)(tree),
            });
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to fetch fleet tree');
        }
    }
    async moveFleet(req, res) {
        try {
            const { id } = req.params;
            const { parentFleetId } = req.body;
            const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
            const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
            const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(id, organizationId, {
                notFoundCode: api_1.ApiErrorCode.FLEET_NOT_FOUND,
            });
            const updated = await this.fleetService.moveFleet(organizationId, id, parentFleetId ?? null);
            (0, fleetWebSocketController_1.emitFleetUpdated)(fleet.organizationId, {
                id: updated.id,
                name: updated.name,
            }, userId);
            res.success(updated);
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to move fleet');
        }
    }
    async reorderFleets(req, res) {
        try {
            const { orgId } = req.params;
            const { orderedIds, parentFleetId } = req.body;
            await this.fleetService.reorderFleets(orgId, orderedIds, parentFleetId ?? null);
            res.success({ message: 'Fleets reordered successfully' });
        }
        catch (error) {
            throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to reorder fleets');
        }
    }
    async createFleetWithAssets(req, res) {
        await (0, fleetController_aggregatorCrew_1.createFleetWithAssetsHandler)(req, res);
    }
    async deployFleet(req, res) {
        await (0, fleetController_aggregatorCrew_1.deployFleetHandler)(req, res);
    }
    async dissolveFleet(req, res) {
        await (0, fleetController_aggregatorCrew_1.dissolveFleetHandler)(req, res);
    }
    async selectCrewPosition(req, res) {
        await (0, fleetController_aggregatorCrew_1.selectCrewPositionHandler)(req, res);
    }
    async unselectCrewPosition(req, res) {
        try {
            const { id: fleetId } = req.params;
            const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
            const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
            const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
            await fleetTeamService.unselectCrewPosition(organizationId, fleetId, userId);
            res.success({ message: 'Crew position vacated' });
        }
        catch (error) {
            (0, fleetController_errors_1.rethrowApiOrSendFleetInternalErrorResponse)(res, error, 'Crew position unselect failed', req.path);
        }
    }
    async getCrewPositions(req, res) {
        try {
            const { id: fleetId } = req.params;
            const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
            const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
            const positions = await fleetTeamService.getCrewPositions(organizationId, fleetId);
            res.success(positions);
        }
        catch (error) {
            (0, fleetController_errors_1.rethrowApiOrSendFleetInternalErrorResponse)(res, error, 'Get crew positions failed', req.path);
        }
    }
    async getFleetCrewMembers(req, res) {
        try {
            const { id: fleetId } = req.params;
            const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
            const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
            const result = await fleetTeamService.getFleetCrewMembers(organizationId, fleetId);
            res.success(result);
        }
        catch (error) {
            (0, fleetController_errors_1.sendFleetLoggedErrorResponse)(res, error, 'Get fleet crew members failed', req.path);
        }
    }
    async getFleetAuditLog(req, res) {
        await (0, fleetController_audit_1.getFleetAuditLogHandler)(req, res);
    }
}
exports.FleetControllerV2 = FleetControllerV2;
//# sourceMappingURL=fleetController.js.map