import { logger } from '../../utils/logger';
import { emitToOrganization, emitToRoom } from '../websocketServer';

/**
 * Trading WebSocket Controller
 *
 * Handles real-time events for trading operations:
 * - Trading route created, updated, deleted
 * - Route status changes
 * - New opportunities discovered
 * - Market analysis updates
 * - Price changes
 */

export interface TradingRoute {
  id: string;
  name?: string;
  origin?: string;
  destination?: string;
  commodity?: string;
  profitPerUnit?: number;
  status?: string;
  [key: string]: unknown;
}

export interface TradingOpportunity {
  id: string;
  commodity: string;
  buyLocation: string;
  sellLocation: string;
  profitMargin: number;
  [key: string]: unknown;
}

export interface MarketData {
  location?: string;
  commodity?: string;
  prices?: Record<string, number>;
  [key: string]: unknown;
}

export interface TradingEvent {
  type:
    | 'trading:route_created'
    | 'trading:route_updated'
    | 'trading:route_deleted'
    | 'trading:route_status_changed'
    | 'trading:opportunity_discovered'
    | 'trading:market_updated'
    | 'trading:price_changed';
  organizationId?: string;
  routeId?: string;
  data: TradingRoute | TradingOpportunity | MarketData | Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

/**
 * Emit trading route created event
 */
export const emitRouteCreated = (
  organizationId: string,
  route: TradingRoute,
  userId?: string
): void => {
  const event: TradingEvent = {
    type: 'trading:route_created',
    organizationId,
    routeId: route.id,
    data: route,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'trading:route_created', event);
  logger.debug(`Emitted trading:route_created for route ${route.id} in org ${organizationId}`);
};

/**
 * Emit trading route updated event
 */
export const emitRouteUpdated = (
  organizationId: string,
  route: TradingRoute,
  userId?: string
): void => {
  const event: TradingEvent = {
    type: 'trading:route_updated',
    organizationId,
    routeId: route.id,
    data: route,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'trading:route_updated', event);
  logger.debug(`Emitted trading:route_updated for route ${route.id} in org ${organizationId}`);
};

/**
 * Emit trading route deleted event
 */
export const emitRouteDeleted = (
  organizationId: string,
  routeId: string,
  userId?: string
): void => {
  const event: TradingEvent = {
    type: 'trading:route_deleted',
    organizationId,
    routeId,
    data: { id: routeId },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'trading:route_deleted', event);
  logger.debug(`Emitted trading:route_deleted for route ${routeId} in org ${organizationId}`);
};

/**
 * Emit route status changed event
 */
export const emitRouteStatusChanged = (
  organizationId: string,
  routeId: string,
  oldStatus: string,
  newStatus: string,
  userId?: string
): void => {
  const event: TradingEvent = {
    type: 'trading:route_status_changed',
    organizationId,
    routeId,
    data: { oldStatus, newStatus },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'trading:route_status_changed', event);
  logger.debug(
    `Emitted trading:route_status_changed for route ${routeId} in org ${organizationId}`
  );
};

/**
 * Emit opportunity discovered event (broadcast to all)
 */
export const emitOpportunityDiscovered = (opportunity: TradingOpportunity): void => {
  const event: TradingEvent = {
    type: 'trading:opportunity_discovered',
    data: opportunity,
    timestamp: Date.now(),
  };

  // Scope to trading subscribers only (clients join 'trading:market' room)
  emitToRoom('trading:market', 'trading:opportunity_discovered', event);
  logger.debug(`Emitted trading:opportunity_discovered for route ${opportunity.id}`);
};

/**
 * Emit market updated event (broadcast to all)
 */
export const emitMarketUpdated = (marketData: MarketData): void => {
  const event: TradingEvent = {
    type: 'trading:market_updated',
    data: marketData,
    timestamp: Date.now(),
  };

  emitToRoom('trading:market', 'trading:market_updated', event);
  logger.debug('Emitted trading:market_updated to trading:market room');
};

/**
 * Emit price changed event (broadcast to all)
 */
export const emitPriceChanged = (
  commodity: string,
  location: string,
  oldPrice: number,
  newPrice: number
): void => {
  const event: TradingEvent = {
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

  emitToRoom('trading:market', 'trading:price_changed', event);
  logger.debug(`Emitted trading:price_changed for ${commodity} at ${location}`);
};
