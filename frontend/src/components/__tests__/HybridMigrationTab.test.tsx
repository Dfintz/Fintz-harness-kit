import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock encryption context
const mockOrgKey = { type: 'secret' } as unknown as CryptoKey;
const mockRecipientKeys = new Map<string, CryptoKey>([
  ['user-1', { type: 'public' } as unknown as CryptoKey],
]);

jest.mock('@/components/encryption/EncryptionKeyProvider', () => ({
  useEncryptionKeys: () => ({
    isUnlocked: true,
    hasKeyPair: true,
    orgKey: mockOrgKey,
    privateKey: { type: 'private' } as unknown as CryptoKey,
    recipientKeys: mockRecipientKeys,
    unlock: jest.fn(),
    lock: jest.fn(),
    storePrivateKey: jest.fn(),
    clearPrivateKey: jest.fn(),
    unlockError: null,
    isUnlocking: false,
  }),
}));

// Mock crypto functions
jest.mock('@/services/crypto/encryptionService', () => ({
  decryptData: jest.fn().mockResolvedValue('decrypted-plaintext'),
  encryptData: jest.fn().mockResolvedValue({
    encrypted: 'new-encrypted',
    iv: 'new-iv',
    authTag: 'new-tag',
    algorithm: 'aes-256-gcm',
  }),
  generateDEK: jest.fn().mockResolvedValue({
    dek: { type: 'secret' } as unknown as CryptoKey,
    dekId: 'dek_generated',
    rawDEK: new ArrayBuffer(32),
  }),
  wrapDEKForRecipients: jest.fn().mockResolvedValue({ 'user-1': 'wrapped-dek' }),
}));

// Mock mutation hooks
const mockInitiateMigration = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };
const mockCompleteMigrationItem = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockCreateDEK = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};

const mockNotification = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

jest.mock('@/store/uiStore', () => ({
  useNotification: () => mockNotification,
}));

jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  useMigrationProgress: jest.fn(),
  useMigrationCandidates: jest.fn(),
  useInitiateMigration: jest.fn(() => mockInitiateMigration),
  useCompleteMigrationItem: jest.fn(() => mockCompleteMigrationItem),
  useCreateDEK: jest.fn(() => mockCreateDEK),
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { HybridMigrationTab } from '@/components/encryption/HybridMigrationTab';
import {
    useMigrationCandidates,
    useMigrationProgress,
} from '@/hooks/queries/useHybridEncryptionQueries';

const mockedUseMigrationProgress = useMigrationProgress as jest.Mock;
const mockedUseMigrationCandidates = useMigrationCandidates as jest.Mock;

describe('HybridMigrationTab', () => {
  const defaultProps = {
    organizationId: 'org-123',
    isOwner: true,
  };

  const mockProgress = {
    totalItems: 10,
    flatItems: 3,
    pendingItems: 5,
    migratedItems: 2,
    percentComplete: 20,
  };

  const mockCandidates = [
    {
      id: 'item-1',
      keyId: 'key-1',
      dataType: 'document',
      resourceId: 'res-1',
      encryptedData: 'enc-data-1',
      encryptionMetadata: { iv: 'iv1', authTag: 'tag1' },
      encryptionMode: 'flat',
      migrationStatus: 'pending',
    },
    {
      id: 'item-2',
      keyId: 'key-2',
      dataType: 'secret',
      resourceId: 'res-2',
      encryptedData: 'enc-data-2',
      encryptionMetadata: { iv: 'iv2', authTag: 'tag2' },
      encryptionMode: 'flat',
      migrationStatus: 'pending',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotification.success.mockReset();
    mockNotification.error.mockReset();
    mockNotification.info.mockReset();
    mockNotification.warning.mockReset();
    mockInitiateMigration.mutateAsync.mockResolvedValue({});
    mockInitiateMigration.isPending = false;
    mockCompleteMigrationItem.mutateAsync.mockResolvedValue({});
    mockCompleteMigrationItem.isPending = false;
    mockCreateDEK.mutateAsync.mockResolvedValue({});
    mockCreateDEK.isPending = false;

    mockedUseMigrationProgress.mockReturnValue({
      data: mockProgress,
      isLoading: false,
      error: null,
    });

    mockedUseMigrationCandidates.mockReturnValue({
      data: null,
      refetch: jest.fn().mockResolvedValue({ data: { data: mockCandidates, total: 2 } }),
    });
  });

  it('shows loading spinner when progress is loading', () => {
    mockedUseMigrationProgress.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Migration Progress')).not.toBeInTheDocument();
  });

  it('renders progress card with statistics', () => {
    render(<HybridMigrationTab {...defaultProps} />);

    expect(screen.getByText('Migration Progress')).toBeInTheDocument();
    expect(screen.getByText('Total: 10')).toBeInTheDocument();
    expect(screen.getByText('Flat (legacy): 3')).toBeInTheDocument();
    expect(screen.getByText('Pending: 5')).toBeInTheDocument();
    expect(screen.getByText('Migrated: 2')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows "No Data" chip when no items exist', () => {
    mockedUseMigrationProgress.mockReturnValue({
      data: { totalItems: 0, flatItems: 0, pendingItems: 0, migratedItems: 0, percentComplete: 0 },
      isLoading: false,
      error: null,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText(/No encrypted data items found/)).toBeInTheDocument();
  });

  it('shows completion state when all items are migrated', () => {
    mockedUseMigrationProgress.mockReturnValue({
      data: {
        totalItems: 5,
        flatItems: 0,
        pendingItems: 0,
        migratedItems: 5,
        percentComplete: 100,
      },
      isLoading: false,
      error: null,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText(/successfully migrated to the hybrid DEK model/)).toBeInTheDocument();
  });

  it('shows initiate button when owner and no pending items', () => {
    mockedUseMigrationProgress.mockReturnValue({
      data: {
        totalItems: 5,
        flatItems: 5,
        pendingItems: 0,
        migratedItems: 0,
        percentComplete: 0,
      },
      isLoading: false,
      error: null,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Initiate Migration' })).toBeInTheDocument();
  });

  it('shows batch migration button when pending items exist', () => {
    render(<HybridMigrationTab {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Start Batch Migration/ })).toBeInTheDocument();
  });

  it('shows info alert for non-owners instead of action buttons', () => {
    render(<HybridMigrationTab {...defaultProps} isOwner={false} />);

    expect(screen.getByText(/Only organization owners and administrators/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Batch Migration/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Initiate Migration' })).not.toBeInTheDocument();
  });

  it('calls initiateMigration when initiate button is clicked', async () => {
    mockedUseMigrationProgress.mockReturnValue({
      data: {
        totalItems: 5,
        flatItems: 5,
        pendingItems: 0,
        migratedItems: 0,
        percentComplete: 0,
      },
      isLoading: false,
      error: null,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Initiate Migration' });
    await userEvent.click(button);

    expect(mockInitiateMigration.mutateAsync).toHaveBeenCalledWith('org-123');
  });

  it('displays error alert when initiation fails', async () => {
    mockedUseMigrationProgress.mockReturnValue({
      data: {
        totalItems: 5,
        flatItems: 5,
        pendingItems: 0,
        migratedItems: 0,
        percentComplete: 0,
      },
      isLoading: false,
      error: null,
    });
    mockInitiateMigration.mutateAsync.mockRejectedValue(new Error('Server error'));

    render(<HybridMigrationTab {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Initiate Migration' });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockNotification.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('processes batch migration and calls completeMigrationItem for each candidate', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({ data: { data: mockCandidates, total: 2 } });
    mockedUseMigrationCandidates.mockReturnValue({
      data: null,
      refetch: mockRefetch,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Start Batch Migration/ });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockCompleteMigrationItem.mutateAsync).toHaveBeenCalledTimes(2);
    });

    // With real crypto, dekId comes from generateDEK, not the original item keyId
    expect(mockCompleteMigrationItem.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-123',
        dataId: 'item-1',
        dekId: 'dek_generated',
      })
    );
    expect(mockCompleteMigrationItem.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-123',
        dataId: 'item-2',
        dekId: 'dek_generated',
      })
    );
  });

  it('skips batch migration gracefully when no candidates are returned', async () => {
    const mockRefetch = jest.fn().mockResolvedValue({ data: { data: [], total: 0 } });
    mockedUseMigrationCandidates.mockReturnValue({
      data: null,
      refetch: mockRefetch,
    });

    render(<HybridMigrationTab {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Start Batch Migration/ });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
    expect(mockCompleteMigrationItem.mutateAsync).not.toHaveBeenCalled();
  });
});
