"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitTouchedFleetUpdates = emitTouchedFleetUpdates;
exports.syncTeamCapacityForFleets = syncTeamCapacityForFleets;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Fleet_1 = require("../../models/Fleet");
const FleetTeamService_1 = require("../../services/fleet/FleetTeamService");
const logger_1 = require("../../utils/logger");
const fleetWebSocketController_1 = require("../../websocket/controllers/fleetWebSocketController");
async function emitTouchedFleetUpdates(organizationId, userId, fleetIds) {
    if (fleetIds.size === 0) {
        return [];
    }
    const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
    const fleets = await fleetRepo.find({
        where: { id: (0, typeorm_1.In)([...fleetIds]), organizationId },
    });
    for (const fleet of fleets) {
        (0, fleetWebSocketController_1.emitFleetUpdated)(organizationId, { ...fleet }, userId);
    }
    return fleets;
}
async function syncTeamCapacityForFleets(organizationId, fleets) {
    if (fleets.length === 0) {
        return;
    }
    const fleetTeamService = FleetTeamService_1.FleetTeamService.getInstance();
    for (const fleet of fleets) {
        try {
            await fleetTeamService.syncTeamCapacity(organizationId, fleet.id);
        }
        catch (syncError) {
            logger_1.logger.warn('Failed to sync team capacity after bulk fleet change', {
                fleetId: fleet.id,
                error: syncError instanceof Error ? syncError.message : String(syncError),
            });
        }
    }
}
//# sourceMappingURL=fleetController.postBulkUpdates.js.map