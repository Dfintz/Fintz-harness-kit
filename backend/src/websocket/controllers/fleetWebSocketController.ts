import { logger } from '../../utils/logger';
import { emitToOrganization } from '../websocketServer';

/**
 * Fleet WebSocket Controller
 *
 * Handles real-time events for fleet operations:
 * - Fleet created, updated, deleted
 * - Ships added/removed from fleet
 * - Fleet composition changes
 * - Fleet statistics updates
 */

export interface FleetData {
  id: string;
  name?: string;
  organizationId?: string;
  description?: string;
  ships?: unknown[];
  [key: string]: unknown;
}

export interface FleetShip {
  id?: string;
  name: string;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

export interface FleetComposition {
  totalShips?: number;
  shipsByType?: Record<string, number>;
  totalCrew?: number;
  totalCargo?: number;
  [key: string]: unknown;
}

export interface FleetEvent {
  type:
    | 'fleet:created'
    | 'fleet:updated'
    | 'fleet:deleted'
    | 'fleet:ship_added'
    | 'fleet:ship_removed'
    | 'fleet:composition_updated';
  organizationId: string;
  fleetId: string;
  data: FleetData | FleetComposition | Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

/**
 * Emit fleet created event
 */
export const emitFleetCreated = (
  organizationId: string,
  fleet: FleetData | Record<string, unknown>,
  userId?: string
): void => {
  const event: FleetEvent = {
    type: 'fleet:created',
    organizationId,
    fleetId: fleet.id as string,
    data: fleet,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'fleet:created', event);
  logger.debug(`Emitted fleet:created for fleet ${fleet.id} in org ${organizationId}`);
};

/**
 * Emit fleet updated event
 */
export const emitFleetUpdated = (
  organizationId: string,
  fleet: FleetData | Record<string, unknown>,
  userId?: string
): void => {
  const event: FleetEvent = {
    type: 'fleet:updated',
    organizationId,
    fleetId: fleet.id as string,
    data: fleet,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'fleet:updated', event);
  logger.debug(`Emitted fleet:updated for fleet ${fleet.id} in org ${organizationId}`);
};

/**
 * Emit fleet deleted event
 */
export const emitFleetDeleted = (
  organizationId: string,
  fleetId: string,
  userId?: string
): void => {
  const event: FleetEvent = {
    type: 'fleet:deleted',
    organizationId,
    fleetId,
    data: { id: fleetId },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'fleet:deleted', event);
  logger.debug(`Emitted fleet:deleted for fleet ${fleetId} in org ${organizationId}`);
};

/**
 * Emit ship added to fleet event
 */
export const emitShipAddedToFleet = (
  organizationId: string,
  fleetId: string,
  ship: FleetShip,
  userId?: string
): void => {
  const event: FleetEvent = {
    type: 'fleet:ship_added',
    organizationId,
    fleetId,
    data: { ship },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'fleet:ship_added', event);
  logger.debug(`Emitted fleet:ship_added for fleet ${fleetId} in org ${organizationId}`);
};

/**
 * Emit ship removed from fleet event
 */
export const emitShipRemovedFromFleet = (
  organizationId: string,
  fleetId: string,
  shipId: string,
  userId?: string
): void => {
  const event: FleetEvent = {
    type: 'fleet:ship_removed',
    organizationId,
    fleetId,
    data: { shipId },
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'fleet:ship_removed', event);
  logger.debug(`Emitted fleet:ship_removed for fleet ${fleetId} in org ${organizationId}`);
};

/**
 * Emit fleet composition updated event
 */
export const emitFleetCompositionUpdated = (
  organizationId: string,
  fleetId: string,
  composition: FleetComposition,
  userId?: string
): void => {
  const event: FleetEvent = {
    type: 'fleet:composition_updated',
    organizationId,
    fleetId,
    data: composition,
    timestamp: Date.now(),
    userId,
  };

  emitToOrganization(organizationId, 'fleet:composition_updated', event);
  logger.debug(`Emitted fleet:composition_updated for fleet ${fleetId} in org ${organizationId}`);
};
