/**
 * OpportunityFinder Component Tests
 *
 * Tests for the routing-independent OpportunityFinder component
 * No router mocking needed!
 */

import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { muiTheme } from '@/theme/muiTheme';
import { OpportunityFinder } from '@/components/trading/OpportunityFinder';

// Simple render helper - NO ROUTER NEEDED!
const renderComponent = (props: React.ComponentProps<typeof OpportunityFinder>) => {
  return render(
    <MuiThemeProvider theme={muiTheme}>
      <OpportunityFinder {...props} />
    </MuiThemeProvider>
  );
};

describe('OpportunityFinder Component', () => {
  const mockProps = {
    startLocation: '',
    onStartLocationChange: jest.fn(),
    minProfitMargin: 15,
    onMinProfitMarginChange: jest.fn(),
    onFindOpportunities: jest.fn(),
    onOptimizeRoute: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the opportunity finder form', () => {
    renderComponent(mockProps);

    expect(screen.getByText('Find Trade Opportunities')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Min Profit Margin %')).toBeInTheDocument();
    expect(screen.getByText('Find Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Optimize Route')).toBeInTheDocument();
  });

  it('calls onStartLocationChange when location input changes', async () => {
    const user = userEvent.setup();
    renderComponent(mockProps);

    const locationInput = screen.getByLabelText('Start Location');
    await user.type(locationInput, 'Port Olisar');

    expect(mockProps.onStartLocationChange).toHaveBeenCalled();
  });

  it('calls onFindOpportunities when Find Opportunities button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent(mockProps);

    const findButton = screen.getByText('Find Opportunities');
    await user.click(findButton);

    expect(mockProps.onFindOpportunities).toHaveBeenCalledTimes(1);
  });

  it('calls onOptimizeRoute when Optimize Route button is clicked', async () => {
    const user = userEvent.setup();
    const propsWithLocation = { ...mockProps, startLocation: 'Port Olisar' };
    renderComponent(propsWithLocation);

    const optimizeButton = screen.getByText('Optimize Route');
    await user.click(optimizeButton);

    expect(mockProps.onOptimizeRoute).toHaveBeenCalledTimes(1);
  });

  it('disables Optimize Route button when no start location', () => {
    renderComponent(mockProps);

    const optimizeButton = screen.getByRole('button', { name: 'Optimize Route' });
    expect(optimizeButton).toBeDisabled();
  });

  it('disables buttons when loading', () => {
    const loadingProps = { ...mockProps, loading: true };
    renderComponent(loadingProps);

    const findButton = screen.getByRole('button', { name: 'Find Opportunities' });
    const optimizeButton = screen.getByRole('button', { name: 'Optimize Route' });

    expect(findButton).toBeDisabled();
    expect(optimizeButton).toBeDisabled();
  });

  it('displays the correct profit margin value', () => {
    renderComponent(mockProps);

    const profitInput = screen.getByLabelText('Min Profit Margin %') as HTMLInputElement;
    // Input values can be string or number, check both
    expect(profitInput.value).toBe('15');
  });
});
