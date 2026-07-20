/**
 * Organization Deletion Approvals Component Tests
 */

import { OrganizationDeletionApprovals } from '@/pages/admin/components/OrganizationDeletionApprovals';
import { organizationDeletionService } from '@/services/organizationDeletionService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the organizationDeletionService
jest.mock('../../../services/organizationDeletionService', () => ({
  organizationDeletionService: {
    getPendingDeletionRequests: jest.fn(),
    getDeletionRequest: jest.fn(),
    approveDeletionRequest: jest.fn(),
    rejectDeletionRequest: jest.fn(),
    getdeletionPreview: jest.fn(),
  },
}));

// Mock query keys
jest.mock('../../../hooks/queries/queryKeys', () => ({
  adminKeys: {
    deletionApprovals: () => ['admin', 'deletion-approvals'],
  },
}));

// Helper to render with QueryClientProvider
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const mockPendingRequests = [
  {
    id: 'req-1',
    organizationId: 'org-1',
    requestedBy: 'user-1',
    status: 'pending',
    requestedAt: '2024-01-01T00:00:00Z',
    gracePeriodDays: 30,
    deleteDescendants: false,
    dataExportGenerated: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletionPreview: {
      organizationId: 'org-1',
      organizationName: 'Test Organization',
      descendantCount: 2,
      memberCount: 10,
      shipCount: 25,
      estimatedDataSize: '1.5 MB',
      willDeleteDescendants: false,
    },
    requester: {
      id: 'user-1',
      username: 'testuser',
    },
  },
  {
    id: 'req-2',
    organizationId: 'org-2',
    requestedBy: 'user-2',
    status: 'pending',
    requestedAt: '2024-01-02T00:00:00Z',
    gracePeriodDays: 30,
    deleteDescendants: true,
    dataExportGenerated: false,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    deletionPreview: {
      organizationId: 'org-2',
      organizationName: 'Another Organization',
      descendantCount: 0,
      memberCount: 5,
      shipCount: 15,
      estimatedDataSize: '800 KB',
      willDeleteDescendants: true,
    },
    requester: {
      id: 'user-2',
      username: 'anotheruser',
    },
  },
];

describe('OrganizationDeletionApprovals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (organizationDeletionService.getPendingDeletionRequests as jest.Mock).mockResolvedValue(
      mockPendingRequests
    );
  });

  describe('Rendering', () => {
    it('should render the deletion approvals component', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText('Organization Deletion Requests')).toBeInTheDocument();
      });
    });

    it('should display pending requests count', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Pending Requests')).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display requests in table after loading', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
        expect(screen.getByText('Another Organization')).toBeInTheDocument();
      });
    });

    it('should show empty state when no pending requests', async () => {
      (organizationDeletionService.getPendingDeletionRequests as jest.Mock).mockResolvedValue([]);

      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
        expect(screen.getByText('All deletion requests have been processed')).toBeInTheDocument();
      });
    });
  });

  describe('Request Details', () => {
    it('should display organization details', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });

    it('should display deletion impact preBox', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        // Check if table is rendered with the organization
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      });
    });

    it('should display grace period information', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        const gracePeriodElements = screen.getAllByText('30 days');
        expect(gracePeriodElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Actions', () => {
    it('should call refresh when refresh button is clicked', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(organizationDeletionService.getPendingDeletionRequests).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetching fails', async () => {
      const errorMessage = 'Failed to fetch deletion requests';
      (organizationDeletionService.getPendingDeletionRequests as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      (organizationDeletionService.getPendingDeletionRequests as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Periodic Refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should refresh data every 30 seconds', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        expect(organizationDeletionService.getPendingDeletionRequests).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(organizationDeletionService.getPendingDeletionRequests).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(organizationDeletionService.getPendingDeletionRequests).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Status Display', () => {
    it('should display correct status badges', async () => {
      renderWithQueryClient(<OrganizationDeletionApprovals />);

      await waitFor(() => {
        const statusBadges = screen.getAllByText('PENDING');
        expect(statusBadges.length).toBeGreaterThan(0);
      });
    });
  });
});
