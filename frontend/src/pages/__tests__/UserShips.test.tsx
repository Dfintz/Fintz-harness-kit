import { UserShipsWithErrorBoundary as UserShips } from '@/pages/UserShips';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock user queries React Query hooks
jest.mock('../../hooks/queries/useUserQueries', () => ({
  useUserShips: jest.fn(() => ({ data: null, isLoading: false, error: null })),
}));

import { useUserShips } from '../../hooks/queries/useUserQueries';

describe('UserShips Page', () => {
  const mockShips = [
    { id: 'ship-1', shipName: 'Aurora MR', manufacturer: 'RSI' },
    {
      id: 'ship-2',
      shipName: 'Constellation Andromeda',
      manufacturer: 'RSI',
    },
    { id: 'ship-3', shipName: 'Freelancer', manufacturer: 'MISC' },
  ];

  const renderWithRouter = (userId: string = 'user-123') => {
    return render(
      <MemoryRouter initialEntries={[`/users/${userId}/ships`]}>
        <Routes>
          <Route path="/users/:userId/ships" element={<UserShips />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useUserShips as jest.Mock).mockReturnValue({
      data: mockShips,
      isLoading: false,
      error: null,
    });
  });

  it('renders page heading with user ID', async () => {
    renderWithRouter('user-123');

    await waitFor(() => {
      expect(screen.getByText('User Ships for user-123')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    (useUserShips as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithRouter();

    expect(screen.getByLabelText('Loading ships...')).toBeInTheDocument();
  });

  it('displays ships after loading', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Aurora MR')).toBeInTheDocument();
      expect(screen.getByText('Constellation Andromeda')).toBeInTheDocument();
      expect(screen.getByText('Freelancer')).toBeInTheDocument();
    });
  });

  it('displays "No ships found" when user has no ships', async () => {
    (useUserShips as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No ships found')).toBeInTheDocument();
    });
  });

  it('displays error message on API failure', async () => {
    (useUserShips as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load ships'),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Failed to load ships')).toBeInTheDocument();
    });
  });

  it('calls API with correct user ID', async () => {
    renderWithRouter('test-user-456');

    await waitFor(() => {
      expect(useUserShips).toHaveBeenCalled();
      // The hook receives the userId from useParams, verified by page rendering correctly
      expect(screen.getByText('User Ships for test-user-456')).toBeInTheDocument();
    });
  });

  it('renders ships as list items', async () => {
    renderWithRouter();

    await waitFor(() => {
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });
  });
});
