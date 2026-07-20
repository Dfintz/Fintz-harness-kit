/**
 * Recruitment Query Hooks — Sprint 22-D React Query Migration
 *
 * TanStack Query hooks for recruitment campaign management with automatic caching,
 * background refetching, and cache invalidation.
 */

import {
  recruitmentService,
  type ApplyToRecruitmentInput,
  type CreateRecruitmentInput,
  type Recruitment,
  type RecruitmentApplicationsResponse,
  type RecruitmentFilters,
  type ReviewApplicationInput,
  type UpdateRecruitmentInput,
} from '@/services/recruitmentService';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { recruitmentKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all recruitment campaigns, optionally filtered
 */
export function useRecruitments(
  filters?: RecruitmentFilters,
  options?: Omit<UseQueryOptions<Recruitment[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: recruitmentKeys.list(filters as Record<string, unknown>),
    queryFn: () => recruitmentService.getRecruitments(filters),
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new recruitment campaign
 */
export function useCreateRecruitment() {  return useMutation({
    mutationFn: (data: CreateRecruitmentInput) => recruitmentService.createRecruitment(data),
    meta: { invalidates: [recruitmentKeys.lists()] },
  });
}

/**
 * Hook to update an existing recruitment campaign
 */
export function useUpdateRecruitment() {  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecruitmentInput }) =>
      recruitmentService.updateRecruitment(id, data),
    meta: { invalidates: [recruitmentKeys.lists()] },
  });
}

/**
 * Hook to delete a recruitment campaign
 */
export function useDeleteRecruitment() {  return useMutation({
    mutationFn: (id: string) => recruitmentService.deleteRecruitment(id),
    meta: { invalidates: [recruitmentKeys.lists()] },
  });
}

/**
 * Hook to update the status of a recruitment campaign
 */
export function useUpdateRecruitmentStatus() {  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      recruitmentService.updateStatus(id, status),
    meta: { invalidates: [recruitmentKeys.lists()] },
  });
}

/**
 * Hook to apply to a recruitment campaign
 */
export function useApplyToRecruitment() {  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ApplyToRecruitmentInput }) =>
      recruitmentService.apply(id, data),
    meta: { invalidates: [recruitmentKeys.lists()] },
  });
}

// ============================================================================
// Recruitment Application Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch applications for a specific recruitment campaign
 */
export function useRecruitmentApplications(
  recruitmentId: string | undefined,
  filters?: { status?: string },
  options?: Omit<UseQueryOptions<RecruitmentApplicationsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: recruitmentKeys.applications(recruitmentId!, filters as Record<string, unknown>),
    queryFn: () => recruitmentService.getApplications(recruitmentId!, filters),
    enabled: !!recruitmentId,
    ...options,
  });
}

/**
 * Hook to review (accept/reject/interview) a recruitment application
 */
export function useReviewRecruitmentApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recruitmentId,
      applicationId,
      data,
    }: {
      recruitmentId: string;
      applicationId: string;
      data: ReviewApplicationInput;
    }) => recruitmentService.reviewApplication(recruitmentId, applicationId, data),
    onSuccess: (_result, { recruitmentId }) => {
      queryClient.invalidateQueries({
        queryKey: recruitmentKeys.detail(recruitmentId),
      });
      queryClient.invalidateQueries({ queryKey: recruitmentKeys.lists() });
    },
  });
}
