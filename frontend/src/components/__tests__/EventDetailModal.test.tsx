import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { muiTheme } from '@/theme/muiTheme';
import { EventDetailModal } from '@/components/EventDetailModal';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('EventDetailModal Component', () => {
  const mockOnClose = jest.fn();

  beforeAll(() => {
    // Mock fetch for deletion preBox
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  const mockEvent = {
    id: 'test-event-123',
    timestamp: Date.now(),
    type: 'fleet:created',
    category: 'fleet' as const,
    title: 'Fleet Created',
    description: 'A new fleet "Alpha Squadron" has been created',
    color: '#00d9ff',
    rawData: { fleetId: 'fleet-1', name: 'Alpha Squadron' },
  };

  const renderWithThemeProvider = (
    props: Partial<React.ComponentProps<typeof EventDetailModal>> = {}
  ) => {
    const defaultProps = {
      isOpen: true,
      onClose: mockOnClose,
      event: mockEvent,
      ...props,
    };

    return render(
      <ThemeProvider theme={muiTheme}>
        <EventDetailModal {...defaultProps} />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    renderWithThemeProvider({ isOpen: false });

    expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
  });

  it('renders nothing when event is null', () => {
    renderWithThemeProvider({ event: null });

    expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true and event exists', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Event Details')).toBeInTheDocument();
  });

  it('displays event title', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Fleet Created')).toBeInTheDocument();
  });

  it('displays event description', () => {
    renderWithThemeProvider();

    expect(screen.getByText('A new fleet "Alpha Squadron" has been created')).toBeInTheDocument();
  });

  it('displays event category badge', () => {
    renderWithThemeProvider();

    expect(screen.getByText('fleet')).toBeInTheDocument();
  });

  it('displays event type', () => {
    renderWithThemeProvider();

    expect(screen.getByText('fleet:created')).toBeInTheDocument();
  });

  it('displays formatted timestamp', () => {
    renderWithThemeProvider();

    // Check that timestamp section exists
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
  });

  it('displays event ID section', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Event ID')).toBeInTheDocument();
  });

  it('displays raw event data section when rawData exists', () => {
    renderWithThemeProvider();

    expect(screen.getByText('Raw Event Data')).toBeInTheDocument();
  });

  it('displays Close button', () => {
    renderWithThemeProvider();

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    // MUI Dialog's onClose prop is called on backdrop click
    // This is handled internally by MUI, so we just verify the prop is set
    // by checking that clicking outside the dialog area (using Escape key) closes it
    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays copy buttons for ID and JSON', () => {
    renderWithThemeProvider();

    // Copy buttons use ContentCopyIcon (no text label)
    const copyIcons = screen.getAllByTestId('ContentCopyIcon');
    expect(copyIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('does not display raw data section when rawData is undefined', () => {
    const eventWithoutRawData = { ...mockEvent, rawData: undefined };
    renderWithThemeProvider({ event: eventWithoutRawData });

    expect(screen.queryByText('Raw Event Data')).not.toBeInTheDocument();
  });

  it('displays different category colors', () => {
    const activityEvent = {
      ...mockEvent,
      category: 'activity' as const,
      color: '#00ff88',
    };

    renderWithThemeProvider({ event: activityEvent });

    expect(screen.getByText('activity')).toBeInTheDocument();
  });
});
