"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrgFleetsHandler = listOrgFleetsHandler;
exports.getFleetOverviewHandler = getFleetOverviewHandler;
exports.getFleetByIdHandler = getFleetByIdHandler;
exports.createFleetHandler = createFleetHandler;
exports.updateFleetHandler = updateFleetHandler;
exports.deleteFleetHandler = deleteFleetHandler;
const database_1 = require("../../config/database");
const queryParser_1 = require("../../middleware/queryParser");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const FleetTeamService_1 = require("../../services/fleet/FleetTeamService");
const logger_1 = require("../../utils/logger");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetWebSocketController_1 = require("../../websocket/controllers/fleetWebSocketController");
const fleetController_authorization_1 = require("./fleetController.authorization");
const fleetController_capabilities_1 = require("./fleetController.capabilities");
const fleetController_errors_1 = require("./fleetController.errors");
const FLEET_SORTABLE_FIELDS = ['name', 'createdAt', 'updatedAt', 'status'];
const FLEET_FILTERABLE_FIELDS = ['status', 'name'];
async function listOrgFleetsHandler(req, res) {
    try {
        const orgId = (0, tenantHelpers_1.getOrganizationId)(req);
        const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
            limit: 20,
            offset: 0,
            sort: null,
            filters: {},
            search: null,
            fields: null,
        };
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const queryBuilder = fleetRepo
            .createQueryBuilder('fleet')
            .where('fleet.organizationId = :orgId', { orgId });
        if (search) {
            queryBuilder.andWhere('fleet.name ILIKE :search', {
                search: `%${search}%`,
            });
        }
        const validFilters = (0, queryParser_1.validateFilters)(filters, FLEET_FILTERABLE_FIELDS);
        Object.entries(validFilters).forEach(([field, value]) => {
            if (Array.isArray(value)) {
                queryBuilder.andWhere(`fleet.${field} IN (:...${field}Values)`, {
                    [`${field}Values`]: value,
                });
            }
            else {
                queryBuilder.andWhere(`fleet.${field} = :${field}Value`, {
                    [`${field}Value`]: value,
                });
            }
        });
        const validSort = (0, queryParser_1.validateSortField)(sort, FLEET_SORTABLE_FIELDS);
        if (validSort) {
            queryBuilder.orderBy(`fleet.${validSort.field}`, validSort.order);
        }
        else {
            queryBuilder.orderBy('fleet.createdAt', 'DESC');
        }
        const total = await queryBuilder.getCount();
        const fleets = await queryBuilder.skip(offset).take(limit).getMany();
        const fleetIds = fleets.map(f => f.id);
        const [shipCountMap, memberCountMap] = await Promise.all([
            (0, fleetController_capabilities_1.batchShipCounts)(fleetIds),
            (0, fleetController_capabilities_1.batchMemberCounts)(fleets, orgId),
        ]);
        const fleetCapabilities = await (0, fleetController_capabilities_1.computeFleetCapabilities)(fleetIds);
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
        const filteredFleets = (0, queryParser_1.selectFieldsFromArray)(enrichedWithCaps, fields);
        const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/fleets`, offset, limit, total, {
            ...(search ? { search } : {}),
        });
        res.paginated(filteredFleets, {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        }, links);
    }
    catch (error) {
        (0, fleetController_errors_1.sendFleetErrorResponse)(res, error, {
            logMessage: 'Fleet listing failed',
            path: req.path,
        });
    }
}
async function getFleetOverviewHandler(req, res) {
    try {
        const orgId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
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
            (0, fleetController_capabilities_1.batchShipCounts)(fleetIds),
            (0, fleetController_capabilities_1.batchMemberCounts)(fleets, orgId),
            (0, fleetController_capabilities_1.computeFleetCapabilities)(fleetIds),
        ]);
        const fleetShipRepo = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        const fleetShipRows = await fleetShipRepo
            .createQueryBuilder('fs')
            .innerJoin('fs.ship', 'ship')
            .select(['fs.fleetId', 'ship.name'])
            .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
            .getMany();
        const shipNameToFleets = {};
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
    }
    catch (error) {
        (0, fleetController_errors_1.sendFleetErrorResponse)(res, error, {
            logMessage: 'Fleet overview failed',
            path: req.path,
        });
    }
}
async function getFleetByIdHandler(req, res) {
    try {
        const { id } = req.params;
        const fields = req.queryParams?.fields;
        const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, id, 'read');
        const organizationId = fleet.organizationId;
        const fleetShipRepo = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
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
                const teamMemberCount = await database_1.AppDataSource.query(`SELECT COUNT(*)::int AS "count" FROM team_members
           WHERE "teamId" = $1 AND "organizationId" = $2
             AND status IN ('active', 'deployed')`, [fleet.teamId, organizationId]);
                memberCount = teamMemberCount?.[0]?.count ?? memberCount;
            }
            catch (error) {
                let errorMessage = 'Unknown error';
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else if (typeof error === 'string') {
                    errorMessage = error;
                }
                else if (typeof error === 'number' ||
                    typeof error === 'boolean' ||
                    typeof error === 'bigint' ||
                    typeof error === 'symbol') {
                    errorMessage = String(error);
                }
                logger_1.logger.warn('Failed to count team members for fleet', {
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
            const filtered = {};
            const fleetRecord = enrichedFleet;
            fields.forEach(field => {
                if (field in enrichedFleet) {
                    filtered[field] = fleetRecord[field];
                }
            });
            res.success(filtered);
        }
        else {
            res.success(enrichedFleet);
        }
    }
    catch (error) {
        (0, fleetController_errors_1.sendFleetErrorResponse)(res, error, {
            logMessage: 'Fleet retrieval failed',
            path: req.path,
        });
    }
}
async function createFleetHandler(req, res, fleetService) {
    try {
        const { orgId } = req.params;
        const { name, type, description, members } = req.body;
        const fleet = await fleetService.createFleet(orgId, {
            name,
            description,
            type,
            members,
        });
        const fleetWithTeam = await fleetService.postCreateFleet(orgId, fleet);
        const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
        (0, fleetWebSocketController_1.emitFleetCreated)(orgId, { ...fleetWithTeam }, userId);
        res.success(fleetWithTeam);
    }
    catch (error) {
        (0, fleetController_errors_1.sendFleetErrorResponse)(res, error, {
            logMessage: 'Fleet creation failed',
            path: req.path,
        });
    }
}
async function updateFleetHandler(req, res) {
    try {
        const { id } = req.params;
        const { name, description, type, members } = req.body;
        const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, id, 'edit');
        if (name !== undefined) {
            fleet.name = name;
        }
        if (description !== undefined) {
            fleet.description = description;
        }
        if (type !== undefined) {
            if (Object.values(Fleet_1.FleetType).includes(type)) {
                fleet.type = type;
            }
        }
        if (members !== undefined) {
            fleet.members = members;
        }
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        await fleetRepo.save(fleet);
        const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
        (0, fleetWebSocketController_1.emitFleetUpdated)(fleet.organizationId, { ...fleet }, userId);
        res.success(fleet);
    }
    catch (error) {
        (0, fleetController_errors_1.sendFleetErrorResponse)(res, error, {
            logMessage: 'Fleet update failed',
            path: req.path,
        });
    }
}
async function deleteFleetHandler(req, res) {
    const t0 = Date.now();
    const timings = {};
    try {
        const { id } = req.params;
        const tAuth = Date.now();
        const fleet = await (0, fleetController_authorization_1.loadAuthorizedFleet)(req, id, 'delete');
        timings.loadAuthorizedFleet = Date.now() - tAuth;
        const orgId = fleet.organizationId;
        const hadTeam = Boolean(fleet.teamId);
        if (fleet.teamId) {
            const tTeam = Date.now();
            const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
            await fleetTeamService.deleteTeamForFleet(orgId, fleet);
            timings.deleteTeamForFleet = Date.now() - tTeam;
        }
        const tRemove = Date.now();
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        await fleetRepo.remove(fleet);
        timings.fleetRepoRemove = Date.now() - tRemove;
        const tEmit = Date.now();
        (0, fleetWebSocketController_1.emitFleetDeleted)(orgId, id);
        timings.emitFleetDeleted = Date.now() - tEmit;
        timings.total = Date.now() - t0;
        res.success({
            id,
            deleted: true,
            message: 'Fleet deleted successfully',
        });
        logger_1.logger.info('Fleet deletion timings', { fleetId: id, hadTeam, timings });
    }
    catch (error) {
        timings.total = Date.now() - t0;
        (0, fleetController_errors_1.sendFleetErrorResponse)(res, error, {
            logMessage: 'Fleet deletion failed',
            path: req.path,
            logContext: { timings },
        });
    }
}
//# sourceMappingURL=fleetController.coreOperations.js.map