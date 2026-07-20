import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { RoleMapping, RoleMappingListResponse } from '@/services/rsiRoleMappingService';

// --- Mocks ---

const mockMappings: RoleMapping[] = [
  {
    id: 'map-1',
    rsiRank: 'Founder',
    discordRoleId: '123456789012345678',
    internalRoleId: 'role-founder',
    rbacPermissions: { admin: true },
    isActive: true,
    priority: 100,
    description: 'Org founder',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    summary: {
      rsiRank: 'Founder',
      hasDiscordRole: true,
      discordRoleId: '123456789012345678',
      hasInternalRole: true,
      hasAutoAssignTeams: false,
      permissionCount: 1,
      isActive: true,
      priority: 100,
    },
  },
];

const mockOrgRoles = [
  { id: 'role-founder', name: 'founder', description: 'Organization founder' },
  { id: 'role-admin', name: 'admin', description: 'Administrator' },
  { id: 'role-officer', name: 'officer', description: 'Officer role' },
  { id: 'role-member', name: 'member', description: 'Basic member' },
];

const mockGetMappings = jest.fn<Promise<RoleMappingListResponse>, [string, boolean]>();
const mockGetTemplates = jest.fn();
const mockGetOrganizationRoles = jest.fn();
const mockGetDiscoveredRanks = jest.fn();
const mockCreateMapping = jest.fn();
const mockUpdateMapping = jest.fn();
const mockDeleteMapping = jest.fn();

jest.mock('@/services/rsiRoleMappingService', () => ({
  RSI_ROLE_TYPES: ['Founder', 'Officer', 'Recruitment', 'Marketing'],
  STANDARD_STAR_RANKS: {
    0: 'Rank 0',
    1: 'Rank 1',
    2: 'Rank 2',
    3: 'Rank 3',
    4: 'Rank 4',
    5: 'Rank 5',
  },
  RSI_RANKS_FALLBACK: [
    'Founder',
    'Officer',
    'Recruitment',
    'Marketing',
    'Rank 5',
    'Rank 4',
    'Rank 3',
    'Rank 2',
    'Rank 1',
    'Rank 0',
  ],
  rsiRoleMappingService: {
    getMappings: (...args: unknown[]) => mockGetMappings(...(args as [string, boolean])),
    getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    getOrganizationRoles: (...args: unknown[]) => mockGetOrganizationRoles(...args),
    getDiscoveredRanks: (...args: unknown[]) => mockGetDiscoveredRanks(...args),
    createMapping: (...args: unknown[]) => mockCreateMapping(...args),
    updateMapping: (...args: unknown[]) => mockUpdateMapping(...args),
    deleteMapping: (...args: unknown[]) => mockDeleteMapping(...args),
  },
}));

jest.mock('@/services/discordService', () => ({
  discordService: {
    getGuildRoles: jest.fn().mockResolvedValue([
      { id: '123456789012345678', name: 'Leader' },
      { id: '223456789012345678', name: 'Officer' },
    ]),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Import after mocks
import { RoleMappingPanel } from '@/components/organization/RoleMappingPanel';

describe('RoleMappingPanel', () => {
  const defaultProps = { organizationId: 'org-1', guildId: 'guild-1' } as const;

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMappings.mockResolvedValue({ mappings: mockMappings, count: 1 });
    mockGetTemplates.mockResolvedValue([]);
    mockGetOrganizationRoles.mockResolvedValue(mockOrgRoles);
    mockGetDiscoveredRanks.mockResolvedValue({
      roles: ['Founder', 'Officer', 'Recruitment', 'Marketing'],
      ranks: [0, 1, 2, 3, 4, 5],
    });
  });

  it('renders loading state initially', () => {
    // Never resolve to keep loading
    mockGetMappings.mockReturnValue(new Promise(() => {}));
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders mappings table after loading', async () => {
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Founder')).toBeInTheDocument();
    });
    // Web role column shows resolved name
    expect(screen.getByText('founder')).toBeInTheDocument();
    // Discord role column shows name with ID
    expect(screen.getByText(/Leader.*123456789012345678/)).toBeInTheDocument();
    // Status chip
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows empty state when no mappings exist', async () => {
    mockGetMappings.mockResolvedValue({ mappings: [], count: 0 });
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/No role mappings configured/)).toBeInTheDocument();
    });
  });

  it('renders title "Role Mapping: RSI → Web Role"', async () => {
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Role Mapping: RSI → Web Role')).toBeInTheDocument();
    });
  });

  it('shows table headers with Web Role before Discord Role', async () => {
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('RSI Rank')).toBeInTheDocument();
    });
    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map(h => h.textContent);
    const webRoleIdx = headerTexts.indexOf('Web Role');
    const discordIdx = headerTexts.indexOf('Discord Role');
    expect(webRoleIdx).toBeLessThan(discordIdx);
  });

  it('opens create dialog with Add Mapping button', async () => {
    const user = userEvent.setup();
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Mapping'));
    expect(screen.getByText('Create Role Mapping')).toBeInTheDocument();
  });

  it('disables Create button when web role is not selected', async () => {
    const user = userEvent.setup();
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Mapping'));

    // Create button should be disabled (no rank or web role selected yet)
    const createBtn = screen.getByRole('button', { name: 'Create' });
    expect(createBtn).toBeDisabled();
  });

  it('opens edit dialog with pre-filled values', async () => {
    const user = userEvent.setup();
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Founder')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByLabelText('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Role Mapping')).toBeInTheDocument();
  });

  it('calls deleteMapping and reloads on delete after confirmation', async () => {
    const user = userEvent.setup();
    mockDeleteMapping.mockResolvedValue(undefined);
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Founder')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('Delete');
    await user.click(deleteButtons[0]);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Delete Role Mapping')).toBeInTheDocument();
    });

    // Click the confirm button
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteMapping).toHaveBeenCalledWith('org-1', 'map-1');
    });
    // getMappings called again to reload
    expect(mockGetMappings.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows alert on load error', async () => {
    mockGetMappings.mockRejectedValue(new Error('Network error'));
    mockGetTemplates.mockRejectedValue(new Error('fail'));
    mockGetOrganizationRoles.mockRejectedValue(new Error('fail'));
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows Web Role dropdown in dialog with org roles', async () => {
    const user = userEvent.setup();
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Mapping'));

    // Web Role autocomplete field should be present
    const dialog = screen.getByRole('dialog');
    const webRoleInput = within(dialog).getByLabelText('Web Role *');
    expect(webRoleInput).toBeInTheDocument();
  });

  it('shows Discord Role dropdown as optional in dialog', async () => {
    const user = userEvent.setup();
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Mapping'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Discord Role (optional)')).toBeInTheDocument();
  });

  it('filters already-mapped ranks from RSI Rank options', async () => {
    const user = userEvent.setup();
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Mapping'));

    // Open RSI Rank autocomplete
    const dialog = screen.getByRole('dialog');
    const rankInput = within(dialog).getByLabelText('RSI Rank *');
    await user.click(rankInput);

    // Founder is already mapped, so should not appear as a selectable option
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      const optionTexts = options.map(o => o.textContent);
      expect(optionTexts).not.toContain('Founder');
      // Officer should be available since it's not mapped
      expect(optionTexts).toContain('Officer');
    });
  });

  it('calls createMapping with correct payload on save', async () => {
    const user = userEvent.setup();
    mockCreateMapping.mockResolvedValue({ id: 'map-new', rsiRank: 'Officer' });
    render(<RoleMappingPanel {...defaultProps} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Mapping'));

    const dialog = screen.getByRole('dialog');

    // Select RSI Rank — "Officer" via autocomplete
    const rankInput = within(dialog).getByLabelText('RSI Rank *');
    await user.click(rankInput);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Officer' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('option', { name: 'Officer' }));

    // Select Web Role — "officer"
    const webRoleInput = within(dialog).getByLabelText('Web Role *');
    await user.click(webRoleInput);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'officer' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('option', { name: 'officer' }));

    // Click Create
    const createBtn = screen.getByRole('button', { name: 'Create' });
    expect(createBtn).not.toBeDisabled();
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockCreateMapping).toHaveBeenCalledWith('org-1', {
        rsiRank: 'Officer',
        internalRoleId: 'role-officer',
        isActive: true,
        priority: 0,
        discordRoleId: undefined,
        description: undefined,
      });
    });
  });
});
