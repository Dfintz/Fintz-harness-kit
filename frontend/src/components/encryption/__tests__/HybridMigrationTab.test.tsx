/**
 * Tests for HybridMigrationTab (Step E - Migration crypto logic)
 */

import { HybridMigrationTab } from '@/components/encryption/HybridMigrationTab';
import type {
    MigrationCandidateItem,
    MigrationProgressResponse,
} from '@/services/crypto/encryptionApiService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrgKey = { type: 'secret' } as unknown as CryptoKey | null;
const mockPrivateKey = { type: 'private' } as unknown as CryptoKey;
const mockRecipientKeys = new Map<string, CryptoKey>([
  ['user-1', { type: 'public' } as unknown as CryptoKey],
]);

const mockEncryptionContext = {
  isUnlocked: true,
  hasKeyPair: true,
  orgKey: mockOrgKey,
  privateKey: mockPrivateKey,
  recipientKeys: mockRecipientKeys,
  unlock: jest.fn(),
  lock: jest.fn(),
  storePrivateKey: jest.fn(),
  clearPrivateKey: jest.fn(),
  unlockError: null,
  isUnlocking: false,
};

const mockNotification = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

jest.mock('@/components/encryption/EncryptionKeyProvider', () => ({
  useEncryptionKeys: () => mockEncryptionContext,
}));

jest.mock('@/store/uiStore', () => ({
  useNotification: () => mockNotification,
}));

// Crypto mocks
const mockDecryptData = jest.fn().mockResolvedValue('decrypted-plaintext');
const mockEncryptData = jest.fn().mockResolvedValue({
  encrypted: 'new-encrypted-base64',
  iv: 'new-iv',
  authTag: 'new-authtag',
  algorithm: 'aes-256-gcm',
});
const mockGenerateDEK = jest.fn().mockResolvedValue({
  dek: { type: 'secret' } as unknown as CryptoKey,
  dekId: 'dek_generated123',
  rawDEK: new ArrayBuffer(32),
});
const mockWrapDEKForRecipients = jest.fn().mockResolvedValue({
  'user-1': 'wrapped-dek-base64',
});

jest.mock('@/services/crypto/encryptionService', () => ({
  decryptData: (...args: unknown[]) => mockDecryptData(...args),
  encryptData: (...args: unknown[]) => mockEncryptData(...args),
  generateDEK: (...args: unknown[]) => mockGenerateDEK(...args),
  wrapDEKForRecipients: (...args: unknown[]) => mockWrapDEKForRecipients(...args),
}));

// Query hook mocks
const mockInitiateMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockCompleteMutateAsync = jest.fn().mockResolvedValue({
  id: 'item-1',
  dekId: 'dek_generated123',
  dataType: 'secret-note',
  encryptionMode: 'hybrid',
  migrationStatus: 'migrated',
});
const mockCreateDEKMutateAsync = jest.fn().mockResolvedValue({
  id: 'dek-id',
  dekId: 'dek_generated123',
});

let mockProgress: {
  data: MigrationProgressResponse | undefined;
  isLoading: boolean;
} = {
  data: undefined,
  isLoading: false,
};

const mockCandidateItem: MigrationCandidateItem = {
  id: 'item-1',
  keyId: 'old-key-1',
  dataType: 'secret-note',
  encryptedData: 'old-encrypted-base64',
  encryptionMetadata: { iv: 'old-iv', authTag: 'old-authtag', algorithm: 'aes-256-gcm' },
  encryptionMode: 'flat',
  migrationStatus: 'pending',
};

const mockRefetchCandidates = jest.fn().mockResolvedValue({
  data: { data: [mockCandidateItem], total: 1 },
});

let mockCandidatesData: {
  data: { data: MigrationCandidateItem[]; total: number } | undefined;
  refetch: jest.Mock;
} = {
  data: undefined,
  refetch: mockRefetchCandidates,
};

jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  useMigrationProgress: () => mockProgress,
  useMigrationCandidates: () => mockCandidatesData,
  useInitiateMigration: () => ({
    mutateAsync: mockInitiateMutateAsync,
    isPending: false,
  }),
  useCompleteMigrationItem: () => ({
    mutateAsync: mockCompleteMutateAsync,
    isPending: false,
  }),
  useCreateDEK: () => ({
    mutateAsync: mockCreateDEKMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-123';

function renderComponent(props?: Partial<{ organizationId: string; isOwner: boolean }>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HybridMigrationTab
        organizationId={props?.organizationId ?? ORG_ID}
        isOwner={props?.isOwner ?? true}
      />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Reset mutable mocks to defaults
  mockEncryptionContext.isUnlocked = true;
  mockEncryptionContext.orgKey = mockOrgKey;
  mockEncryptionContext.recipientKeys = mockRecipientKeys;

  mockProgress = { data: undefined, isLoading: false };
  mockCandidatesData = { data: undefined, refetch: mockRefetchCandidates };
});

describe('HybridMigrationTab', () => {
  it('shows loading spinner when progress is loading', () => {
    mockProgress = { data: undefined, isLoading: true };
    renderComponent();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows "No Data" chip when there are no items', () => {
    mockProgress = {
      data: { totalItems: 0, pendingItems: 0, migratedItems: 0, flatItems: 0, percentComplete: 0 },
      isLoading: false,
    };
    renderComponent();
    expect(screen.getByText('No Data')).toBeInTheDocument();
  });

  it('shows success alert when migration is complete', () => {
    mockProgress = {
      data: {
        totalItems: 5,
        pendingItems: 0,
        migratedItems: 5,
        flatItems: 0,
        percentComplete: 100,
      },
      isLoading: false,
    };
    renderComponent();
    expect(screen.getByText(/successfully migrated/i)).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows info alert for non-owners', () => {
    mockProgress = {
      data: { totalItems: 5, pendingItems: 3, migratedItems: 2, flatItems: 0, percentComplete: 40 },
      isLoading: false,
    };
    renderComponent({ isOwner: false });
    expect(screen.getByText(/only organization owners/i)).toBeInTheDocument();
  });

  it('renders Initiate Migration button when no pending items', () => {
    mockProgress = {
      data: { totalItems: 5, pendingItems: 0, migratedItems: 0, flatItems: 5, percentComplete: 0 },
      isLoading: false,
    };
    renderComponent();
    expect(screen.getByRole('button', { name: /initiate migration/i })).toBeInTheDocument();
  });

  it('calls initiateMigration on button click', async () => {
    mockProgress = {
      data: { totalItems: 5, pendingItems: 0, migratedItems: 0, flatItems: 5, percentComplete: 0 },
      isLoading: false,
    };
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /initiate migration/i }));
    await waitFor(() => {
      expect(mockInitiateMutateAsync).toHaveBeenCalledWith(ORG_ID);
    });
  });

  it('shows vault unlock warning when vault is locked', () => {
    mockEncryptionContext.isUnlocked = false;
    mockProgress = {
      data: { totalItems: 5, pendingItems: 3, migratedItems: 2, flatItems: 0, percentComplete: 40 },
      isLoading: false,
    };
    renderComponent();
    expect(screen.getByText(/unlock the encryption vault/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start batch migration/i })).toBeDisabled();
  });

  it('shows Start Batch Migration button when pending items exist and vault unlocked', () => {
    mockProgress = {
      data: { totalItems: 5, pendingItems: 3, migratedItems: 2, flatItems: 0, percentComplete: 40 },
      isLoading: false,
    };
    renderComponent();
    const btn = screen.getByRole('button', { name: /start batch migration \(3 pending\)/i });
    expect(btn).toBeEnabled();
  });

  it('executes full migration crypto pipeline on batch start', async () => {
    mockProgress = {
      data: { totalItems: 5, pendingItems: 3, migratedItems: 2, flatItems: 0, percentComplete: 40 },
      isLoading: false,
    };
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /start batch migration/i }));

    await waitFor(() => {
      // 1. Decrypt with org key
      expect(mockDecryptData).toHaveBeenCalledWith(
        {
          encrypted: 'old-encrypted-base64',
          iv: 'old-iv',
          authTag: 'old-authtag',
          algorithm: 'aes-256-gcm',
        },
        mockOrgKey
      );
    });

    // 2. Generate DEK
    expect(mockGenerateDEK).toHaveBeenCalled();

    // 3. Re-encrypt with DEK
    expect(mockEncryptData).toHaveBeenCalledWith(
      'decrypted-plaintext',
      expect.objectContaining({ type: 'secret' })
    );

    // 4. Wrap DEK for recipients
    expect(mockWrapDEKForRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'secret' }),
      mockRecipientKeys
    );

    // 5a. Register DEK
    expect(mockCreateDEKMutateAsync).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      dekId: 'dek_generated123',
      dataType: 'secret-note',
      resourceId: undefined,
      wrappedKeys: { 'user-1': 'wrapped-dek-base64' },
    });

    // 5b. Complete migration item
    expect(mockCompleteMutateAsync).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      dataId: 'item-1',
      dekId: 'dek_generated123',
      encryptedData: 'new-encrypted-base64',
      encryptionMetadata: {
        iv: 'new-iv',
        authTag: 'new-authtag',
        algorithm: 'aes-256-gcm',
        version: 1,
      },
    });
  });

  it('sets error when vault not ready and batch button is clicked', async () => {
    mockEncryptionContext.orgKey = null;
    mockEncryptionContext.recipientKeys = new Map();
    mockEncryptionContext.isUnlocked = true; // unlocked but no keys
    mockProgress = {
      data: { totalItems: 5, pendingItems: 3, migratedItems: 2, flatItems: 0, percentComplete: 40 },
      isLoading: false,
    };
    // Need to override the disabled check — isUnlocked is true so button is enabled
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /start batch migration/i }));

    await waitFor(() => {
      expect(mockNotification.error).toHaveBeenCalledWith(
        'Encryption vault must be unlocked with recipient keys available'
      );
    });
  });

  it('shows progress stats when items exist', () => {
    mockProgress = {
      data: {
        totalItems: 10,
        pendingItems: 3,
        migratedItems: 5,
        flatItems: 2,
        percentComplete: 50,
      },
      isLoading: false,
    };
    renderComponent();
    expect(screen.getByText('Total: 10')).toBeInTheDocument();
    expect(screen.getByText('Flat (legacy): 2')).toBeInTheDocument();
    expect(screen.getByText('Pending: 3')).toBeInTheDocument();
    expect(screen.getByText('Migrated: 5')).toBeInTheDocument();
  });
});
