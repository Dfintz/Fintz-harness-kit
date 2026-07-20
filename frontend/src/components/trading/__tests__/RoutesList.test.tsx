/**
 * RoutesList Component Tests
 *
 * Tests for the routing-independent RoutesList component
 * No router mocking needed!
 */

import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { muiTheme } from '@/theme/muiTheme';
import { RoutesList } from '@/components/trading/RoutesList';
import type { RouteDisplay } from '@/components/trading/types';

// Simple render helper - NO ROUTER NEEDED!
const renderComponent = (props: React.ComponentProps<typeof RoutesList>) => {
  return render(
    <MuiThemeProvider theme={muiTheme}>
      <RoutesList {...props} />
    </MuiThemeProvider>
  );
};

describe('RoutesList Component', () => {
  const mockRoutes: RouteDisplay[] = [
    {
      id: 'route-1',
      name: 'Olisar Loop',
      description: 'Quick medical supplies run',
      stops: 3,
      estimatedProfit: 15000,
      duration: 45,
      runCount: 12,
      status: 'active',
    },
    {
      id: 'route-2',
      name: 'Lorville Trade',
      description: 'Mining equipment transport',
      stops: 2,
      estimatedProfit: 8000,
      duration: 30,
      runCount: 5,
      status: 'inactive',
    },
  ];

  const mockProps = {
    routes: mockRoutes,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onBox: jest.fn(),
    onCreateFirst: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the routes table with data', () => {
    renderComponent(mockProps);

    expect(screen.getByText('Olisar Loop')).toBeInTheDocument();
    expect(screen.getByText('Quick medical supplies run')).toBeInTheDocument();
    expect(screen.getByText('Lorville Trade')).toBeInTheDocument();
    expect(screen.getByText('15,000 aUEC')).toBeInTheDocument();
    expect(screen.getByText('8,000 aUEC')).toBeInTheDocument();
  });

  it('displays empty state when no routes', () => {
    const emptyProps = { ...mockProps, routes: [] };
    renderComponent(emptyProps);

    expect(screen.getByText('No trading routes yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first trading route to start optimizing your profits')
    ).toBeInTheDocument();
  });

  it('calls onCreateFirst when Create First Route button is clicked in empty state', async () => {
    const user = userEvent.setup();
    const emptyProps = { ...mockProps, routes: [] };
    renderComponent(emptyProps);

    const createButton = screen.getByText('Create First Route');
    await user.click(createButton);

    expect(mockProps.onCreateFirst).toHaveBeenCalledTimes(1);
  });

  it('calls onBox when Box button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent(mockProps);

    const BoxButtons = screen.getAllByRole('button', { name: /Box details/i });
    await user.click(BoxButtons[0]);

    expect(mockProps.onBox).toHaveBeenCalledWith(mockRoutes[0]);
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent(mockProps);

    const editButtons = screen.getAllByRole('button', { name: /edit route/i });
    await user.click(editButtons[0]);

    expect(mockProps.onEdit).toHaveBeenCalledWith(mockRoutes[0]);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent(mockProps);

    const deleteButtons = screen.getAllByRole('button', { name: /delete route/i });
    await user.click(deleteButtons[0]);

    expect(mockProps.onDelete).toHaveBeenCalledWith(mockRoutes[0]);
  });

  it('disables action buttons when loading', () => {
    const loadingProps = { ...mockProps, loading: true };
    renderComponent(loadingProps);

    const BoxButtons = screen.getAllByRole('button', { name: /Box details/i });
    const editButtons = screen.getAllByRole('button', { name: /edit route/i });
    const deleteButtons = screen.getAllByRole('button', { name: /delete route/i });

    expect(BoxButtons[0]).toBeDisabled();
    expect(editButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
  });

  it('displays correct status badges', () => {
    renderComponent(mockProps);

    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('displays route details correctly', () => {
    renderComponent(mockProps);

    // Check stops count
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check duration
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();

    // Check run count
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
