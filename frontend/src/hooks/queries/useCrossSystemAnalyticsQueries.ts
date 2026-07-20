import { useQuery } from '@tanstack/react-query';

import {
  crossSystemAnalyticsService,
  type CrossSystemAnalyticsParams,
} from '@/services/crossSystemAnalyticsService';
import { crossSystemAnalyticsKeys } from './queryKeys';

export function useCrossSystemAnalytics(params?: CrossSystemAnalyticsParams) {
  return useQuery({
    queryKey: crossSystemAnalyticsKeys.analytics(params as Record<string, unknown>),
    queryFn: () => crossSystemAnalyticsService.getAnalytics(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrewFormationTrends(params?: CrossSystemAnalyticsParams) {
  return useQuery({
    queryKey: crossSystemAnalyticsKeys.crewFormation(params as Record<string, unknown>),
    queryFn: () => crossSystemAnalyticsService.getCrewFormationTrends(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFormationSpeedStats(params?: CrossSystemAnalyticsParams) {
  return useQuery({
    queryKey: crossSystemAnalyticsKeys.formationSpeed(params as Record<string, unknown>),
    queryFn: () => crossSystemAnalyticsService.getFormationSpeedStats(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useJobPlacementMetrics(params?: CrossSystemAnalyticsParams) {
  return useQuery({
    queryKey: crossSystemAnalyticsKeys.jobPlacement(params as Record<string, unknown>),
    queryFn: () => crossSystemAnalyticsService.getJobPlacementMetrics(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLfgConversionMetrics(params?: CrossSystemAnalyticsParams) {
  return useQuery({
    queryKey: crossSystemAnalyticsKeys.lfgConversion(params as Record<string, unknown>),
    queryFn: () => crossSystemAnalyticsService.getLfgConversionMetrics(params),
    staleTime: 5 * 60 * 1000,
  });
}
