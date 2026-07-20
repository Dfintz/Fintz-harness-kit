/**
 * Tests for DEKManagementPanel (Step C - DEK Management)
 */

import { DEKManagementPanel } from '@/components/encryption/DEKManagementPanel';
import type { DEKResponse } from '@/services/crypto/encryptionApiService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

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

let mockDEKData: {
  data: { deks: DEKResponse[]; total: number } | undefined;
  isLoading: boolean;
  error: Error | null;
} = {
  data: undefined,
  isLoading: false,
  error: null,
};

jest.mock('@/hooks/queries/useHybridEncryptionQueries', () => ({
  useDEKs: () => mockDEKData,
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
      <DEKManagementPanel organizationId={ORG_ID} />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockEncryptionContext.isUnlocked = true;
  mockDEKData = { data: undefined, isLoading: false, error: null };
});

describe('DEKManagementPanel', () => {
  describe('locked state', () => {
    it('should show unlock message when vault is locked', () => {
      mockEncryptionContext.isUnlocked = false;
      renderComponent();

      expect(screen.getByText(/Unlock the encryption vault/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner', () => {
      mockDEKData = { data: undefined, isLoading: true, error: null };
      renderComponent();

      expect(screen.getByText('Loading encryption keys...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error alert', () => {
      mockDEKData = { data: undefined, isLoading: false, error: new Error('Network error') };
      renderComponent();

      expect(screen.getByText(/Failed to load Data Encryption Keys/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show info message when no DEKs exist', () => {
      mockDEKData = { data: { deks: [], total: 0 }, isLoading: false, error: null };
      renderComponent();

      expect(screen.getByText(/No Data Encryption Keys have been created/i)).toBeInTheDocument();
    });
  });

  describe('DEK list', () => {
    const mockDEKs: DEKResponse[] = [
      {
        id: '1',
        dekId: 'dek-abc-123',
        dataType: 'fleet-note',
        resourceId: 'fleet-001',
        algorithm: 'AES-256-GCM',
        version: 1,
        isActive: true,
        createdAt: new Date('2025-01-15'),
      },
      {
        id: '2',
        dekId: 'dek-def-456',
        dataType: 'org-secret',
        algorithm: 'AES-256-GCM',
        version: 1,
        isActive: false,
        createdAt: new Date('2025-01-10'),
      },
    ];

    beforeEach(() => {
      mockDEKData = { data: { deks: mockDEKs, total: 2 }, isLoading: false, error: null };
    });

    it('should show DEK count chip', () => {
      renderComponent();
      expect(screen.getByText('2 keys')).toBeInTheDocument();
    });

    it('should show data type chips', () => {
      renderComponent();
      expect(screen.getByText('fleet-note')).toBeInTheDocument();
      expect(screen.getByText('org-secret')).toBeInTheDocument();
    });

    it('should show active/revoked status', () => {
      renderComponent();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Revoked')).toBeInTheDocument();
    });

    it('should show resource ID or dash', () => {
      renderComponent();
      expect(screen.getByText('fleet-001')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('should render header row', () => {
      renderComponent();
      expect(screen.getByText('DEK ID')).toBeInTheDocument();
      expect(screen.getByText('Data Type')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });
});
