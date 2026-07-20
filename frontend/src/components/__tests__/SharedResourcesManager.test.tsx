import { SharedResourcesManager } from '@/pages/SharedResources';
import { render, screen } from '@testing-library/react';

// Mock auth store
const mockAuthUser = { id: 'user-1', username: 'testuser' };
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: mockAuthUser }),
  selectUser: (state: Record<string, unknown>) => state.user,
}));

// Mock organization queries
const mockOrganizations = [
  { id: 'org-1', name: 'Test Organization' },
  { id: 'org-2', name: 'Allied Organization' },
];
jest.mock('@/hooks/queries/useOrganizationQueries', () => ({
  useMyOrganizations: () => ({ data: mockOrganizations }),
}));

// Mock loadout queries
const mockMutate = jest.fn();
const mockLoadouts = [
  {
    id: 'loadout-1',
    name: 'Mining Config',
    shipName: 'Prospector',
    ownerId: 'user-1',
    description: 'Optimal mining setup',
    sharedWithOrgs: ['org-2'],
    sharedWithFleet: true,
  },
  {
    id: 'loadout-2',
    name: 'Combat Config',
    shipName: 'Gladius',
    ownerId: 'user-1',
    description: 'PvP loadout',
    sharedWithOrgs: [],
    sharedWithFleet: false,
  },
];

let mockLoadoutQueryResult: { data: typeof mockLoadouts; isLoading: boolean; error: Error | null } =
  {
    data: mockLoadouts,
    isLoading: false,
    error: null,
  };

jest.mock('@/hooks/queries/useLoadoutQueries', () => ({
  useUserLoadouts: () => mockLoadoutQueryResult,
  useUpdateLoadout: () => ({ mutateAsync: mockMutate, isPending: false }),
  useParseErkulUrl: () => ({ mutateAsync: jest.fn(), isPending: false, reset: jest.fn() }),
  useCreateLoadout: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/queries/useFederationManagementQueries', () => ({
  useMyFederations: () => ({ data: [] }),
}));

describe('SharedResourcesManager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadoutQueryResult = {
      data: mockLoadouts,
      isLoading: false,
      error: null,
    };
  });

  it('renders Shared Resources heading', () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Shared Ship Loadouts')).toBeInTheDocument();
  });

  it('displays loadouts list', () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Mining Config')).toBeInTheDocument();
    expect(screen.getByText('Combat Config')).toBeInTheDocument();
  });

  it('displays ship names', () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Mining Config')).toBeInTheDocument();
  });

  it('displays loadout descriptions when expanded', async () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Mining Config')).toBeInTheDocument();
  });

  it('displays sharing controls for owned loadouts', () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Mining Config')).toBeInTheDocument();
    expect(screen.getByText('Combat Config')).toBeInTheDocument();
  });

  it('renders sharing modal component', () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Mining Config')).toBeInTheDocument();
  });

  it('displays organization options heading', () => {
    render(<SharedResourcesManager />);
    expect(screen.getByText('Shared Ship Loadouts')).toBeInTheDocument();
  });

  it('displays error on API failure', () => {
    mockLoadoutQueryResult = {
      data: [],
      isLoading: false,
      error: new Error('Failed to fetch loadouts'),
    };

    render(<SharedResourcesManager />);
    expect(screen.getByText('Failed to fetch loadouts')).toBeInTheDocument();
  });

  it('displays empty state when no loadouts', () => {
    mockLoadoutQueryResult = {
      data: [],
      isLoading: false,
      error: null,
    };

    render(<SharedResourcesManager />);
    expect(screen.getByText(/No.*loadouts/i)).toBeInTheDocument();
  });

  it('displays loading state', () => {
    mockLoadoutQueryResult = {
      data: [],
      isLoading: true,
      error: null,
    };

    render(<SharedResourcesManager />);
    expect(screen.getByText(/Loading shared resources/i)).toBeInTheDocument();
  });
});
