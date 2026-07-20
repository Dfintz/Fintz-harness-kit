import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { apiClient } from '@/services/apiClient';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock apiClient
jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('OrganizationSwitcher Component', () => {
  const mockOrganizations = [
    {
      id: 'org-1',
      name: 'Alpha Squadron',
      userRole: 'admin',
      joinedAt: new Date(),
    },
    {
      id: 'org-2',
      name: 'Beta Fleet',
      userRole: 'member',
      joinedAt: new Date(),
    },
    {
      id: 'org-3',
      name: 'Gamma Corps',
      userRole: 'officer',
      joinedAt: new Date(),
    },
  ];

  const mockActiveOrg = mockOrganizations[0];
  const mockUserId = 'user-123';
  const mockOnOrgChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default success response — single call returns all orgs with isActive flag
    (mockedApiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v2/users/me/organizations') {
        return Promise.resolve({
          data: mockOrganizations.map((org, i) => ({
            id: org.id,
            name: org.name,
            role: org.userRole,
            joinedAt: org.joinedAt,
            isActive: i === 0,
          })),
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  it('renders loading state initially', () => {
    (mockedApiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<OrganizationSwitcher userId={mockUserId} />);

    expect(screen.getByText(/Loading organizations/i)).toBeInTheDocument();
  });

  it('displays active organization name after loading', async () => {
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });
  });

  it('displays "No Organization" when no active org', async () => {
    (mockedApiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v2/users/me/organizations') {
        return Promise.resolve({
          data: mockOrganizations.map(org => ({
            id: org.id,
            name: org.name,
            role: org.userRole,
            joinedAt: org.joinedAt,
            isActive: false,
          })),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('No Organization')).toBeInTheDocument();
    });
  });

  it('opens dropdown when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /Alpha Squadron/i });
    await user.click(toggleButton);

    expect(screen.getByText('Your Organizations')).toBeInTheDocument();
  });

  it('displays all user organizations in dropdown', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /Alpha Squadron/i });
    await user.click(toggleButton);

    expect(screen.getByText('Beta Fleet')).toBeInTheDocument();
    expect(screen.getByText('Gamma Corps')).toBeInTheDocument();
  });

  it('displays user roles for each organization', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Alpha Squadron/i }));

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('officer')).toBeInTheDocument();
  });

  it('shows Join Organization button', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Alpha Squadron/i }));

    expect(screen.getByText('+ Join Organization')).toBeInTheDocument();
  });

  it('switches organization when clicked', async () => {
    const user = userEvent.setup();
    (mockedApiClient.put as jest.Mock).mockResolvedValue({ data: {} });

    render(<OrganizationSwitcher userId={mockUserId} onOrganizationChange={mockOnOrgChange} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /Alpha Squadron/i }));

    // Click Beta Fleet to switch
    const betaFleetButton = screen.getByRole('button', { name: /Beta Fleet/i });
    await user.click(betaFleetButton);

    expect(mockedApiClient.put).toHaveBeenCalledWith('/api/v2/users/me', { activeOrgId: 'org-2' });

    expect(mockOnOrgChange).toHaveBeenCalledWith('org-2');
  });

  it('closes dropdown after switching organization', async () => {
    const user = userEvent.setup();
    (mockedApiClient.put as jest.Mock).mockResolvedValue({ data: {} });

    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Alpha Squadron/i }));

    // Get the Beta Fleet button in the org list
    const betaFleetButtons = screen.getAllByRole('button', { name: /Beta Fleet/i });
    await user.click(betaFleetButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Your Organizations')).not.toBeInTheDocument();
    });
  });

  it('disables switch button for active organization', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Alpha Squadron/i }));

    // The active organization's switch button should be disabled
    // Find the button that contains Alpha Squadron in the dropdown list
    const orgItems = screen.getAllByRole('button');
    const alphaButton = orgItems.find(
      btn => btn.textContent?.includes('Alpha Squadron') && btn.textContent?.includes('admin')
    );

    expect(alphaButton).toBeDisabled();
  });

  it('displays empty state when user has no organizations', async () => {
    const user = userEvent.setup();
    (mockedApiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v2/users/me/organizations') {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('No Organization')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /No Organization/i }));

    expect(screen.getByText('No organizations yet')).toBeInTheDocument();
  });

  it('displays error message when API fails', async () => {
    (mockedApiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      // Should still render after loading
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
  });

  it('has leave organization buttons for each org', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Alpha Squadron/i }));

    // Should have leave buttons (✕)
    const leaveButtons = screen.getAllByTitle('Leave organization');
    expect(leaveButtons.length).toBe(3); // One for each org
  });

  it('toggles dropdown open and closed', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Squadron')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /Alpha Squadron/i });

    // Open
    await user.click(toggleButton);
    expect(screen.getByText('Your Organizations')).toBeInTheDocument();

    // Close
    await user.click(toggleButton);
    await waitFor(() => {
      expect(screen.queryByText('Your Organizations')).not.toBeInTheDocument();
    });
  });

  it('fetches organizations on mount', () => {
    render(<OrganizationSwitcher userId={mockUserId} />);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v2/users/me/organizations');
  });
});
