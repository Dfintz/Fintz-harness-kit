import { CrewManifestPanel } from '@/components/fleet/CrewManifestPanel';
import { useCrewAssignmentsQuery } from '@/hooks/queries/useCrewQueries';
import { useOrgShips } from '@/hooks/queries/useOrgShipQueries';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';

jest.mock('@/hooks/queries/useCrewQueries', () => ({
  useCrewAssignmentsQuery: jest.fn(),
}));

jest.mock('@/hooks/queries/useOrgShipQueries', () => ({
  useOrgShips: jest.fn(),
}));

const mockedUseCrewAssignmentsQuery = useCrewAssignmentsQuery as jest.MockedFunction<
  typeof useCrewAssignmentsQuery
>;
const mockedUseOrgShips = useOrgShips as jest.MockedFunction<typeof useOrgShips>;

describe('CrewManifestPanel', () => {
  const renderPanel = () =>
    render(
      <ThemeProvider theme={theme}>
        <CrewManifestPanel />
      </ThemeProvider>
    );

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseOrgShips.mockReturnValue({
      data: {
        data: [
          { id: 'ship-1', customName: 'Hammerhead Alpha' },
          { id: 'ship-2', shipName: 'Carrack' },
        ],
      },
    } as ReturnType<typeof useOrgShips>);
  });

  it('renders loading state', () => {
    mockedUseCrewAssignmentsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useCrewAssignmentsQuery>);

    renderPanel();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    mockedUseCrewAssignmentsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCrewAssignmentsQuery>);

    renderPanel();

    expect(screen.getByText(/No crew assignments found yet/i)).toBeInTheDocument();
  });

  it('renders grouped crew members with roles and ships', () => {
    mockedUseCrewAssignmentsQuery.mockReturnValue({
      data: {
        data: [
          {
            id: 'assignment-1',
            organizationId: 'org-1',
            shipId: 'ship-1',
            assignerId: 'user-1',
            crew: [
              {
                userId: 'crew-1',
                username: 'PilotOne',
                role: 'pilot',
                assignedAt: new Date().toISOString(),
              },
            ],
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'assignment-2',
            organizationId: 'org-1',
            shipId: 'ship-2',
            assignerId: 'user-1',
            crew: [
              {
                userId: 'crew-1',
                username: 'PilotOne',
                role: 'gunner',
                assignedAt: new Date().toISOString(),
              },
            ],
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCrewAssignmentsQuery>);

    renderPanel();

    expect(screen.getByText('PilotOne')).toBeInTheDocument();
    expect(screen.getByText('pilot')).toBeInTheDocument();
    expect(screen.getByText('gunner')).toBeInTheDocument();
    expect(screen.getByText(/Hammerhead Alpha/i)).toBeInTheDocument();
    expect(screen.getByText(/Carrack/i)).toBeInTheDocument();
  });
});
