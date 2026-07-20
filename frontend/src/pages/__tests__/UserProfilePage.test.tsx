import { UserProfilePageWithErrorBoundary as UserProfilePage } from '@/pages/UserProfilePage';
import { apiClient } from '@/services/apiClient';
import * as userProfileService from '@/services/userProfileService';
import { useAuthStore } from '@/store/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the services and stores
jest.mock('../../services/userProfileService');
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));
jest.mock('../../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

// Helper to render with QueryClientProvider (needed for SCStatsDashboardWidget)
const render = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
};

describe('UserProfilePage', () => {
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    displayName: 'Test User',
    bio: 'Test bio',
    role: 'user',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock useAuthStore as a selector function
    (useAuthStore as unknown as jest.Mock).mockImplementation(selector =>
      selector({ user: mockUser })
    );
  });

  it('renders loading state initially', () => {
    (userProfileService.userProfileService.getMyProfile as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<UserProfilePage />);

    expect(screen.getByText(/Loading user profile/i)).toBeInTheDocument();
  });

  it('renders user profile data when loaded', async () => {
    (userProfileService.userProfileService.getMyProfile as jest.Mock).mockResolvedValue(mockUser);
    (userProfileService.userProfileService.getUserShips as jest.Mock).mockResolvedValue([]);
    (userProfileService.userProfileService.getUserActivityTimeline as jest.Mock).mockResolvedValue(
      []
    );

    render(<UserProfilePage />);

    await waitFor(
      () => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getAllByText('Test bio')).toHaveLength(2); // Appears in header and About tab
  });

  it('handles error state', async () => {
    (userProfileService.userProfileService.getMyProfile as jest.Mock).mockRejectedValue(
      new Error('Failed to load profile')
    );

    render(<UserProfilePage />);

    await waitFor(
      () => {
        expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('shows ships tab when user has ships', async () => {
    const mockShips = [
      {
        id: 'ship-1',
        shipName: 'My Ship',
        manufacturer: 'Aegis',
      },
    ];

    (userProfileService.userProfileService.getMyProfile as jest.Mock).mockResolvedValue({
      ...mockUser,
      showShips: true,
    });
    (userProfileService.userProfileService.getUserShips as jest.Mock).mockResolvedValue(mockShips);
    (userProfileService.userProfileService.getUserActivityTimeline as jest.Mock).mockResolvedValue(
      []
    );

    render(<UserProfilePage />);

    await waitFor(
      () => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Check if ships tab is present
    expect(screen.getByText(/Ships \(1\)/i)).toBeInTheDocument();
  });

  it('does not fetch private data for other users', async () => {
    const otherUser = {
      ...mockUser,
      id: 'other-user',
      isPrivateProfile: true,
      showShips: false,
      showActivity: false,
    };

    // Mock useParams to return a different user slug
    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ slug: 'other-user' });

    (userProfileService.userProfileService.getUserProfile as jest.Mock).mockResolvedValue(
      otherUser
    );

    render(<UserProfilePage />);

    await waitFor(
      () => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify that ships and activity were not fetched
    expect(userProfileService.userProfileService.getUserShips).not.toHaveBeenCalled();
    expect(userProfileService.userProfileService.getUserActivityTimeline).not.toHaveBeenCalled();
  });

  describe('RSI Verification', () => {
    beforeEach(() => {
      (userProfileService.userProfileService.getMyProfile as jest.Mock).mockResolvedValue(mockUser);
      (userProfileService.userProfileService.getUserShips as jest.Mock).mockResolvedValue([]);
      (
        userProfileService.userProfileService.getUserActivityTimeline as jest.Mock
      ).mockResolvedValue([]);

      // Mock apiClient.post
      apiClient.post = jest.fn().mockResolvedValue({ data: {} });
    });

    it('should render profile page for own profile', async () => {
      render(<UserProfilePage />);

      await waitFor(
        () => {
          expect(screen.getByText('Test User')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should render profile page successfully', async () => {
      render(<UserProfilePage />);

      await waitFor(
        () => {
          expect(screen.getByText('Test User')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should render for verified users', async () => {
      const verifiedUser = { ...mockUser, rsiHandle: 'TestRSIHandle', rsiVerified: true };
      (userProfileService.userProfileService.getMyProfile as jest.Mock).mockResolvedValue(
        verifiedUser
      );

      render(<UserProfilePage />);

      await waitFor(
        () => {
          expect(screen.getByText('Test User')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
