import { OrganizationShipsWithErrorBoundary as OrganizationShips } from '@/pages/OrganizationShips';
import { render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="recharts-responsive-container">{children}</div>
    ),
  };
});

jest.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string; activeOrgId: string } }) => unknown) =>
    selector({ user: { id: 'user-1', activeOrgId: 'org-123' } }),
  useHasMinOrgRole: jest.fn(() => true),
}));

jest.mock('../../store/uiStore', () => ({
  useNotification: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}));

// Mock org ship React Query hooks
jest.mock('../../hooks/queries/useOrgShipQueries', () => ({
  useOrgShips: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
  })),
  useLoanOrgShip: jest.fn(() => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false })),
  useReturnOrgShipLoan: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

// Mock ship catalogue query used for enrichment in the page
jest.mock('../../hooks/queries/useShipCatalogueQueries', () => ({
  useShipCatalogue: jest.fn(() => ({
    data: { items: [] },
    isLoading: false,
    error: null,
  })),
}));

import { useOrgShips } from '../../hooks/queries/useOrgShipQueries';

// Mock @tanstack/react-query (for inline useQuery for member ships + useQueryClient)
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => ({ data: [], isLoading: false, error: null })),
  useQueries: jest.fn(() => []),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

// Mock query keys
jest.mock('../../hooks/queries/queryKeys', () => ({
  organizationKeys: {
    ships: (id?: string) => ['organizations', id, 'ships'],
    detail: (id?: string) => ['organizations', id],
  },
  fleetKeys: {
    all: ['fleets'],
    lists: () => ['fleets', 'list'],
    list: (filters?: Record<string, unknown>) => ['fleets', 'list', filters],
    ships: (id: string) => ['fleets', id, 'ships'],
  },
}));

// Mock fleet statistics and fleets hooks
jest.mock('../../hooks/queries/useFleetQueries', () => ({
  useFleetStatistics: jest.fn(() => ({ data: undefined, isLoading: false })),
  useFleets: jest.fn(() => ({ data: undefined, isLoading: false })),
}));

// Mock user ship service (used by member ships tab)
jest.mock('../../services/userShipService', () => ({
  userShipService: {
    getOrgAvailableShips: jest.fn().mockResolvedValue([]),
  },
}));

// Mock ship loan service (used by loans tab)
jest.mock('../../services/shipLoanService', () => ({
  shipLoanService: {
    getOrgLoanHistory: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock organization ship service (used for create operations)
jest.mock('../../services/organizationShipService', () => ({
  organizationShipService: {
    getOrgShips: jest.fn(),
    createOrgShip: jest.fn(),
  },
}));

// Mock fleet service (used for fleet ship mapping)
jest.mock('../../services/fleetServiceV2', () => ({
  fleetServiceV2: {
    getFleetShips: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

// Mock useLoaderData
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLoaderData: () => null,
}));

describe('OrganizationShips Page', () => {
  const mockShips = [
    { id: 'ship-1', shipName: 'Constellation Andromeda', name: 'Flagship' },
    { id: 'ship-2', shipName: 'Carrack', name: 'Explorer' },
    { id: 'ship-3', shipId: 'hammerhead-001', name: 'Defender' },
  ];

  const renderWithRouter = (orgId: string = 'org-123') => {
    return render(
      <MemoryRouter initialEntries={[`/organizations/${orgId}/ships`]}>
        <Routes>
          <Route path="/organizations/:orgId/ships" element={<OrganizationShips />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgShips as jest.Mock).mockReturnValue({
      data: mockShips,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('renders page heading', async () => {
    renderWithRouter('org-123');

    await waitFor(() => {
      expect(screen.getByText('Fleet Operations')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    (useOrgShips as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays ships after loading', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Constellation Andromeda')).toBeInTheDocument();
      expect(screen.getByText('Carrack')).toBeInTheDocument();
    });
  });

  it('displays empty message when organization has no ships', async () => {
    (useOrgShips as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/No fleet ships found/)).toBeInTheDocument();
    });
  });

  it('displays error message on API failure', async () => {
    (useOrgShips as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: new Error('Failed to load organization ships'),
      refetch: jest.fn(),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Failed to load organization ships')).toBeInTheDocument();
    });
  });

  it('renders ships in a data table', async () => {
    renderWithRouter();

    await waitFor(() => {
      // DataTable renders rows (header row + 3 data rows)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });
  });
});
