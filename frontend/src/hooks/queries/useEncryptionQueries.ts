/**
 * Encryption Query Hooks
 *
 * TanStack Query hooks for organization encryption management with automatic
 * caching and background refetching.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import type { ShareKeyRequest, StoreEncryptedDataRequest } from '@/services/encryptionService';
import { encryptionService } from '@/services/encryptionService';
import { useMutation, useQuery } from '@tanstack/react-query';
import { encryptionKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get encryption status for an organization
 */
export function useEncryptionStatus(organizationId: string | undefined) {
  return useQuery({
    queryKey: encryptionKeys.status(organizationId!),
    queryFn: () => encryptionService.getEncryptionStatus(organizationId!),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 min — status rarely changes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get the encryption key wrapper
 */
export function useEncryptionKey(organizationId: string | undefined) {
  return useQuery({
    queryKey: encryptionKeys.key(organizationId!),
    queryFn: () => encryptionService.getKeyWrapper(organizationId!),
    enabled: !!organizationId,
    staleTime: 30 * 60 * 1000, // 30 min — key wrapper changes only on rotation
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get encryption audit log
 */
export function useEncryptionAuditLog(organizationId: string | undefined) {
  return useQuery({
    queryKey: encryptionKeys.auditLog(organizationId!),
    queryFn: () => encryptionApiService.getAuditLog(organizationId!),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 min — audit log doesn't need frequent refresh
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get pending re-encryption items
 */
export function usePendingReEncryption(organizationId: string | undefined) {
  return useQuery({
    queryKey: encryptionKeys.pendingReEncryption(organizationId!),
    queryFn: () => encryptionService.getPendingReEncryption(organizationId!),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 min — only changes during active re-encryption
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get re-encryption progress
 */
export function useReEncryptionProgress(organizationId: string | undefined) {
  return useQuery({
    queryKey: encryptionKeys.reEncryptionProgress(organizationId!),
    queryFn: () => encryptionService.getReEncryptionProgress(organizationId!),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 min — only changes during active re-encryption
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get encrypted data by ID
 */
export function useEncryptedData(organizationId: string | undefined, dataId: string | undefined) {
  return useQuery({
    queryKey: encryptionKeys.data(organizationId!, dataId),
    queryFn: () => encryptionService.getEncryptedData(organizationId!, dataId!),
    enabled: !!organizationId && !!dataId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to initialize encryption for an org
 */
export function useInitializeEncryption() {  return useMutation({
    mutationFn: (organizationId: string) => encryptionService.initializeEncryption(organizationId),
    meta: {
      invalidates: (_data, organizationId) => [encryptionKeys.status(organizationId),],
    },
  });
}

/**
 * Hook to share encryption key with a user
 */
export function useShareKey() {  return useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: ShareKeyRequest }) =>
      encryptionService.shareKey(organizationId, data),
    meta: {
      invalidates: (_data, variables) => [encryptionKeys.status(variables.organizationId),],
    },
  });
}

/**
 * Hook to revoke key access for a user
 */
export function useRevokeKeyAccess() {  return useMutation({
    mutationFn: ({ organizationId, userId }: { organizationId: string; userId: string }) =>
      encryptionService.revokeKeyAccess(organizationId, userId),
    meta: {
      invalidates: (_data, variables) => [encryptionKeys.status(variables.organizationId),],
    },
  });
}

/**
 * Hook to rotate encryption key
 */
export function useRotateKey() {  return useMutation({
    mutationFn: (organizationId: string) => encryptionService.rotateKey(organizationId),
    meta: {
      invalidates: (_data, organizationId) => [encryptionKeys.key(organizationId),, encryptionKeys.pendingReEncryption(organizationId),],
    },
  });
}

/**
 * Hook to disable encryption
 */
export function useDisableEncryption() {  return useMutation({
    mutationFn: (organizationId: string) => encryptionService.disableEncryption(organizationId),
    meta: {
      invalidates: (_data, organizationId) => [encryptionKeys.status(organizationId),],
    },
  });
}

/**
 * Hook to store encrypted data
 */
export function useStoreEncryptedData() {  return useMutation({
    mutationFn: ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: StoreEncryptedDataRequest;
    }) => encryptionService.storeEncryptedData(organizationId, data),
    meta: {
      invalidates: (_data, variables) => [encryptionKeys.data(variables.organizationId),],
    },
  });
}

/**
 * Hook to delete encrypted data
 */
export function useDeleteEncryptedData() {  return useMutation({
    mutationFn: ({ organizationId, dataId }: { organizationId: string; dataId: string }) =>
      encryptionService.deleteEncryptedData(organizationId, dataId),
    meta: {
      invalidates: (_data, variables) => [encryptionKeys.data(variables.organizationId),],
    },
  });
}
