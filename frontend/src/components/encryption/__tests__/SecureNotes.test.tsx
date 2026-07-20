/**
 * Tests for SecureNotes component (Step D — first domain wired to hybrid)
 */

import { SecureNotes } from '@/components/encryption/SecureNotes';
import type { HybridEncryptedDataListItem } from '@/services/crypto/encryptionApiService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEncryptionContext = {
  isUnlocked: true,
  hasKeyPair: true,
  orgKey: null,
  privateKey: 'mock-pk' as unknown as CryptoKey,
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

const mockEncryptAndStore = jest.fn();
const mockFetchAndDecrypt = jest.fn();

jest.mock('@/hooks/useHybridCrypto', () => ({
  useHybridCrypto: () => ({
    encryptAndStore: mockEncryptAndStore,
    fetchAndDecrypt: mockFetchAndDecrypt,
    decryptResponse: jest.fn(),
    isReady: mockEncryptionContext.isUnlocked && !!mockEncryptionContext.privateKey,
    isEncrypting: false,
  }),
}));

let mockListData: {
  data: { data: HybridEncryptedDataListItem[]; total: number } | undefined;
  isLoading: boolean;
  error: Error | null;
} = { data: undefined, isLoading: false, error: null };

jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  useHybridEncryptedDataList: () => mockListData,
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-123';

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SecureNotes organizationId={ORG_ID} />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockEncryptionContext.isUnlocked = true;
  mockEncryptionContext.privateKey = 'mock-pk' as unknown as CryptoKey;
  mockEncryptionContext.recipientKeys = new Map([['user-1', 'mock-pub' as unknown as CryptoKey]]);
  mockListData = { data: undefined, isLoading: false, error: null };
});

describe('SecureNotes', () => {
  describe('locked state', () => {
    it('should show unlock message when vault is locked', () => {
      mockEncryptionContext.isUnlocked = false;
      renderComponent();
      expect(screen.getByText(/Unlock the encryption vault/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no notes exist', () => {
      mockListData = { data: { data: [], total: 0 }, isLoading: false, error: null };
      renderComponent();
      expect(screen.getByText(/No secure notes yet/i)).toBeInTheDocument();
    });
  });

  describe('creating a note', () => {
    beforeEach(() => {
      mockListData = { data: { data: [], total: 0 }, isLoading: false, error: null };
    });

    it('should call encryptAndStore on save', async () => {
      mockEncryptAndStore.mockResolvedValue({ id: 'data-1', dekId: 'dek-1' });
      renderComponent();

      const input = screen.getByPlaceholderText(/Type an encrypted note/i);
      fireEvent.change(input, { target: { value: 'my secret note' } });

      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockEncryptAndStore).toHaveBeenCalledWith('my secret note', 'secure-note');
      });
    });

    it('should clear the text field after successful save', async () => {
      mockEncryptAndStore.mockResolvedValue({ id: 'data-1', dekId: 'dek-1' });
      renderComponent();

      const input = screen.getByPlaceholderText(/Type an encrypted note/i) as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'temp note' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should show error when save fails', async () => {
      mockEncryptAndStore.mockRejectedValue(new Error('Network error'));
      renderComponent();

      fireEvent.change(screen.getByPlaceholderText(/Type an encrypted note/i), {
        target: { value: 'will fail' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('note list', () => {
    const mockNotes: HybridEncryptedDataListItem[] = [
      {
        id: 'note-1',
        dekId: 'dek-a',
        dataType: 'secure-note',
        encryptionMode: 'hybrid',
        createdAt: new Date('2025-06-01'),
        createdBy: 'user-1',
      },
      {
        id: 'note-2',
        dekId: 'dek-b',
        dataType: 'secure-note',
        encryptionMode: 'hybrid',
        createdAt: new Date('2025-06-02'),
        createdBy: 'user-2',
      },
    ];

    beforeEach(() => {
      mockListData = { data: { data: mockNotes, total: 2 }, isLoading: false, error: null };
    });

    it('should render masked note entries', () => {
      renderComponent();
      const masked = screen.getAllByText('••••••••••••••••');
      expect(masked).toHaveLength(2);
    });

    it('should decrypt and show note on click', async () => {
      mockFetchAndDecrypt.mockResolvedValue('revealed secret');
      renderComponent();

      const decryptBtns = screen.getAllByLabelText('decrypt note');
      fireEvent.click(decryptBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('revealed secret')).toBeInTheDocument();
      });
      expect(mockFetchAndDecrypt).toHaveBeenCalledWith('note-1');
    });

    it('should hide note on second click', async () => {
      mockFetchAndDecrypt.mockResolvedValue('revealed secret');
      renderComponent();

      // Decrypt
      const decryptBtns = screen.getAllByLabelText('decrypt note');
      fireEvent.click(decryptBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('revealed secret')).toBeInTheDocument();
      });

      // Hide
      const hideBtn = screen.getByLabelText('hide note');
      fireEvent.click(hideBtn);

      await waitFor(() => {
        expect(screen.queryByText('revealed secret')).not.toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('should show spinner while loading', () => {
      mockListData = { data: undefined, isLoading: true, error: null };
      renderComponent();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error alert on list fetch failure', () => {
      mockListData = { data: undefined, isLoading: false, error: new Error('Fetch failed') };
      renderComponent();
      expect(screen.getByText(/Failed to load notes/i)).toBeInTheDocument();
    });
  });
});
