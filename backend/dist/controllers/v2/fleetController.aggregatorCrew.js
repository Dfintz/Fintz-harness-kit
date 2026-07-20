"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFleetWithAssetsHandler = createFleetWithAssetsHandler;
exports.deployFleetHandler = deployFleetHandler;
exports.dissolveFleetHandler = dissolveFleetHandler;
exports.selectCrewPositionHandler = selectCrewPositionHandler;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const FleetAggregatorService_1 = require("../../services/aggregators/FleetAggregatorService");
const FleetTeamService_1 = require("../../services/fleet/FleetTeamService");
const api_1 = require("../../types/api");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetController_bulkGuards_1 = require("./fleetController.bulkGuards");
const fleetController_errors_1 = require("./fleetController.errors");
const fleetController_lookup_1 = require("./fleetController.lookup");
async function createFleetWithAssetsHandler(req, res) {
    try {
        const { orgId } = req.params;
        const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
        const { fleetData, shipIds, squadronData, inventoryItems, notifyMembers, postToDiscord, discordChannelId, } = req.body;
        const aggregator = new FleetAggregatorService_1.FleetAggregatorService();
        const result = await aggregator.createFleetWithAssets({
            organizationId: orgId,
            fleetData: { ...fleetData, leaderId: fleetData.leaderId ?? userId },
            shipIds,
            squadronData,
            inventoryItems,
            notifyMembers,
            postToDiscord,
            discordChannelId,
        });
        (0, fleetController_errors_1.throwIfFleetAggregatorFailed)(result, 'Failed to create fleet with assets');
        res.status(201).success(result.data);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to create fleet with assets');
    }
}
async function deployFleetHandler(req, res) {
    try {
        const { id } = req.params;
        const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
        const body = req.body;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(id, organizationId, {
            notFoundCode: api_1.ApiErrorCode.NOT_FOUND,
        });
        const aggregator = new FleetAggregatorService_1.FleetAggregatorService();
        const result = await aggregator.deployFleet({
            organizationId: fleet.organizationId,
            fleetId: id,
            deploymentData: {
                location: body.location,
                mission: body.mission,
                objectives: body.objectives,
                estimatedDuration: body.estimatedDuration,
                deployedById: userId,
            },
            notifyMembers: body.notifyMembers,
        });
        res.success(result);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to deploy fleet');
    }
}
async function dissolveFleetHandler(req, res) {
    try {
        const { id } = req.params;
        const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
        const { reason, reassignShipsToFleetId, notifyMembers } = req.body;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(id, organizationId, {
            notFoundCode: api_1.ApiErrorCode.NOT_FOUND,
        });
        const aggregator = new FleetAggregatorService_1.FleetAggregatorService();
        const result = await aggregator.dissolveFleet({
            organizationId: fleet.organizationId,
            fleetId: id,
            dissolvedById: userId,
            reason,
            reassignShipsToFleetId,
            notifyMembers,
        });
        (0, fleetController_errors_1.throwIfFleetAggregatorFailed)(result, 'Failed to dissolve fleet');
        res.success(result.data);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to dissolve fleet');
    }
}
async function selectCrewPositionHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const { shipId, role } = req.body;
        if (!shipId || !role) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Ship ID and role are required', 400);
        }
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const userId = (0, fleetController_bulkGuards_1.requireAuthenticatedUser)((0, tenantHelpers_1.getAuthenticatedUserId)(req));
        const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
        const result = await fleetTeamService.selectCrewPosition(organizationId, fleetId, userId, shipId, role);
        res.success(result);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        (0, fleetController_errors_1.sendFleetLoggedErrorResponse)(res, error, 'Crew position selection failed', req.path);
    }
}
//# sourceMappingURL=fleetController.aggregatorCrew.js.map