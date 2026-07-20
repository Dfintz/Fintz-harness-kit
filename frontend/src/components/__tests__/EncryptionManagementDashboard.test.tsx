/**
 * Integration tests for EncryptionManagementDashboard (Step F)
 * Verifies new tabs (Key Pairs, Data Keys, Secure Notes) render
 * when the EncryptionKeyProvider context is available.
 */

import { EncryptionManagementDashboard } from '@/components/EncryptionManagementDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEncryptionContext = {
  isUnlocked: true,
  hasKeyPair: true,
  orgKey: null,
  privateKey: null,
  recipientKeys: new Map(),
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

// Mock encryptionApiService
jest.mock('@/services/crypto/encryptionApiService', () => ({
  encryptionApiService: {
    getEncryptionStatus: jest.fn().mockResolvedValue({
      enabled: true,
      algorithm: 'AES-256-GCM',
      version: 1,
      numKeyHolders: 3,
      createdAt: '2025-01-01T00:00:00Z',
    }),
    getKeyWrapper: jest.fn().mockResolvedValue({
      keyId: 'key-1',
      wrappedKey: '{}',
      algorithm: 'AES-KW',
    }),
    getAuditLog: jest.fn().mockResolvedValue({ logs: [] }),
    getReEncryptionProgress: jest.fn().mockResolvedValue({
      totalItems: 0,
      reEncryptedItems: 0,
      pendingItems: 0,
      percentComplete: 100,
    }),
    listClaims: jest.fn().mockResolvedValue({ claims: [] }),
  },
}));

// Mock encryptionService crypto functions
jest.mock('@/services/crypto/encryptionService', () => ({
  generateDEK: jest.fn(),
  encryptData: jest.fn(),
  decryptData: jest.fn(),
  wrapDEKForRecipients: jest.fn(),
}));

// Mock hybrid encryption queries used by child components
jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  useDEKs: () => ({ data: undefined, isLoading: false, error: null }),
  usePublicKey: () => ({ data: null, isLoading: false }),
  usePublicKeys: () => ({ data: undefined }),
  useRegisterPublicKey: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRevokePublicKey: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useHybridEncryptedDataList: () => ({ data: undefined, isLoading: false, error: null }),
  useMigrationCandidates: () => ({ data: undefined, isLoading: false }),
  useMigrationProgress: () => ({ data: undefined, isLoading: false }),
  useInitiateMigration: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCompleteMigrationItem: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCreateDEK: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// Mock useHybridCrypto
jest.mock('@/hooks/useHybridCrypto', () => ({
  useHybridCrypto: () => ({
    encryptAndStore: jest.fn(),
    fetchAndDecrypt: jest.fn(),
    decryptResponse: jest.fn(),
    isReady: true,
    isEncrypting: false,
  }),
}));

// Mock auth store
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 'user-1', activeOrgId: 'org-1' },
    }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  organizationId: 'org-1',
  organizationName: 'Test Org',
  currentUserId: 'user-1',
  isOwner: true,
  onSetupEncryption: jest.fn(),
};

function renderDashboard(overrides: Partial<typeof defaultProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EncryptionManagementDashboard {...defaultProps} {...overrides} />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EncryptionManagementDashboard — tab integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEncryptionContext.isUnlocked = true;
    mockEncryptionContext.hasKeyPair = true;
  });

  it('renders the new tab labels when encryption is enabled', async () => {
    renderDashboard();

    // Wait for async status load
    expect(await screen.findByText('Encryption Management')).toBeInTheDocument();

    // New tabs should be visible
    expect(screen.getByRole('tab', { name: 'Key Pairs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Data Keys' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Secure Notes' })).toBeInTheDocument();
    // Original tabs still present
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Audit Log' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Migration' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();
  });

  it('renders 7 tabs total', async () => {
    renderDashboard();
    expect(await screen.findByText('Encryption Management')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
  });

  it('switches to Key Pairs tab and renders KeyPairManager', async () => {
    renderDashboard();
    expect(await screen.findByText('Encryption Management')).toBeInTheDocument();

    const keyPairsTab = screen.getByRole('tab', { name: 'Key Pairs' });
    await userEvent.click(keyPairsTab);

    // KeyPairManager renders - look for its heading
    expect(await screen.findByText('Hybrid Encryption Key Pair')).toBeInTheDocument();
  });

  it('switches to Data Keys tab and renders DEKManagementPanel', async () => {
    renderDashboard();
    expect(await screen.findByText('Encryption Management')).toBeInTheDocument();

    const dekTab = screen.getByRole('tab', { name: 'Data Keys' });
    await userEvent.click(dekTab);

    // DEKManagementPanel renders - look for its heading
    expect(await screen.findByText('Data Encryption Keys')).toBeInTheDocument();
  });

  it('switches to Secure Notes tab and renders SecureNotes', async () => {
    renderDashboard();
    expect(await screen.findByText('Encryption Management')).toBeInTheDocument();

    const notesTab = screen.getByRole('tab', { name: 'Secure Notes' });
    await userEvent.click(notesTab);

    // SecureNotes renders - look for unique content (heading text is same as tab label)
    expect(await screen.findByText('No secure notes yet. Create one above.')).toBeInTheDocument();
  });

  it('switches to Migration tab and renders HybridMigrationTab', async () => {
    renderDashboard();
    expect(await screen.findByText('Encryption Management')).toBeInTheDocument();

    const migrationTab = screen.getByRole('tab', { name: 'Migration' });
    await userEvent.click(migrationTab);

    // HybridMigrationTab renders - look for its unique heading
    expect(await screen.findByText('Hybrid Encryption Migration')).toBeInTheDocument();
    // Also check for migration-specific content
    expect(await screen.findByText('Migration Progress')).toBeInTheDocument();
  });
});
