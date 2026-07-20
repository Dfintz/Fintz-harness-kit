/**
 * Loadout Query Hooks — Tech Debt Migration
 *
 * TanStack Query hooks for loadout sharing/management operations with automatic caching,
 * background refetching, and cache invalidation.
 */

import type { CreateLoadoutInput, Loadout, UpdateLoadoutInput } from '@/services/loadoutService';
import { loadoutService } from '@/services/loadoutService';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { loadoutKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch loadouts for a user, optionally filtered by organization IDs
 */
export function useUserLoadouts(
  userId: string | undefined,
  organizationIds?: string,
  options?: Omit<UseQueryOptions<Loadout[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: loadoutKeys.userLoadouts(userId!, organizationIds),
    queryFn: () => loadoutService.getUserLoadouts(userId!, organizationIds),
    enabled: !!userId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to share a loadout with one or more organizations
 */
export function useShareLoadoutWithOrgs() {  return useMutation({
    mutationFn: ({
      loadoutId,
      organizationIds,
    }: {
      loadoutId: string;
      organizationIds: string[];
    }) => loadoutService.shareWithOrgs(loadoutId, organizationIds),
    meta: { invalidates: [loadoutKeys.lists()] },
  });
}

/**
 * Hook to unshare a loadout from one or more organizations
 */
export function useUnshareLoadoutFromOrgs() {  return useMutation({
    mutationFn: ({
      loadoutId,
      organizationIds,
    }: {
      loadoutId: string;
      organizationIds: string[];
    }) => loadoutService.unshareWithOrgs(loadoutId, organizationIds),
    meta: { invalidates: [loadoutKeys.lists()] },
  });
}

/**
 * Hook to create a new loadout
 */
export function useCreateLoadout() {  return useMutation({
    mutationFn: (data: CreateLoadoutInput) => loadoutService.createLoadout(data),
    meta: { invalidates: [loadoutKeys.lists()] },
  });
}

/**
 * Hook to update a loadout (name, description, shipName, URLs, sharing)
 */
export function useUpdateLoadout() {  return useMutation({
    mutationFn: ({ loadoutId, data }: { loadoutId: string; data: UpdateLoadoutInput }) =>
      loadoutService.updateLoadout(loadoutId, data),
    meta: { invalidates: [loadoutKeys.all] },
  });
}

/**
 * Hook to parse an Erkul.games URL and extract ship/component data
 */
export function useParseErkulUrl() {
  return useMutation({
    mutationFn: (url: string) => loadoutService.parseErkulUrl(url),
  });
}
