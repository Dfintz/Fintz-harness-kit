import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CustomStatusSelector } from '@/components/CustomStatusSelector';

const theme = createTheme();

describe('CustomStatusSelector Component', () => {
  const mockOnStatusChange = jest.fn();

  const renderWithThemeProvider = (
    props: Partial<React.ComponentProps<typeof CustomStatusSelector>> = {}
  ) => {
    const defaultProps = {
      onStatusChange: mockOnStatusChange,
      ...props,
    };

    return render(
      <ThemeProvider theme={theme}>
        <CustomStatusSelector {...defaultProps} />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Quick Presets section', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Quick Presets')).toBeInTheDocument();
  });

  it('renders Custom Status section', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Custom Status')).toBeInTheDocument();
  });

  it('renders Set Preset Status button', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Set Preset Status')).toBeInTheDocument();
  });

  it('renders Set Status button', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Set Status')).toBeInTheDocument();
  });

  it('renders custom status input', () => {
    renderWithThemeProvider();

    expect(screen.getByPlaceholderText("What's your status?")).toBeInTheDocument();
  });

  it('displays current status when provided', () => {
    const currentStatus = {
      text: 'In a meeting',
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
    };

    renderWithThemeProvider({ currentStatus });

    expect(screen.getByText('In a meeting')).toBeInTheDocument();
  });

  it('displays time remaining for current status', () => {
    const currentStatus = {
      text: 'Working remotely',
      expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
    };

    renderWithThemeProvider({ currentStatus });

    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('displays clear status button when status exists', () => {
    const currentStatus = {
      text: 'On a break',
    };

    renderWithThemeProvider({ currentStatus });

    expect(screen.getByLabelText('Clear status')).toBeInTheDocument();
  });

  it('calls onStatusChange with null when clear status is clicked', async () => {
    const user = userEvent.setup();
    const currentStatus = {
      text: 'Do not disturb',
    };

    renderWithThemeProvider({ currentStatus });

    await user.click(screen.getByLabelText('Clear status'));

    expect(mockOnStatusChange).toHaveBeenCalledWith(null);
  });

  it('allows typing custom status text', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const input = screen.getByPlaceholderText("What's your status?");
    await user.type(input, 'Working on tests');

    expect(input).toHaveValue('Working on tests');
  });

  it('Set Status button is disabled when custom text is empty', () => {
    renderWithThemeProvider();

    const setStatusButton = screen.getByText('Set Status').closest('button');
    expect(setStatusButton).toBeDisabled();
  });

  it('Set Status button is enabled when custom text is entered', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const input = screen.getByPlaceholderText("What's your status?");
    await user.type(input, 'Custom status');

    const setStatusButton = screen.getByText('Set Status').closest('button');
    expect(setStatusButton).not.toBeDisabled();
  });

  it('calls onStatusChange when Set Status is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const input = screen.getByPlaceholderText("What's your status?");
    await user.type(input, 'My custom status');

    await user.click(screen.getByText('Set Status'));

    expect(mockOnStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'My custom status',
      })
    );
  });

  it('displays helper text about status visibility', () => {
    renderWithThemeProvider();

    expect(screen.getByText(/Your status will be visible to all members/)).toBeInTheDocument();
  });

  it('does not display expired status', () => {
    const expiredStatus = {
      text: 'Expired status',
      expiresAt: Date.now() - 1000, // 1 second in the past
    };

    renderWithThemeProvider({ currentStatus: expiredStatus });

    expect(screen.queryByText('Expired status')).not.toBeInTheDocument();
  });
});
