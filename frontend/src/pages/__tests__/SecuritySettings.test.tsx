/**
 * Security Settings Page Tests
 */

import { SecuritySettings } from '@/pages/SecuritySettings';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock data
const mockSessions = [
  {
    id: 1,
    userId: 100,
    sessionToken: 'tok-1',
    discordTokenExpiry: '2025-12-01T00:00:00Z',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    lastActivity: '2025-01-10T12:00:00Z',
    expiresAt: '2025-02-01T00:00:00Z',
    ipAddress: '172.16.0.1',
    userAgent: 'SessionAgent/1.0',
  },
  {
    id: 2,
    userId: 100,
    sessionToken: 'tok-2',
    discordTokenExpiry: '2025-12-01T00:00:00Z',
    isActive: true,
    createdAt: '2025-01-05T00:00:00Z',
    lastActivity: '2025-01-09T08:00:00Z',
    expiresAt: '2025-02-05T00:00:00Z',
    ipAddress: '172.16.0.2',
    userAgent: 'SessionAgent/2.0',
  },
];

const mockDevices = [
  {
    id: 'dev-1',
    userId: 'u-1',
    deviceFingerprint: 'fp-1',
    deviceName: 'Desktop PC',
    userAgent: 'DeviceAgent/1.0',
    ipAddress: '192.168.5.1',
    location: 'Berlin, DE',
    lastUsed: '2025-01-10T00:00:00Z',
    isActive: true,
    trustLevel: 'high' as const,
    verificationMethod: '2fa' as const,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'dev-2',
    userId: 'u-1',
    deviceFingerprint: 'fp-2',
    deviceName: undefined,
    userAgent: 'DeviceAgent/2.0',
    ipAddress: '192.168.5.2',
    location: undefined,
    lastUsed: '2025-01-08T00:00:00Z',
    isActive: true,
    trustLevel: 'low' as const,
    verificationMethod: 'email' as const,
    createdAt: '2024-09-01T00:00:00Z',
    updatedAt: '2025-01-08T00:00:00Z',
  },
];

const mockAccessLogs = [
  {
    id: 'log-1',
    accountId: 'acc-1',
    userId: 'u-1',
    organizationId: 'org-1',
    action: 'view',
    ipAddress: '10.10.0.1',
    userAgent: 'LogAgent/1.0',
    metadata: {},
    createdAt: '2025-01-10T14:30:00Z',
  },
  {
    id: 'log-2',
    accountId: 'acc-1',
    userId: 'u-1',
    organizationId: 'org-1',
    action: 'password_reveal',
    ipAddress: '10.10.0.2',
    userAgent: 'LogAgent/2.0',
    metadata: {},
    createdAt: '2025-01-09T10:00:00Z',
  },
];

const mockRevokeSession = jest.fn().mockResolvedValue(undefined);
const mockRevokeTrustedDevice = jest.fn().mockResolvedValue(undefined);

// Mock security session queries
jest.mock('../../hooks/queries/useSecuritySessionQueries', () => ({
  useSessions: jest.fn(() => ({
    data: mockSessions,
    isLoading: false,
    error: null,
  })),
  useTrustedDevices: jest.fn(() => ({
    data: mockDevices,
    isLoading: false,
    error: null,
  })),
  useAccessLogs: jest.fn(() => ({
    data: mockAccessLogs,
    isLoading: false,
    error: null,
  })),
  useRevokeSession: jest.fn(() => ({
    mutateAsync: mockRevokeSession,
    isPending: false,
  })),
  useRevokeTrustedDevice: jest.fn(() => ({
    mutateAsync: mockRevokeTrustedDevice,
    isPending: false,
  })),
}));

// Mock statusStyles
jest.mock('../../utils/statusStyles', () => ({
  getStatusChipSx: jest.fn(() => ({})),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// Import after mocking so we can override
const queryMocks = jest.requireMock('../../hooks/queries/useSecuritySessionQueries');

function renderPage() {
  return render(
    <BrowserRouter>
      <SecuritySettings />
    </BrowserRouter>
  );
}

describe('SecuritySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default data
    queryMocks.useSessions.mockReturnValue({ data: mockSessions, isLoading: false, error: null });
    queryMocks.useTrustedDevices.mockReturnValue({
      data: mockDevices,
      isLoading: false,
      error: null,
    });
    queryMocks.useAccessLogs.mockReturnValue({
      data: mockAccessLogs,
      isLoading: false,
      error: null,
    });
    queryMocks.useRevokeSession.mockReturnValue({
      mutateAsync: mockRevokeSession,
      isPending: false,
    });
    queryMocks.useRevokeTrustedDevice.mockReturnValue({
      mutateAsync: mockRevokeTrustedDevice,
      isPending: false,
    });
  });

  describe('Page Structure', () => {
    it('should render the security heading', () => {
      renderPage();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should render all section headings', () => {
      renderPage();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
      // Two-Factor Authentication is rendered by TwoFactorManagement component
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      expect(screen.getByText('Trusted Devices')).toBeInTheDocument();
      expect(screen.getByText('Login History')).toBeInTheDocument();
    });
  });

  describe('Active Sessions Section', () => {
    it('should display session data in the table', () => {
      renderPage();
      expect(screen.getByText('SessionAgent/1.0')).toBeInTheDocument();
      expect(screen.getByText('SessionAgent/2.0')).toBeInTheDocument();
      expect(screen.getByText('172.16.0.1')).toBeInTheDocument();
      expect(screen.getByText('172.16.0.2')).toBeInTheDocument();
    });

    it('should show empty state when no sessions', () => {
      queryMocks.useSessions.mockReturnValue({ data: [], isLoading: false, error: null });
      renderPage();
      expect(screen.getByText('No active sessions')).toBeInTheDocument();
    });

    it('should show error alert on fetch failure', () => {
      queryMocks.useSessions.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('fail'),
      });
      renderPage();
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
    });

    it('should render revoke buttons for each session', () => {
      renderPage();
      const revokeButtons = screen.getAllByLabelText('Revoke session');
      expect(revokeButtons).toHaveLength(2);
    });

    it('should open confirm dialog when clicking revoke', async () => {
      const user = userEvent.setup();
      renderPage();
      const revokeButtons = screen.getAllByLabelText('Revoke session');
      await user.click(revokeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Revoke Session')).toBeInTheDocument();
        expect(
          screen.getByText(/This will immediately end the selected session/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Trusted Devices Section', () => {
    it('should display device data in the table', () => {
      renderPage();
      expect(screen.getByText('Desktop PC')).toBeInTheDocument();
      // Second device has no deviceName, falls back to userAgent
      expect(screen.getByText('DeviceAgent/2.0')).toBeInTheDocument();
      expect(screen.getByText('Berlin, DE')).toBeInTheDocument();
    });

    it('should show trust level chips', () => {
      renderPage();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('should show empty state when no devices', () => {
      queryMocks.useTrustedDevices.mockReturnValue({ data: [], isLoading: false, error: null });
      renderPage();
      expect(screen.getByText('No trusted devices')).toBeInTheDocument();
    });

    it('should show error alert on fetch failure', () => {
      queryMocks.useTrustedDevices.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('fail'),
      });
      renderPage();
      expect(screen.getByText('Failed to load trusted devices')).toBeInTheDocument();
    });

    it('should open confirm dialog when clicking revoke device', async () => {
      const user = userEvent.setup();
      renderPage();
      const revokeButtons = screen.getAllByLabelText('Revoke device');
      await user.click(revokeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Revoke Trusted Device')).toBeInTheDocument();
        expect(screen.getByText(/This device will no longer be trusted/)).toBeInTheDocument();
      });
    });
  });

  describe('Login History Section', () => {
    it('should display access log entries', () => {
      renderPage();
      expect(screen.getByText('view')).toBeInTheDocument();
      expect(screen.getByText('password_reveal')).toBeInTheDocument();
      expect(screen.getByText('LogAgent/1.0')).toBeInTheDocument();
    });

    it('should show empty state when no logs', () => {
      queryMocks.useAccessLogs.mockReturnValue({ data: [], isLoading: false, error: null });
      renderPage();
      expect(screen.getByText('No access logs')).toBeInTheDocument();
    });

    it('should show error alert on fetch failure', () => {
      queryMocks.useAccessLogs.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('fail'),
      });
      renderPage();
      expect(screen.getByText('Failed to load access logs')).toBeInTheDocument();
    });
  });

  describe('Password Change', () => {
    it('should render password fields', () => {
      renderPage();
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    });

    it('should disable update button when fields are empty', () => {
      renderPage();
      const button = screen.getByText('Update Password');
      expect(button).toBeDisabled();
    });

    it('should show mismatch message when passwords differ', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText('Current Password'), 'old123');
      await user.type(screen.getByLabelText('New Password'), 'new123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'different');
      await user.click(screen.getByText('Update Password'));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
      });
    });
  });

  describe('Two-Factor Authentication', () => {
    it('should render 2FA management section', () => {
      renderPage();
      // TwoFactorManagement component is rendered (shows loading spinner initially)
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
    });
  });
});
