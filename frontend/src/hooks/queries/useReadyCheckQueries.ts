/**
 * Ready Check Query Hooks
 *
 * TanStack Query hooks for ready check operations.
 * Polls the ready check status while active for real-time updates.
 */

import { readyCheckService, type ReadyCheckResponse } from '@/services/readyCheckService';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { activityKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get the current ready check status for an activity.
 * Automatically polls every 3 seconds while the ready check is active.
 */
export function useReadyCheck(
  activityId: string | undefined,
  options?: Omit<UseQueryOptions<ReadyCheckResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: activityKeys.readyCheck(activityId ?? ''),
    queryFn: () => readyCheckService.getReadyCheck(activityId!),
    enabled: !!activityId,
    refetchInterval: query => {
      // Poll every 3 seconds while the ready check is active
      const data = query.state.data;
      if (data?.active) return 3000;
      return false;
    },
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to initiate a ready check
 */
export function useInitiateReadyCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      durationSeconds,
    }: {
      activityId: string;
      durationSeconds?: number;
    }) => readyCheckService.initiateReadyCheck(activityId, durationSeconds),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.readyCheck(activityId) });
    },
  });
}

/**
 * Hook to respond to a ready check
 */
export function useRespondToReadyCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      response,
    }: {
      activityId: string;
      response: 'ready' | 'not_ready';
    }) => readyCheckService.respondToReadyCheck(activityId, response),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.readyCheck(activityId) });
    },
  });
}

/**
 * Hook to cancel a ready check
 */
export function useCancelReadyCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId }: { activityId: string }) =>
      readyCheckService.cancelReadyCheck(activityId),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.readyCheck(activityId) });
    },
  });
}
