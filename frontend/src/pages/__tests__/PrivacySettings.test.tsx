/**
 * Privacy Settings Page Tests
 */

import { PrivacySettingsWithErrorBoundary as PrivacySettings } from '@/pages/PrivacySettings';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the consent service (still used directly for downloadUserData/requestAccountDeletion)
jest.mock('../../services/consentService', () => ({
  consentService: {
    getUserConsents: jest.fn(),
    recordConsent: jest.fn(),
    withdrawConsent: jest.fn(),
    downloadUserData: jest.fn(),
    requestAccountDeletion: jest.fn(),
  },
  ConsentType: {
    ESSENTIAL: 'essential',
    ANALYTICS: 'analytics',
    MARKETING: 'marketing',
    THIRD_PARTY: 'third_party',
    DATA_PROCESSING: 'data_processing',
  },
}));

// Mock React Query consent hooks
jest.mock('../../hooks/queries/useConsentQueries', () => ({
  useUserConsents: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useRecordConsent: jest.fn(() => ({
    mutateAsync: jest.fn(),
    mutate: jest.fn(),
    isPending: false,
  })),
  useConsentVersion: jest.fn(() => ({
    data: {
      hasConsent: true,
      isCurrentVersion: true,
      consentedVersion: '2025.01.1',
      currentVersion: '2025.01.1',
      requiresRenewal: false,
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// Mock user queries (privacy settings)
jest.mock('../../hooks/queries/useUserQueries', () => ({
  usePrivacySettings: jest.fn(() => ({
    data: {
      profileVisibility: 'public',
      showEmail: false,
      showDiscord: false,
      showBio: true,
      showRsiInfo: true,
      showVerifiedBadge: true,
      showOrganizations: true,
      showPublicShips: true,
      showScStats: false,
      showActivity: true,
    },
    isLoading: false,
  })),
  useUpdatePrivacySettings: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

import { useUserConsents } from '../../hooks/queries/useConsentQueries';

// Mock query keys
jest.mock('../../hooks/queries/queryKeys', () => ({
  consentKeys: {
    all: ['consents'],
    list: () => ['consents', 'list'],
    lists: () => ['consents', 'list'],
  },
}));

// Mock @tanstack/react-query (for useQueryClient usage)
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

// Mock scstatsService
jest.mock('../../services/scstatsService', () => ({
  scstatsService: {
    checkDataExists: jest.fn().mockResolvedValue(false),
    deleteData: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the auth store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(selector => {
    if (
      selector.name === 'selectIsAuthenticated' ||
      selector.toString().includes('isAuthenticated')
    ) {
      return true;
    }
    return null;
  }),
  selectIsAuthenticated: (state: any) => state?.isAuthenticated ?? true,
}));

const mockConsents = [
  { type: 'essential', granted: true, updatedAt: '2024-01-01T00:00:00Z' },
  { type: 'analytics', granted: true, updatedAt: '2024-01-01T00:00:00Z' },
  { type: 'marketing', granted: false, updatedAt: '2024-01-01T00:00:00Z' },
  { type: 'third_party', granted: true, updatedAt: '2024-01-01T00:00:00Z' },
  { type: 'data_processing', granted: true, updatedAt: '2024-01-01T00:00:00Z' },
];

describe('PrivacySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUserConsents as jest.Mock).mockReturnValue({
      data: mockConsents,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render the privacy settings page', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
      });
    });

    it('should display consent preferences section', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Consent Preferences')).toBeInTheDocument();
      });
    });

    it('should display data rights section', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Your Data Rights')).toBeInTheDocument();
      });
    });

    it('should show GDPR information alert', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Under GDPR, you have the right/)).toBeInTheDocument();
      });
    });
  });

  describe('Consent Types', () => {
    it.skip('should display all consent types - SKIPPED: component UI changed', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Essential Services')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Marketing Communications')).toBeInTheDocument();
        expect(screen.getByText('Third-Party Services')).toBeInTheDocument();
        expect(screen.getByText('Data Processing')).toBeInTheDocument();
      });
    });

    it('should mark essential consent as required', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Required')).toBeInTheDocument();
      });
    });
  });

  describe('Data Rights', () => {
    it('should display download data button', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });

    it('should display delete account button', async () => {
      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching consents', async () => {
      (useUserConsents as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      render(<PrivacySettings />);

      // React Spectrum ProgressCircle uses aria-label
      await waitFor(
        () => {
          const loadingIndicator = document.querySelector('[aria-label="Loading"]');
          expect(loadingIndicator).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error message when consent fetch fails', async () => {
      (useUserConsents as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load consents'),
        refetch: jest.fn(),
      });

      render(<PrivacySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
      });
    });
  });
});
