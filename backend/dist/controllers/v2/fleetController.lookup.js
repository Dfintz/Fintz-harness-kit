"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFleetInOrganization = loadFleetInOrganization;
exports.loadFleetAssignmentInFleet = loadFleetAssignmentInFleet;
exports.buildFleetShipWithShipQuery = buildFleetShipWithShipQuery;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Fleet_1 = require("../../models/Fleet");
const FleetShip_1 = require("../../models/FleetShip");
const api_1 = require("../../types/api");
async function loadFleetInOrganization(fleetId, organizationId, options) {
    const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });
    if (!fleet) {
        throw new errorHandlerV2_1.ApiError(options?.notFoundCode ?? api_1.ApiErrorCode.NOT_FOUND, options?.notFoundMessage ?? 'Fleet not found', 404);
    }
    return fleet;
}
async function loadFleetAssignmentInFleet(assignmentId, fleetId, options) {
    const fleetShipRepo = database_1.AppDataSource.getRepository(FleetShip_1.FleetShip);
    const assignment = await fleetShipRepo.findOne({ where: { id: assignmentId, fleetId } });
    if (!assignment) {
        throw new errorHandlerV2_1.ApiError(options?.notFoundCode ?? api_1.ApiErrorCode.NOT_FOUND, options?.notFoundMessage ?? 'Assignment not found', 404);
    }
    return assignment;
}
function buildFleetShipWithShipQuery(fleetId) {
    return database_1.AppDataSource.getRepository(FleetShip_1.FleetShip)
        .createQueryBuilder('fleetShip')
        .innerJoinAndSelect('fleetShip.ship', 'ship')
        .where('fleetShip.fleetId = :fleetId', { fleetId });
}
//# sourceMappingURL=fleetController.lookup.js.map