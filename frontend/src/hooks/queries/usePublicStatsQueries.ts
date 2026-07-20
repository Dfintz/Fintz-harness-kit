/**
 * Public Stats Query Hooks (Sprint 21-B)
 *
 * TanStack Query hook for the public platform statistics endpoint.
 * No authentication required — suitable for public pages.
 */

import { publicStatsService, type PublicStats } from '@/services/publicStatsService';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { publicStatsKeys } from './queryKeys';

export function usePublicStats(
  options?: Omit<UseQueryOptions<PublicStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: publicStatsKeys.stats(),
    queryFn: () => publicStatsService.getStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes — matches backend cache TTL
    ...options,
  });
}
