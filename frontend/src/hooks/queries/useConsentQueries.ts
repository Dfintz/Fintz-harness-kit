/**
 * Consent Query Hooks
 *
 * TanStack Query hooks for GDPR consent management with automatic caching.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type { Consent, ConsentType } from '@/services/consentService';
import { consentService } from '@/services/consentService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { consentKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get all user consents
 */
export function useUserConsents() {
  return useQuery({
    queryKey: consentKeys.lists(),
    queryFn: () => consentService.getUserConsents(),
  });
}

/**
 * Hook to check a specific consent type
 */
export function useCheckConsent(consentType: ConsentType | undefined) {
  return useQuery({
    queryKey: consentKeys.check(consentType!),
    queryFn: () => consentService.checkConsent(consentType!),
    enabled: !!consentType,
  });
}

/**
 * Hook to check consent version status for a specific consent type
 */
export function useConsentVersion(consentType: ConsentType | undefined) {
  return useQuery({
    queryKey: consentKeys.version(consentType!),
    queryFn: () => consentService.checkConsentVersion(consentType!),
    enabled: !!consentType,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to record consent
 *
 * Uses optimistic updates so the toggle flips instantly.
 * Rolls back on error.
 */
export function useRecordConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      consentType,
      granted,
      purpose,
      version,
    }: {
      consentType: ConsentType;
      granted: boolean;
      purpose?: string;
      version?: string;
    }) => consentService.recordConsent(consentType, granted, purpose, version),
    onMutate: async ({ consentType, granted }) => {
      const key = consentKeys.lists();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Consent[]>(key);
      if (previous) {
        const exists = previous.some(c => c.type === consentType);
        const updated = exists
          ? previous.map(c =>
              c.type === consentType ? { ...c, granted, updatedAt: new Date().toISOString() } : c
            )
          : [
              ...previous,
              {
                type: consentType,
                granted,
                updatedAt: new Date().toISOString(),
              } as Consent,
            ];
        queryClient.setQueryData<Consent[]>(key, updated);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(consentKeys.lists(), context.previous);
      }
    },
    onSettled: () => {
      // Optimistic-rollback path: global meta.invalidates handler runs only on
      // success, so we invalidate manually here to cover the error/rollback case.
      // eslint-disable-next-line no-restricted-syntax -- onSettled covers rollback path; see /memories/repo/react-query-meta-invalidates.md
      queryClient.invalidateQueries({ queryKey: consentKeys.all });
    },
  });
}

/**
 * Hook to withdraw a specific consent
 *
 * Uses optimistic updates so the toggle flips instantly.
 * Rolls back on error.
 */
export function useWithdrawConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (consentType: ConsentType) => consentService.withdrawConsent(consentType),
    onMutate: async consentType => {
      const key = consentKeys.lists();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Consent[]>(key);
      if (previous) {
        queryClient.setQueryData<Consent[]>(
          key,
          previous.map(c =>
            c.type === consentType
              ? { ...c, granted: false, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(consentKeys.lists(), context.previous);
      }
    },
    onSettled: () => {
      // Optimistic-rollback path: global meta.invalidates handler runs only on
      // success, so we invalidate manually here to cover the error/rollback case.
      // eslint-disable-next-line no-restricted-syntax -- onSettled covers rollback path; see /memories/repo/react-query-meta-invalidates.md
      queryClient.invalidateQueries({ queryKey: consentKeys.all });
    },
  });
}

/**
 * Hook to withdraw all consents
 */
export function useWithdrawAllConsents() {
  return useMutation({
    mutationFn: () => consentService.withdrawAllConsents(),
    meta: { invalidates: [consentKeys.all] },
  });
}

/**
 * Hook to request data export
 */
export function useRequestDataExport() {
  return useMutation({
    mutationFn: () => consentService.requestDataExport(),
  });
}

/**
 * Hook to request account deletion
 */
export function useRequestAccountDeletion() {
  return useMutation({
    mutationFn: () => consentService.requestAccountDeletion(),
  });
}
