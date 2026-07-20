/**
 * SCStats Query Hooks — Phase 3
 *
 * TanStack Query hooks for Star Citizen stats import/display with
 * automatic caching and background refetching.
 * Supports both JSON (legacy) and CSV imports.
 */

import type {
  OrgSCStatsAnalytics,
  SCStatsCsvPlayerData,
  SCStatsPlayerData,
} from '@/services/scstatsService';
import { scstatsService, type SCStatsCsvFiles } from '@/services/scstatsService';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { scStatsKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch SCStats data for a user (JSON import)
 */
export function useSCStatsData(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<SCStatsPlayerData>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: scStatsKeys.userData(userId!),
    queryFn: () => scstatsService.getData(userId!),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Hook to fetch CSV-imported SCStats data for a user
 */
export function useSCStatsCsvData(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<SCStatsCsvPlayerData>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: scStatsKeys.csvData(userId!),
    queryFn: () => scstatsService.getCsvData(userId!),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Hook to fetch SCStats org analytics
 */
export function useSCStatsOrgAnalytics(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<OrgSCStatsAnalytics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: scStatsKeys.orgAnalytics(orgId!),
    queryFn: () => scstatsService.getOrgAnalytics(orgId!),
    enabled: !!orgId,
    retry: (failureCount, error) => {
      // Don't retry on auth/permission errors
      if (
        error &&
        'statusCode' in error &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        return false;
      }
      return failureCount < 3;
    },
    ...options,
  });
}

/**
 * Hook to fetch SCStats org analytics (public, unauthenticated)
 */
export function useSCStatsPublicOrgAnalytics(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<OrgSCStatsAnalytics | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: scStatsKeys.orgAnalyticsPublic(orgId!),
    queryFn: () => scstatsService.getPublicOrgAnalytics(orgId!),
    enabled: !!orgId,
    retry: false,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to import SCStats data for a user (JSON)
 */
export function useImportSCStats(userId: string) {  return useMutation({
    mutationFn: ({ file, consent }: { file: File; consent: boolean }) =>
      scstatsService.importData(userId, file, consent),
    meta: { invalidates: [scStatsKeys.userData(userId)] },
  });
}

/**
 * Hook to import SCStats CSV exports
 */
export function useImportSCStatsCsv(userId: string) {  return useMutation({
    mutationFn: ({ files, consent }: { files: SCStatsCsvFiles; consent: boolean }) =>
      scstatsService.importCsvData(userId, files, consent),
    meta: { invalidates: [scStatsKeys.csvData(userId)] },
  });
}

/**
 * Hook to delete SCStats data for a user (JSON)
 */
export function useDeleteSCStats(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => scstatsService.deleteData(userId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: scStatsKeys.userData(userId) });
    },
  });
}

/**
 * Hook to delete CSV-imported SCStats data for a user
 */
export function useDeleteSCStatsCsv(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => scstatsService.deleteCsvData(userId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: scStatsKeys.csvData(userId) });
    },
  });
}
