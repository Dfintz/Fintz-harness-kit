/**
 * RsiSyncReviewQueue Component Tests
 *
 * Wave 1.6: RSI Sync Review Queue
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RsiSyncReviewQueue } from '@/components/RsiSyncReviewQueue';

// Mock rsiSyncService
const mockGetReviewQueue = jest.fn();
const mockGetReviewStats = jest.fn();
const mockResolveReviewItem = jest.fn();

jest.mock('@/services/rsiSyncService', () => ({
  rsiSyncService: {
    getReviewQueue: (...args: unknown[]) => mockGetReviewQueue(...args),
    getReviewStats: (...args: unknown[]) => mockGetReviewStats(...args),
    resolveReviewItem: (...args: unknown[]) => mockResolveReviewItem(...args),
  },
}));

// Mock useNotification
jest.mock('@/store/uiStore', () => ({
  useNotification: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}));

const testOrgId = 'org-123';

const mockReviewItem = {
  id: 'link-1',
  userId: 'user-1',
  rsiHandle: 'TestPilot',
  syncStatus: 'needs_review',
  lastKnownRank: 'Officer',
  isAffiliate: false,
  discordUserId: '123456789012345678',
  reviewReason: 'rank_mismatch',
  reviewFlaggedAt: '2026-01-15T10:00:00Z',
  lastFailureReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockStats = {
  totalPendingReview: 2,
  byReason: { rank_mismatch: 1, multiple_failures: 1 },
  oldestReviewItem: '2026-01-10T00:00:00Z',
  resolvedLast30Days: 5,
};

describe('RsiSyncReviewQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetReviewQueue.mockResolvedValue({ items: [mockReviewItem], total: 1 });
    mockGetReviewStats.mockResolvedValue(mockStats);
  });

  it('should render loading state initially', () => {
    // Don't resolve promises immediately
    mockGetReviewQueue.mockReturnValue(new Promise(() => {}));
    mockGetReviewStats.mockReturnValue(new Promise(() => {}));

    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    expect(screen.getByText('Loading review queue...')).toBeInTheDocument();
  });

  it('should render review queue items after loading', async () => {
    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('TestPilot')).toBeInTheDocument();
    });

    expect(screen.getByText('Officer')).toBeInTheDocument();
    // "Rank Mismatch" appears in both stats card and table; just verify at least one exists
    expect(screen.getAllByText('Rank Mismatch').length).toBeGreaterThanOrEqual(1);
  });

  it('should show success message when queue is empty', async () => {
    mockGetReviewQueue.mockResolvedValue({ items: [], total: 0 });
    mockGetReviewStats.mockResolvedValue({
      ...mockStats,
      totalPendingReview: 0,
      byReason: {},
    });

    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText(/No items pending review/)).toBeInTheDocument();
    });
  });

  it('should display stats cards', async () => {
    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    expect(screen.getByText('Resolved (30d)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // totalPendingReview
    expect(screen.getByText('5')).toBeInTheDocument(); // resolvedLast30Days
  });

  it('should show pending count chip when items exist', async () => {
    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('1 pending')).toBeInTheDocument();
    });
  });

  it('should open resolve dialog on action button click', async () => {
    const user = userEvent.setup();

    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('TestPilot')).toBeInTheDocument();
    });

    // Click the approve button
    const approveButton = screen.getByLabelText('Approve (mark as synced)');
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText(/Resolve Review/)).toBeInTheDocument();
    });
  });

  it('should call resolve API on confirm', async () => {
    const user = userEvent.setup();
    mockResolveReviewItem.mockResolvedValue(undefined);

    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('TestPilot')).toBeInTheDocument();
    });

    // Open approve dialog
    const approveButton = screen.getByLabelText('Approve (mark as synced)');
    await user.click(approveButton);

    // Confirm
    const confirmButton = screen.getByText('Confirm approved');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockResolveReviewItem).toHaveBeenCalledWith(
        testOrgId,
        expect.objectContaining({
          linkId: 'link-1',
          resolution: 'approved',
        })
      );
    });
  });

  it('should call getReviewQueue with organizationId', async () => {
    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(mockGetReviewQueue).toHaveBeenCalledWith(testOrgId, { limit: 50 });
    });
  });

  it('should call getReviewStats with organizationId', async () => {
    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(mockGetReviewStats).toHaveBeenCalledWith(testOrgId);
    });
  });

  it('should show refresh button', async () => {
    render(<RsiSyncReviewQueue organizationId={testOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});
