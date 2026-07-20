/**
 * Moderation / Blacklist React Query Hooks
 *
 * TanStack React Query hooks for the moderation subsystem.
 * Covers incident search, analytics, user lookup, sharing config,
 * and mutations for create/revoke/share.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { moderationKeys } from './queryKeys';
import {
  moderationService,
  type CreateIncidentInput,
  type IncidentSearchFilters,
  type ModerationAnalytics,
  type ModerationIncident,
  type PaginatedIncidentResponse,
  type RepeatOffender,
  type SharingConfig,
  type UpdateIncidentInput,
  type UpdateSharingConfigInput,
  type UserIncidentSummary,
} from '@/services/moderationService';

// Re-export types
export type {
  CreateIncidentInput,
  IncidentSearchFilters,
  ModerationAnalytics,
  ModerationIncident,
  PaginatedIncidentResponse,
  RepeatOffender,
  SharingConfig,
  UpdateIncidentInput,
  UpdateSharingConfigInput,
  UserIncidentSummary,
};
export type { IncidentStatus, IncidentType, TrendDataPoint } from '@/services/moderationService';

// ============================================================================
// Queries
// ============================================================================

export function useIncidents(filters?: IncidentSearchFilters) {
  return useQuery<PaginatedIncidentResponse>({
    queryKey: moderationKeys.incidentList(filters as Record<string, unknown>),
    queryFn: () => moderationService.searchIncidents(filters),
  });
}

export function useIncident(incidentId: string | undefined) {
  return useQuery<ModerationIncident>({
    queryKey: moderationKeys.incidentDetail(incidentId ?? ''),
    queryFn: () => moderationService.getIncident(incidentId!),
    enabled: !!incidentId,
  });
}

export function useLookupUser(discordId: string | undefined, includeShared?: boolean) {
  return useQuery<UserIncidentSummary>({
    queryKey: moderationKeys.lookup(discordId ?? ''),
    queryFn: () => moderationService.lookupUser(discordId!, includeShared),
    enabled: !!discordId,
  });
}

export function useModerationAnalytics() {
  return useQuery<ModerationAnalytics>({
    queryKey: moderationKeys.analytics(),
    queryFn: () => moderationService.getAnalytics(),
  });
}

export function useRepeatOffenders() {
  return useQuery<RepeatOffender[]>({
    queryKey: moderationKeys.repeatOffenders(),
    queryFn: () => moderationService.getRepeatOffenders(),
  });
}

export function useSharingConfig() {
  return useQuery<SharingConfig>({
    queryKey: moderationKeys.sharingConfig(),
    queryFn: () => moderationService.getSharingConfig(),
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateIncident() {  return useMutation({
    mutationFn: (input: CreateIncidentInput) => moderationService.createIncident(input),
    meta: { invalidates: [moderationKeys.incidents(), moderationKeys.analytics()] },
  });
}

export function useUpdateIncident() {  return useMutation({
    mutationFn: ({ incidentId, input }: { incidentId: string; input: UpdateIncidentInput }) =>
      moderationService.updateIncident(incidentId, input),
    meta: { invalidates: [moderationKeys.incidents()] },
  });
}

export function useRevokeIncident() {  return useMutation({
    mutationFn: ({ incidentId, reason }: { incidentId: string; reason?: string }) =>
      moderationService.revokeIncident(incidentId, reason),
    meta: { invalidates: [moderationKeys.incidents(), moderationKeys.analytics()] },
  });
}

export function useShareIncident() {  return useMutation({
    mutationFn: (incidentId: string) => moderationService.shareIncident(incidentId),
    meta: { invalidates: [moderationKeys.incidents()] },
  });
}

export function useUnshareIncident() {  return useMutation({
    mutationFn: (incidentId: string) => moderationService.unshareIncident(incidentId),
    meta: { invalidates: [moderationKeys.incidents()] },
  });
}

export function useUpdateSharingConfig() {  return useMutation({
    mutationFn: (input: UpdateSharingConfigInput) => moderationService.updateSharingConfig(input),
    meta: { invalidates: [moderationKeys.sharingConfig()] },
  });
}
