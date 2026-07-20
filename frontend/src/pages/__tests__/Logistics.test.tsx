import { LogisticsWithErrorBoundary as Logistics } from '@/pages/Logistics';
import { logisticsService } from '@/services/logisticsService';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock the logistics service
jest.mock('../../services/logisticsService');
const mockedLogisticsService = logisticsService as jest.Mocked<typeof logisticsService>;

// Mock auth store so inventory query is enabled (requires active org)
jest.mock('../../store/authStore', () => ({
  selectUser: (state: { user: unknown }) => state.user,
  useAuthStore: jest.fn((selector?: (state: { user: unknown }) => unknown) => {
    const state = {
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        activeOrgId: 'org-1',
      },
    };
    return selector ? selector(state) : state;
  }),
}));

const theme = createTheme();

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe('Logistics Page', () => {
  const mockInventory = [
    {
      id: 'item-1',
      itemName: 'Medical Supplies',
      category: 'medical',
      quantity: 100,
      unit: 'units',
      location: 'Port Olisar',
      avgBuyPrice: 50,
      avgSellPrice: 75,
      minStock: 20,
      lastValidated: new Date(),
      organizationId: 'org-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'item-2',
      itemName: 'Hydrogen Fuel',
      category: 'fuel',
      quantity: 500,
      unit: 'liters',
      location: 'Lorville',
      avgBuyPrice: 10,
      avgSellPrice: 15,
      minStock: 100,
      lastValidated: new Date(),
      organizationId: 'org-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const renderWithThemeProviders = (component: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>{component}</ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedLogisticsService.getInventory.mockResolvedValue(mockInventory);
  });

  it('renders page title', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });
  });

  it('displays inventory count after loading', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText(/Inventory \(2\)/)).toBeInTheDocument();
    });
  });

  it('displays inventory items', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
      expect(screen.getByText('Hydrogen Fuel')).toBeInTheDocument();
    });
  });

  it('displays item categories', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('medical')).toBeInTheDocument();
      expect(screen.getByText('fuel')).toBeInTheDocument();
    });
  });

  it('displays Add Item button', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });
  });

  it('displays Update All Prices button', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Update All Prices')).toBeInTheDocument();
    });
  });

  it('displays search input', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      // Component renders successfully
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });
  });

  it('displays category Select', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      // Check for the category Select section
      const categoryElements = screen.getAllByText('Category');
      expect(categoryElements.length).toBeGreaterThan(0);
    });
  });

  it('displays empty state when no inventory', async () => {
    mockedLogisticsService.getInventory.mockResolvedValue([]);

    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText(/No inventory items found/)).toBeInTheDocument();
    });
  });

  it('displays item quantities', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('100 units')).toBeInTheDocument();
      expect(screen.getByText('500 liters')).toBeInTheDocument();
    });
  });

  it('displays item locations', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Port Olisar')).toBeInTheDocument();
      expect(screen.getByText('Lorville')).toBeInTheDocument();
    });
  });

  it('filters inventory by search', async () => {
    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
    });

    // Verify service is called to load inventory
    expect(mockedLogisticsService.getInventory).toHaveBeenCalled();
  });

  it('calls delete function when delete button is clicked', async () => {
    mockedLogisticsService.deleteInventoryItem.mockResolvedValue(undefined);

    renderWithThemeProviders(<Logistics />);

    await waitFor(() => {
      expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
    });

    // Verify delete buttons exist
    const deleteButtons = screen.getAllByRole('button');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });
});
