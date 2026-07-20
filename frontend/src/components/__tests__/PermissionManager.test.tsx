import { PermissionManager } from '@/components/PermissionManager';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock React Query hooks
const mockGrantPermission = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };
const mockRevokePermission = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };
const mockUpdateSecurityLevel = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };
const mockSetSecurityLevel = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };

jest.mock('@/hooks/queries/usePermissionQueries', () => ({
  useUserPermissions: jest.fn(),
  useGrantPermission: jest.fn(() => mockGrantPermission),
  useRevokePermission: jest.fn(() => mockRevokePermission),
  useUpdateSecurityLevel: jest.fn(() => mockUpdateSecurityLevel),
}));

jest.mock('@/hooks/queries/useSecurityLevelQueries', () => ({
  useOrgSecurityLevels: jest.fn(),
  useSetSecurityLevel: jest.fn(() => mockSetSecurityLevel),
}));

jest.mock('@/hooks/queries/useRelationshipQueries', () => ({
  useOrgRelationships: jest.fn(() => ({
    data: { data: [] },
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/queries/useAllianceQueries', () => ({
  useAlliances: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/queries/useFederationManagementQueries', () => ({
  useMyFederations: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/queries/useOrganizationQueries', () => ({
  useOrganizationMembers: jest.fn(() => ({
    data: {
      items: [
        { userId: 'user-1', username: 'testuser1', displayName: 'Test User 1' },
        { userId: 'user-2', username: 'testuser2', displayName: 'Test User 2' },
      ],
      pagination: { total: 2, page: 1, pageSize: 100, totalPages: 1 },
    },
    isLoading: false,
  })),
}));

import { useUserPermissions } from '@/hooks/queries/usePermissionQueries';
import { useOrgSecurityLevels } from '@/hooks/queries/useSecurityLevelQueries';

const mockedUseUserPermissions = useUserPermissions as jest.Mock;
const mockedUseOrgSecurityLevels = useOrgSecurityLevels as jest.Mock;

describe('PermissionManager Component', () => {
  const mockPermissions = [
    {
      id: 'perm-1',
      userId: 'user-1',
      organizationId: 'org-1',
      resource: 'events',
      action: 'read',
      granted: true,
      grantedBy: 'admin',
      expiresAt: null,
    },
    {
      id: 'perm-2',
      userId: 'user-2',
      organizationId: 'org-1',
      resource: 'ships',
      action: 'create',
      granted: true,
      grantedBy: 'admin',
      expiresAt: '2025-12-31T00:00:00.000Z',
    },
  ];

  const mockSecurityLevels = [
    {
      id: 'sec-1',
      fromOrganizationId: 'org-1',
      toOrganizationId: 'org-2',
      level: 3,
      resourceType: 'events',
      accessLevel: 'read',
    },
  ];

  const mockOrganizations = [
    { id: 'org-1', name: 'Test Organization' },
    { id: 'org-2', name: 'Allied Organization' },
    { id: 'org-3', name: 'Partner Organization' },
  ];

  const defaultProps = {
    userId: 'user-1',
    organizationId: 'org-1',
    organizations: mockOrganizations,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseUserPermissions.mockReturnValue({
      data: mockPermissions,
      isLoading: false,
      error: null,
    });
    mockedUseOrgSecurityLevels.mockReturnValue({
      data: mockSecurityLevels,
      isLoading: false,
      error: null,
    });
    mockGrantPermission.mutateAsync.mockResolvedValue({});
    mockRevokePermission.mutateAsync.mockResolvedValue({});
    mockUpdateSecurityLevel.mutateAsync.mockResolvedValue({});
    mockSetSecurityLevel.mutateAsync.mockResolvedValue({});
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('renders heading', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Permission & Access Control Manager/)).toBeInTheDocument();
    });
  });

  it('renders tab buttons', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('User Permissions')).toBeInTheDocument();
      expect(screen.getByText('Security Levels')).toBeInTheDocument();
      expect(screen.getByText('Inter-Org Security')).toBeInTheDocument();
    });
  });

  it('displays permissions on User Permissions tab', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      // Look for the resource:action format
      const eventsRead = screen.getAllByText(/events/);
      expect(eventsRead.length).toBeGreaterThan(0);
    });
  });

  it('displays Grant Permission form', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      // Look for the heading h3
      const grantPermissionElements = screen.getAllByText('Grant Permission');
      expect(grantPermissionElements.length).toBeGreaterThan(0);
    });
  });

  it('displays Revoke button for each permission', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      // Revoke buttons are icon buttons with tooltip "Revoke permission"
      const revokeButtons = screen.getAllByRole('button', { name: /Revoke permission/ });
      expect(revokeButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to Security Levels tab', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Security Levels')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Security Levels'));

    expect(screen.getByText('Update User Security Level')).toBeInTheDocument();
  });

  it('displays security level guide', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Security Levels')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Security Levels'));

    expect(screen.getByText('Security Level Guide')).toBeInTheDocument();
    expect(screen.getByText(/Standard member access/)).toBeInTheDocument();
  });

  it('switches to Inter-Org Security tab', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Inter-Org Security')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Inter-Org Security'));

    expect(screen.getByText('Set Inter-Organization Security Level')).toBeInTheDocument();
  });

  it('displays inter-org security levels', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Inter-Org Security')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Inter-Org Security'));

    expect(screen.getByText('Active Inter-Org Security Levels')).toBeInTheDocument();
  });

  it('displays target member dropdown', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      const selects = screen.getAllByText(/Target Member/i);
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('can submit grant permission form', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getAllByText(/Target Member/i).length).toBeGreaterThan(0);
    });

    // Find and click the submit button (it's type="submit")
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      await userEvent.setup().click(submitButton);
    }

    // Form submission with no member selected shouldn't crash
  });

  it('displays Revoke buttons that can be clicked', async () => {
    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    // Wait for permissions to render
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Revoke permission/ }).length).toBeGreaterThan(
        0
      );
    });

    // Verify revoke buttons are rendered and clickable
    const revokeButtons = screen.getAllByRole('button', { name: /Revoke permission/ });
    expect(revokeButtons[0]).toBeEnabled();
  });

  it('displays error message on API failure', async () => {
    mockedUseUserPermissions.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to load permissions'),
    });

    renderWithQueryClient(<PermissionManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load permissions')).toBeInTheDocument();
    });
  });
});
