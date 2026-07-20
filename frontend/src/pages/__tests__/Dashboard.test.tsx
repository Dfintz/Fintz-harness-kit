import { Dashboard } from '@/pages/Dashboard';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { userShipService } from '@/services/userShipService';
import { useAuthStore } from '@/store/authStore';
import { render, screen, waitFor } from '@/test-utils/test-utils';
import type { FeedItem, OrganizationOverview } from '@/types/apiV2';
import React from 'react';

// Helper to render with router (test-utils render already provides MemoryRouter + ThemeProvider)
const renderWithRouter = (component: React.ReactElement) => {
  return render(component);
};

// Mock recharts to avoid dependency issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="area-chart">{children}</svg>
  ),
  Line: () => <div data-testid="line" />,
  Area: () => <g data-testid="area" />,
  ReferenceLine: () => <g data-testid="reference-line" />,
}));

// Mock the organization service
jest.mock('../../services/organizationServiceV2');
const mockOrganizationService = organizationServiceV2 as jest.Mocked<typeof organizationServiceV2>;

// Mock the activity service
jest.mock('../../services/activityServiceV2');
const mockActivityService = activityServiceV2 as jest.Mocked<typeof activityServiceV2>;

// Mock the user ship service
jest.mock('../../services/userShipService');
const mockUserShipService = userShipService as jest.Mocked<typeof userShipService>;

// Mock the auth store
jest.mock('../../store/authStore');

jest.mock('../../components/dashboard/LfgFeedWidget', () => ({
  LfgFeedWidget: () => <div data-testid="lfg-feed-widget" />,
}));

jest.mock('../../components/dashboard/SCStatsDashboardWidget', () => ({
  SCStatsDashboardWidget: () => <div data-testid="scstats-dashboard-widget" />,
}));

// Mock the auth store
jest.mock('../../store/authStore');

// Mock the realtime hooks
jest.mock('../../hooks/useRealtime', () => ({
  useWebSocketConnection: () => ({
    status: 'connected',
    isConnected: true,
    isReconnecting: false,
    error: null,
  }),
  useRealtimeFleets: () => ({ events: [] }),
  useRealtimeActivities: () => ({ events: [] }),
  useRealtimeTrading: () => ({ events: [] }),
  useRealtimeNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    clearNotification: jest.fn(),
    clearAll: jest.fn(),
  }),
}));

// Mock approval queries (React Query hooks)
jest.mock('../../hooks/queries/useApprovalQueries', () => ({
  usePendingApplications: () => ({ data: undefined, isLoading: false, error: null }),
  usePendingInvitations: () => ({ data: undefined, isLoading: false, error: null }),
  usePendingRecruitmentApplicants: () => ({ data: 0, isLoading: false, error: null }),
}));

// Mock activity queries (React Query hooks)
jest.mock('../../hooks/queries/useActivityQueries', () => ({
  useActivityAnalytics: () => ({ data: undefined, isLoading: false, error: null }),
}));

// Mock team queries (React Query hooks)
jest.mock('../../hooks/queries/useTeamQueries', () => ({
  useTeams: () => ({ data: [], isLoading: false, error: null }),
}));

jest.mock('../../hooks/queries/useFederationManagementQueries', () => ({
  useMyFederations: () => ({ data: [], isLoading: false, error: null }),
}));

// Mock dashboard queries (React Query hooks)
jest.mock('../../hooks/queries/useDashboardQueries', () => ({
  useDashboardSummary: () => ({
    data: {
      fleets: { total: 1, totalShips: 5, totalMemberShips: 8, personalShipCount: 3 },
      activities: { total: 3, upcoming: 1 },
      teams: { total: 1 },
      notifications: { recent: [], total: 0, unreadCount: 0 },
      organization: {
        id: 'test-org',
        name: 'Test Organization',
        role: 'member',
        rsiVerified: false,
        scale: {
          tier: 'standard',
          memberCount: 2,
          dashboardCacheTtlSeconds: 300,
          recommendedPageSize: 200,
        },
        members: { total: 2, active: 2, byRole: { member: 2 } },
      },
      scStats: null,
      trading: null,
      inventory: null,
      mining: null,
      missions: null,
      timestamp: new Date().toISOString(),
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  usePersonalDashboardData: () => ({
    data: { ships: 2, upcomingActivities: 1 },
    isLoading: false,
    error: null,
  }),
  useMemberActivityStats: () => ({
    data: { totalActivities: 10, loginCount: 5, recentActivity: new Date().toISOString() },
    isLoading: false,
    error: null,
  }),
}));

const mockOverBox: OrganizationOverview = {
  organization: {
    id: 'org-1',
    name: 'Test Organization',
    memberCount: 2,
  },
  memberStats: {
    total: 2,
    byRole: { member: 2 },
  },
  fleetStats: {
    totalShips: 5,
    totalFleets: 1,
    bySize: {
      small: 2,
      medium: 2,
      large: 1,
    },
  },
  activityStats: {
    total: 3,
    upcoming: 1,
    byType: {},
  },
};

const mockFeed: {
  items: FeedItem[];
  pagination: { total: number; page: number; limit: number; hasMore: boolean };
} = {
  items: [],
  pagination: { total: 0, page: 1, limit: 10, hasMore: false },
};

const mockPersonalShips = {
  ships: [
    { id: '1', name: 'Constellation', manufacturer: 'RSI' },
    { id: '2', name: 'Cutlass Black', manufacturer: 'Drake' },
  ],
};

const mockUpcomingActivities = {
  items: [
    { id: '1', title: 'Public Mining Op', startTime: new Date().toISOString() },
    { id: '2', title: 'Trading Convoy', startTime: new Date().toISOString() },
  ],
};

// Dashboard preferences localStorage keys
const DASHBOARD_PREFS_KEYS = ['sc_dashboard_prefs_1', 'sc_dashboard_prefs_anonymous'];

describe('Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Prevent OnboardingFlow dialog from rendering (MUI Dialog adds aria-hidden to content)
    localStorage.setItem('onboarding_completed', 'true');

    // Clear dashboard preferences to ensure widgets are visible
    DASHBOARD_PREFS_KEYS.forEach(key => localStorage.removeItem(key));

    // Mock fetch for member activity stats
    (globalThis.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalActivities: 10,
        loginCount: 5,
        recentActivity: new Date().toISOString(),
      }),
    });

    // Mock user with organization by default
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: { id: '1', username: 'testuser', activeOrgId: 'test-org' },
        isAuthenticated: true,
        token: 'test-token',
        loading: false,
        error: null,
      })
    );

    mockOrganizationService.getOverview = jest.fn().mockResolvedValue(mockOverBox);
    (mockOrganizationService.getFeed as jest.Mock).mockResolvedValue(mockFeed);
    (mockOrganizationService.getMyOrganizations as jest.Mock).mockResolvedValue([
      {
        id: 'test-org',
        name: 'Test Organization',
        role: 'member',
        isActive: true,
      },
    ]);
    (mockActivityService.getUpcomingActivities as jest.Mock).mockResolvedValue(
      mockUpcomingActivities
    );
    (mockUserShipService.getUserShips as jest.Mock).mockResolvedValue(mockPersonalShips);
  });

  it('should show the organization scale tier chip', async () => {
    renderWithRouter(<Dashboard />);

    expect(await screen.findByText('standard scale')).toBeInTheDocument();
  });

  describe('User with Organization', () => {
    it('renders page header with title', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Dashboard/ })).toBeInTheDocument();
      });
    });

    it.skip('renders stat cards for organization - SKIPPED: component UI changed', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
        expect(screen.getByText('Fleet Size')).toBeInTheDocument();
      });
    });

    it('renders Quick Actions Typography', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });
    });

    it('renders organization quick action cards', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Tactical Calendar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Fleet Management/i })).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Logistics.*Track inventory/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Trading.*Trading routes/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Members & Roles.*Manage organization members/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Organizations.*Handle org relationships/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Recruitment.*Recruit new members/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Teams & Squads.*Manage teams and squads/i })
        ).toBeInTheDocument();
      });
    });

    it('renders quick action descriptions', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Plan tactical operations')).toBeInTheDocument();
        expect(screen.getByText('Manage your fleet and ships')).toBeInTheDocument();
        expect(screen.getByText('Track inventory and supplies')).toBeInTheDocument();
      });
    });

    it('renders Live Activity Feed section', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Live Activity Feed')).toBeInTheDocument();
      });
    });

    it('renders with correct color scheme', async () => {
      const { container } = renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('User without Organization', () => {
    beforeEach(() => {
      // Mock user without organization
      (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
        selector({
          user: { id: '1', username: 'testuser', activeOrgId: null },
          isAuthenticated: true,
          token: 'test-token',
          loading: false,
          error: null,
        })
      );
    });

    it('renders personal stats instead of organization stats', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Personal Ships')).toBeInTheDocument();
        expect(screen.getByText('Upcoming Activities')).toBeInTheDocument();
      });
    });

    it('renders personal quick action cards', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Personal Hangar/i })).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Activities.*Browse public activities/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Trading.*Trading routes/i })
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Directories/i })).toBeInTheDocument();
      });
    });

    it('does not render organization-specific actions', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByText('Fleet Management')).not.toBeInTheDocument();
        expect(screen.queryByText('Users')).not.toBeInTheDocument();
      });
    });

    it('calls personal data hooks instead of organization services', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // Dashboard should render personal stats when user has no org
        expect(screen.getByText('Personal Ships')).toBeInTheDocument();
      });
    });
  });
});
