/**
 * OpportunitiesList Component Tests
 *
 * Tests for the routing-independent OpportunitiesList component
 * No router mocking needed!
 */

import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { muiTheme } from '@/theme/muiTheme';
import { OpportunitiesList } from '@/components/trading/OpportunitiesList';
import type { OpportunityDisplay } from '@/components/trading/types';

// Simple render helper - NO ROUTER NEEDED!
const renderComponent = (props: React.ComponentProps<typeof OpportunitiesList>) => {
  return render(
    <MuiThemeProvider theme={muiTheme}>
      <OpportunitiesList {...props} />
    </MuiThemeProvider>
  );
};

describe('OpportunitiesList Component', () => {
  const mockOpportunities: OpportunityDisplay[] = [
    {
      commodity: 'Medical Supplies',
      buyLocation: 'Port Olisar',
      sellLocation: 'Lorville',
      buyPrice: 100,
      sellPrice: 160,
      profitPerUnit: 60,
      profitMargin: 60,
    },
    {
      commodity: 'Mining Equipment',
      buyLocation: 'Area18',
      sellLocation: 'Levski',
      buyPrice: 250,
      sellPrice: 350,
      profitPerUnit: 100,
      profitMargin: 40,
    },
  ];

  const mockProps = {
    opportunities: mockOpportunities,
    onSelect: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the opportunities table with data', () => {
    renderComponent(mockProps);

    expect(screen.getByText('Profitable Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Medical Supplies')).toBeInTheDocument();
    expect(screen.getByText('Mining Equipment')).toBeInTheDocument();
    expect(screen.getByText('Port Olisar')).toBeInTheDocument();
    expect(screen.getByText('Lorville')).toBeInTheDocument();
  });

  it('displays empty state when no opportunities', () => {
    const emptyProps = { ...mockProps, opportunities: [] };
    renderComponent(emptyProps);

    expect(screen.getByText('Find trade opportunities')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a start location above to discover profitable trades')
    ).toBeInTheDocument();
  });

  it('displays buy prices correctly', () => {
    renderComponent(mockProps);

    const prices100 = screen.getAllByText('100.00 aUEC');
    const prices250 = screen.getAllByText('250.00 aUEC');

    // Buy price 100.00 appears (could also appear as profit)
    expect(prices100.length).toBeGreaterThanOrEqual(1);
    // Buy price 250.00 appears
    expect(prices250.length).toBeGreaterThanOrEqual(1);
  });

  it('displays sell prices correctly', () => {
    renderComponent(mockProps);

    expect(screen.getByText('160.00 aUEC')).toBeInTheDocument();
    expect(screen.getByText('350.00 aUEC')).toBeInTheDocument();
  });

  it('displays profit per unit correctly', () => {
    renderComponent(mockProps);

    // Profit of 60.00 aUEC for first opportunity
    expect(screen.getByText('60.00 aUEC')).toBeInTheDocument();
    // Profit of 100.00 aUEC for second opportunity (also matches buy price)
    const prices100 = screen.getAllByText('100.00 aUEC');
    expect(prices100.length).toBeGreaterThanOrEqual(1);
  });

  it('displays profit margins as percentages', () => {
    renderComponent(mockProps);

    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });

  it('renders progress bars for profit margins', () => {
    renderComponent(mockProps);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);

    expect(progressBars[0]).toHaveAttribute('aria-label', '60.0% profit margin');
    expect(progressBars[1]).toHaveAttribute('aria-label', '40.0% profit margin');
  });

  it('shows all column headers', () => {
    renderComponent(mockProps);

    expect(screen.getByText('Commodity')).toBeInTheDocument();
    expect(screen.getByText('Buy From')).toBeInTheDocument();
    expect(screen.getByText('Buy Price')).toBeInTheDocument();
    expect(screen.getByText('Sell To')).toBeInTheDocument();
    expect(screen.getByText('Sell Price')).toBeInTheDocument();
    expect(screen.getByText('Profit/Unit')).toBeInTheDocument();
    expect(screen.getByText('Margin')).toBeInTheDocument();
  });
});
