/**
 * Approval Query Hooks — Pending Approvals Dashboard Widget
 *
 * TanStack Query hooks for fetching pending organization applications
 * and invitations. Used by the Dashboard Pending Approvals widget.
 */

import { invitationService } from '@/services/invitationService';
import { orgApplicationService } from '@/services/orgApplicationService';
import { recruitmentService } from '@/services/recruitmentService';
import {
  ApplicationStatus,
  InvitationStatus,
  type ApplicationDto,
  type InvitationDto,
} from '@sc-fleet-manager/shared-types';
import { useQuery } from '@tanstack/react-query';
import { applicationKeys, invitationKeys, recruitmentKeys } from './queryKeys';

interface PaginatedResult<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * Fetch pending organization applications (admin-only endpoint).
 */
export function usePendingApplications(orgId: string | undefined) {
  return useQuery<PaginatedResult<ApplicationDto>>({
    queryKey: applicationKeys.list(orgId ?? '', { status: 'pending' }),
    queryFn: () =>
      orgApplicationService.getApplicationsForOrg(orgId ?? '', {
        status: ApplicationStatus.PENDING,
        page: 1,
        limit: 5,
      }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/**
 * Fetch pending organization invitations (admin-only endpoint).
 */
export function usePendingInvitations(orgId: string | undefined) {
  return useQuery<PaginatedResult<InvitationDto>>({
    queryKey: invitationKeys.list(orgId ?? '', { status: 'pending' }),
    queryFn: () =>
      invitationService.getInvitationsForOrg(orgId ?? '', {
        status: InvitationStatus.PENDING,
        page: 1,
        limit: 5,
      }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/**
 * Fetch pending recruitment applicants count across all of the org's open recruitment posts.
 */
export function usePendingRecruitmentApplicants(orgId: string | undefined) {
  return useQuery<number>({
    queryKey: [...recruitmentKeys.lists(), 'pending-count', orgId] as const,
    queryFn: async () => {
      const result = await recruitmentService.getRecruitments({
        organizationId: orgId,
        status: 'open',
      });
      const recruitments = result ?? [];
      return recruitments.reduce((sum, r) => sum + (r.pendingApplicants ?? 0), 0);
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
