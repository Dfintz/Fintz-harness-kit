/**
 * Badge / Title Query Hooks
 *
 * TanStack React Query hooks for the Custom Titles & Badges subsystem.
 * Maps to backend endpoints at /api/v2/achievements.
 */

import {
  badgeService,
  type Achievement,
  type AchievementFilters,
  type BadgeRecipient,
  type CreateAchievementInput,
  type PaginatedAchievementResponse,
  type UpdateAchievementInput,
  type UserAchievement,
} from '@/services/badgeService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeKeys } from './queryKeys';

// Re-export types for convenience
export type {
  Achievement,
  AchievementFilters,
  AchievementRarity,
  AchievementType,
  BadgeRecipient,
  CreateAchievementInput,
  PaginatedAchievementResponse,
  UpdateAchievementInput,
  UserAchievement,
} from '@/services/badgeService';

/* ── Queries ── */

export function useBadges(filters?: AchievementFilters) {
  return useQuery<PaginatedAchievementResponse>({
    queryKey: badgeKeys.list(filters as Record<string, unknown> | undefined),
    queryFn: () => badgeService.list(filters),
  });
}

export function useBadge(id: string | undefined) {
  return useQuery<Achievement>({
    queryKey: badgeKeys.detail(id ?? ''),
    queryFn: () => badgeService.getById(id!),
    enabled: !!id,
  });
}

export function useUserBadges(userId: string | undefined) {
  return useQuery<UserAchievement[]>({
    queryKey: badgeKeys.userBadges(userId ?? ''),
    queryFn: () => badgeService.getUserBadges(userId!),
    enabled: !!userId,
  });
}

export function useBadgeRecipients(achievementId: string | undefined) {
  return useQuery<BadgeRecipient[]>({
    queryKey: badgeKeys.recipients(achievementId ?? ''),
    queryFn: () => badgeService.getRecipients(achievementId!),
    enabled: !!achievementId,
  });
}

/* ── Mutations ── */

export function useCreateBadge() {  return useMutation({
    mutationFn: (data: CreateAchievementInput) => badgeService.create(data),
    meta: { invalidates: [badgeKeys.lists()] },
  });
}

export function useUpdateBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAchievementInput }) =>
      badgeService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: badgeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: badgeKeys.lists() });
    },
  });
}

export function useDeleteBadge() {  return useMutation({
    mutationFn: (id: string) => badgeService.remove(id),
    meta: { invalidates: [badgeKeys.lists()] },
  });
}

export function useAwardBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ achievementId, userId }: { achievementId: string; userId: string }) =>
      badgeService.award(achievementId, userId),
    onSuccess: (_, { achievementId, userId }) => {
      queryClient.invalidateQueries({ queryKey: badgeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: badgeKeys.userBadges(userId) });
      queryClient.invalidateQueries({ queryKey: badgeKeys.recipients(achievementId) });
    },
  });
}

export function useRevokeBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ achievementId, userId }: { achievementId: string; userId: string }) =>
      badgeService.revoke(achievementId, userId),
    onSuccess: (_, { achievementId, userId }) => {
      queryClient.invalidateQueries({ queryKey: badgeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: badgeKeys.userBadges(userId) });
      queryClient.invalidateQueries({ queryKey: badgeKeys.recipients(achievementId) });
    },
  });
}

export function useToggleBadgeDisplay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userAchievementId,
      isDisplayed,
    }: {
      userAchievementId: string;
      isDisplayed: boolean;
      userId: string;
    }) => badgeService.toggleDisplay(userAchievementId, isDisplayed),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: badgeKeys.userBadges(userId) });
    },
  });
}
