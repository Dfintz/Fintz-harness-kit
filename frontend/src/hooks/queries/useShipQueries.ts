/**
 * Ship Query Hooks
 *
 * TanStack Query hooks for ship operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import { shipServiceV2 } from '@/services/shipServiceV2';
import type { PaginatedResult, PaginationParams, ShipV2 } from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { fleetKeys, shipKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all ships for the current organization
 */
export function useShips(
  params?: PaginationParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ShipV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipKeys.list(params as Record<string, unknown>),
    queryFn: () => shipServiceV2.getShips(params),
    ...options,
  });
}

/**
 * Hook to search ships
 */
export function useSearchShips(
  searchTerm: string,
  params?: PaginationParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ShipV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...shipKeys.lists(), 'search', { searchTerm, ...params }],
    queryFn: () => shipServiceV2.searchShips(searchTerm, params),
    enabled: searchTerm.length > 0,
    ...options,
  });
}

/**
 * Hook to fetch a single ship by ID
 */
export function useShip(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ShipV2>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipKeys.detail(id!),
    queryFn: () => shipServiceV2.getShipById(id!),
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateShipInput {
  name: string;
  manufacturer: string;
  model: string;
  role: string;
  size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
}

interface UpdateShipInput {
  id: string;
  data: {
    name?: string;
    manufacturer?: string;
    model?: string;
    role?: string;
    size?: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
  };
}

/**
 * Hook to create a new ship
 */
export function useCreateShip() {
  return useMutation({
    mutationFn: (data: CreateShipInput) => shipServiceV2.createShip(data),
    meta: {
      invalidates: [shipKeys.lists(), fleetKeys.lists()],
    },
  });
}

/**
 * Hook to update a ship
 */
export function useUpdateShip() {
  return useMutation({
    mutationFn: ({ id, data }: UpdateShipInput) => shipServiceV2.updateShip(id, data),
    meta: {
      invalidates: (_data, { id }: UpdateShipInput) => [
        shipKeys.detail(id),
        shipKeys.lists(),
        fleetKeys.lists(),
      ],
    },
  });
}

/**
 * Hook to delete a ship.
 *
 * Keeps `onSuccess` for `removeQueries` on the deleted detail (invalidate
 * would re-fetch and 404). List invalidations route through the central
 * handler.
 */
export function useDeleteShip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => shipServiceV2.deleteShip(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: shipKeys.detail(id) });
    },
    meta: {
      invalidates: [shipKeys.lists(), fleetKeys.lists()],
    },
  });
}
