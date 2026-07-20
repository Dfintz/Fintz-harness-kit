/**
 * React Query hooks for voice server data.
 *
 * Provides typed query + mutation hooks for:
 * - Org voice server config/status/stats
 * - Federation voice server config/status/stats
 * - User-accessible voice servers (aggregated)
 */

import type {
  AccessibleVoiceServer,
  UpdateVoiceServerConfigRequest,
  VoiceServerConfig,
  VoiceServerStats,
  VoiceServerStatus,
  VoiceServerWhitelistSuggestion,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';

import { voiceServerService } from '@/services/voiceServerService';

import { voiceServerKeys } from './queryKeys';

// ── Organization Queries ────────────────────────────────────

export function useOrgVoiceConfig(orgId: string | undefined) {
  return useQuery<VoiceServerConfig | null>({
    queryKey: voiceServerKeys.orgConfig(orgId!),
    queryFn: () => voiceServerService.getOrgConfig(orgId!),
    enabled: !!orgId,
  });
}

export function useOrgVoiceStatus(orgId: string | undefined) {
  return useQuery<VoiceServerStatus>({
    queryKey: voiceServerKeys.orgStatus(orgId!),
    queryFn: () => voiceServerService.getOrgStatus(orgId!),
    enabled: !!orgId,
    refetchInterval: 60_000, // Refresh every minute for live status
  });
}

export function useOrgVoiceStats(orgId: string | undefined) {
  return useQuery<VoiceServerStats | null>({
    queryKey: voiceServerKeys.orgStats(orgId!),
    queryFn: () => voiceServerService.getOrgStats(orgId!),
    enabled: !!orgId,
  });
}

export function useUpdateOrgVoiceConfig() {
  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: UpdateVoiceServerConfigRequest }) =>
      voiceServerService.updateOrgConfig(orgId, data),
    meta: {
      invalidates: (_data: unknown, variables: { orgId: string }) => [
        voiceServerKeys.orgConfig(variables.orgId),
        voiceServerKeys.orgStatus(variables.orgId),
        voiceServerKeys.orgStats(variables.orgId),
        voiceServerKeys.accessible(),
      ],
    },
  });
}

export function useDeleteOrgVoiceConfig() {
  return useMutation({
    mutationFn: (orgId: string) => voiceServerService.deleteOrgConfig(orgId),
    meta: {
      invalidates: (_data: unknown, orgId: string) => [
        voiceServerKeys.orgConfig(orgId),
        voiceServerKeys.orgStatus(orgId),
        voiceServerKeys.orgStats(orgId),
        voiceServerKeys.accessible(),
      ],
    },
  });
}

export function useOrgWhitelistSuggestions(orgId: string | undefined, enabled = true) {
  return useQuery<VoiceServerWhitelistSuggestion[]>({
    queryKey: voiceServerKeys.orgSuggestions(orgId!),
    queryFn: () => voiceServerService.getOrgWhitelistSuggestions(orgId!),
    enabled: !!orgId && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes — relationships change infrequently
  });
}

// ── Federation Queries ──────────────────────────────────────

export function useFedVoiceConfig(fedId: string | undefined) {
  return useQuery<VoiceServerConfig | null>({
    queryKey: voiceServerKeys.fedConfig(fedId!),
    queryFn: () => voiceServerService.getFedConfig(fedId!),
    enabled: !!fedId,
  });
}

export function useFedVoiceStatus(fedId: string | undefined) {
  return useQuery<VoiceServerStatus>({
    queryKey: voiceServerKeys.fedStatus(fedId!),
    queryFn: () => voiceServerService.getFedStatus(fedId!),
    enabled: !!fedId,
    refetchInterval: 60_000,
  });
}

export function useFedVoiceStats(fedId: string | undefined) {
  return useQuery<VoiceServerStats | null>({
    queryKey: voiceServerKeys.fedStats(fedId!),
    queryFn: () => voiceServerService.getFedStats(fedId!),
    enabled: !!fedId,
  });
}

export function useUpdateFedVoiceConfig() {
  return useMutation({
    mutationFn: ({ fedId, data }: { fedId: string; data: UpdateVoiceServerConfigRequest }) =>
      voiceServerService.updateFedConfig(fedId, data),
    meta: {
      invalidates: (_data: unknown, variables: { fedId: string }) => [
        voiceServerKeys.fedConfig(variables.fedId),
        voiceServerKeys.fedStatus(variables.fedId),
        voiceServerKeys.fedStats(variables.fedId),
        voiceServerKeys.accessible(),
      ],
    },
  });
}

export function useDeleteFedVoiceConfig() {
  return useMutation({
    mutationFn: (fedId: string) => voiceServerService.deleteFedConfig(fedId),
    meta: {
      invalidates: (_data: unknown, fedId: string) => [
        voiceServerKeys.fedConfig(fedId),
        voiceServerKeys.fedStatus(fedId),
        voiceServerKeys.fedStats(fedId),
        voiceServerKeys.accessible(),
      ],
    },
  });
}

export function useFedWhitelistSuggestions(fedId: string | undefined, enabled = true) {
  return useQuery<VoiceServerWhitelistSuggestion[]>({
    queryKey: voiceServerKeys.fedSuggestions(fedId!),
    queryFn: () => voiceServerService.getFedWhitelistSuggestions(fedId!),
    enabled: !!fedId && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Accessible Voice Servers (per-user) ────────────────

export function useAccessibleVoiceServers() {
  return useQuery<AccessibleVoiceServer[]>({
    queryKey: voiceServerKeys.accessible(),
    queryFn: () => voiceServerService.getAccessible(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
