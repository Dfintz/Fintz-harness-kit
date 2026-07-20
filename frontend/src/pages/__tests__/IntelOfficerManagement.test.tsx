import { IntelOfficerManagementWithErrorBoundary as IntelOfficerManagement } from '@/pages/IntelOfficerManagement';
import { type IntelAuditLog } from '@/services/intelVaultService';
import { useAuthStore } from '@/store/authStore';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock intel vault service (still used for checkAccess directly)
jest.mock('../../services/intelVaultService', () => ({
  intelVaultService: {
    checkAccess: jest.fn(),
    getOfficers: jest.fn(),
  },
}));

import { intelVaultService } from '../../services/intelVaultService';
const mockedIntelVaultService = intelVaultService as jest.Mocked<typeof intelVaultService>;

// Mock intel React Query hooks
jest.mock('../../hooks/queries/useIntelQueries', () => ({
  useIntelOfficers: jest.fn(() => ({ data: [], isLoading: false, error: null })),
  useIntelAuditLogs: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useAppointIntelOfficer: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateIntelOfficer: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useRemoveIntelOfficer: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

import { useIntelAuditLogs, useIntelOfficers } from '../../hooks/queries/useIntelQueries';

jest.mock('../../hooks/queries/useOrganizationQueries', () => ({
  useOrganizationMembers: jest.fn(() => ({
    data: { items: [] },
    isLoading: false,
    error: null,
  })),
}));

// Mock auth store
jest.mock('../../store/authStore');
const mockedUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Wrapper with Spectrum ThemeProvider
const renderWithThemeProvider = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('IntelOfficerManagement Page', () => {
  const mockOfficers = [
    {
      id: 'officer-1',
      organizationId: 'org-1',
      userId: 'user-2',
      rank: 'senior',
      accessLevel: 'edit',
      isActive: true,
      specializations: 'strategic, tactical',
      appointedBy: 'user-1',
      appointedAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'officer-2',
      organizationId: 'org-1',
      userId: 'user-3',
      rank: 'junior',
      accessLevel: 'read',
      isActive: true,
      appointedBy: 'user-1',
      appointedAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockAuditLogs: IntelAuditLog[] = [
    {
      id: 'log-1',
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'create_entry',
      description: 'Created new intel entry',
      severity: 'info',
      createdAt: new Date(),
    },
  ];

  const mockAccessCheck = {
    hasAccess: true,
    accessLevel: 'admin',
    isOwner: true,
    isIntelOfficer: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthStore.mockReturnValue({
      user: { id: 'user-1', organizationId: 'org-1', activeOrgId: 'org-1' },
    } as any);
    mockedIntelVaultService.checkAccess.mockResolvedValue(mockAccessCheck);
    mockedIntelVaultService.getOfficers.mockResolvedValue(mockOfficers);
    (useIntelOfficers as jest.Mock).mockReturnValue({
      data: mockOfficers,
      isLoading: false,
      error: null,
    });
    (useIntelAuditLogs as jest.Mock).mockReturnValue({
      data: { logs: mockAuditLogs, total: mockAuditLogs.length },
      isLoading: false,
      error: null,
    });
  });

  it('renders Intel Officer Management Typography', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Intel Officer Management')).toBeInTheDocument();
    });
  });

  it('displays Appoint Officer button for owners', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Appoint Officer')).toBeInTheDocument();
    });
  });

  it('displays Intel Officers tab', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      // React Spectrum Tabs render text in multiple ways
      const tabElements = screen.queryAllByText(/Intel Officers/);
      expect(tabElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays officer table headers', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Access Level')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('displays officer data in table', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('user-2')).toBeInTheDocument();
      expect(screen.getByText('user-3')).toBeInTheDocument();
    });
  });

  it('displays officer ranks', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Senior Officer')).toBeInTheDocument();
      expect(screen.getByText('Junior Officer')).toBeInTheDocument();
    });
  });

  it('displays officer status badges', async () => {
    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      const activeStatuses = screen.getAllByText('Active');
      expect(activeStatuses.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays organization required message when user has no org', async () => {
    mockedUseAuthStore.mockReturnValue({
      user: { id: 'user-1', organizationId: null },
    } as any);

    renderWithThemeProvider(<IntelOfficerManagement />);

    expect(screen.getByText('Organization Required')).toBeInTheDocument();
  });

  it('displays access denied for non-owners', async () => {
    mockedIntelVaultService.checkAccess.mockResolvedValue({
      hasAccess: true,
      isOwner: false,
      isIntelOfficer: false,
    });
    (useIntelOfficers as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  it('displays empty state when no officers exist', async () => {
    (useIntelOfficers as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Intel officers appointed yet.')).toBeInTheDocument();
    });
  });

  it('displays Audit Logs tab for authorized users', async () => {
    // Set up as chief officer to see audit logs
    (useIntelOfficers as jest.Mock).mockReturnValue({
      data: [
        ...mockOfficers,
        {
          id: 'officer-3',
          organizationId: 'org-1',
          userId: 'user-1',
          rank: 'chief',
          accessLevel: 'admin',
          isActive: true,
          appointedBy: 'user-1',
          appointedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      error: null,
    });
    mockedIntelVaultService.getOfficers.mockResolvedValue([
      ...mockOfficers,
      {
        id: 'officer-3',
        organizationId: 'org-1',
        userId: 'user-1',
        rank: 'chief',
        accessLevel: 'admin',
        isActive: true,
        appointedBy: 'user-1',
        appointedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    renderWithThemeProvider(<IntelOfficerManagement />);

    await waitFor(() => {
      // In React Spectrum tabs, the text may be in different places
      const auditLogsElements = screen.queryAllByText(/Audit Logs/i);
      expect(auditLogsElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
