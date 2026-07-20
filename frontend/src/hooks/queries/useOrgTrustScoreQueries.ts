import { useQuery } from '@tanstack/react-query';

import { orgTrustScoreService } from '@/services/orgTrustScoreService';

import { orgTrustScoreKeys } from './queryKeys';

/**
 * Hook to fetch an organization's composite trust score.
 * Cached for 5 minutes to match backend TTL.
 */
export function useOrgTrustScore(organizationId: string | undefined) {
  return useQuery({
    queryKey: orgTrustScoreKeys.detail(organizationId!),
    queryFn: () => orgTrustScoreService.getTrustScore(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}
