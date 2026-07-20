/**
 * Participation Query Hooks — Sprint 20-E
 *
 * TanStack Query hooks for unified participation data
 * (teams, activities, jobs, LFG) with automatic caching,
 * background refetching, and cache invalidation.
 */

import type { ParticipationSummary, ParticipationSystemType } from '@sc-fleet-manager/shared-types';
import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import {
  participationService,
  type ParticipationSummaryParams,
} from '@/services/participationService';
import { useAuthStore } from '@/store/authStore';

import { participationKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch the authenticated user's participation summary.
 *
 * User-scoped: cache key includes the signed-in user's id so a previous user's
 * participation summary cannot be served to the next signed-in user from cache.
 *
 * @param params - Optional filters (organizationId, systems)
 * @param options - React Query overrides
 */
export function useMyParticipation(
  params?: ParticipationSummaryParams,
  options?: Omit<UseQueryOptions<ParticipationSummary>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: participationKeys.mySummary(userId, params as Record<string, unknown> | undefined),
    queryFn: () => participationService.getMySummary(params),
    enabled: !!userId && callerEnabled,
  });
}

/**
 * Hook to fetch participation summary for a specific user.
 *
 * @param userId - Target user ID (required; query disabled when falsy)
 * @param params - Optional filters (organizationId, systems)
 * @param options - React Query overrides
 */
export function useUserParticipation(
  userId: string | undefined,
  params?: ParticipationSummaryParams,
  options?: Omit<UseQueryOptions<ParticipationSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: participationKeys.userSummary(userId!, params as Record<string, unknown>),
    queryFn: () => participationService.getUserSummary(userId!, params),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Hook to fetch participation for a single system only.
 * Convenience wrapper that filters the systems query param.
 *
 * @param userId - Target user ID (required; query disabled when falsy)
 * @param system - System to query (team, activity, job, lfg)
 * @param organizationId - Optional org scope
 * @param options - React Query overrides
 */
export function useSystemParticipation(
  userId: string | undefined,
  system: ParticipationSystemType,
  organizationId?: string,
  options?: Omit<UseQueryOptions<ParticipationSummary>, 'queryKey' | 'queryFn'>
) {
  const params: ParticipationSummaryParams = {
    organizationId,
    systems: [system],
  };

  return useQuery({
    queryKey: participationKeys.userSummary(userId!, { system, organizationId }),
    queryFn: () => participationService.getUserSummary(userId!, params),
    enabled: !!userId,
    ...options,
  });
}

// ============================================================================
// Invalidation Helpers
// ============================================================================

/**
 * Hook returning a function to invalidate all participation caches.
 * Useful after actions that change participation state (join, leave, etc.).
 */
export function useInvalidateParticipation() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: participationKeys.all });
  };
}
