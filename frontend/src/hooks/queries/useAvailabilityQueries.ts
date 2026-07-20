/**
 * Availability Query Hooks — Sprint 22-I React Query Migration
 *
 * TanStack Query hooks for availability/scheduling operations with automatic caching,
 * background refetching, and cache invalidation.
 */

import { availabilityService } from '@/services/availabilityService';
import { useAuthStore } from '@/store/authStore';
import type {
  AvailabilitySlot,
  BestTimeWindow,
  GroupAvailabilityHeatmap,
  SetAvailabilityRequest,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { availabilityKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch the current user's availability for an organization
 *
 * User-scoped: cache key includes the signed-in user's id so a previous user's
 * availability cannot be served to the next signed-in user from cache.
 */
export function useMyAvailability(
  orgId: string | undefined,
  options?: Omit<
    UseQueryOptions<{ slots: AvailabilitySlot[]; count: number }>,
    'queryKey' | 'queryFn'
  >
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: availabilityKeys.myAvailability(orgId ?? '', userId),
    queryFn: () => availabilityService.getMyAvailability(orgId ?? ''),
    enabled: !!userId && !!orgId && callerEnabled,
  });
}

/**
 * Hook to fetch the group availability heatmap for an organization
 */
export function useGroupHeatmap(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<GroupAvailabilityHeatmap>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: availabilityKeys.heatmap(orgId ?? ''),
    queryFn: () => availabilityService.getGroupHeatmap(orgId ?? ''),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to find the best scheduling time windows
 */
export function useBestTimes(
  orgId: string | undefined,
  durationMinutes: number,
  minAttendees: number,
  options?: Omit<
    UseQueryOptions<{ windows: BestTimeWindow[]; count: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: availabilityKeys.bestTimes(orgId ?? '', durationMinutes, minAttendees),
    queryFn: () => availabilityService.findBestTimes(orgId ?? '', durationMinutes, minAttendees),
    enabled: !!orgId && durationMinutes > 0 && minAttendees > 0,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to set the current user's availability for an organization.
 * Invalidates both user availability and group heatmap on success.
 */
export function useSetMyAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, slots }: { orgId: string; slots: SetAvailabilityRequest['slots'] }) =>
      availabilityService.setMyAvailability(orgId, slots),
    onSuccess: (_result, { orgId }) => {
      // Invalidate by prefix so all per-user variants of myAvailability are refreshed.
      queryClient.invalidateQueries({ queryKey: [...availabilityKeys.all, 'me', orgId] });
      queryClient.invalidateQueries({ queryKey: availabilityKeys.heatmap(orgId) });
      // Invalidate all best-times queries for this org (any duration/minAttendees combo)
      queryClient.invalidateQueries({ queryKey: ['availability', 'best-times', orgId] });
    },
  });
}
