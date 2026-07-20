/**
 * Fleet Query Hooks
 *
 * TanStack Query hooks for fleet operations with automatic caching,
 * background refetching, and optimistic updates.
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
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { fleetKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch fleets for an organization
 */
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

/**
 * Hook to fetch a single fleet by ID
 */
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

/**
 * Hook to fetch fleet statistics for an organization
 */
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

/**
 * Hook to fetch ships in a fleet
 */
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

/**
 * Hook to fetch fleet composition analysis
 */
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

/**
 * Hook to fetch fleet health assessment
 */
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

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateFleetInput {
  organizationId: string;
  data: { name: string; description?: string; type?: string; members?: string[] };
}

interface UpdateFleetInput {
  fleetId: string;
  data: { name?: string; description?: string; type?: string; members?: string[] };
}

/**
 * Hook to create a new fleet
 */
export function useCreateFleet() {
  return useMutation({
    mutationFn: ({ organizationId, data }: CreateFleetInput) =>
      fleetServiceV2.createFleet(organizationId, data),
    meta: {
      invalidates: (_data, variables) => [
        fleetKeys.lists(),
        [...fleetKeys.lists(), 'statistics', (variables as CreateFleetInput).organizationId],
      ],
    },
  });
}

/**
 * Hook to update a fleet
 */
export function useUpdateFleet() {
  // Note: previously did `setQueryData(detail, updatedFleet)` here. Removed in
  // favour of plain invalidation so the UI always sees the canonical server
  // shape — critical for fleets that include JSONB metadata columns where the
  // client-mirror could drift from the persisted value.
  return useMutation({
    mutationFn: ({ fleetId, data }: UpdateFleetInput) => fleetServiceV2.updateFleet(fleetId, data),
    meta: {
      invalidates: (_data, variables) => [
        fleetKeys.detail((variables as UpdateFleetInput).fleetId),
        fleetKeys.lists(),
      ],
    },
  });
}

/**
 * Hook to delete a fleet.
 *
 * Uses both `meta.invalidates` (success path, central handler) AND retains
 * `onMutate`/`onSuccess`/`onError` for two reasons that the central handler
 * cannot express:
 *   1. Cancel in-flight detail queries before the DELETE so they don't race
 *      and surface a 404.
 *   2. Treat a server-side 404 as a successful delete (the fleet is already
 *      gone): clean up caches and refresh lists. The `invalidateQueries`
 *      calls inside `onError` are an intentional escape hatch — see the
 *      ESLint rule comment in eslint.config.mjs.
 */
export function useDeleteFleet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fleetId: string) => fleetServiceV2.deleteFleet(fleetId),
    onMutate: async (fleetId: string) => {
      // Cancel any in-flight queries for this fleet (detail, ships, composition,
      // health, crew, etc.) so they don't race the delete and emit 404s.
      await queryClient.cancelQueries({ queryKey: fleetKeys.detail(fleetId) });
    },
    onSuccess: (_, fleetId) => {
      // Remove all cached data scoped under the fleet detail key (matches by
      // prefix, so ships/composition/health/crew sub-queries are cleared too).
      queryClient.removeQueries({ queryKey: fleetKeys.detail(fleetId) });
    },
    onError: (error, fleetId) => {
      // If the DELETE returned 404, the fleet is already gone — treat it the
      // same as a successful delete: clean up caches and refresh lists.
      let status: number | undefined;
      if (error && typeof error === 'object') {
        if (
          'statusCode' in error &&
          typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ) {
          status = (error as { statusCode: number }).statusCode;
        } else if (
          'status' in error &&
          typeof (error as { status?: unknown }).status === 'number'
        ) {
          status = (error as { status: number }).status;
        }
      }
      if (status === 404) {
        queryClient.removeQueries({ queryKey: fleetKeys.detail(fleetId) });
        // eslint-disable-next-line no-restricted-syntax -- onError 404 fallback: global handler fires only on success.
        queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
        // eslint-disable-next-line no-restricted-syntax -- onError 404 fallback: global handler fires only on success.
        queryClient.invalidateQueries({ queryKey: [...fleetKeys.all, 'tree'] });
      }
    },
    meta: {
      invalidates: [fleetKeys.lists(), [...fleetKeys.all, 'tree']],
    },
  });
}

// ============================================================================
// Hierarchy Hooks (Wave 2.2)
// ============================================================================

/**
 * Hook to fetch fleet tree for an organization
 */
export function useFleetTree(organizationId: string | undefined) {
  return useQuery({
    queryKey: fleetKeys.tree(organizationId!),
    queryFn: () => fleetServiceV2.getFleetTree(organizationId!),
    enabled: !!organizationId,
  });
}

/**
 * Hook to move a fleet to a new parent
 */
export function useMoveFleet() {
  return useMutation({
    mutationFn: ({ fleetId, parentFleetId }: { fleetId: string; parentFleetId: string | null }) =>
      fleetServiceV2.moveFleet(fleetId, parentFleetId),
    meta: {
      invalidates: [fleetKeys.all],
    },
  });
}

/**
 * Hook to reorder fleets within a parent
 */
export function useReorderFleets() {
  return useMutation({
    mutationFn: ({
      organizationId,
      orderedIds,
      parentFleetId,
    }: {
      organizationId: string;
      orderedIds: string[];
      parentFleetId?: string | null;
    }) => fleetServiceV2.reorderFleets(organizationId, orderedIds, parentFleetId),
    meta: {
      invalidates: [fleetKeys.all],
    },
  });
}

// ============================================================================
// Prefetch Functions
// ============================================================================

/**
 * Prefetch fleet data for improved navigation performance
 */
export function usePrefetchFleet() {
  const queryClient = useQueryClient();

  return (fleetId: string) => {
    queryClient.prefetchQuery({
      queryKey: fleetKeys.detail(fleetId),
      queryFn: () => fleetServiceV2.getFleetById(fleetId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
}

/**
 * Prefetch fleet ships for improved navigation performance
 */
export function usePrefetchFleetShips() {
  const queryClient = useQueryClient();

  return (fleetId: string) => {
    queryClient.prefetchQuery({
      queryKey: fleetKeys.ships(fleetId),
      queryFn: () => fleetServiceV2.getFleetShips(fleetId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
}

// ============================================================================
// Crew Position Self-Selection Hooks (Sprint 26)
// ============================================================================

/**
 * Hook to fetch crew positions for all ships in a fleet
 */
export function useFleetCrewPositions(fleetId: string | undefined) {
  return useQuery({
    queryKey: fleetKeys.crewPositions(fleetId!),
    queryFn: () => fleetServiceV2.getCrewPositions(fleetId!),
    enabled: !!fleetId,
  });
}

/**
 * Hook to fetch all crew members for a fleet with their assignments
 */
export function useFleetCrewMembers(fleetId: string | undefined) {
  return useQuery({
    queryKey: fleetKeys.crewMembers(fleetId!),
    queryFn: () => fleetServiceV2.getFleetCrewMembers(fleetId!),
    enabled: !!fleetId,
  });
}

/**
 * Hook to select a crew position (ship + role) within a fleet
 */
export function useSelectCrewPosition() {
  return useMutation({
    mutationFn: ({ fleetId, shipId, role }: { fleetId: string; shipId: string; role: string }) =>
      fleetServiceV2.selectCrewPosition(fleetId, shipId, role),
    meta: {
      invalidates: (_data, { fleetId }: { fleetId: string; shipId: string; role: string }) => [
        fleetKeys.crewPositions(fleetId),
        fleetKeys.crewMembers(fleetId),
        fleetKeys.health(fleetId),
      ],
    },
  });
}

/**
 * Hook to vacate (unselect) your crew position
 */
export function useUnselectCrewPosition() {
  return useMutation({
    mutationFn: (fleetId: string) => fleetServiceV2.unselectCrewPosition(fleetId),
    meta: {
      invalidates: (_, fleetId) => [
        fleetKeys.crewPositions(fleetId),
        fleetKeys.crewMembers(fleetId),
        fleetKeys.health(fleetId),
      ],
    },
  });
}

// ============================================================================
// Audit Log Hooks (Sprint 26)
// ============================================================================

/**
 * Hook to fetch audit log entries for a fleet
 */
export function useFleetAuditLog(
  fleetId: string | undefined,
  params?: { action?: string; limit?: number }
) {
  return useQuery({
    queryKey: fleetKeys.auditLog(fleetId!),
    queryFn: () => fleetServiceV2.getFleetAuditLog(fleetId!, params),
    enabled: !!fleetId,
  });
}
