/**
 * Tests for useHybridCrypto hook (Step D)
 */

import { useHybridCrypto } from '@/hooks/useHybridCrypto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEncryptionContext = {
  isUnlocked: true,
  hasKeyPair: true,
  orgKey: null,
  privateKey: 'mock-private-key' as unknown as CryptoKey | null,
  recipientKeys: new Map([['user-1', 'mock-pub' as unknown as CryptoKey]]),
  unlock: jest.fn(),
  lock: jest.fn(),
  storePrivateKey: jest.fn(),
  clearPrivateKey: jest.fn(),
  unlockError: null,
  isUnlocking: false,
};

jest.mock('@/components/encryption/EncryptionKeyProvider', () => ({
  useEncryptionKeys: () => mockEncryptionContext,
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}));

// Crypto function mocks
const mockHybridEncrypt = jest.fn();
const mockUnwrapDEK = jest.fn();
const mockDecryptData = jest.fn();

jest.mock('@/services/crypto/encryptionService', () => ({
  hybridEncrypt: (...args: unknown[]) => mockHybridEncrypt(...args),
  unwrapDEKWithPrivateKey: (...args: unknown[]) => mockUnwrapDEK(...args),
  decryptData: (...args: unknown[]) => mockDecryptData(...args),
}));

// API service mock
const mockGetHybridEncryptedData = jest.fn();
jest.mock('@/services/crypto/encryptionApiService', () => ({
  encryptionApiService: {
    getHybridEncryptedData: (...args: unknown[]) => mockGetHybridEncryptedData(...args),
  },
}));

// Mutation mocks
const mockCreateDEKMutate = jest.fn();
const mockStoreDataMutate = jest.fn();

jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  useCreateDEK: () => ({
    mutateAsync: mockCreateDEKMutate,
    isPending: false,
  }),
  useStoreHybridEncryptedData: () => ({
    mutateAsync: mockStoreDataMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-123';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockEncryptionContext.isUnlocked = true;
  mockEncryptionContext.privateKey = 'mock-private-key' as unknown as CryptoKey;
  mockEncryptionContext.recipientKeys = new Map([['user-1', 'mock-pub' as unknown as CryptoKey]]);
});

describe('useHybridCrypto', () => {
  describe('isReady', () => {
    it('should be true when vault unlocked, private key loaded, and recipients exist', () => {
      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });
      expect(result.current.isReady).toBe(true);
    });

    it('should be false when vault is locked', () => {
      mockEncryptionContext.isUnlocked = false;
      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });
      expect(result.current.isReady).toBe(false);
    });

    it('should be false when private key is missing', () => {
      mockEncryptionContext.privateKey = null;
      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });
      expect(result.current.isReady).toBe(false);
    });

    it('should be false when no recipient keys', () => {
      mockEncryptionContext.recipientKeys = new Map();
      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });
      expect(result.current.isReady).toBe(false);
    });
  });

  describe('encryptAndStore', () => {
    it('should encrypt plaintext, create DEK, and store data', async () => {
      mockHybridEncrypt.mockResolvedValue({
        encryptedData: { encrypted: 'cipher', iv: 'iv1', authTag: 'tag1', algorithm: 'AES-GCM' },
        dekId: 'dek-abc',
        wrappedDEKs: { 'user-1': 'wrapped-key' },
      });
      mockCreateDEKMutate.mockResolvedValue({ id: 'dek-row-1' });
      mockStoreDataMutate.mockResolvedValue({ id: 'data-1', dekId: 'dek-abc' });

      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });

      let stored: { id: string; dekId: string } | undefined;
      await act(async () => {
        stored = await result.current.encryptAndStore('secret text', 'secure-note');
      });

      expect(mockHybridEncrypt).toHaveBeenCalledWith(
        'secret text',
        mockEncryptionContext.recipientKeys
      );
      expect(mockCreateDEKMutate).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        dekId: 'dek-abc',
        dataType: 'secure-note',
        resourceId: undefined,
        wrappedKeys: { 'user-1': 'wrapped-key' },
      });
      expect(mockStoreDataMutate).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        data: {
          dekId: 'dek-abc',
          dataType: 'secure-note',
          resourceId: undefined,
          encryptedData: 'cipher',
          encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'AES-GCM' },
        },
      });
      expect(stored).toEqual({ id: 'data-1', dekId: 'dek-abc' });
    });

    it('should throw when vault is locked', async () => {
      mockEncryptionContext.isUnlocked = false;
      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });

      await expect(act(() => result.current.encryptAndStore('text', 'note'))).rejects.toThrow(
        'Encryption vault must be unlocked'
      );
    });
  });

  describe('fetchAndDecrypt', () => {
    it('should fetch data from server and decrypt', async () => {
      const serverResponse = {
        id: 'data-1',
        dekId: 'dek-abc',
        wrappedKey: 'wrapped-dek-base64',
        dataType: 'secure-note',
        encryptedData: 'cipher',
        encryptionMetadata: { iv: 'iv1', authTag: 'tag1', algorithm: 'AES-GCM' },
        encryptionMode: 'hybrid',
        createdAt: new Date(),
      };
      mockGetHybridEncryptedData.mockResolvedValue(serverResponse);
      mockUnwrapDEK.mockResolvedValue('mock-dek' as unknown as CryptoKey);
      mockDecryptData.mockResolvedValue('decrypted secret');

      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });

      let plaintext: string | undefined;
      await act(async () => {
        plaintext = await result.current.fetchAndDecrypt('data-1');
      });

      expect(mockGetHybridEncryptedData).toHaveBeenCalledWith(ORG_ID, 'data-1');
      expect(mockUnwrapDEK).toHaveBeenCalledWith(
        'wrapped-dek-base64',
        mockEncryptionContext.privateKey
      );
      expect(mockDecryptData).toHaveBeenCalledWith(
        { encrypted: 'cipher', iv: 'iv1', authTag: 'tag1', algorithm: 'AES-GCM' },
        'mock-dek'
      );
      expect(plaintext).toBe('decrypted secret');
    });
  });

  describe('decryptResponse', () => {
    it('should decrypt an already-fetched response', async () => {
      const response = {
        id: 'data-2',
        dekId: 'dek-xyz',
        wrappedKey: 'wrapped-key-b64',
        dataType: 'note',
        encryptedData: 'ciphertext',
        encryptionMetadata: { iv: 'iv2', authTag: 'tag2', algorithm: 'AES-GCM' },
        encryptionMode: 'hybrid',
        createdAt: new Date(),
      };
      mockUnwrapDEK.mockResolvedValue('dek-key' as unknown as CryptoKey);
      mockDecryptData.mockResolvedValue('hello world');

      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });

      let plaintext: string | undefined;
      await act(async () => {
        plaintext = await result.current.decryptResponse(response);
      });

      expect(mockUnwrapDEK).toHaveBeenCalledWith(
        'wrapped-key-b64',
        mockEncryptionContext.privateKey
      );
      expect(plaintext).toBe('hello world');
    });

    it('should throw when private key is missing', async () => {
      mockEncryptionContext.privateKey = null;
      const { result } = renderHook(() => useHybridCrypto(ORG_ID), { wrapper: createWrapper() });

      await expect(
        act(() =>
          result.current.decryptResponse({
            id: 'x',
            dekId: 'x',
            wrappedKey: 'x',
            dataType: 'x',
            encryptedData: 'x',
            encryptionMetadata: { iv: 'x', authTag: 'x', algorithm: 'x' },
            encryptionMode: 'hybrid',
            createdAt: new Date(),
          })
        )
      ).rejects.toThrow('Encryption vault must be unlocked');
    });
  });
});
