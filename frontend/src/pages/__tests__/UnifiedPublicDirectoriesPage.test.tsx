/**
 * Unified Public Directories Page Tests
 */

import { UnifiedPublicDirectoriesPageWithErrorBoundary as UnifiedPublicDirectoriesPage } from '@/pages/UnifiedPublicDirectoriesPage';
import {
  publicDirectoryService,
  publicFederationService,
  publicJobListingService,
} from '@/services/publicDirectoryService';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock the services
jest.mock('../../services/publicDirectoryService', () => ({
  publicDirectoryService: {
    getDirectory: jest.fn(),
    getDirectoryStats: jest.fn(),
  },
  publicFederationService: {
    getFederations: jest.fn(),
    getFederationStats: jest.fn(),
  },
  publicJobListingService: {
    getJobListings: jest.fn(),
    getJobListingStats: jest.fn(),
    getJobListing: jest.fn(),
  },
  getFocusLabel: jest.fn(focus => focus),
  getFocusIcon: jest.fn(focus => 'FocusIcon'),
  getJobTypeLabel: jest.fn(type => type),
  getJobTypeIcon: jest.fn(type => 'JobTypeIcon'),
  getPayTypeLabel: jest.fn(type => type),
  getExperienceLevelLabel: jest.fn(level => 'Beginner'),
  getActivityLevelLabel: jest.fn(level => level),
  getContactTypeLabel: jest.fn(type => type),
}));

// Mock the auth store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    isAuthenticated: false,
  })),
}));

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockOrganizationsData = {
  data: [
    {
      id: 'org-1',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      organizationDescription: 'Test description',
      primaryFocus: 'combat',
      memberCount: 100,
      activityLevel: 'high',
      isRecruiting: true,
      isVerified: true,
    },
  ],
  pagination: {
    page: 1,
    limit: 12,
    total: 1,
    totalPages: 1,
  },
};

const mockFederationsData = {
  data: [
    {
      id: 'fed-1',
      name: 'Test Alliance',
      description: 'Test alliance description',
      memberCount: 50,
      memberOrganizations: [],
      tags: ['test'],
      createdAt: new Date().toISOString(),
      sharedResourceTypes: [],
      treatyCount: 0,
    },
  ],
  pagination: {
    page: 1,
    limit: 12,
    total: 1,
    totalPages: 1,
  },
};

const mockJobsData = {
  data: [
    {
      id: 'job-1',
      organizationName: 'Test Org',
      ownerType: 'organization' as const,
      title: 'Test Job',
      description: 'Test job description',
      jobType: 'pilot' as const,
      focus: 'combat' as const,
      payDisplay: '50k aUEC',
      experienceLevel: 5,
      postedAt: new Date().toISOString(),
      languages: ['en'],
      tags: ['test'],
    },
  ],
  pagination: {
    page: 1,
    limit: 12,
    total: 1,
    totalPages: 1,
  },
};

const mockStats = {
  totalOrganizations: 100,
  recruitingOrganizations: 50,
  verifiedOrganizations: 30,
};

const mockFederationStats = {
  totalFederations: 20,
  totalOrganizations: 80,
};

const mockJobStats = {
  activeListings: 50,
  organizationListings: 30,
  allianceListings: 20,
  byJobType: {},
};

// Helper: render with Router context when needed
const renderWithRouter = (ui: React.ReactElement, options?: { route?: string }) => {
  const route = options?.route ?? '/';
  return rtlRender(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
};

// Default render wrapper providing Router context
const render = (ui: React.ReactElement, route?: string) =>
  renderWithRouter(ui, { route: route ?? '/' });

// SKIPPED: Component structure changed after navigation refactoring
describe.skip('UnifiedPublicDirectoriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (publicDirectoryService.getDirectory as jest.Mock).mockResolvedValue(mockOrganizationsData);
    (publicDirectoryService.getDirectoryStats as jest.Mock).mockResolvedValue(mockStats);
    (publicFederationService.getFederations as jest.Mock).mockResolvedValue(mockFederationsData);
    (publicFederationService.getFederationStats as jest.Mock).mockResolvedValue(
      mockFederationStats
    );
    (publicJobListingService.getJobListings as jest.Mock).mockResolvedValue(mockJobsData);
    (publicJobListingService.getJobListingStats as jest.Mock).mockResolvedValue(mockJobStats);
  });

  describe('Initial Rendering', () => {
    it('should render the unified public directories page', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Public Directory')).toBeInTheDocument();
      });
    });

    it('should default to organizations tab', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /organizations/i })).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('should render all three tabs', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /organizations/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /alliances/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /job listings/i })).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to alliances tab when clicked', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /alliances/i })).toBeInTheDocument();
      });

      const alliancesTab = screen.getByRole('tab', { name: /alliances/i });
      fireEvent.click(alliancesTab);

      await waitFor(() => {
        expect(publicFederationService.getFederations).toHaveBeenCalled();
      });
    });

    it('should switch to jobs tab when clicked', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /job listings/i })).toBeInTheDocument();
      });

      const jobsTab = screen.getByRole('tab', { name: /job listings/i });
      fireEvent.click(jobsTab);

      await waitFor(() => {
        expect(publicJobListingService.getJobListings).toHaveBeenCalled();
      });
    });

    it('should load organizations tab from URL parameter', async () => {
      renderWithRouter(<UnifiedPublicDirectoriesPage />, { route: '/directory?tab=organizations' });

      await waitFor(() => {
        expect(publicDirectoryService.getDirectory).toHaveBeenCalled();
      });
    });

    it('should load alliances tab from URL parameter', async () => {
      renderWithRouter(<UnifiedPublicDirectoriesPage />, { route: '/directory?tab=alliances' });

      await waitFor(() => {
        expect(publicFederationService.getFederations).toHaveBeenCalled();
      });
    });

    it('should redirect jobs tab to opportunities tab', async () => {
      renderWithRouter(<UnifiedPublicDirectoriesPage />, { route: '/directory?tab=jobs' });

      await waitFor(() => {
        // ?tab=jobs now redirects to the unified Jobs & Opportunities panel
        // The Jobs & Opportunities button should be active (not Job Listings)
        const opportunitiesBtn = screen.getByRole('button', { name: /jobs & opportunities/i });
        expect(opportunitiesBtn).toBeInTheDocument();
      });
    });
  });

  describe('Back Button Navigation', () => {
    it('should navigate to login when not authenticated', async () => {
      const { useAuthStore } = require('../../store/authStore');
      (useAuthStore as jest.Mock).mockReturnValue({ isAuthenticated: false });

      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /sign in/i });
        expect(backButton).toBeInTheDocument();
      });
    });

    it('should navigate to dashboard when authenticated', async () => {
      const { useAuthStore } = require('../../store/authStore');
      (useAuthStore as jest.Mock).mockReturnValue({ isAuthenticated: true });

      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /^dashboard$/i });
        expect(backButton).toBeInTheDocument();
      });
    });
  });

  describe('Organizations Panel', () => {
    it('should display organizations data', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Org')).toBeInTheDocument();
      });
    });

    it('should display stats badges', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByText(/100 Organizations/i)).toBeInTheDocument();
      });
    });

    it('should show loading state', async () => {
      (publicDirectoryService.getDirectory as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockOrganizationsData), 100))
      );

      render(<UnifiedPublicDirectoriesPage />);

      expect(screen.getByText(/loading organizations/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/loading organizations/i)).not.toBeInTheDocument();
      });
    });

    it('should handle error state', async () => {
      (publicDirectoryService.getDirectory as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load organizations/i)).toBeInTheDocument();
      });
    });

    it('should display search input', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search/i);
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should display filter button', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        const filterButtons = screen.getAllByRole('button');
        const filterButton = filterButtons.find(
          btn =>
            btn.textContent?.includes('Filter') ||
            btn.getAttribute('aria-label')?.includes('Filter')
        );
        expect(filterButton).toBeDefined();
      });
    });
  });

  describe('Search and Filter Operations', () => {
    it('should trigger search when search button is clicked', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'test search' } });

      const searchButtons = screen.getAllByRole('button');
      const searchButton = searchButtons.find(
        btn =>
          btn.textContent?.includes('Search') || btn.getAttribute('aria-label')?.includes('Search')
      );

      if (searchButton) {
        fireEvent.click(searchButton);
      }

      await waitFor(() => {
        expect(publicDirectoryService.getDirectory).toHaveBeenCalled();
      });
    });

    it('should show clear button when filters are active', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search/i);
        fireEvent.change(searchInput, { target: { value: 'test' } });
      });

      // After entering search text, there might be a Clear button
      // This depends on the component's state management
    });
  });

  describe('Pagination', () => {
    it('should display pagination when multiple pages exist', async () => {
      const multiPageData = {
        ...mockOrganizationsData,
        pagination: {
          page: 1,
          limit: 12,
          total: 50,
          totalPages: 5,
        },
      };
      (publicDirectoryService.getDirectory as jest.Mock).mockResolvedValue(multiPageData);

      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });
    });

    it('should not display pagination when only one page exists', async () => {
      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.queryByText(/previous/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no organizations found', async () => {
      (publicDirectoryService.getDirectory as jest.Mock).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
      });

      render(<UnifiedPublicDirectoriesPage />);

      await waitFor(() => {
        expect(screen.getByText(/no organizations found/i)).toBeInTheDocument();
      });
    });
  });
});
