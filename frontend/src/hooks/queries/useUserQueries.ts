/**
 * User Profile Query Hooks — Phase 3
 *
 * TanStack Query hooks for user profile operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import {
  communityMembersService,
  type CommunityBrowseParams,
  type CommunityBrowseResult,
} from '@/services/communityMembersService';
import type {
  ActivitySummary,
  LinkedAccountsResponse,
  PrivacySettings,
  UserActivityStats,
  UserProfile,
  UserShip,
} from '@/services/userProfileService';
import { userProfileService } from '@/services/userProfileService';
import { useAuthStore } from '@/store/authStore';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { userKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch the current user's profile
 *
 * User-scoped: cache key includes the signed-in user's id so a previous user's
 * profile cannot be served to the next signed-in user from cache.
 */
export function useMyProfile(options?: Omit<UseQueryOptions<UserProfile>, 'queryKey' | 'queryFn'>) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: userKeys.current(userId),
    queryFn: () => userProfileService.getMyProfile(),
    enabled: !!userId && callerEnabled,
  });
}

/**
 * Hook to fetch a specific user's profile
 */
export function useUserProfile(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<UserProfile>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.detail(userId!),
    queryFn: () => userProfileService.getUserProfile(userId!),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Hook to fetch a user's ships
 */
export function useUserShips(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<UserShip[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.ships(userId!),
    queryFn: () => userProfileService.getUserShips(userId!),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Hook to fetch a user's activity stats
 */
export function useUserActivityStats(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<UserActivityStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...userKeys.detail(userId!), 'activity-stats'] as const,
    queryFn: () => userProfileService.getUserActivityStats(userId!),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Hook to fetch a user's activity timeline
 */
export function useUserActivityTimeline(
  userId: string | undefined,
  days?: number,
  options?: Omit<UseQueryOptions<ActivitySummary[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...userKeys.detail(userId!), 'activity-timeline', days] as const,
    queryFn: () => userProfileService.getUserActivityTimeline(userId!, days),
    enabled: !!userId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to update the current user's profile
 *
 * NOTE: deliberately does NOT call setQueryData with the mutation response.
 * The user profile contains JSONB-backed fields (preferences, social links)
 * whose server-canonical shape may differ from the partial sent by the
 * client — writing the response straight back into cache caused the
 * "settings snap back" class of bugs. Instead we invalidate and refetch.
 * See /memories/repo/typeorm-jsonb-pitfall.md.
 */
export function useUpdateMyProfile() {
  const userId = useAuthStore(state => state.user?.id);

  return useMutation({
    mutationFn: (updates: Partial<UserProfile>) => userProfileService.updateMyProfile(updates),
    meta: {
      invalidates: [userKeys.current(userId), userKeys.lists()],
    },
  });
}

/**
 * Hook to fetch the current user's linked OAuth accounts
 *
 * User-scoped via userKeys.current(userId).
 */
export function useLinkedAccounts(
  options?: Omit<UseQueryOptions<LinkedAccountsResponse>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: userKeys.linkedAccounts(userId),
    queryFn: () => userProfileService.getLinkedAccounts(),
    enabled: !!userId && callerEnabled,
  });
}

/**
 * Hook to unlink an OAuth provider from the current user
 */
export function useUnlinkAccount() {
  const userId = useAuthStore(state => state.user?.id);

  return useMutation({
    mutationFn: (provider: string) => userProfileService.unlinkAccount(provider),
    meta: { invalidates: [userKeys.linkedAccounts(userId)] },
  });
}

/**
 * Hook to fetch the current user's privacy settings
 *
 * User-scoped via userKeys.current(userId).
 */
export function usePrivacySettings(
  options?: Omit<UseQueryOptions<PrivacySettings>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: userKeys.privacySettings(userId),
    queryFn: () => userProfileService.getPrivacySettings(),
    enabled: !!userId && callerEnabled,
  });
}

/**
 * Hook to update the current user's privacy settings
 *
 * NOTE: previously used optimistic updates with setQueryData merge. Privacy
 * settings is a JSONB-backed payload whose server-normalized shape can
 * diverge from the partial the client sends — the optimistic flip then
 * "snapped back" after invalidation. Removed in favour of invalidate-and-
 * refetch (small UX delay, but correct). See
 * /memories/repo/typeorm-jsonb-pitfall.md.
 */
export function useUpdatePrivacySettings() {
  const userId = useAuthStore(state => state.user?.id);

  return useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) =>
      userProfileService.updatePrivacySettings(updates),
    meta: {
      invalidates: [userKeys.privacySettings(userId), userKeys.current(userId)],
    },
  });
}

/**
 * Hook to browse community members directory with pagination + search
 */
export function useCommunityMembers(
  params: CommunityBrowseParams = {},
  options?: Omit<UseQueryOptions<CommunityBrowseResult>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.browse(params as Record<string, unknown>),
    queryFn: () => communityMembersService.browseMembers(params),
    ...options,
  });
}
