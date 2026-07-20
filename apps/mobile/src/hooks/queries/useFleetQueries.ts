/**
 * Fleet Query Hooks for Mobile
 * TanStack Query hooks for fleet operations.
 * Ported from frontend/src/hooks/queries/useFleetQueries.ts
 */

import { fleetServiceV2 } from '@/services/fleetServiceV2';
import type {
  FleetComposition,
  FleetHealth,
  FleetListParams,
  FleetStatistics,
  FleetV2,
  PaginatedResult,
  PaginationParams,
  ShipV2,
} from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fleetKeys } from './queryKeys';

export function useFleets(
  organizationId: string | undefined,
  params?: FleetListParams,
  options?: Omit<UseQueryOptions<PaginatedResult<FleetV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: fleetKeys.list({ organizationId, ...params }),
    queryFn: () => fleetServiceV2.getFleets(organizationId!, params),
    enabled: !!organizationId,
    ...options,
  });
}

export function useFleet(
  fleetId: string | undefined,
  options?: Omit<UseQueryOptions<FleetV2>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: fleetKeys.detail(fleetId!),
    queryFn: () => fleetServiceV2.getFleetById(fleetId!),
    enabled: !!fleetId,
    ...options,
  });
}

export function useFleetStatistics(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<FleetStatistics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...fleetKeys.lists(), 'statistics', organizationId],
    queryFn: () => fleetServiceV2.getFleetStatistics(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

export function useFleetShips(
  fleetId: string | undefined,
  params?: PaginationParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ShipV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: fleetKeys.ships(fleetId!, params as Record<string, unknown>),
    queryFn: () => fleetServiceV2.getFleetShips(fleetId!, params),
    enabled: !!fleetId,
    ...options,
  });
}

export function useFleetComposition(
  fleetId: string | undefined,
  options?: Omit<UseQueryOptions<FleetComposition>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...fleetKeys.detail(fleetId!), 'composition'],
    queryFn: () => fleetServiceV2.getFleetComposition(fleetId!),
    enabled: !!fleetId,
    ...options,
  });
}

export function useFleetHealth(
  fleetId: string | undefined,
  options?: Omit<UseQueryOptions<FleetHealth>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: fleetKeys.health(fleetId!),
    queryFn: () => fleetServiceV2.getFleetHealth(fleetId!),
    enabled: !!fleetId,
    ...options,
  });
}

// Mutations

interface CreateFleetInput {
  organizationId: string;
  data: { name: string; description?: string; type?: string; members?: string[] };
}

interface UpdateFleetInput {
  fleetId: string;
  data: { name?: string; description?: string; type?: string; members?: string[] };
}

export function useCreateFleet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, data }: CreateFleetInput) =>
      fleetServiceV2.createFleet(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
    },
  });
}

export function useUpdateFleet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fleetId, data }: UpdateFleetInput) => fleetServiceV2.updateFleet(fleetId, data),
    onSuccess: (_, { fleetId }) => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.detail(fleetId) });
      queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
    },
  });
}

export function useDeleteFleet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fleetId: string) => fleetServiceV2.deleteFleet(fleetId),
    onSuccess: (_, fleetId) => {
      queryClient.removeQueries({ queryKey: fleetKeys.detail(fleetId) });
      queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
    },
  });
}
