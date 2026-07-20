/**
 * React Query hooks for public directory data.
 *
 * Provides cached access to public job listings, public activities,
 * and job application management.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, isApiClientError } from '@/services/apiClient';
import type {
  JobApplicationItem,
  JobApplicationStatus,
  PublicJobListItem,
  ReviewApplicationInput,
} from '@/services/publicDirectoryService';
import { jobApplicationService, publicJobListingService } from '@/services/publicDirectoryService';
import type { ActivityV2 } from '@/types/apiV2';

import { publicDirectoryKeys } from './queryKeys';

/**
 * Fetch a public job listing by slug or UUID.
 */
export function useJobListing(slug: string | undefined) {
  return useQuery<PublicJobListItem | null>({
    queryKey: publicDirectoryKeys.jobDetail(slug ?? ''),
    queryFn: () => publicJobListingService.getJobListing(slug ?? ''),
    enabled: !!slug,
  });
}

/**
 * Fetch a public activity by ID.
 * Uses the public search endpoint (no auth required).
 */
export function usePublicActivity(id: string | undefined) {
  return useQuery<ActivityV2 | null>({
    queryKey: publicDirectoryKeys.publicActivity(id ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<ActivityV2>(`/api/v2/search/activities/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch applications for a job listing (owner/admin only).
 */
export function useJobApplications(
  jobId: string | undefined,
  status?: JobApplicationStatus,
  enabled = true
) {
  return useQuery<JobApplicationItem[]>({
    queryKey: publicDirectoryKeys.jobApplications(jobId ?? '', status),
    queryFn: () => jobApplicationService.getApplicationsForJob(jobId!, status),
    enabled: !!jobId && enabled,
    // Don't retry permission errors (403) — they won't succeed on retry
    retry: (failureCount, error) => {
      if (isApiClientError(error) && (error.statusCode === 403 || error.statusCode === 401)) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Review (approve/reject/waitlist) a job application.
 * Invalidates the applications list on success.
 */
export function useReviewApplication(jobId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: ReviewApplicationInput;
    }) => {
      if (!jobId) throw new Error('Job ID is required to review an application');
      return jobApplicationService.reviewApplication(jobId, applicationId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: publicDirectoryKeys.jobApplications(jobId ?? ''),
      });
      // Also invalidate the job detail (crew count may have changed)
      queryClient.invalidateQueries({
        queryKey: publicDirectoryKeys.jobDetail(jobId ?? ''),
      });
    },
  });
}

/**
 * Cancel (deactivate) a job listing.
 * Invalidates both the job detail and the jobs list on success.
 */
export function useCancelJobListing() {  return useMutation({
    mutationFn: (jobId: string) => publicJobListingService.cancelJobListing(jobId),
    meta: {
      invalidates: (_data, jobId) => [publicDirectoryKeys.jobs(), publicDirectoryKeys.jobDetail(jobId)],
    },
  });
}
