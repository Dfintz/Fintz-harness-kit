/**
 * Briefing Query Hooks — Sprint 22-H React Query Migration
 *
 * TanStack Query hooks for briefing/whiteboard management with automatic caching,
 * background refetching, and cache invalidation.
 */

import { isApiClientError } from '@/services/apiClient';
import {
  briefingService,
  type Briefing,
  type BriefingElement,
  type CreateBriefingInput,
  type UpdateBriefingInput,
} from '@/services/briefingService';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { briefingKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all briefings
 */
export function useBriefings(options?: Omit<UseQueryOptions<Briefing[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: briefingKeys.lists(),
    queryFn: () => briefingService.getBriefings(),
    ...options,
  });
}

/**
 * Hook to fetch a single briefing by ID
 */
export function useBriefing(
  id: string | undefined,
  options?: Omit<UseQueryOptions<Briefing>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: briefingKeys.detail(id ?? ''),
    queryFn: () => briefingService.getBriefing(id ?? ''),
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new briefing
 */
export function useCreateBriefing() {  return useMutation({
    mutationFn: (data: CreateBriefingInput) => briefingService.createBriefing(data),
    meta: { invalidates: [briefingKeys.lists()] },
  });
}

/**
 * Hook to update an existing briefing
 */
export function useUpdateBriefing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBriefingInput }) =>
      briefingService.updateBriefing(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: briefingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: briefingKeys.lists() });
    },
  });
}

/**
 * Hook to delete a briefing.
 *
 * Cache invalidation runs in `onSettled` (not just `onSuccess`) so that a 404
 * response — which means the row is already gone server-side — still clears
 * the stale list cache and removes the dead row from the UI. Without this,
 * users could see and repeatedly attempt to delete a briefing that no longer
 * exists in the database.
 */
export function useDeleteBriefing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => briefingService.deleteBriefing(id),
    onSettled: (_result, error, id) => {
      // Always remove the detail cache for the targeted briefing
      queryClient.removeQueries({ queryKey: briefingKeys.detail(id) });
      // Always refetch lists so a stale row (e.g., already deleted) disappears
      queryClient.invalidateQueries({ queryKey: briefingKeys.lists() });

      if (error && isApiClientError(error) && error.statusCode === 404) {
        // Briefing is already gone; force an immediate refetch of lists
        queryClient.refetchQueries({ queryKey: briefingKeys.lists() });
      }
    },
  });
}

/**
 * Hook to update the status of a briefing
 */
export function useUpdateBriefingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      briefingService.updateStatus(id, status),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: briefingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: briefingKeys.lists() });
    },
  });
}

/**
 * Hook to add an element to a briefing
 */
export function useAddBriefingElement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ briefingId, element }: { briefingId: string; element: BriefingElement }) =>
      briefingService.addElement(briefingId, element),
    onSuccess: (_result, { briefingId }) => {
      queryClient.invalidateQueries({ queryKey: briefingKeys.detail(briefingId) });
    },
  });
}

/**
 * Hook to create a new version of a briefing
 */
export function useCreateBriefingVersion() {  return useMutation({
    mutationFn: (id: string) => briefingService.createVersion(id),
    meta: { invalidates: [briefingKeys.lists()] },
  });
}
