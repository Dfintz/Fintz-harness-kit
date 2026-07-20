"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitFleetCompositionUpdated = exports.emitShipRemovedFromFleet = exports.emitShipAddedToFleet = exports.emitFleetDeleted = exports.emitFleetUpdated = exports.emitFleetCreated = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const emitFleetCreated = (organizationId, fleet, userId) => {
    const event = {
        type: 'fleet:created',
        organizationId,
        fleetId: fleet.id,
        data: fleet,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'fleet:created', event);
    logger_1.logger.debug(`Emitted fleet:created for fleet ${fleet.id} in org ${organizationId}`);
};
exports.emitFleetCreated = emitFleetCreated;
const emitFleetUpdated = (organizationId, fleet, userId) => {
    const event = {
        type: 'fleet:updated',
        organizationId,
        fleetId: fleet.id,
        data: fleet,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'fleet:updated', event);
    logger_1.logger.debug(`Emitted fleet:updated for fleet ${fleet.id} in org ${organizationId}`);
};
exports.emitFleetUpdated = emitFleetUpdated;
const emitFleetDeleted = (organizationId, fleetId, userId) => {
    const event = {
        type: 'fleet:deleted',
        organizationId,
        fleetId,
        data: { id: fleetId },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'fleet:deleted', event);
    logger_1.logger.debug(`Emitted fleet:deleted for fleet ${fleetId} in org ${organizationId}`);
};
exports.emitFleetDeleted = emitFleetDeleted;
const emitShipAddedToFleet = (organizationId, fleetId, ship, userId) => {
    const event = {
        type: 'fleet:ship_added',
        organizationId,
        fleetId,
        data: { ship },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'fleet:ship_added', event);
    logger_1.logger.debug(`Emitted fleet:ship_added for fleet ${fleetId} in org ${organizationId}`);
};
exports.emitShipAddedToFleet = emitShipAddedToFleet;
const emitShipRemovedFromFleet = (organizationId, fleetId, shipId, userId) => {
    const event = {
        type: 'fleet:ship_removed',
        organizationId,
        fleetId,
        data: { shipId },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'fleet:ship_removed', event);
    logger_1.logger.debug(`Emitted fleet:ship_removed for fleet ${fleetId} in org ${organizationId}`);
};
exports.emitShipRemovedFromFleet = emitShipRemovedFromFleet;
const emitFleetCompositionUpdated = (organizationId, fleetId, composition, userId) => {
    const event = {
        type: 'fleet:composition_updated',
        organizationId,
        fleetId,
        data: composition,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'fleet:composition_updated', event);
    logger_1.logger.debug(`Emitted fleet:composition_updated for fleet ${fleetId} in org ${organizationId}`);
};
exports.emitFleetCompositionUpdated = emitFleetCompositionUpdated;
//# sourceMappingURL=fleetWebSocketController.js.map