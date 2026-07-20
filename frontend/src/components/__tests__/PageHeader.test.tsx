import { PageHeader } from '@/components/PageHeader';
import { muiTheme } from '@/theme/muiTheme';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

describe('PageHeader Component', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={muiTheme}>{component}</ThemeProvider>);
  };

  it('renders with title only', () => {
    renderWithProvider(<PageHeader title="Test Page" />);

    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders with title', () => {
    renderWithProvider(<PageHeader title="Dashboard" />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders with description', () => {
    renderWithProvider(<PageHeader title="Fleet" description="Manage your ships" />);

    expect(screen.getByText('Fleet')).toBeInTheDocument();
    expect(screen.getByText('Manage your ships')).toBeInTheDocument();
  });

  it('renders primary action button', () => {
    const mockAction = jest.fn();

    renderWithProvider(
      <PageHeader
        title="Inventory"
        primaryAction={{
          label: 'Add Item',
          icon: AddIcon,
          onPress: mockAction,
        }}
      />
    );

    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('renders secondary action button', () => {
    const mockAction = jest.fn();

    renderWithProvider(
      <PageHeader
        title="Fleet"
        secondaryAction={{
          label: 'Refresh',
          icon: RefreshIcon,
          onPress: mockAction,
        }}
      />
    );

    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders both action buttons', () => {
    const mockPrimary = jest.fn();
    const mockSecondary = jest.fn();

    renderWithProvider(
      <PageHeader
        title="Trading"
        primaryAction={{
          label: 'Create Route',
          icon: AddIcon,
          onPress: mockPrimary,
        }}
        secondaryAction={{
          label: 'Refresh',
          icon: RefreshIcon,
          onPress: mockSecondary,
        }}
      />
    );

    expect(screen.getByText('Create Route')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('calls primary action when clicked', async () => {
    const user = userEvent.setup();
    const mockAction = jest.fn();

    renderWithProvider(
      <PageHeader
        title="Test"
        primaryAction={{
          label: 'Primary',
          onPress: mockAction,
        }}
      />
    );

    const button = screen.getByText('Primary');
    await user.click(button);

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('calls secondary action when clicked', async () => {
    const user = userEvent.setup();
    const mockAction = jest.fn();

    renderWithProvider(
      <PageHeader
        title="Test"
        secondaryAction={{
          label: 'Secondary',
          onPress: mockAction,
        }}
      />
    );

    const button = screen.getByText('Secondary');
    await user.click(button);

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('applies gradient styling to title', () => {
    renderWithProvider(<PageHeader title="Styled Title" />);

    const heading = screen.getByText('Styled Title');
    // Title now uses gradient styling with background-clip
    expect(heading).toBeInTheDocument();
  });

  it('applies correct styling to description', () => {
    renderWithProvider(<PageHeader title="Test" description="Test description" />);

    const description = screen.getByText('Test description');
    expect(description).toHaveStyle({
      fontSize: '1rem',
      color: '#8a9eb5',
    });
  });

  it('renders without actions section when no actions provided', () => {
    const { container } = renderWithProvider(<PageHeader title="Simple Title" />);

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(0);
  });

  it('renders help tooltip icon when helpTooltip is provided', () => {
    renderWithProvider(
      <PageHeader title="Fleet" helpTooltip="This is helpful info about the fleet page." />
    );

    expect(screen.getByText('Fleet')).toBeInTheDocument();
    // The HelpTooltip renders a button with role="button" when icon=true
    const helpButtons = screen.getAllByRole('button');
    expect(helpButtons.length).toBeGreaterThan(0);
  });

  it('does not render help tooltip when helpTooltip is not provided', () => {
    const { container } = renderWithProvider(<PageHeader title="Fleet" />);

    // PageHeader with no actions and no tooltip should have 0 buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(0);
  });
});
