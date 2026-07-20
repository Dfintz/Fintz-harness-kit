/**
 * User Trust Score Query Hooks — Sprint 22-K
 *
 * TanStack Query hook for fetching unified user trust scores.
 */

import {
  userTrustScoreService,
  type UnifiedReputationScore,
} from '@/services/userTrustScoreService';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { userTrustScoreKeys } from './queryKeys';

/**
 * Hook to fetch unified trust score for a user
 */
export function useUserTrustScore(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<UnifiedReputationScore>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userTrustScoreKeys.detail(userId ?? ''),
    queryFn: () => userTrustScoreService.getUnifiedScore(userId ?? ''),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 min — reputation data doesn't change frequently
    ...options,
  });
}
