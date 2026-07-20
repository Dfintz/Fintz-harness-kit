import { OrganizationProfilePageWithErrorBoundary as OrganizationProfilePage } from '@/pages/OrganizationProfilePage';
import * as publicDirectoryService from '@/services/publicDirectoryService';
import { useAuthStore } from '@/store/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { HelmetProvider } from 'react-helmet-async';

const theme = createTheme();

// Mock the services
jest.mock('../../services/publicDirectoryService');
jest.mock('../../hooks/queries/useRecruitmentQueries', () => ({
  useRecruitments: jest.fn(() => ({ data: [] })),
}));
jest.mock('../../services/orgApplicationService', () => ({
  orgApplicationService: {
    checkActiveApplication: jest.fn(),
    submitApplication: jest.fn(),
  },
}));

import * as orgApplicationServiceModule from '@/services/orgApplicationService';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ organizationSlug: 'org-123' }),
}));

const render = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe('OrganizationProfilePage', () => {
  const mockOrgProfile = {
    id: 'profile-1',
    organizationId: 'org-123',
    organizationName: 'Test Org',
    organizationDescription: 'A test organization',
    tagline: 'Test tagline',
    primaryFocus: 'combat' as const,
    secondaryFocus: ['trading' as const, 'mining' as const],
    memberCount: 50,
    activityLevel: 'high' as const,
    isVerified: true,
    isRecruiting: true,
    isPublic: true,
    languages: ['en', 'de'],
    timezone: 'UTC',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth store to default (no user)
    useAuthStore.setState({ user: null });
    (publicDirectoryService.publicDirectoryService.getOrgFederations as jest.Mock).mockResolvedValue(
      []
    );
    // Default mock for org application check — prevents error boundary from catching
    (
      orgApplicationServiceModule.orgApplicationService.checkActiveApplication as jest.Mock
    ).mockResolvedValue({ hasActiveApplication: false, isMember: false });
  });

  it('renders loading state initially', () => {
    (
      publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock
    ).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<OrganizationProfilePage />);

    expect(screen.getByText(/Loading organization profile/i)).toBeInTheDocument();
  });

  it('renders organization profile data when loaded', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    expect(screen.getByText('"Test tagline"')).toBeInTheDocument();
    expect(screen.getByText('A test organization')).toBeInTheDocument();
    expect(screen.getByText('50 members')).toBeInTheDocument();
  });

  it('displays recruiting badge when organization is recruiting', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    expect(screen.getByText('Recruiting')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockRejectedValue(
      new Error('Failed to load profile')
    );

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });

  it('displays secondary focus areas', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    expect(screen.getByText('Additional Focus Areas')).toBeInTheDocument();
  });

  it('displays languages when available', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('shows "Apply to Join" button when user has no active application', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );
    (
      orgApplicationServiceModule.orgApplicationService.checkActiveApplication as jest.Mock
    ).mockResolvedValue({ hasActiveApplication: false, isMember: false });

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    // There may be multiple "Apply to Join" buttons in the component
    const applyButtons = screen.getAllByText('Apply to Join');
    expect(applyButtons.length).toBeGreaterThan(0);
  });

  it('shows "Application Pending" chip when user has active application', async () => {
    // Set an authenticated user so the checkActiveApplication effect runs
    useAuthStore.setState({ user: { id: 'user-1', username: 'testuser' } as never });

    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );
    (
      orgApplicationServiceModule.orgApplicationService.checkActiveApplication as jest.Mock
    ).mockResolvedValue({ hasActiveApplication: true, isMember: false });

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      // There may be multiple "Application Pending" chips in the component
      const pendingChips = screen.getAllByText('Application Pending');
      expect(pendingChips.length).toBeGreaterThan(0);
    });
  });

  it('shows "Apply to Join" button when checkActiveApplication fails (unauthenticated)', async () => {
    (publicDirectoryService.publicDirectoryService.getPublicProfile as jest.Mock).mockResolvedValue(
      mockOrgProfile
    );
    (
      orgApplicationServiceModule.orgApplicationService.checkActiveApplication as jest.Mock
    ).mockRejectedValue(new Error('Unauthorized'));

    render(<OrganizationProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    // Should fallback to showing the Apply button (hasApplied stays false)
    // There may be multiple "Apply to Join" buttons in the component
    const applyButtons = screen.getAllByText('Apply to Join');
    expect(applyButtons.length).toBeGreaterThan(0);
  });
});
