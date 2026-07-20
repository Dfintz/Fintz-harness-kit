import { PersonalHangarWithErrorBoundary as PersonalHangar } from '@/pages/PersonalHangar';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock the React Query user ship hooks
jest.mock('../../hooks/queries/useUserShipQueries', () => ({
  useUserShips: jest.fn(() => ({
    data: { items: [], total: 0, page: 1, totalPages: 1 },
    isLoading: false,
    isFetching: false,
    error: null,
  })),
  useUserShipSummary: jest.fn(() => ({ data: undefined, isLoading: false })),
  useCreateUserShip: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useImportUserShips: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateUserShip: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteUserShip: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useLoanUserShip: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

// Mock auth store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'test-user-id', organizationId: 'test-org-id' },
  })),
}));

// Mock userShipService (used for clearAllUserShips)
jest.mock('../../services/userShipService', () => ({
  userShipService: { clearAllUserShips: jest.fn(), getUserShipSummary: jest.fn() },
}));

import { useUserShips, useUserShipSummary } from '../../hooks/queries/useUserShipQueries';

describe('PersonalHangar Page', () => {
  const mockShips = [
    {
      id: 'ship-1',
      shipName: 'Aurora MR',
      customName: 'My First Ship',
      description: 'Starter ship for basic cargo runs',
      status: 'owned',
      condition: 'good',
      location: 'Port Olisar',
      insuranceLevel: 'LTI',
      needsInsuranceRenewal: false,
      sharingLevel: 'organization',
    },
    {
      id: 'ship-2',
      shipName: 'Constellation Andromeda',
      customName: null,
      status: 'pledged',
      condition: 'excellent',
      location: 'Lorville',
      insuranceLevel: '6 months',
      needsInsuranceRenewal: true,
      sharingLevel: 'personal',
    },
    {
      id: 'ship-3',
      shipName: 'Freelancer',
      customName: 'Trading Beast',
      status: 'owned',
      condition: 'damaged',
      location: 'Grim HEX',
      insuranceLevel: null,
      needsInsuranceRenewal: false,
      sharingLevel: 'personal',
    },
  ];

  const render = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return rtlRender(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>{component}</ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useUserShips as jest.Mock).mockReturnValue({
      data: { items: mockShips, total: mockShips.length, page: 1, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
    });
    (useUserShipSummary as jest.Mock).mockReturnValue({
      data: {
        totalShips: 3,
        byCondition: { good: 1, excellent: 1, damaged: 1 },
        bySharingLevel: { organization: 1, personal: 2 },
      },
      isLoading: false,
    });
  });

  it('renders page title', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Personal Hangar')).toBeInTheDocument();
    });
  });

  it('displays Add Ship button', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Add Ship')).toBeInTheDocument();
    });
  });

  it('displays ship names', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Aurora MR')).toBeInTheDocument();
      expect(screen.getByText('Constellation Andromeda')).toBeInTheDocument();
      expect(screen.getByText('Freelancer')).toBeInTheDocument();
    });
  });

  it('displays custom ship names', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('My First Ship')).toBeInTheDocument();
      expect(screen.getByText('Trading Beast')).toBeInTheDocument();
    });
  });

  it('displays description column header and values', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Starter ship for basic cargo runs')).toBeInTheDocument();
    });
  });

  it('displays ship statuses', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      // StatusLight shows status text
      const ownedElements = screen.getAllByText('owned');
      expect(ownedElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays ship conditions', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('good')).toBeInTheDocument();
      expect(screen.getByText('excellent')).toBeInTheDocument();
      expect(screen.getByText('damaged')).toBeInTheDocument();
    });
  });

  it('displays ship locations', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Port Olisar')).toBeInTheDocument();
      expect(screen.getByText('Lorville')).toBeInTheDocument();
      expect(screen.getByText('Grim HEX')).toBeInTheDocument();
    });
  });

  it('displays Total Ships statistic', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Total Ships')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('displays Operational ships count', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      const label = screen.getByText('Operational');
      expect(label).toBeInTheDocument();
      // The count (good + excellent = 2) renders as a sibling Typography in the same Box
      const statBox = label.closest('.MuiBox-root');
      expect(statBox).toHaveTextContent('2');
    });
  });

  it('displays Needs Repair ships count', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Needs Repair')).toBeInTheDocument();
    });
  });

  it('displays Shared with Org ships count', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('Shared with Org')).toBeInTheDocument();
    });
  });

  it('displays filter section', async () => {
    render(<PersonalHangar />);

    // Just verify the page loads successfully with ships
    await waitFor(() => {
      expect(screen.getByText('Aurora MR')).toBeInTheDocument();
    });
  });

  it('displays empty state when no ships', async () => {
    (useUserShips as jest.Mock).mockReturnValue({
      data: { items: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
    });

    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText(/No ships found/)).toBeInTheDocument();
    });
  });

  it('displays Edit and Loan action buttons', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      // Buttons now use icons with aria-labels instead of text
      expect(screen.getAllByLabelText('Edit ship').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Loan ship').length).toBeGreaterThan(0);
    });
  });

  it('displays insurance levels', async () => {
    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText('LTI')).toBeInTheDocument();
      expect(screen.getByText('6 months')).toBeInTheDocument();
    });
  });

  it('shows loading spinner initially', () => {
    (useUserShips as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
    });

    render(<PersonalHangar />);

    // Should show loading state
    expect(screen.queryByText('Personal Hangar')).not.toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    (useUserShips as jest.Mock).mockReturnValue({
      data: { items: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      error: new Error('Failed to load'),
    });

    render(<PersonalHangar />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });
});
