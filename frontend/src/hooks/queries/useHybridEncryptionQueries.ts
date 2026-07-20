/**
 * Hybrid Encryption Query Hooks
 *
 * TanStack Query hooks for hybrid DEK encryption operations including
 * public key management, DEK lifecycle, hybrid data storage, and
 * flat-to-hybrid migration.
 *
 * Phase 3-4: Hybrid Encryption Integration
 */

import type {
  DEKResponse,
  HybridEncryptedDataListItem,
  HybridEncryptedDataResponse,
  MigrationCandidateItem,
  MigrationProgressResponse,
  StoreHybridEncryptedDataInput,
} from '@/services/crypto/encryptionApiService';
import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { hybridEncryptionKeys } from './queryKeys';

// ============================================================================
// Public Key Hooks
// ============================================================================

/**
 * Hook to list all public keys for an organization
 */
export function usePublicKeys(organizationId: string | undefined) {
  return useQuery({
    queryKey: hybridEncryptionKeys.publicKeys(organizationId!),
    queryFn: () => encryptionApiService.getPublicKeys(organizationId!),
    enabled: !!organizationId,
    staleTime: 30 * 60 * 1000, // 30 min — public keys rarely change
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get a specific user's public key
 */
export function usePublicKey(organizationId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: hybridEncryptionKeys.publicKey(organizationId!, userId!),
    queryFn: () => encryptionApiService.getPublicKey(organizationId!, userId!),
    enabled: !!organizationId && !!userId,
    staleTime: 30 * 60 * 1000, // 30 min — rarely changes
    retry: false, // 404 is expected when user has no key registered
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to register a public key for the current user
 */
export function useRegisterPublicKey() {  return useMutation({
    mutationFn: ({
      organizationId,
      publicKey,
      keyFingerprint,
      keySize,
    }: {
      organizationId: string;
      publicKey: string;
      keyFingerprint: string;
      keySize?: number;
    }) =>
      encryptionApiService.registerPublicKey(organizationId, publicKey, keyFingerprint, keySize),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.publicKeys(variables.organizationId),],
    },
  });
}

/**
 * Hook to revoke a user's public key
 */
export function useRevokePublicKey() {  return useMutation({
    mutationFn: ({ organizationId, userId }: { organizationId: string; userId: string }) =>
      encryptionApiService.revokePublicKey(organizationId, userId),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.publicKeys(variables.organizationId),],
    },
  });
}

// ============================================================================
// DEK Hooks
// ============================================================================

/**
 * Hook to list all DEKs for an organization
 */
export function useDEKs(
  organizationId: string | undefined,
  params?: { dataType?: string; resourceId?: string },
  options?: Omit<UseQueryOptions<{ deks: DEKResponse[]; total: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: hybridEncryptionKeys.deks(organizationId!),
    queryFn: () => encryptionApiService.listDEKs(organizationId!, params),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Hook to get a specific DEK (with user's wrapped key)
 */
export function useDEK(organizationId: string | undefined, dekId: string | undefined) {
  return useQuery({
    queryKey: hybridEncryptionKeys.dek(organizationId!, dekId!),
    queryFn: () => encryptionApiService.getDEKForUser(organizationId!, dekId!),
    enabled: !!organizationId && !!dekId,
  });
}

/**
 * Hook to create a new DEK
 */
export function useCreateDEK() {  return useMutation({
    mutationFn: ({
      organizationId,
      dekId,
      dataType,
      resourceId,
      wrappedKeys,
    }: {
      organizationId: string;
      dekId: string;
      dataType: string;
      resourceId?: string;
      wrappedKeys: Record<string, string>;
    }) => encryptionApiService.createDEK(organizationId, dekId, dataType, wrappedKeys, resourceId),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.deks(variables.organizationId),],
    },
  });
}

/**
 * Hook to grant DEK access to a user
 */
export function useGrantDEKAccess() {  return useMutation({
    mutationFn: ({
      organizationId,
      dekId,
      userId,
      wrappedKey,
    }: {
      organizationId: string;
      dekId: string;
      userId: string;
      wrappedKey: string;
    }) => encryptionApiService.grantDEKAccess(organizationId, dekId, userId, wrappedKey),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.dek(variables.organizationId, variables.dekId),],
    },
  });
}

/**
 * Hook to revoke DEK access from a user
 */
export function useRevokeDEKAccess() {  return useMutation({
    mutationFn: ({
      organizationId,
      dekId,
      userId,
    }: {
      organizationId: string;
      dekId: string;
      userId: string;
    }) => encryptionApiService.revokeDEKAccess(organizationId, dekId, userId),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.dek(variables.organizationId, variables.dekId),],
    },
  });
}

// ============================================================================
// Hybrid Encrypted Data Hooks (Phase 3)
// ============================================================================

/**
 * Hook to store hybrid-encrypted data
 */
export function useStoreHybridEncryptedData() {  return useMutation({
    mutationFn: ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: StoreHybridEncryptedDataInput;
    }) => encryptionApiService.storeHybridEncryptedData(organizationId, data),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.hybridData(variables.organizationId),, hybridEncryptionKeys.hybridDataList(variables.organizationId),],
    },
  });
}

/**
 * Hook to get a specific hybrid-encrypted data item (with wrapped DEK)
 */
export function useHybridEncryptedData(
  organizationId: string | undefined,
  dataId: string | undefined,
  options?: Omit<UseQueryOptions<HybridEncryptedDataResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: hybridEncryptionKeys.hybridData(organizationId!, dataId),
    queryFn: () => encryptionApiService.getHybridEncryptedData(organizationId!, dataId!),
    enabled: !!organizationId && !!dataId,
    ...options,
  });
}

/**
 * Hook to list hybrid-encrypted data items
 */
export function useHybridEncryptedDataList(
  organizationId: string | undefined,
  params?: { dataType?: string; resourceId?: string; limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<{ data: HybridEncryptedDataListItem[]; total: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: hybridEncryptionKeys.hybridDataList(organizationId!, params),
    queryFn: () => encryptionApiService.listHybridEncryptedData(organizationId!, params),
    enabled: !!organizationId,
    ...options,
  });
}

// ============================================================================
// Migration Hooks (Phase 4)
// ============================================================================

/**
 * Hook to initiate flat-to-hybrid migration
 * Restricted to organization owners/admins
 */
export function useInitiateMigration() {  return useMutation({
    mutationFn: (organizationId: string) => encryptionApiService.initiateMigration(organizationId),
    meta: {
      invalidates: (_data, organizationId) => [hybridEncryptionKeys.migrationProgress(organizationId),, hybridEncryptionKeys.migrationCandidates(organizationId),],
    },
  });
}

/**
 * Hook to get migration candidates (batch of items to re-encrypt)
 */
export function useMigrationCandidates(
  organizationId: string | undefined,
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<{ data: MigrationCandidateItem[]; total: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: hybridEncryptionKeys.migrationCandidates(organizationId!),
    queryFn: () => encryptionApiService.getMigrationCandidates(organizationId!, params),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Hook to complete migration of a single item
 */
export function useCompleteMigrationItem() {  return useMutation({
    mutationFn: ({
      organizationId,
      dataId,
      dekId,
      encryptedData,
      encryptionMetadata,
    }: {
      organizationId: string;
      dataId: string;
      dekId: string;
      encryptedData: string;
      encryptionMetadata: { iv: string; authTag: string; algorithm: string; version: number };
    }) =>
      encryptionApiService.completeMigrationItem(organizationId, dataId, {
        dekId,
        encryptedData,
        encryptionMetadata,
      }),
    meta: {
      invalidates: (_data, variables) => [hybridEncryptionKeys.migrationProgress(variables.organizationId),, hybridEncryptionKeys.migrationCandidates(variables.organizationId),, hybridEncryptionKeys.hybridData(variables.organizationId),],
    },
  });
}

/**
 * Hook to get migration progress
 */
export function useMigrationProgress(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<MigrationProgressResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: hybridEncryptionKeys.migrationProgress(organizationId!),
    queryFn: () => encryptionApiService.getMigrationProgress(organizationId!),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 min — only changes during migration
    refetchOnWindowFocus: false,
    ...options,
  });
}
