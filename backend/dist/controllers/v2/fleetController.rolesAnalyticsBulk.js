"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFleetRolesHandler = getFleetRolesHandler;
exports.getCompositionAnalyticsHandler = getCompositionAnalyticsHandler;
exports.compareFleetsHandler = compareFleetsHandler;
exports.bulkAddMembersHandler = bulkAddMembersHandler;
exports.bulkUpdateMembersHandler = bulkUpdateMembersHandler;
exports.bulkDeleteMembersHandler = bulkDeleteMembersHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const FleetTeamService_1 = require("../../services/fleet/FleetTeamService");
const api_1 = require("../../types/api");
const logger_1 = require("../../utils/logger");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetController_bulkGuards_1 = require("./fleetController.bulkGuards");
const fleetController_bulkMembers_1 = require("./fleetController.bulkMembers");
const fleetController_errors_1 = require("./fleetController.errors");
const fleetController_lookup_1 = require("./fleetController.lookup");
const fleetController_postBulkUpdates_1 = require("./fleetController.postBulkUpdates");
const fleetController_shipResolution_1 = require("./fleetController.shipResolution");
async function getFleetRolesHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.FLEET_NOT_FOUND,
        });
        const roles = [
            { value: 'commander', label: 'Commander', description: 'Fleet commander' },
            { value: 'officer', label: 'Officer', description: 'Fleet officer' },
            { value: 'pilot', label: 'Pilot', description: 'Fleet pilot' },
            { value: 'crew', label: 'Crew', description: 'Fleet crew member' },
        ];
        res.success({ roles });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get fleet roles: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
}
async function getCompositionAnalyticsHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const fleetShipRows = await (0, fleetController_lookup_1.buildFleetShipWithShipQuery)(fleetId).getMany();
        const ships = fleetShipRows.map(row => row.ship);
        const composition = {
            total: ships.length,
            byManufacturer: {},
            bySize: {},
            byRole: {},
            byStatus: {},
        };
        ships.forEach((ship) => {
            const manufacturer = ship.manufacturer ?? 'Unknown';
            composition.byManufacturer[manufacturer] =
                (composition.byManufacturer[manufacturer] ?? 0) + 1;
            const size = ship.size ?? 'Unknown';
            composition.bySize[size] = (composition.bySize[size] ?? 0) + 1;
            const role = ship.role ?? 'Unknown';
            composition.byRole[role] = (composition.byRole[role] ?? 0) + 1;
            const status = ship.status ?? 'active';
            composition.byStatus[status] = (composition.byStatus[status] ?? 0) + 1;
        });
        res.success({
            fleetId,
            composition,
        });
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to get composition analytics');
    }
}
async function compareFleetsHandler(req, res) {
    try {
        const { fleetIds } = req.body;
        if (!Array.isArray(fleetIds) || fleetIds.length < 2) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'At least 2 fleet IDs required for comparison', 400);
        }
        if (fleetIds.length > 10) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 10 fleets can be compared at once', 400);
        }
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleets = await fleetRepo.find({
            where: fleetIds.map(id => ({ id, organizationId })),
        });
        if (fleets.length !== fleetIds.length) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'One or more fleets not found', 404);
        }
        const comparison = fleets.map(fleet => ({
            id: fleet.id,
            name: fleet.name,
            shipCount: fleet.ships?.length ?? 0,
            memberCount: fleet.members?.length ?? 0,
            status: fleet.status,
            createdAt: fleet.createdAt,
        }));
        res.success({
            comparison,
            count: fleets.length,
        });
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to compare fleets');
    }
}
async function bulkAddMembersHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const { shipIds } = req.body;
        if (!Array.isArray(shipIds) || shipIds.length === 0) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Ship IDs array is required', 400);
        }
        if (shipIds.length > 100) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 100 ships can be added at once', 400);
        }
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
        const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const allResolved = await (0, fleetController_shipResolution_1.resolveShipIds)(shipIds, organizationId);
        const unresolvedFinal = shipIds.filter((id) => !allResolved.has(id));
        if (unresolvedFinal.length > 0) {
            logger_1.logger.warn('Bulk add ships: unresolved ship IDs', {
                fleetId,
                organizationId,
                unresolvedIds: unresolvedFinal,
                totalRequested: shipIds.length,
                resolvedCount: allResolved.size,
            });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, `${unresolvedFinal.length} ship(s) not found or do not belong to your organization`, 400);
        }
        const catalogShipIds = [...new Set(allResolved.values())];
        const fleetShipRepo = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
        let existingShipIds = new Set();
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
            const assignments = newCatalogShipIds.map(catalogShipId => fleetShipRepo.create({
                fleetId,
                shipId: catalogShipId,
                organizationId,
                assignedBy: userId,
            }));
            await fleetShipRepo.save(assignments);
            addedCount = assignments.length;
        }
        const skipped = shipIds.length - addedCount;
        if (addedCount > 0) {
            const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
            if (!fleet.teamId) {
                await fleetTeamService.autoCreateTeamForFleet(organizationId, fleet);
            }
            await fleetTeamService.syncTeamCapacity(organizationId, fleetId);
        }
        logger_1.logger.info('Bulk added ships to fleet', {
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
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to bulk add members');
    }
}
async function bulkUpdateMembersHandler(req, res) {
    try {
        const { updates } = req.body;
        (0, fleetController_bulkGuards_1.validateBulkUpdateRequest)(updates);
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
        (0, fleetController_bulkMembers_1.validateBulkUpdates)(updates);
        const touchedFleetIds = new Set();
        const notFound = [];
        let updatedCount = 0;
        await database_1.AppDataSource.transaction(async (manager) => {
            const txRepo = manager.getRepository(FleetShip_1.FleetShip);
            for (const update of updates) {
                const result = await (0, fleetController_bulkMembers_1.applyBulkUpdate)(txRepo, organizationId, update);
                if (result.updated) {
                    touchedFleetIds.add(update.fleetId);
                    updatedCount++;
                }
                else {
                    notFound.push({ fleetId: update.fleetId, shipId: update.shipId });
                }
            }
        });
        await (0, fleetController_postBulkUpdates_1.emitTouchedFleetUpdates)(organizationId, userId, touchedFleetIds);
        logger_1.logger.info('Bulk updated fleet members', {
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
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to bulk update members');
    }
}
async function bulkDeleteMembersHandler(req, res) {
    try {
        const { items } = req.body;
        (0, fleetController_bulkGuards_1.validateBulkDeleteRequest)(items);
        (0, fleetController_bulkMembers_1.validateBulkDeleteItems)(items);
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
        const touchedFleetIds = new Set();
        const notFound = [];
        let deletedCount = 0;
        await database_1.AppDataSource.transaction(async (manager) => {
            const txRepo = manager.getRepository(FleetShip_1.FleetShip);
            for (const item of items) {
                const removed = await (0, fleetController_bulkMembers_1.applyBulkDelete)(txRepo, organizationId, item);
                if (removed) {
                    touchedFleetIds.add(item.fleetId);
                    deletedCount++;
                }
                else {
                    notFound.push({ fleetId: item.fleetId, shipId: item.shipId });
                }
            }
        });
        const fleets = await (0, fleetController_postBulkUpdates_1.emitTouchedFleetUpdates)(organizationId, userId, touchedFleetIds);
        await (0, fleetController_postBulkUpdates_1.syncTeamCapacityForFleets)(organizationId, fleets);
        logger_1.logger.info('Bulk deleted fleet members', {
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
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to bulk delete members');
    }
}
//# sourceMappingURL=fleetController.rolesAnalyticsBulk.js.map