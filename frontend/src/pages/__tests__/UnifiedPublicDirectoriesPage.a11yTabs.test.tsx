import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { UnifiedPublicDirectoriesPageWithErrorBoundary as UnifiedPublicDirectoriesPage } from '@/pages/UnifiedPublicDirectoriesPage';
import { publicDirectoryService, publicFederationService } from '@/services/publicDirectoryService';

const mockUseAuthStore = jest.fn();

jest.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector?: (state: { isAuthenticated: boolean }) => unknown) =>
    mockUseAuthStore(selector),
  selectIsAuthenticated: (state: { isAuthenticated: boolean }) => state.isAuthenticated,
}));

jest.mock('@/services/publicDirectoryService', () => ({
  OrgPrimaryFocus: {
    COMBAT: 'combat',
    EXPLORATION: 'exploration',
    INDUSTRIAL: 'industrial',
    MIXED: 'mixed',
  },
  ActivityLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
  },
  getFocusLabel: (focus: string) => focus,
  publicDirectoryService: {
    getDirectory: jest.fn(),
    getDirectoryStats: jest.fn(),
  },
  publicFederationService: {
    getFederations: jest.fn(),
    getFederationStats: jest.fn(),
  },
}));

function renderPage(route = '/directory'): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>
        <UnifiedPublicDirectoriesPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('UnifiedPublicDirectoriesPage semantic tab UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuthStore.mockImplementation(
      (selector?: (state: { isAuthenticated: boolean }) => unknown) => {
        const state = { isAuthenticated: false };
        return typeof selector === 'function' ? selector(state) : state;
      }
    );

    (publicDirectoryService.getDirectory as jest.Mock).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 1,
      },
    });
    (publicDirectoryService.getDirectoryStats as jest.Mock).mockResolvedValue({
      totalOrganizations: 0,
      recruitingOrganizations: 0,
      verifiedOrganizations: 0,
    });

    (publicFederationService.getFederations as jest.Mock).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 1,
      },
    });
    (publicFederationService.getFederationStats as jest.Mock).mockResolvedValue({
      totalFederations: 0,
      totalOrganizations: 0,
    });
  });

  it('renders tablist and links selected tab to tabpanel with ARIA attributes', async () => {
    renderPage('/directory?tab=organizations');

    await waitFor(() => {
      expect(
        screen.getByRole('tablist', { name: /public directory sections/i })
      ).toBeInTheDocument();
    });

    const organizationsTab = screen.getByRole('tab', { name: /organizations/i });
    expect(organizationsTab).toHaveAttribute('aria-selected', 'true');
    expect(organizationsTab).toHaveAttribute('id', 'directory-tab-organizations');
    expect(organizationsTab).toHaveAttribute('aria-controls', 'directory-panel-organizations');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'directory-panel-organizations');
    expect(panel).toHaveAttribute('aria-labelledby', 'directory-tab-organizations');
  });

  it('supports keyboard arrow navigation with active tab and panel updates', async () => {
    renderPage('/directory?tab=organizations');

    const organizationsTab = await screen.findByRole('tab', { name: /organizations/i });
    fireEvent.focus(organizationsTab);

    fireEvent.keyDown(organizationsTab, { key: 'ArrowRight' });

    await waitFor(() => {
      const alliancesTab = screen.getByRole('tab', { name: /alliances/i });
      expect(alliancesTab).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(alliancesTab);
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'directory-panel-alliances');
    });
  });

  it('falls back to organizations when members tab is requested without authentication', async () => {
    renderPage('/directory?tab=members');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /organizations/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    expect(screen.queryByRole('tab', { name: /^members$/i })).not.toBeInTheDocument();
  });
});
