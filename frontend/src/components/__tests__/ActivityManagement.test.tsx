import { ActivityManagement } from '@/components/ActivityManagement';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { useAuthStore } from '@/store/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock activity service V2
jest.mock('../../services/activityServiceV2');
const mockedActivityService = activityServiceV2 as jest.Mocked<typeof activityServiceV2>;

// Mock auth store
jest.mock('../../store/authStore');
const mockedUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Mock the CreateActivityDialog to avoid deep dependency chain
jest.mock('../CreateActivityDialog', () => ({
  CreateActivityDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-activity-dialog">
        <input type="text" placeholder="Activity title" />
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe('ActivityManagement Component', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@test.com',
    organizationId: 'org-123',
    role: 'member' as const,
    permissions: [],
    twoFactorEnabled: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  const mockActivities = [
    {
      id: 'activity-1',
      title: 'Mining Operation',
      description: 'Group mining at Aaron Halo',
      type: 'mining',
      status: 'open',
      visibility: 'public',
      location: 'Aaron Halo',
      maxParticipants: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: 'user-1',
      organizationId: 'org-123',
    },
    {
      id: 'activity-2',
      title: 'Combat Training',
      description: 'PvP practice session',
      type: 'combat',
      status: 'planning',
      visibility: 'organization',
      maxParticipants: 20,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: 'user-2',
      organizationId: 'org-123',
    },
  ];

  const defaultProps = {
    userId: 'user-1',
    userOrganizations: [{ id: 'org-123', name: 'Test Organization' }],
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderComponent = (props = defaultProps) =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ActivityManagement {...props} />
        </BrowserRouter>
      </QueryClientProvider>
    );

  const render = rtlRender;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthStore.mockReturnValue({ user: mockUser } as any);
    mockedActivityService.getActivities.mockResolvedValue({
      items: mockActivities as any,
      pagination: {
        page: 1,
        limit: 30,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
    mockedActivityService.getActivitiesByStatus.mockResolvedValue({
      items: mockActivities as any,
      pagination: {
        page: 1,
        limit: 30,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
    mockedActivityService.createActivity.mockResolvedValue({
      id: 'new-activity',
      title: 'New Activity',
      type: 'mission',
      status: 'open',
      organizationId: 'org-123',
      creatorId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    mockedActivityService.joinActivity.mockResolvedValue(undefined);
  });

  it('renders Activity Management Typography', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Activities & Events')).toBeInTheDocument();
    });
  });

  it('displays Create Activity button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Create Activity')).toBeInTheDocument();
    });
  });

  it('displays filter controls', async () => {
    renderComponent();

    await waitFor(() => {
      // Multi-select filter dropdowns render their labels
      expect(screen.getAllByText('Type').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    });
  });

  // NOTE (Sprint 3 cleanup): Removed three `it.skip` placeholders that asserted on activity
  // titles, descriptions, and locations rendered inline by ActivityManagement. Rendering of
  // individual activities moved into `UnifiedActivityCard`, which has its own dedicated tests.
  // Re-adding equivalent tests here would duplicate that coverage without adding signal.

  it('shows create form when Create Activity is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Create Activity')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Create Activity'));

    await waitFor(() => {
      // Check for form fields
      const inputs = document.querySelectorAll('input');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('displays empty state when no activities', async () => {
    mockedActivityService.getActivities.mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        limit: 30,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/No activities found/)).toBeInTheDocument();
    });
  });

  it('displays error message on API failure', async () => {
    mockedActivityService.getActivities.mockRejectedValue({
      response: { data: { message: 'Failed to fetch activities' } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch activities')).toBeInTheDocument();
    });
  });

  it('has My Activities checkbox', async () => {
    renderComponent();

    await waitFor(() => {
      const myCheckbox = screen.getByLabelText('My Activities');
      expect(myCheckbox).toBeInTheDocument();
    });
  });
});
