/**
 * User Profile Query Hooks for Mobile
 * TanStack Query hooks for user profile operations.
 * Ported from frontend/src/hooks/queries/useUserQueries.ts
 */

import type {
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

export function useLinkedAccounts(
  options?: Omit<UseQueryOptions<LinkedAccountsResponse>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: userKeys.linkedAccounts(userId),
    queryFn: () => userProfileService.getLinkedAccounts(),
    enabled: !!userId,
    ...options,
  });
}

export function usePrivacySettings(
  options?: Omit<UseQueryOptions<PrivacySettings>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: userKeys.privacySettings(userId),
    queryFn: () => userProfileService.getPrivacySettings(),
    enabled: !!userId,
    ...options,
  });
}

// Mutations

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (updates: Partial<UserProfile>) => userProfileService.updateMyProfile(updates),
    meta: { invalidates: [userKeys.all] },
  });
}
