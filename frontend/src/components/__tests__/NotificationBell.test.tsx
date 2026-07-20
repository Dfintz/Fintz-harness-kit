import { NotificationBell } from '@/components/NotificationBell';
import { theme } from '@/theme';
import type { Notification } from '@/types/apiV2';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Fleet Created',
    message: 'Your fleet "Alpha Squadron" has been created successfully.',
    timestamp: new Date('2025-01-20T10:00:00').getTime(),
    read: false,
    category: 'fleet',
  },
  {
    id: '2',
    type: 'warning',
    title: 'Low Stock Alert',
    message: 'Medical Supplies are running low.',
    timestamp: new Date('2025-01-20T09:30:00').getTime(),
    read: true,
    category: 'trading',
  },
  {
    id: '3',
    type: 'info',
    title: 'Activity Reminder',
    message: 'Mining operation starts in 1 hour.',
    timestamp: new Date('2025-01-20T09:00:00').getTime(),
    read: false,
    category: 'activity',
  },
];

describe('NotificationBell Component', () => {
  const mockMarkAsRead = jest.fn();
  const mockMarkAllAsRead = jest.fn();
  const mockClear = jest.fn();
  const mockClearAll = jest.fn();
  const mockNotificationClick = jest.fn();

  const renderWithThemeProvider = (
    notifications: Notification[] = mockNotifications,
    unreadCount: number = 2
  ) => {
    return render(
      <ThemeProvider theme={theme}>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={mockMarkAsRead}
          onMarkAllAsRead={mockMarkAllAsRead}
          onClear={mockClear}
          onClearAll={mockClearAll}
          onNotificationClick={mockNotificationClick}
        />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification bell button', () => {
    renderWithThemeProvider();

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays unread count badge when there are unread notifications', () => {
    renderWithThemeProvider(mockNotifications, 2);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not display badge when unread count is 0', () => {
    renderWithThemeProvider(mockNotifications, 0);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('displays 99+ when unread count exceeds 99', () => {
    renderWithThemeProvider(mockNotifications, 150);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('opens dropdown when bell button is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const bellButton = screen.getByRole('button');
    await user.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  it('displays notification list when dropdown is open', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Fleet Created')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Alert')).toBeInTheDocument();
      expect(screen.getByText('Activity Reminder')).toBeInTheDocument();
    });
  });

  it('displays empty state when no notifications', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider([], 0);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('displays Mark all read button when there are unread notifications', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });
  });

  it('displays Clear all button when there are notifications', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });
  });

  it('calls onMarkAllAsRead when Mark all read is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mark all read'));

    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('calls onClearAll when Clear all is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear all'));

    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });

  it('displays notification messages', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/Alpha Squadron/)).toBeInTheDocument();
      expect(screen.getByText(/Medical Supplies/)).toBeInTheDocument();
      expect(screen.getByText(/Mining operation/)).toBeInTheDocument();
    });
  });

  it('displays notification categories as badges', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('fleet')).toBeInTheDocument();
      expect(screen.getByText('trading')).toBeInTheDocument();
      expect(screen.getByText('activity')).toBeInTheDocument();
    });
  });

  it('toggles dropdown on multiple clicks', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const bellButton = screen.getByRole('button');

    // Open dropdown
    await user.click(bellButton);
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    // Close dropdown
    await user.click(bellButton);
    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });

  it('does not show Mark all read when all notifications are read', async () => {
    const user = userEvent.setup();
    const allReadNotifications = mockNotifications.map(n => ({ ...n, read: true }));
    renderWithThemeProvider(allReadNotifications, 0);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
    });
  });
});
