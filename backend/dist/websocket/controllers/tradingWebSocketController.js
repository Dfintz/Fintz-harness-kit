"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitPriceChanged = exports.emitMarketUpdated = exports.emitOpportunityDiscovered = exports.emitRouteStatusChanged = exports.emitRouteDeleted = exports.emitRouteUpdated = exports.emitRouteCreated = void 0;
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const emitRouteCreated = (organizationId, route, userId) => {
    const event = {
        type: 'trading:route_created',
        organizationId,
        routeId: route.id,
        data: route,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'trading:route_created', event);
    logger_1.logger.debug(`Emitted trading:route_created for route ${route.id} in org ${organizationId}`);
};
exports.emitRouteCreated = emitRouteCreated;
const emitRouteUpdated = (organizationId, route, userId) => {
    const event = {
        type: 'trading:route_updated',
        organizationId,
        routeId: route.id,
        data: route,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'trading:route_updated', event);
    logger_1.logger.debug(`Emitted trading:route_updated for route ${route.id} in org ${organizationId}`);
};
exports.emitRouteUpdated = emitRouteUpdated;
const emitRouteDeleted = (organizationId, routeId, userId) => {
    const event = {
        type: 'trading:route_deleted',
        organizationId,
        routeId,
        data: { id: routeId },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'trading:route_deleted', event);
    logger_1.logger.debug(`Emitted trading:route_deleted for route ${routeId} in org ${organizationId}`);
};
exports.emitRouteDeleted = emitRouteDeleted;
const emitRouteStatusChanged = (organizationId, routeId, oldStatus, newStatus, userId) => {
    const event = {
        type: 'trading:route_status_changed',
        organizationId,
        routeId,
        data: { oldStatus, newStatus },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToOrganization)(organizationId, 'trading:route_status_changed', event);
    logger_1.logger.debug(`Emitted trading:route_status_changed for route ${routeId} in org ${organizationId}`);
};
exports.emitRouteStatusChanged = emitRouteStatusChanged;
const emitOpportunityDiscovered = (opportunity) => {
    const event = {
        type: 'trading:opportunity_discovered',
        data: opportunity,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToRoom)('trading:market', 'trading:opportunity_discovered', event);
    logger_1.logger.debug(`Emitted trading:opportunity_discovered for route ${opportunity.id}`);
};
exports.emitOpportunityDiscovered = emitOpportunityDiscovered;
const emitMarketUpdated = (marketData) => {
    const event = {
        type: 'trading:market_updated',
        data: marketData,
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToRoom)('trading:market', 'trading:market_updated', event);
    logger_1.logger.debug('Emitted trading:market_updated to trading:market room');
};
exports.emitMarketUpdated = emitMarketUpdated;
const emitPriceChanged = (commodity, location, oldPrice, newPrice) => {
    const event = {
        type: 'trading:price_changed',
        data: {
            commodity,
            location,
            oldPrice,
            newPrice,
            change: newPrice - oldPrice,
            changePercent: ((newPrice - oldPrice) / oldPrice) * 100,
        },
        timestamp: Date.now(),
    };
    (0, websocketServer_1.emitToRoom)('trading:market', 'trading:price_changed', event);
    logger_1.logger.debug(`Emitted trading:price_changed for ${commodity} at ${location}`);
};
exports.emitPriceChanged = emitPriceChanged;
//# sourceMappingURL=tradingWebSocketController.js.map