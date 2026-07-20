/**
 * Fleet Member (Ship Assignment) Query Hooks
 *
 * TanStack Query mutations for adding/removing ships from fleets.
 * Extends fleetKeys from queryKeys.ts for cache invalidation.
 */

import { useMutation } from '@tanstack/react-query';

import { fleetServiceV2 } from '@/services/fleetServiceV2';
import { logger } from '@/utils/logger';

import { fleetKeys } from './queryKeys';

// ============================================================================
// Types
// ============================================================================

interface AddShipToFleetInput {
  fleetId: string;
  shipId: string;
  role?: string;
  notes?: string;
}

interface RemoveShipFromFleetInput {
  fleetId: string;
  shipId: string;
}

interface BulkAddShipsInput {
  fleetId: string;
  shipIds: string[];
}

const logMutationError = (label: string) => (err: unknown) =>
  logger.error(label, err instanceof Error ? err : new Error(String(err)));

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Add a single ship to a fleet
 */
export function useAddShipToFleet() {
  return useMutation({
    mutationFn: ({ fleetId, shipId, role, notes }: AddShipToFleetInput) =>
      fleetServiceV2.addShipToFleet(fleetId, shipId, role, notes),
    onError: logMutationError('Failed to add ship to fleet'),
    meta: {
      invalidates: (_data, { fleetId }: AddShipToFleetInput) => [
        fleetKeys.ships(fleetId),
        fleetKeys.detail(fleetId),
        fleetKeys.members(fleetId),
      ],
    },
  });
}

/**
 * Remove a ship from a fleet
 */
export function useRemoveShipFromFleet() {
  return useMutation({
    mutationFn: ({ fleetId, shipId }: RemoveShipFromFleetInput) =>
      fleetServiceV2.removeShipFromFleet(fleetId, shipId),
    onError: logMutationError('Failed to remove ship from fleet'),
    meta: {
      invalidates: (_data, { fleetId }: RemoveShipFromFleetInput) => [
        fleetKeys.ships(fleetId),
        fleetKeys.detail(fleetId),
        fleetKeys.members(fleetId),
      ],
    },
  });
}

/**
 * Bulk add ships to a fleet (up to 100)
 */
export function useBulkAddShipsToFleet() {
  return useMutation({
    mutationFn: ({ fleetId, shipIds }: BulkAddShipsInput) =>
      fleetServiceV2.bulkAddShipsToFleet(fleetId, shipIds),
    onError: logMutationError('Failed to bulk add ships to fleet'),
    meta: {
      invalidates: (_data, { fleetId }: BulkAddShipsInput) => [
        fleetKeys.ships(fleetId),
        fleetKeys.detail(fleetId),
        fleetKeys.members(fleetId),
        fleetKeys.lists(),
      ],
    },
  });
}
