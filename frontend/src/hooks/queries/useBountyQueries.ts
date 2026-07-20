/**
 * Bounty Query Hooks
 *
 * TanStack Query hooks for bounty board operations with automatic caching,
 * background refetching, and optimistic updates.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type {
  BountySearchFilters,
  ClaimBountyRequest,
  CreateBountyDTO,
  SubmitClaimRequest,
  SubmitEvidenceRequest,
  UpdateBountyDTO,
} from '@/services/bountyService';
import { bountyService } from '@/services/bountyService';
import { useMutation, useQuery } from '@tanstack/react-query';
import { bountyKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to search bounties with filters
 */
export function useBounties(filters?: BountySearchFilters) {
  return useQuery({
    queryKey: bountyKeys.list(filters as Record<string, unknown>),
    queryFn: () => bountyService.searchBounties(filters),
  });
}

/**
 * Hook to fetch a single bounty by ID
 */
export function useBounty(bountyId: string | undefined) {
  return useQuery({
    queryKey: bountyKeys.detail(bountyId!),
    queryFn: () => bountyService.getBountyById(bountyId!),
    enabled: !!bountyId,
  });
}

/**
 * Hook to fetch claims for a bounty
 */
export function useBountyClaims(bountyId: string | undefined) {
  return useQuery({
    queryKey: bountyKeys.claims(bountyId!),
    queryFn: () => bountyService.getBountyClaims(bountyId!),
    enabled: !!bountyId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new bounty
 */
export function useCreateBounty() {
  return useMutation({
    mutationFn: (data: CreateBountyDTO) => bountyService.createBounty(data),
    meta: { invalidates: [bountyKeys.lists()] },
  });
}

/**
 * Hook to update a bounty
 */
export function useUpdateBounty() {
  return useMutation({
    mutationFn: ({ bountyId, data }: { bountyId: string; data: UpdateBountyDTO }) =>
      bountyService.updateBounty(bountyId, data),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.detail(variables.bountyId),
        bountyKeys.lists(),
      ],
    },
  });
}

/**
 * Hook to delete a bounty
 */
export function useDeleteBounty() {
  return useMutation({
    mutationFn: (bountyId: string) => bountyService.deleteBounty(bountyId),
    meta: { invalidates: [bountyKeys.lists()] },
  });
}

/**
 * Hook to create a bounty claim
 */
export function useCreateBountyClaim() {
  return useMutation({
    mutationFn: ({ bountyId, data }: { bountyId: string; data?: ClaimBountyRequest }) =>
      bountyService.claimBounty(bountyId, data),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.claims(variables.bountyId),
        bountyKeys.detail(variables.bountyId),
      ],
    },
  });
}

/**
 * Hook to approve a bounty claim
 */
export function useApproveBountyClaim() {
  return useMutation({
    mutationFn: ({
      bountyId,
      claimId,
      notes,
    }: {
      bountyId: string;
      claimId: string;
      notes?: string;
    }) => bountyService.updateClaim(bountyId, claimId, { action: 'approve', notes }),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.claims(variables.bountyId),
        bountyKeys.detail(variables.bountyId),
      ],
    },
  });
}

/**
 * Hook to reject a bounty claim
 */
export function useRejectBountyClaim() {
  return useMutation({
    mutationFn: ({
      bountyId,
      claimId,
      reason,
    }: {
      bountyId: string;
      claimId: string;
      reason: string;
    }) => bountyService.updateClaim(bountyId, claimId, { action: 'reject', reason }),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.claims(variables.bountyId),
        bountyKeys.detail(variables.bountyId),
      ],
    },
  });
}

/**
 * Hook to submit evidence for an in-progress claim
 */
export function useSubmitClaimEvidence() {
  return useMutation({
    mutationFn: ({
      bountyId,
      claimId,
      data,
    }: {
      bountyId: string;
      claimId: string;
      data: SubmitEvidenceRequest;
    }) => bountyService.submitEvidence(bountyId, claimId, data),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.claims(variables.bountyId),
        bountyKeys.detail(variables.bountyId),
      ],
    },
  });
}

/**
 * Hook to submit a claim for review
 */
export function useSubmitBountyClaim() {
  return useMutation({
    mutationFn: ({
      bountyId,
      claimId,
      data,
    }: {
      bountyId: string;
      claimId: string;
      data?: SubmitClaimRequest;
    }) => bountyService.submitClaim(bountyId, claimId, data),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.claims(variables.bountyId),
        bountyKeys.detail(variables.bountyId),
      ],
    },
  });
}

/**
 * Hook to delete (abandon) a claim
 */
export function useDeleteBountyClaim() {
  return useMutation({
    mutationFn: ({
      bountyId,
      claimId,
      reason,
    }: {
      bountyId: string;
      claimId: string;
      reason?: string;
    }) => bountyService.deleteClaim(bountyId, claimId, reason),
    meta: {
      invalidates: (_data, variables) => [
        bountyKeys.claims(variables.bountyId),
        bountyKeys.detail(variables.bountyId),
      ],
    },
  });
}
