/**
 * Tests for KeyPairManager (Step B - Key Pair Registration UI)
 */

import { KeyPairManager } from '@/components/encryption/KeyPairManager';
import * as cryptoEncryptionService from '@/services/crypto/encryptionService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/services/crypto/encryptionService');
jest.mock('@/services/crypto/encryptionApiService');

// Mock the EncryptionKeyProvider context
const mockEncryptionContext = {
  isUnlocked: true,
  hasKeyPair: false,
  orgKey: null,
  privateKey: null,
  recipientKeys: new Map(),
  unlock: jest.fn(),
  lock: jest.fn(),
  storePrivateKey: jest.fn().mockResolvedValue(undefined),
  clearPrivateKey: jest.fn().mockResolvedValue(undefined),
  unlockError: null,
  isUnlocking: false,
};

jest.mock('@/components/encryption/EncryptionKeyProvider', () => ({
  useEncryptionKeys: () => mockEncryptionContext,
}));

const mockNotification = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

jest.mock('@/store/uiStore', () => ({
  useNotification: () => mockNotification,
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// Mock the hybrid encryption query hooks
const mockRegisterPublicKey = {
  mutateAsync: jest.fn().mockResolvedValue({ success: true }),
  isPending: false,
};

const mockRevokePublicKey = {
  mutateAsync: jest.fn().mockResolvedValue({ success: true }),
  isPending: false,
};

let mockPublicKeyData: {
  data: { publicKey: string; isActive: boolean; keyFingerprint: string } | undefined;
  isLoading: boolean;
} = {
  data: undefined,
  isLoading: false,
};

jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  usePublicKey: () => mockPublicKeyData,
  useRegisterPublicKey: () => mockRegisterPublicKey,
  useRevokePublicKey: () => mockRevokePublicKey,
}));

const mockedCrypto = cryptoEncryptionService as jest.Mocked<typeof cryptoEncryptionService>;

import { useAuthStore } from '@/store/authStore';

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-123';
const USER_ID = 'user-test-456';

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <KeyPairManager organizationId={ORG_ID} />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockNotification.success.mockReset();
  mockNotification.error.mockReset();
  mockNotification.info.mockReset();
  mockNotification.warning.mockReset();

  // Default: logged-in user
  mockedUseAuthStore.mockImplementation(
    (selector: (state: { user: { id: string } | null }) => unknown) =>
      selector({ user: { id: USER_ID } })
  );

  // Default: unlocked, no key pair
  mockEncryptionContext.isUnlocked = true;
  mockEncryptionContext.hasKeyPair = false;
  mockEncryptionContext.storePrivateKey = jest.fn().mockResolvedValue(undefined);
  mockEncryptionContext.clearPrivateKey = jest.fn().mockResolvedValue(undefined);

  // Default: no server key
  mockPublicKeyData = { data: undefined, isLoading: false };

  // Default: crypto stubs
  mockedCrypto.generateUserKeyPair.mockResolvedValue({
    publicKey: {} as CryptoKey,
    privateKey: {} as CryptoKey,
    publicKeyBase64: 'mock-public-key-base64',
    keyFingerprint: 'abcdef1234567890',
  });

  // Default: mutation mocks
  mockRegisterPublicKey.mutateAsync = jest.fn().mockResolvedValue({ success: true });
  mockRevokePublicKey.mutateAsync = jest.fn().mockResolvedValue({ success: true });
});

describe('KeyPairManager', () => {
  describe('loading state', () => {
    it('should show loading spinner when checking key status', () => {
      mockPublicKeyData = { data: undefined, isLoading: true };

      renderComponent();

      expect(screen.getByText('Checking key pair status...')).toBeInTheDocument();
    });
  });

  describe('no key pair', () => {
    it('should show Generate Key Pair button', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /Generate Key Pair/i })).toBeInTheDocument();
    });

    it('should show warning chips for missing keys', () => {
      renderComponent();

      expect(screen.getByText('No Public Key')).toBeInTheDocument();
      expect(screen.getByText('No Private Key')).toBeInTheDocument();
    });
  });

  describe('key pair generation', () => {
    it('should generate key pair, store private key, and register public key', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /Generate Key Pair/i }));

      await waitFor(() => {
        expect(mockedCrypto.generateUserKeyPair).toHaveBeenCalled();
      });

      expect(mockEncryptionContext.storePrivateKey).toHaveBeenCalledWith(expect.any(Object));
      expect(mockRegisterPublicKey.mutateAsync).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        publicKey: 'mock-public-key-base64',
        keyFingerprint: 'abcdef1234567890',
        keySize: 4096,
      });

      expect(mockNotification.success).toHaveBeenCalledWith(
        'Key pair generated and registered successfully'
      );
    });

    it('should show error when generation fails', async () => {
      mockedCrypto.generateUserKeyPair.mockRejectedValue(new Error('Crypto unavailable'));
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /Generate Key Pair/i }));

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalledWith('Crypto unavailable');
      });
    });

    it('should disable button when vault is locked', () => {
      mockEncryptionContext.isUnlocked = false;

      renderComponent();

      expect(screen.getByRole('button', { name: /Generate Key Pair/i })).toBeDisabled();
      expect(screen.getByText(/Unlock the encryption vault first/i)).toBeInTheDocument();
    });
  });

  describe('existing key pair', () => {
    beforeEach(() => {
      mockEncryptionContext.hasKeyPair = true;
      mockPublicKeyData = {
        data: {
          publicKey: 'existing-public-key-base64',
          isActive: true,
          keyFingerprint: 'aabbccdd11223344',
        },
        isLoading: false,
      };
    });

    it('should show success chips for registered keys', () => {
      renderComponent();

      expect(screen.getByText('Public Key Registered')).toBeInTheDocument();
      expect(screen.getByText('Private Key Stored')).toBeInTheDocument();
    });

    it('should show key fingerprint', () => {
      renderComponent();

      expect(screen.getByText('aabbccdd11223344')).toBeInTheDocument();
      expect(screen.getByText('Key Fingerprint')).toBeInTheDocument();
    });

    it('should show Regenerate button instead of Generate', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /Regenerate Key Pair/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Generate Key Pair$/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('key pair regeneration', () => {
    beforeEach(() => {
      mockEncryptionContext.hasKeyPair = true;
      mockPublicKeyData = {
        data: {
          publicKey: 'old-key',
          isActive: true,
          keyFingerprint: 'old-fingerprint',
        },
        isLoading: false,
      };
    });

    it('should revoke old key, clear private key, then generate new pair', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /Regenerate Key Pair/i }));

      await waitFor(() => {
        expect(mockRevokePublicKey.mutateAsync).toHaveBeenCalledWith({
          organizationId: ORG_ID,
          userId: USER_ID,
        });
      });

      expect(mockEncryptionContext.clearPrivateKey).toHaveBeenCalled();
      expect(mockedCrypto.generateUserKeyPair).toHaveBeenCalled();
      expect(mockEncryptionContext.storePrivateKey).toHaveBeenCalled();
      expect(mockRegisterPublicKey.mutateAsync).toHaveBeenCalled();
      expect(mockNotification.success).toHaveBeenCalledWith('Key pair regenerated successfully');
    });
  });

  describe('mismatch warning', () => {
    it('should show warning when server key exists but no local private key', () => {
      mockEncryptionContext.hasKeyPair = false;
      mockPublicKeyData = {
        data: {
          publicKey: 'server-key',
          isActive: true,
          keyFingerprint: 'fp-123',
        },
        isLoading: false,
      };

      renderComponent();

      expect(
        screen.getByText(/public key is registered.*but no matching private key/i)
      ).toBeInTheDocument();
    });
  });
});
