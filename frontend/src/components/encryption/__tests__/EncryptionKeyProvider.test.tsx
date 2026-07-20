/**
 * Tests for EncryptionKeyProvider (Step A - Zero Knowledge)
 *
 * Tests the React context that manages unlocked encryption keys for the
 * hybrid DEK model: org master key, RSA private key, and recipient keys.
 */

import {
    EncryptionKeyProvider,
    useEncryptionKeys,
} from '@/components/encryption/EncryptionKeyProvider';
import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import * as cryptoEncryptionService from '@/services/crypto/encryptionService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/services/crypto/encryptionApiService');
jest.mock('@/services/crypto/encryptionService');
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));
jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  usePublicKeys: jest.fn().mockReturnValue({ data: undefined }),
}));

const mockedApiService = encryptionApiService as jest.Mocked<typeof encryptionApiService>;
const mockedCrypto = cryptoEncryptionService as jest.Mocked<typeof cryptoEncryptionService>;

// Import after mocking
import { usePublicKeys } from '@/hooks/queries/useHybridEncryptionQueries';
import { useAuthStore } from '@/store/authStore';

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedUsePublicKeys = usePublicKeys as jest.Mock;

// Mock IndexedDB
const mockIDBStore: Record<string, string> = {};
const mockObjectStore = {
  get: jest.fn((key: string) => {
    const req = {
      result: mockIDBStore[key] ?? undefined,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
    };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }),
  put: jest.fn((value: string, key: string) => {
    mockIDBStore[key] = value;
    const req = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
    };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }),
  delete: jest.fn((key: string) => {
    delete mockIDBStore[key];
    const req = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
    };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }),
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore),
};

const mockDB = {
  transaction: jest.fn(() => mockTransaction),
  objectStoreNames: { contains: jest.fn(() => true) },
  createObjectStore: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).indexedDB = {
  open: jest.fn(() => {
    const req = {
      result: mockDB,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
    };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }),
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-123';
const USER_ID = 'user-test-456';

const mockWrappedKey = JSON.stringify({
  encryptedKey: 'base64-enc-key',
  iv: 'base64-iv',
  salt: 'base64-salt',
  iterations: 100000,
});

const mockKeyWrapperResponse = {
  keyId: 'key-1',
  wrappedKey: mockWrappedKey,
  algorithm: 'AES-256-GCM',
};

const fakeOrgCryptoKey = {} as CryptoKey;
const fakePrivateCryptoKey = {} as CryptoKey;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(overrides?: {
  organizationId?: string;
  idleTimeoutMs?: number;
  skipCacheSeed?: boolean;
}) {
  const queryClient = createQueryClient();
  const orgId = overrides?.organizationId ?? ORG_ID;
  const idleMs = overrides?.idleTimeoutMs;

  // Pre-populate query cache so useQuery has data immediately (avoids async race)
  if (!overrides?.skipCacheSeed) {
    queryClient.setQueryData(['encryption', 'key', orgId], mockKeyWrapperResponse);
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    const providerProps = {
      organizationId: orgId,
      ...(idleMs !== undefined ? { idleTimeoutMs: idleMs } : {}),
    };
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(EncryptionKeyProvider, providerProps as any, children)
    );
  }
  return Wrapper;
}

function setupAuthMock(user: { id: string } | null = { id: USER_ID }) {
  mockedUseAuthStore.mockImplementation((selector: (state: { user: typeof user }) => unknown) =>
    selector({ user })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default auth: logged in
  setupAuthMock();

  // Default: no public keys
  mockedUsePublicKeys.mockReturnValue({ data: undefined });

  // Default: key wrapper from server
  mockedApiService.getKeyWrapper.mockResolvedValue(mockKeyWrapperResponse);

  // Default: crypto stubs
  mockedCrypto.parseKeyWrapper.mockReturnValue(JSON.parse(mockWrappedKey));
  mockedCrypto.unwrapKeyWithPassword.mockResolvedValue(fakeOrgCryptoKey);
  mockedCrypto.importPrivateKey.mockResolvedValue(fakePrivateCryptoKey);
  mockedCrypto.exportPrivateKey.mockResolvedValue('exported-pk-base64');
  mockedCrypto.importPublicKey.mockResolvedValue({} as CryptoKey);

  // Clean IDB mock
  Object.keys(mockIDBStore).forEach(k => delete mockIDBStore[k]);
});

afterEach(() => {
  // noop
});

describe('EncryptionKeyProvider', () => {
  describe('useEncryptionKeys outside provider', () => {
    it('should throw when used outside provider', () => {
      const queryClient = createQueryClient();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() =>
        renderHook(() => useEncryptionKeys(), {
          wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children),
        })
      ).toThrow('useEncryptionKeys must be used within an EncryptionKeyProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('initial state', () => {
    it('should start with locked state', () => {
      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      expect(result.current.isUnlocked).toBe(false);
      expect(result.current.orgKey).toBeNull();
      expect(result.current.privateKey).toBeNull();
      expect(result.current.unlockError).toBeNull();
      expect(result.current.isUnlocking).toBe(false);
    });

    it('should provide empty recipient keys by default', () => {
      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      expect(result.current.recipientKeys).toBeInstanceOf(Map);
      expect(result.current.recipientKeys.size).toBe(0);
    });
  });

  describe('unlock', () => {
    it('should unwrap org key and set isUnlocked', async () => {
      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      // Wait for initial mount effects to settle
      await waitFor(() => expect(result.current).not.toBeNull());

      await act(async () => {
        await result.current.unlock('my-password');
      });

      expect(mockedCrypto.unwrapKeyWithPassword).toHaveBeenCalledWith(
        JSON.parse(mockWrappedKey),
        'my-password'
      );
      expect(result.current.isUnlocked).toBe(true);
      expect(result.current.orgKey).toBe(fakeOrgCryptoKey);
    });

    it('should load RSA private key from IndexedDB when available', async () => {
      // Pre-populate IDB
      mockIDBStore[USER_ID] = 'stored-private-key-base64';

      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      await act(async () => {
        await result.current.unlock('my-password');
      });

      expect(mockedCrypto.importPrivateKey).toHaveBeenCalledWith('stored-private-key-base64');
      expect(result.current.privateKey).toBe(fakePrivateCryptoKey);
      expect(result.current.hasKeyPair).toBe(true);
    });

    it('should set error when user not authenticated', async () => {
      setupAuthMock(null);

      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      await act(async () => {
        await result.current.unlock('password');
      });

      expect(result.current.unlockError).toBe('Not authenticated');
      expect(result.current.isUnlocked).toBe(false);
    });

    it('should set error when unwrap fails', async () => {
      mockedCrypto.unwrapKeyWithPassword.mockRejectedValue(new Error('Wrong password'));

      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      await act(async () => {
        await result.current.unlock('wrong-password');
      });

      expect(result.current.unlockError).toBe('Wrong password');
      expect(result.current.isUnlocked).toBe(false);
      expect(result.current.orgKey).toBeNull();
    });
  });

  describe('lock', () => {
    it('should clear all keys from memory', async () => {
      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      // First unlock
      await act(async () => {
        await result.current.unlock('my-password');
      });

      expect(result.current.isUnlocked).toBe(true);

      // Then lock
      act(() => {
        result.current.lock();
      });

      expect(result.current.isUnlocked).toBe(false);
      expect(result.current.orgKey).toBeNull();
      expect(result.current.privateKey).toBeNull();
      expect(result.current.unlockError).toBeNull();
    });
  });

  describe('storePrivateKey', () => {
    it('should export and save private key to IndexedDB', async () => {
      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      const testKey = {} as CryptoKey;

      await act(async () => {
        await result.current.storePrivateKey(testKey);
      });

      expect(mockedCrypto.exportPrivateKey).toHaveBeenCalledWith(testKey);
      expect(mockIDBStore[USER_ID]).toBe('exported-pk-base64');
      expect(result.current.privateKey).toBe(testKey);
      expect(result.current.hasKeyPair).toBe(true);
    });
  });

  describe('clearPrivateKey', () => {
    it('should remove private key from IndexedDB', async () => {
      // Pre-populate
      mockIDBStore[USER_ID] = 'some-key';

      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      await act(async () => {
        await result.current.clearPrivateKey();
      });

      expect(mockIDBStore[USER_ID]).toBeUndefined();
      expect(result.current.privateKey).toBeNull();
      expect(result.current.hasKeyPair).toBe(false);
    });
  });

  describe('recipient keys', () => {
    it('should import public keys when data arrives', async () => {
      const mockPublicKeyData = [
        { userId: 'user-a', publicKey: 'pk-a', isActive: true },
        { userId: 'user-b', publicKey: 'pk-b', isActive: true },
        { userId: 'user-c', publicKey: null, isActive: true },
        { userId: 'user-d', publicKey: 'pk-d', isActive: false },
      ];

      const cryptoKeyA = { algorithm: { name: 'A' } } as CryptoKey;
      const cryptoKeyB = { algorithm: { name: 'B' } } as CryptoKey;

      mockedCrypto.importPublicKey.mockImplementation(async (key: string) => {
        if (key === 'pk-a') return cryptoKeyA;
        if (key === 'pk-b') return cryptoKeyB;
        throw new Error('Unknown key');
      });

      mockedUsePublicKeys.mockReturnValue({ data: mockPublicKeyData });

      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.recipientKeys.size).toBe(2);
      });

      expect(result.current.recipientKeys.get('user-a')).toBe(cryptoKeyA);
      expect(result.current.recipientKeys.get('user-b')).toBe(cryptoKeyB);
      // Inactive and null-key entries should be skipped
      expect(result.current.recipientKeys.has('user-c')).toBe(false);
      expect(result.current.recipientKeys.has('user-d')).toBe(false);
    });
  });

  describe('user logout', () => {
    it('should lock when user becomes null', async () => {
      const { result, rerender } = renderHook(() => useEncryptionKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).not.toBeNull());

      // Unlock first
      await act(async () => {
        await result.current.unlock('password');
      });

      expect(result.current.isUnlocked).toBe(true);

      // Simulate logout
      setupAuthMock(null);
      rerender();

      await waitFor(() => {
        expect(result.current.isUnlocked).toBe(false);
      });

      expect(result.current.orgKey).toBeNull();
    });
  });

  describe('hasKeyPair detection', () => {
    it('should detect existing key pair in IndexedDB on mount', async () => {
      mockIDBStore[USER_ID] = 'existing-pk';

      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.hasKeyPair).toBe(true);
      });
    });

    it('should report no key pair when IDB is empty', async () => {
      const { result } = renderHook(() => useEncryptionKeys(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).not.toBeNull());

      // hasKeyPair starts false and stays false since IDB is empty
      expect(result.current.hasKeyPair).toBe(false);
    });
  });
});
