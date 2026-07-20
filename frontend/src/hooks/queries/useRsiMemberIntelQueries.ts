/**
 * RSI Member Intel React Query Hooks (Wave 3.3)
 *
 * Query hooks for member intelligence:
 *  - Member list with intel summary
 *  - Full member intel card
 *  - Enrichment mutations
 *  - Audit and role validation mutations
 */

import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  rsiMemberIntelService,
  type AuditRunResult,
  type BatchEnrichmentResult,
  type ClearCacheResult,
  type EnrichmentResult,
  type LinkCandidate,
  type ManualLinkInput,
  type ManualLinkResult,
  type MemberIntelCard,
  type MemberIntelListResponse,
  type RoleMappingValidationResult,
} from '@/services/rsiMemberIntelService';
import { rsiMemberIntelKeys } from './queryKeys';

// ─── Queries ───────────────────────────────────────────────────────────

/**
 * Fetch paginated member list with intel summaries.
 */
export function useRsiMemberIntelList(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<MemberIntelListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: rsiMemberIntelKeys.list(organizationId!),
    queryFn: () => rsiMemberIntelService.getMemberList(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Fetch full member intel card for a specific RSI handle.
 */
export function useRsiMemberIntelCard(
  organizationId: string | undefined,
  rsiHandle: string | undefined,
  options?: Omit<UseQueryOptions<MemberIntelCard>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: rsiMemberIntelKeys.card(organizationId!, rsiHandle!),
    queryFn: () => rsiMemberIntelService.getMemberCard(organizationId!, rsiHandle!),
    enabled: !!organizationId && !!rsiHandle,
    ...options,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────

/**
 * Enrich a single member (fetch RSI org affiliations).
 */
export function useEnrichMember() {
  const queryClient = useQueryClient();
  return useMutation<EnrichmentResult, Error, { organizationId: string; rsiHandle: string }>({
    mutationFn: ({ organizationId, rsiHandle }) =>
      rsiMemberIntelService.enrichMember(organizationId, rsiHandle),
    onSuccess: (_, { organizationId, rsiHandle }) => {
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.card(organizationId, rsiHandle),
      });
    },
  });
}

/**
 * Batch enrich all members in the organization.
 */
export function useEnrichAllMembers() {
  const queryClient = useQueryClient();
  return useMutation<BatchEnrichmentResult, Error, { organizationId: string }>({
    mutationFn: ({ organizationId }) => rsiMemberIntelService.enrichAll(organizationId),
    onSuccess: (_, { organizationId }) => {
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.list(organizationId),
      });
    },
  });
}

/**
 * Run member audit checks (creates flags).
 */
export function useRunMemberAudit() {
  const queryClient = useQueryClient();
  return useMutation<AuditRunResult, Error, { organizationId: string; guildId?: string }>({
    mutationFn: ({ organizationId, guildId }) =>
      rsiMemberIntelService.runAudit(organizationId, guildId),
    onSuccess: (_, { organizationId }) => {
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.list(organizationId),
      });
    },
  });
}

/**
 * Validate role mappings across all members.
 */
export function useValidateRoleMappings() {
  return useMutation<
    RoleMappingValidationResult,
    Error,
    { organizationId: string; guildId?: string }
  >({
    mutationFn: ({ organizationId, guildId }) =>
      rsiMemberIntelService.validateRoles(organizationId, guildId),
  });
}

// ─── Link Candidate Queries ────────────────────────────────────────────

/**
 * Fetch link candidates (platform users) for manual mapping.
 */
export function useLinkCandidates(
  organizationId: string | undefined,
  query?: string,
  options?: Omit<UseQueryOptions<LinkCandidate[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: rsiMemberIntelKeys.linkCandidates(organizationId!, query),
    queryFn: () => rsiMemberIntelService.getLinkCandidates(organizationId!, query),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Manually link an RSI member to a platform user.
 */
export function useManualLink() {
  const queryClient = useQueryClient();
  return useMutation<
    ManualLinkResult,
    Error,
    { organizationId: string; rsiHandle: string; input: ManualLinkInput }
  >({
    mutationFn: ({ organizationId, rsiHandle, input }) =>
      rsiMemberIntelService.manualLink(organizationId, rsiHandle, input),
    onSuccess: (_, { organizationId, rsiHandle }) => {
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.card(organizationId, rsiHandle),
      });
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.list(organizationId),
      });
    },
  });
}

/**
 * Remove the link between an RSI member and a platform user.
 */
export function useUnlinkMember() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { organizationId: string; rsiHandle: string }>({
    mutationFn: ({ organizationId, rsiHandle }) =>
      rsiMemberIntelService.unlinkMember(organizationId, rsiHandle),
    onSuccess: (_, { organizationId, rsiHandle }) => {
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.card(organizationId, rsiHandle),
      });
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.list(organizationId),
      });
    },
  });
}

/**
 * Clear all cached RSI data for the organization.
 */
export function useClearCache() {
  const queryClient = useQueryClient();
  return useMutation<ClearCacheResult, Error, { organizationId: string }>({
    mutationFn: ({ organizationId }) => rsiMemberIntelService.clearCache(organizationId),
    onSuccess: (_, { organizationId }) => {
      void queryClient.invalidateQueries({
        queryKey: rsiMemberIntelKeys.list(organizationId),
      });
    },
  });
}
