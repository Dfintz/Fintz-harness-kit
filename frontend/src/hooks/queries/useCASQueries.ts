/**
 * CAS Query Hooks — TanStack React Query hooks for Composite Activity Score.
 */

import type {
    CASHeatmapResponse,
    CASHistoryPoint,
    CASRankingEntry,
    CASScoreResult,
} from '@sc-fleet-manager/shared-types';

import { casService } from '@/services/casService';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { casKeys } from './queryKeys';

/**
 * Get current CAS score for an organization.
 */
export function useOrgCAS(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<CASScoreResult | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: casKeys.score(orgId!),
    queryFn: () => casService.getCurrentScore(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 min (computed every 15 min)
    ...options,
  });
}

/**
 * Get CAS score history for trend charts.
 */
export function useCASHistory(
  orgId: string | undefined,
  days: number = 30,
  options?: Omit<UseQueryOptions<CASHistoryPoint[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: casKeys.history(orgId!, days),
    queryFn: () => casService.getScoreHistory(orgId!, days),
    enabled: !!orgId,
    staleTime: 15 * 60 * 1000, // 15 min (matches computation interval)
    ...options,
  });
}

/**
 * Get CAS activity heatmap.
 */
export function useCASHeatmap(
  orgId: string | undefined,
  days: number = 7,
  options?: Omit<UseQueryOptions<CASHeatmapResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: casKeys.heatmap(orgId!, days),
    queryFn: () => casService.getHeatmap(orgId!, days),
    enabled: !!orgId,
    staleTime: 15 * 60 * 1000,
    ...options,
  });
}

/**
 * Get CAS organization ranking.
 */
export function useCASRanking(
  options?: Omit<UseQueryOptions<CASRankingEntry[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: casKeys.ranking(),
    queryFn: () => casService.getRanking(),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
}
