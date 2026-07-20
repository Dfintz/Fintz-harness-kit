import { Trading } from '@/pages/Trading';
import { tradingServiceV2 } from '@/services/tradingServiceV2';
import { useAuthStore } from '@/store/authStore';
import { theme } from '@/theme';
import type { PaginatedResult, TradingOpportunities, TradingRouteV2 } from '@/types/apiV2';
import { RouteStatus } from '@/types/apiV2';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock the trading service V2
jest.mock('../../services/tradingServiceV2');
const mockedTradingService = tradingServiceV2 as jest.Mocked<typeof tradingServiceV2>;

// Mock auth store
jest.mock('../../store/authStore');
const mockedUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Mock React Query trading hooks (used by Price Alerts tab)
const mockCreateAlertMutateAsync = jest.fn();
const mockUpdateAlertMutateAsync = jest.fn();
const mockDeleteAlertMutateAsync = jest.fn();
jest.mock('../../hooks/queries/useTradingQueries', () => ({
  ...jest.requireActual('../../hooks/queries/useTradingQueries'),
  usePriceAlerts: () => ({ data: [], isLoading: false }),
  useCreatePriceAlert: () => ({ mutateAsync: mockCreateAlertMutateAsync, isPending: false }),
  useUpdatePriceAlert: () => ({ mutateAsync: mockUpdateAlertMutateAsync, isPending: false }),
  useDeletePriceAlert: () => ({ mutateAsync: mockDeleteAlertMutateAsync, isPending: false }),
}));

describe('Trading Page', () => {
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

  const mockOpportunities: TradingOpportunities = {
    opportunities: [
      {
        id: 'opp-1',
        name: 'Medical Supplies Run',
        description: 'Medical supplies from Port Olisar to Lorville',
        creatorId: 'user-1',
        commodity: 'Medical Supplies',
        buyLocation: 'Port Olisar',
        buyPrice: 100,
        sellLocation: 'Lorville',
        sellPrice: 200,
        profitMargin: 100,
        stops: [
          { location: 'Port Olisar', buyGoods: ['Medical Supplies'], order: 1 },
          { location: 'Lorville', sellGoods: ['Medical Supplies'], order: 2 },
        ],
        status: RouteStatus.ACTIVE,
        tags: ['medical'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profitPerHour: 5000,
        rating: 4.5,
      },
      {
        id: 'opp-2',
        name: 'Agricultural Goods Run',
        description: 'Agricultural goods from Hurston to Area18',
        creatorId: 'user-1',
        commodity: 'Agricultural Goods',
        buyLocation: 'Hurston',
        buyPrice: 50,
        sellLocation: 'Area18',
        sellPrice: 120,
        profitMargin: 140,
        stops: [
          { location: 'Hurston', buyGoods: ['Agricultural Goods'], order: 1 },
          { location: 'Area18', sellGoods: ['Agricultural Goods'], order: 2 },
        ],
        status: RouteStatus.ACTIVE,
        tags: ['agriculture'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profitPerHour: 6000,
        rating: 4.2,
      },
    ] as any,
    count: 2,
    filters: { minProfit: 0, maxDistance: 0 },
  };

  const mockRoutes: PaginatedResult<TradingRouteV2> = {
    items: [
      {
        id: 'route-1',
        name: 'Crusader Medical Run',
        description: 'Medical supply route through Crusader system',
        creatorId: 'user-1',
        stops: [
          { location: 'Port Olisar', order: 1, buyGoods: ['Medical'] },
          { location: 'Lorville', order: 2, sellGoods: ['Medical'] },
        ],
        estimatedProfit: 2500,
        status: RouteStatus.ACTIVE,
        tags: ['medical', 'crusader'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    pagination: { page: 1, limit: 30, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  };

  let queryClient: QueryClient;

  const renderWithProviders = (component: React.ReactElement) => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return rtlRender(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>{component}</ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  const render = renderWithProviders;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthStore.mockReturnValue(mockUser);
    mockedTradingService.getOpportunities.mockResolvedValue(mockOpportunities);
    mockedTradingService.getRoutes.mockResolvedValue(mockRoutes);
  });

  it('renders page title', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Trading & Routes/)).toBeInTheDocument();
    });
  });

  it('displays Find Trade Opportunities section', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Find Trade Opportunities')).toBeInTheDocument();
    });
  });

  it('displays Create Route button', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Create Route')).toBeInTheDocument();
    });
  });

  it('displays Find Opportunities button', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Find Opportunities')).toBeInTheDocument();
    });
  });

  it('displays Optimize Route button', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Optimize Route')).toBeInTheDocument();
    });
  });

  it('displays Start Location input', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g., Port Olisar')).toBeInTheDocument();
    });
  });

  it('displays Min Profit input', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByLabelText('Min Profit %')).toBeInTheDocument();
    });
  });

  it('displays opportunities tab', async () => {
    render(<Trading />);

    await waitFor(() => {
      // Look for the tab - it has the count
      const tabElements = screen.getAllByText(/Opportunities/);
      expect(tabElements.length).toBeGreaterThan(0);
    });
  });

  it('displays routes tab', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/My Routes/)).toBeInTheDocument();
    });
  });

  it('displays trading opportunities', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
      expect(screen.getByText('Agricultural Goods')).toBeInTheDocument();
    });
  });

  it('displays buy and sell locations', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Port Olisar')).toBeInTheDocument();
      expect(screen.getByText('Lorville')).toBeInTheDocument();
    });
  });

  it('displays empty state when no opportunities', async () => {
    mockedTradingService.getOpportunities.mockResolvedValue({
      opportunities: [],
      count: 0,
      filters: { minProfit: 0, maxDistance: 0 },
    });

    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/No opportunities found/)).toBeInTheDocument();
    });
  });

  it('switches to routes tab when clicked', async () => {
    const user = userEvent.setup();
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/My Routes/)).toBeInTheDocument();
    });

    // Click the My Routes tab
    await user.click(screen.getByText(/My Routes/));

    await waitFor(() => {
      expect(mockedTradingService.getRoutes).toHaveBeenCalled();
    });
  });

  it('calls getOpportunities when search is clicked', async () => {
    const user = userEvent.setup();
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Find Opportunities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Find Opportunities'));

    expect(mockedTradingService.getOpportunities).toHaveBeenCalled();
  });

  it('displays Profitable Opportunities Typography', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Profitable Opportunities')).toBeInTheDocument();
    });
  });

  // ==================== Price Alerts Tab ====================

  it('displays Price Alerts tab', async () => {
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Price Alerts/)).toBeInTheDocument();
    });
  });

  it('switches to Price Alerts tab and shows empty state', async () => {
    const user = userEvent.setup();
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Price Alerts/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Price Alerts/));

    await waitFor(() => {
      expect(screen.getByText(/No price alerts configured/)).toBeInTheDocument();
    });
  });

  it('shows New Alert button on Price Alerts tab', async () => {
    const user = userEvent.setup();
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Price Alerts/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Price Alerts/));

    await waitFor(() => {
      expect(screen.getByText('New Alert')).toBeInTheDocument();
    });
  });

  it('opens create alert dialog when New Alert is clicked', async () => {
    const user = userEvent.setup();
    render(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Price Alerts/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Price Alerts/));

    await waitFor(() => {
      expect(screen.getByText('New Alert')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Alert'));

    await waitFor(() => {
      expect(screen.getByText('Create Price Alert')).toBeInTheDocument();
      expect(screen.getByLabelText('Commodity *')).toBeInTheDocument();
    });
  });
});
