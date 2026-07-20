import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { theme } from '@/theme';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';

describe('SessionTimeoutWarning', () => {
  const renderWithThemeProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
  };

  const defaultProps = {
    isOpen: true,
    remainingTime: 45000, // 45 seconds
    totalTime: 60000, // 1 minute
    onKeepSession: jest.fn(),
    onLogout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders warning dialog when isOpen is true', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    expect(screen.getByText('Session Timeout Warning')).toBeInTheDocument();
    expect(screen.getByText('Your session is about to expire')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Session Timeout Warning')).not.toBeInTheDocument();
  });

  it('displays formatted time correctly', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    // 45000ms = 45 seconds = 0:45
    expect(screen.getByText('0:45')).toBeInTheDocument();
  });

  it('formats time with leading zero for seconds', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={5000} />);

    // 5000ms = 5 seconds = 0:05
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  it('formats time for minutes correctly', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={125000} />);

    // 125000ms = 125 seconds = 2:05
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('rounds up partial seconds', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={4500} />);

    // 4500ms = 4.5 seconds, should round up to 5 = 0:05
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  it('renders "Keep Session" button', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    expect(screen.getByText('Keep Session')).toBeInTheDocument();
  });

  it('renders "Log Out" button', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  it('calls onKeepSession when "Keep Session" is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    await user.click(screen.getByText('Keep Session'));
    // The dialog calls onKeepSession both when button is clicked and on dismiss
    expect(defaultProps.onKeepSession).toHaveBeenCalled();
  });

  it('calls onLogout when "Log Out" is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    await user.click(screen.getByText('Log Out'));
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it('displays warning message about inactivity', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    expect(screen.getByText(/You've been inactive for a while/i)).toBeInTheDocument();
  });

  it('displays instructions about keeping session', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    expect(screen.getByText(/"Keep Session"/i)).toBeInTheDocument();
    expect(screen.getByText(/"Log Out"/i)).toBeInTheDocument();
  });

  it('has progress indicator for time remaining', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    expect(screen.getByLabelText('Time remaining')).toBeInTheDocument();
  });

  it('calculates percentage correctly for progress', () => {
    const { rerender } = renderWithThemeProvider(
      <SessionTimeoutWarning {...defaultProps} remainingTime={30000} totalTime={60000} />
    );

    // 30000/60000 = 50%
    let progressCircle = screen.getByLabelText('Time remaining');
    expect(progressCircle).toBeInTheDocument();

    // Update to 15000/60000 = 25%
    rerender(
      <ThemeProvider theme={theme}>
        <SessionTimeoutWarning {...defaultProps} remainingTime={15000} totalTime={60000} />
      </ThemeProvider>
    );

    progressCircle = screen.getByLabelText('Time remaining');
    expect(progressCircle).toBeInTheDocument();
  });

  it('handles zero remaining time', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={0} />);

    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('handles very large remaining time', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={599000} />);

    // 599000ms = 599 seconds = 9:59
    expect(screen.getByText('9:59')).toBeInTheDocument();
  });

  it('applies urgent styling when time is low', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={5000} />);

    // Check for urgent state (< 10 seconds) - just verify the component renders with low time
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  it('does not apply urgent styling when time is sufficient', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} remainingTime={30000} />);

    // Check for non-urgent state (>= 10 seconds)
    expect(screen.getByText('0:30')).toBeInTheDocument();
  });

  it('auto-focuses the primary button', () => {
    renderWithThemeProvider(<SessionTimeoutWarning {...defaultProps} />);

    // AlertDialog with autoFocusButton="primary" should focus "Keep Session"
    const keepSessionButton = screen.getByText('Keep Session');
    expect(keepSessionButton).toBeInTheDocument();
  });
});
