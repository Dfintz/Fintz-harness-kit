import { EmptyState } from '@/components/EmptyState';
import { muiTheme } from '@/theme/muiTheme';
import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

describe('EmptyState Component', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={muiTheme}>{component}</ThemeProvider>);
  };

  it('renders with required props', () => {
    renderWithProvider(
      <EmptyState title="No items found" description="Add your first item to get started" />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Add your first item to get started')).toBeInTheDocument();
  });

  it('renders without action button when not provided', () => {
    renderWithProvider(
      <EmptyState title="Search results" description="No results match your search" />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('renders action button when provided', () => {
    const mockAction = jest.fn();

    renderWithProvider(
      <EmptyState
        title="Empty fleet"
        description="Add ships to your fleet"
        actionLabel="Add Ship"
        onAction={mockAction}
      />
    );

    expect(screen.getByText('Add Ship')).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', async () => {
    const user = userEvent.setup();
    const mockAction = jest.fn();

    renderWithProvider(
      <EmptyState
        title="No inventory"
        description="Start adding items"
        actionLabel="Add Item"
        onAction={mockAction}
      />
    );

    const button = screen.getByText('Add Item');
    await user.click(button);

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('applies correct styling to elements', () => {
    renderWithProvider(
      <EmptyState title="No trades" description="Create your first trading route" />
    );

    const title = screen.getByText('No trades');
    expect(title).toHaveStyle({ fontSize: '1.25rem', color: '#b0c4de' });

    const description = screen.getByText('Create your first trading route');
    expect(description).toHaveStyle({ color: '#8a9eb5' });
  });

  it('does not render action button if actionLabel is missing', () => {
    const mockAction = jest.fn();

    renderWithProvider(
      <EmptyState title="No data" description="Data will appear here" onAction={mockAction} />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('does not render action button if onAction is missing', () => {
    renderWithProvider(
      <EmptyState title="Empty list" description="List is empty" actionLabel="Add Item" />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});
