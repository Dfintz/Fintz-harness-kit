import { Trading } from '@/pages/Trading';
import { useAuthStore } from '@/store/authStore';
import type { TradeOpportunity, TradingRoute } from '@/types/apiV2';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

const theme = createTheme();

// Mock the auth store
jest.mock('../store/authStore');

// Mock React Query trading hooks
jest.mock('../hooks/queries/useTradingQueries', () => ({
  useTradingRoutes: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useTradingOpportunities: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useTradingAnalytics: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useMarketAnalysis: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useTradingPrices: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useCreateTradingRoute: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateTradingRoute: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteTradingRoute: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateRouteStatus: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  usePriceAlerts: jest.fn(() => ({ data: [], isLoading: false })),
  useCreatePriceAlert: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdatePriceAlert: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeletePriceAlert: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUexRoutes: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useUexTerminals: jest.fn(() => ({ data: [], isLoading: false, error: null })),
  useUexCommodities: jest.fn(() => ({ data: [], isLoading: false, error: null })),
}));

import { useTradingOpportunities, useTradingRoutes } from '../hooks/queries/useTradingQueries';

// Mock trading data
const mockRoutes: TradingRoute[] = [
  {
    id: '1',
    name: 'Crusader Medical Run',
    description: 'Medical supplies trading route',
    stops: [
      {
        location: 'Port Olisar',
        order: 1,
        action: 'buy',
        commodity: 'Medical Supplies',
        quantity: 10,
        price: 15.5,
      },
      {
        location: 'Lorville',
        order: 2,
        action: 'sell',
        commodity: 'Medical Supplies',
        quantity: 10,
        price: 22.0,
      },
    ],
    estimatedProfit: 65,
    estimatedDuration: 45,
    status: 'active',
    runs: 5,
    organizationId: 'test-org',
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockOpportunities: TradeOpportunity[] = [
  {
    commodity: 'Medical Supplies',
    buyLocation: 'Port Olisar',
    sellLocation: 'Lorville',
    buyPrice: 15.5,
    sellPrice: 22.0,
    profitPerUnit: 6.5,
    profitMargin: 42,
    estimatedDistance: 100,
    lastUpdated: new Date(),
  },
  {
    commodity: 'Agricultural Supplies',
    buyLocation: 'ArcCorp',
    sellLocation: 'MicroTech',
    buyPrice: 10.0,
    sellPrice: 18.0,
    profitPerUnit: 8.0,
    profitMargin: 80,
    estimatedDistance: 150,
    lastUpdated: new Date(),
  },
];

// Helper to render with Router context, theme, and query client
const renderWithRouter = (component: React.ReactElement) => {
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

describe('Trading Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock user with organization
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: { id: '1', username: 'testuser', organizationId: 'test-org' },
        isAuthenticated: true,
        token: 'test-token',
        loading: false,
        error: null,
      })
    );

    // Mock React Query hook return values
    (useTradingRoutes as jest.Mock).mockReturnValue({
      data: { items: mockRoutes, total: mockRoutes.length },
      isLoading: false,
      error: null,
    });
    (useTradingOpportunities as jest.Mock).mockReturnValue({
      data: { opportunities: mockOpportunities, total: mockOpportunities.length },
      isLoading: false,
      error: null,
    });
  });

  it('renders page header and title', async () => {
    renderWithRouter(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Trading & Routes/)).toBeInTheDocument();
    });
  });

  it('loads and displays opportunities by default', async () => {
    renderWithRouter(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
      expect(screen.getByText('Agricultural Supplies')).toBeInTheDocument();
    });
  });

  it('switches to routes tab', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
    });

    const routesTab = screen.getByText(/My Routes/);
    await user.click(routesTab);

    await waitFor(() => {
      expect(screen.getByText('Crusader Medical Run')).toBeInTheDocument();
    });
  });

  it('displays search controls for opportunities', async () => {
    renderWithRouter(<Trading />);

    await waitFor(() => {
      expect(screen.getByText(/Find Trade Opportunities/)).toBeInTheDocument();
    });
  });

  it('displays error message on API failure', async () => {
    (useTradingOpportunities as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Server error'),
    });

    renderWithRouter(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('renders Create Route button', async () => {
    renderWithRouter(<Trading />);

    await waitFor(() => {
      expect(screen.getByText('Create Route')).toBeInTheDocument();
    });
  });

  it('displays profit margin information', async () => {
    renderWithRouter(<Trading />);

    await waitFor(() => {
      // Check for percentage display
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('42%')).toBeInTheDocument();
    });
  });
});
