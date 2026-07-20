/**
 * Tests for Hybrid Encryption Query Hooks (Phase 3-4)
 *
 * Tests query hooks for public keys, DEKs, hybrid encrypted data,
 * and flat-to-hybrid migration operations.
 */

import {
  useCompleteMigrationItem,
  useCreateDEK,
  useDEK,
  useDEKs,
  useGrantDEKAccess,
  useHybridEncryptedData,
  useHybridEncryptedDataList,
  useInitiateMigration,
  useMigrationCandidates,
  useMigrationProgress,
  usePublicKey,
  usePublicKeys,
  useRegisterPublicKey,
  useRevokeDEKAccess,
  useRevokePublicKey,
  useStoreHybridEncryptedData,
} from '@/hooks/queries/useHybridEncryptionQueries';
import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

jest.mock('../../../services/crypto/encryptionApiService');

const mockedService = encryptionApiService as jest.Mocked<typeof encryptionApiService>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
};

// ============================================================================
// Shared mock data
// ============================================================================

const mockPublicKeys = [
  { userId: 'user-1', publicKey: 'pk-1', keyFingerprint: 'fp-1', keySize: 2048 },
  { userId: 'user-2', publicKey: 'pk-2', keyFingerprint: 'fp-2', keySize: 4096 },
];

const mockDEK = {
  dekId: 'dek-1',
  organizationId: 'org-1',
  dataType: 'document',
  resourceId: 'res-1',
  wrappedKey: 'wrapped-key-data',
  createdAt: '2025-01-01',
};

const mockHybridData = {
  id: 'data-1',
  dekId: 'dek-1',
  encryptedData: 'encrypted',
  encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'aes-256-gcm', version: 1 },
  wrappedDEK: 'wrapped-dek',
};

const mockProgress = {
  totalItems: 10,
  pendingItems: 3,
  migratedItems: 5,
  flatItems: 2,
  percentComplete: 80,
};

// ============================================================================

describe('Hybrid Encryption Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Public Key Hooks
  // ==========================================================================

  describe('usePublicKeys', () => {
    it('fetches public keys for an organization', async () => {
      mockedService.getPublicKeys = jest.fn().mockResolvedValue(mockPublicKeys);

      const { result } = renderHook(() => usePublicKeys('org-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockPublicKeys);
      expect(mockedService.getPublicKeys).toHaveBeenCalledWith('org-1');
    });

    it('is disabled when organizationId is undefined', () => {
      const { result } = renderHook(() => usePublicKeys(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockedService.getPublicKeys).not.toHaveBeenCalled();
    });
  });

  describe('usePublicKey', () => {
    it('fetches a specific user public key', async () => {
      mockedService.getPublicKey = jest.fn().mockResolvedValue(mockPublicKeys[0]);

      const { result } = renderHook(() => usePublicKey('org-1', 'user-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockPublicKeys[0]);
      expect(mockedService.getPublicKey).toHaveBeenCalledWith('org-1', 'user-1');
    });

    it('is disabled when userId is undefined', () => {
      const { result } = renderHook(() => usePublicKey('org-1', undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useRegisterPublicKey', () => {
    it('registers a public key and invalidates cache', async () => {
      mockedService.registerPublicKey = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useRegisterPublicKey(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-1',
          publicKey: 'pk-new',
          keyFingerprint: 'fp-new',
          keySize: 2048,
        });
      });

      expect(mockedService.registerPublicKey).toHaveBeenCalledWith(
        'org-1',
        'pk-new',
        'fp-new',
        2048
      );
    });
  });

  describe('useRevokePublicKey', () => {
    it('revokes a public key', async () => {
      mockedService.revokePublicKey = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useRevokePublicKey(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ organizationId: 'org-1', userId: 'user-1' });
      });

      expect(mockedService.revokePublicKey).toHaveBeenCalledWith('org-1', 'user-1');
    });
  });

  // ==========================================================================
  // DEK Hooks
  // ==========================================================================

  describe('useDEKs', () => {
    it('fetches DEKs for an organization', async () => {
      const mockResponse = { deks: [mockDEK], total: 1 };
      mockedService.listDEKs = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDEKs('org-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockedService.listDEKs).toHaveBeenCalledWith('org-1', undefined);
    });

    it('passes filter params through', async () => {
      mockedService.listDEKs = jest.fn().mockResolvedValue({ deks: [], total: 0 });

      const { result } = renderHook(() => useDEKs('org-1', { dataType: 'document' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedService.listDEKs).toHaveBeenCalledWith('org-1', { dataType: 'document' });
    });
  });

  describe('useDEK', () => {
    it('fetches a specific DEK with wrapped key', async () => {
      mockedService.getDEKForUser = jest.fn().mockResolvedValue(mockDEK);

      const { result } = renderHook(() => useDEK('org-1', 'dek-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDEK);
      expect(mockedService.getDEKForUser).toHaveBeenCalledWith('org-1', 'dek-1');
    });

    it('is disabled when dekId is undefined', () => {
      const { result } = renderHook(() => useDEK('org-1', undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateDEK', () => {
    it('creates a DEK with correct parameter order', async () => {
      mockedService.createDEK = jest.fn().mockResolvedValue({ dekId: 'dek-new' });

      const { result } = renderHook(() => useCreateDEK(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-1',
          dekId: 'dek-new',
          dataType: 'document',
          resourceId: 'res-1',
          wrappedKeys: { 'user-1': 'wrapped-1' },
        });
      });

      expect(mockedService.createDEK).toHaveBeenCalledWith(
        'org-1',
        'dek-new',
        'document',
        { 'user-1': 'wrapped-1' },
        'res-1'
      );
    });
  });

  describe('useGrantDEKAccess', () => {
    it('grants DEK access to a user', async () => {
      mockedService.grantDEKAccess = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useGrantDEKAccess(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-1',
          dekId: 'dek-1',
          userId: 'user-2',
          wrappedKey: 'wrapped-for-user2',
        });
      });

      expect(mockedService.grantDEKAccess).toHaveBeenCalledWith(
        'org-1',
        'dek-1',
        'user-2',
        'wrapped-for-user2'
      );
    });
  });

  describe('useRevokeDEKAccess', () => {
    it('revokes DEK access from a user', async () => {
      mockedService.revokeDEKAccess = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useRevokeDEKAccess(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-1',
          dekId: 'dek-1',
          userId: 'user-2',
        });
      });

      expect(mockedService.revokeDEKAccess).toHaveBeenCalledWith('org-1', 'dek-1', 'user-2');
    });
  });

  // ==========================================================================
  // Hybrid Encrypted Data Hooks
  // ==========================================================================

  describe('useStoreHybridEncryptedData', () => {
    it('stores hybrid encrypted data and invalidates caches', async () => {
      mockedService.storeHybridEncryptedData = jest.fn().mockResolvedValue({ id: 'data-new' });

      const { result } = renderHook(() => useStoreHybridEncryptedData(), {
        wrapper: createWrapper(),
      });

      const input = {
        dekId: 'dek-1',
        dataType: 'document',
        resourceId: 'res-1',
        encryptedData: 'ciphertext',
        encryptionMetadata: { iv: 'iv', authTag: 'tag', algorithm: 'aes-256-gcm', version: 1 },
      };

      await act(async () => {
        await result.current.mutateAsync({ organizationId: 'org-1', data: input });
      });

      expect(mockedService.storeHybridEncryptedData).toHaveBeenCalledWith('org-1', input);
    });
  });

  describe('useHybridEncryptedData', () => {
    it('fetches a specific hybrid encrypted data item', async () => {
      mockedService.getHybridEncryptedData = jest.fn().mockResolvedValue(mockHybridData);

      const { result } = renderHook(() => useHybridEncryptedData('org-1', 'data-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockHybridData);
      expect(mockedService.getHybridEncryptedData).toHaveBeenCalledWith('org-1', 'data-1');
    });

    it('is disabled when dataId is undefined', () => {
      const { result } = renderHook(() => useHybridEncryptedData('org-1', undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useHybridEncryptedDataList', () => {
    it('fetches a paginated list of hybrid encrypted data', async () => {
      const mockList = { data: [{ id: 'item-1' }, { id: 'item-2' }], total: 2 };
      mockedService.listHybridEncryptedData = jest.fn().mockResolvedValue(mockList);

      const { result } = renderHook(
        () => useHybridEncryptedDataList('org-1', { dataType: 'document' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockList);
      expect(mockedService.listHybridEncryptedData).toHaveBeenCalledWith('org-1', {
        dataType: 'document',
      });
    });
  });

  // ==========================================================================
  // Migration Hooks
  // ==========================================================================

  describe('useInitiateMigration', () => {
    it('initiates migration for an organization', async () => {
      mockedService.initiateMigration = jest.fn().mockResolvedValue({ initiated: true });

      const { result } = renderHook(() => useInitiateMigration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('org-1');
      });

      expect(mockedService.initiateMigration).toHaveBeenCalledWith('org-1');
    });

    it('propagates service errors', async () => {
      mockedService.initiateMigration = jest.fn().mockRejectedValue(new Error('Not authorized'));

      const { result } = renderHook(() => useInitiateMigration(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('org-1');
        })
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('useMigrationCandidates', () => {
    it('fetches candidates with pagination params', async () => {
      const mockCandidates = {
        data: [{ id: 'c-1', dataType: 'doc', migrationStatus: 'pending' }],
        total: 1,
      };
      mockedService.getMigrationCandidates = jest.fn().mockResolvedValue(mockCandidates);

      const { result } = renderHook(() => useMigrationCandidates('org-1', { limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCandidates);
      expect(mockedService.getMigrationCandidates).toHaveBeenCalledWith('org-1', { limit: 20 });
    });
  });

  describe('useCompleteMigrationItem', () => {
    it('completes a migration item with re-encrypted data', async () => {
      mockedService.completeMigrationItem = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCompleteMigrationItem(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-1',
          dataId: 'data-1',
          dekId: 'dek-1',
          encryptedData: 're-encrypted',
          encryptionMetadata: {
            iv: 'new-iv',
            authTag: 'new-tag',
            algorithm: 'aes-256-gcm',
            version: 1,
          },
        });
      });

      expect(mockedService.completeMigrationItem).toHaveBeenCalledWith('org-1', 'data-1', {
        dekId: 'dek-1',
        encryptedData: 're-encrypted',
        encryptionMetadata: {
          iv: 'new-iv',
          authTag: 'new-tag',
          algorithm: 'aes-256-gcm',
          version: 1,
        },
      });
    });
  });

  describe('useMigrationProgress', () => {
    it('fetches migration progress', async () => {
      mockedService.getMigrationProgress = jest.fn().mockResolvedValue(mockProgress);

      const { result } = renderHook(() => useMigrationProgress('org-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProgress);
      expect(mockedService.getMigrationProgress).toHaveBeenCalledWith('org-1');
    });

    it('is disabled when organizationId is undefined', () => {
      const { result } = renderHook(() => useMigrationProgress(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
