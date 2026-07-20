/**
 * Intel Vault Query Hooks — Phase 3
 *
 * TanStack Query hooks for intel vault operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import type {
  GetAuditLogsOptions,
  GetEntriesOptions,
  IntelAccessCheck,
  IntelAuditLog,
  IntelEntry,
  IntelOfficer,
} from '@/services/intelVaultService';
import { intelVaultService } from '@/services/intelVaultService';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { intelKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to check intel access for the current user in an organization
 */
export function useIntelAccess(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<IntelAccessCheck>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: intelKeys.access(orgId),
    queryFn: () => intelVaultService.checkAccess(orgId!),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to fetch intel entries for an organization
 */
export function useIntelEntries(
  orgId: string | undefined,
  entryOptions?: GetEntriesOptions,
  options?: Omit<UseQueryOptions<{ entries: IntelEntry[]; total: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: intelKeys.list({ orgId, ...entryOptions }),
    queryFn: () => intelVaultService.getEntries(orgId!, entryOptions),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to fetch a single intel entry
 */
export function useIntelEntry(
  orgId: string | undefined,
  entryId: string | undefined,
  options?: Omit<UseQueryOptions<IntelEntry>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: intelKeys.detail(entryId!),
    queryFn: () => intelVaultService.getEntry(orgId!, entryId!),
    enabled: !!orgId && !!entryId,
    ...options,
  });
}

/**
 * Hook to fetch intel officers for an organization
 */
export function useIntelOfficers(
  orgId: string | undefined,
  officerOptions?: { includeInactive?: boolean; rank?: string },
  options?: Omit<UseQueryOptions<IntelOfficer[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: intelKeys.officers(orgId),
    queryFn: () => intelVaultService.getOfficers(orgId!, officerOptions),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to fetch a single intel officer
 */
export function useIntelOfficer(
  orgId: string | undefined,
  officerId: string | undefined,
  options?: Omit<UseQueryOptions<IntelOfficer>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: intelKeys.officer(officerId!),
    queryFn: () => intelVaultService.getOfficer(orgId!, officerId!),
    enabled: !!orgId && !!officerId,
    ...options,
  });
}

/**
 * Hook to fetch intel audit logs
 */
export function useIntelAuditLogs(
  orgId: string | undefined,
  logOptions?: GetAuditLogsOptions,
  options?: Omit<UseQueryOptions<{ logs: IntelAuditLog[]; total: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: intelKeys.auditLogs(orgId),
    queryFn: () => intelVaultService.getAuditLogs(orgId!, logOptions),
    enabled: !!orgId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new intel entry
 */
export function useCreateIntelEntry(orgId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof intelVaultService.createEntry>[1]) =>
      intelVaultService.createEntry(orgId, data),
    meta: { invalidates: [intelKeys.lists(), intelKeys.auditLogs(orgId)] },
  });
}

/**
 * Hook to update an intel entry
 */
export function useUpdateIntelEntry(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entryId,
      data,
    }: {
      entryId: string;
      data: Parameters<typeof intelVaultService.updateEntry>[2];
    }) => intelVaultService.updateEntry(orgId, entryId, data),
    onSuccess: (_result, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: intelKeys.detail(entryId) });
      queryClient.invalidateQueries({ queryKey: intelKeys.lists() });
      queryClient.invalidateQueries({ queryKey: intelKeys.auditLogs(orgId) });
    },
  });
}

/**
 * Hook to delete an intel entry
 */
export function useDeleteIntelEntry(orgId: string) {
  return useMutation({
    mutationFn: (entryId: string) => intelVaultService.deleteEntry(orgId, entryId),
    meta: { invalidates: [intelKeys.lists(), intelKeys.auditLogs(orgId)] },
  });
}

/**
 * Hook to appoint an intel officer
 */
export function useAppointIntelOfficer(orgId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof intelVaultService.appointOfficer>[1]) =>
      intelVaultService.appointOfficer(orgId, data),
    meta: { invalidates: [intelKeys.officers(orgId), intelKeys.auditLogs(orgId)] },
  });
}

/**
 * Hook to update an intel officer
 */
export function useUpdateIntelOfficer(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      officerId,
      data,
    }: {
      officerId: string;
      data: Parameters<typeof intelVaultService.updateOfficer>[2];
    }) => intelVaultService.updateOfficer(orgId, officerId, data),
    onSuccess: (_result, { officerId }) => {
      queryClient.invalidateQueries({ queryKey: intelKeys.officer(officerId) });
      queryClient.invalidateQueries({ queryKey: intelKeys.officers(orgId) });
      queryClient.invalidateQueries({ queryKey: intelKeys.auditLogs(orgId) });
    },
  });
}

/**
 * Hook to remove an intel officer
 */
export function useRemoveIntelOfficer(orgId: string) {
  return useMutation({
    mutationFn: ({ officerId, reason }: { officerId: string; reason?: string }) =>
      intelVaultService.removeOfficer(orgId, officerId, reason),
    meta: { invalidates: [intelKeys.officers(orgId), intelKeys.auditLogs(orgId)] },
  });
}
