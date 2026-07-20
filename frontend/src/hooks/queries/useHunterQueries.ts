import { useQuery } from '@tanstack/react-query';

import {
  bountyService,
  type HunterAnalyticsSummaryData,
  type HunterHistoryResponse,
  type HunterLeaderboardEntryData,
  type HunterProfileData,
} from '@/services/bountyService';
import { useAuthStore } from '@/store/authStore';

import { hunterKeys } from './queryKeys';

/** Check if the current user has an active organization context */
function useHasOrg(): boolean {
  const user = useAuthStore(state => state.user);
  return !!(user?.activeOrgId || user?.organizationId);
}

/**
 * Hook to get or create a hunter profile
 */
export function useHunterProfile(userId?: string) {
  const hasOrg = useHasOrg();
  return useQuery<HunterProfileData>({
    queryKey: hunterKeys.profile(userId),
    queryFn: () => bountyService.getHunterProfile(userId),
    enabled: hasOrg,
  });
}

/**
 * Hook to get the hunter leaderboard
 */
export function useHunterLeaderboard(
  sortBy?: 'completed' | 'rewards' | 'successRate' | 'reputation',
  limit?: number
) {
  const hasOrg = useHasOrg();
  return useQuery<HunterLeaderboardEntryData[]>({
    queryKey: hunterKeys.leaderboard(sortBy),
    queryFn: () => bountyService.getHunterLeaderboard(sortBy, limit),
    enabled: hasOrg,
  });
}

/**
 * Hook to get hunter bounty history
 */
export function useHunterHistory(userId?: string, page = 1, limit = 10) {
  const hasOrg = useHasOrg();
  return useQuery<HunterHistoryResponse>({
    queryKey: hunterKeys.history(userId, page),
    queryFn: () => bountyService.getHunterHistory(userId, page, limit),
    enabled: hasOrg,
  });
}

/**
 * Hook to get hunter analytics summary
 */
export function useHunterAnalytics() {
  const hasOrg = useHasOrg();
  return useQuery<HunterAnalyticsSummaryData>({
    queryKey: hunterKeys.analytics(),
    queryFn: () => bountyService.getHunterAnalytics(),
    enabled: hasOrg,
  });
}
