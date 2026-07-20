/**
 * TanStack Query hooks for Member Audit & Intel
 *
 * Provides reactive data fetching for audit flags, watchlist, and member profiles.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase F)
 */
import type {
  CreateManualFlagDto,
  CreateWatchlistEntryDto,
  ListFlagsQuery,
  ListWatchlistQuery,
  ResolveFlagDto,
  UpdateWatchlistEntryDto,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { memberAuditService } from '@/services/memberAuditService';

import { memberAuditKeys } from './queryKeys';

/* ═══════════════════════════════════════════════════════════════════ */
/*  Audit Flags                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

export function useAuditFlags(orgId: string | undefined, query?: ListFlagsQuery) {
  return useQuery({
    queryKey: memberAuditKeys.flags(orgId ?? '', query as Record<string, unknown> | undefined),
    queryFn: () => memberAuditService.listFlags(orgId!, query),
    enabled: !!orgId,
  });
}

export function useAuditFlag(orgId: string | undefined, flagId: string | undefined) {
  return useQuery({
    queryKey: memberAuditKeys.flag(orgId ?? '', flagId ?? ''),
    queryFn: () => memberAuditService.getFlagById(orgId!, flagId!),
    enabled: !!orgId && !!flagId,
  });
}

export function useUserFlagStats(orgId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: memberAuditKeys.userStats(orgId ?? '', userId ?? ''),
    queryFn: () => memberAuditService.getUserFlagStats(orgId!, userId!),
    enabled: !!orgId && !!userId,
  });
}

export function useCreateManualFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, dto }: { orgId: string; dto: CreateManualFlagDto }) =>
      memberAuditService.createManualFlag(orgId, dto),
    onSuccess: (_data, { orgId }) => {
      void qc.invalidateQueries({ queryKey: memberAuditKeys.flagsList(orgId) });
    },
  });
}

export function useResolveFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, flagId, dto }: { orgId: string; flagId: string; dto: ResolveFlagDto }) =>
      memberAuditService.resolveFlag(orgId, flagId, dto),
    onSuccess: (_data, { orgId }) => {
      void qc.invalidateQueries({ queryKey: memberAuditKeys.flagsList(orgId) });
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Org Watchlist                                                      */
/* ═══════════════════════════════════════════════════════════════════ */

export function useWatchlistEntries(orgId: string | undefined, query?: ListWatchlistQuery) {
  return useQuery({
    queryKey: memberAuditKeys.watchlist(orgId ?? '', query as Record<string, unknown> | undefined),
    queryFn: () => memberAuditService.listWatchlistEntries(orgId!, query),
    enabled: !!orgId,
  });
}

export function useCreateWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, dto }: { orgId: string; dto: CreateWatchlistEntryDto }) =>
      memberAuditService.createWatchlistEntry(orgId, dto),
    onSuccess: (_data, { orgId }) => {
      void qc.invalidateQueries({ queryKey: memberAuditKeys.watchlistList(orgId) });
    },
  });
}

export function useUpdateWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      entryId,
      dto,
    }: {
      orgId: string;
      entryId: string;
      dto: UpdateWatchlistEntryDto;
    }) => memberAuditService.updateWatchlistEntry(orgId, entryId, dto),
    onSuccess: (_data, { orgId }) => {
      void qc.invalidateQueries({ queryKey: memberAuditKeys.watchlistList(orgId) });
    },
  });
}

export function useDeleteWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, entryId }: { orgId: string; entryId: string }) =>
      memberAuditService.deleteWatchlistEntry(orgId, entryId),
    onSuccess: (_data, { orgId }) => {
      void qc.invalidateQueries({ queryKey: memberAuditKeys.watchlistList(orgId) });
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Member Profile                                                     */
/* ═══════════════════════════════════════════════════════════════════ */

export function useMemberProfile(orgId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: memberAuditKeys.profile(orgId ?? '', userId ?? ''),
    queryFn: () => memberAuditService.getMemberProfile(orgId!, userId!),
    enabled: !!orgId && !!userId,
  });
}
