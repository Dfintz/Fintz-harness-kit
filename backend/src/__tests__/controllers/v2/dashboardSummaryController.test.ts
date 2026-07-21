/**
 * DashboardSummaryController — Sprint 21 domain expansion tests
 *
 * Verifies that the 3 new dashboard domains (alliances, bounties, reputation)
 * are included in the aggregated summary response and that failures in any
 * one domain don't break the overall endpoint.
 */
import { Request, Response } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGetFleetCount = jest.fn().mockResolvedValue(5);
jest.mock('../../../services/fleet/FleetService', () => ({
  FleetService: jest.fn().mockImplementation(() => ({
    getFleetCount: mockGetFleetCount,
  })),
}));

const mockActivityCount = jest.fn().mockResolvedValue(10);
const mockGetUpcomingActivities = jest.fn().mockResolvedValue([]);
jest.mock('../../../services/activity/ActivityService', () => ({
  ActivityService: jest.fn().mockImplementation(() => ({
    count: mockActivityCount,
    getUpcomingActivities: mockGetUpcomingActivities,
  })),
}));

jest.mock('../../../services/team/TeamService', () => ({
  TeamService: jest.fn().mockImplementation(() => ({
    count: jest.fn().mockResolvedValue(2),
  })),
}));

jest.mock('../../../services/communication/notifications/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    listForUser: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    getUnreadCount: jest.fn().mockResolvedValue(0),
  })),
}));

jest.mock('../../../services/organization/MemberActivityService', () => ({
  MemberActivityService: jest.fn().mockImplementation(() => ({
    getActiveMemberCount: jest.fn().mockResolvedValue(8),
  })),
}));

jest.mock('../../../services/analytics/SCStatsOrgAnalyticsService', () => ({
  SCStatsOrgAnalyticsService: jest.fn().mockImplementation(() => ({
    getOrgAnalytics: jest.fn().mockResolvedValue(null),
  })),
}));

// ── New domain mocks (Sprint 21) ────────────────────────────────────────────
const mockGetAllianceStatistics = jest.fn().mockResolvedValue({
  total: 3,
  averageHealth: 85,
  strong: 2,
  needingReview: 0,
  mutual: 2,
  mutualPercentage: 67,
});
jest.mock('../../../services/organization/AllianceService', () => ({
  AllianceService: jest.fn().mockImplementation(() => ({
    getAllianceStatistics: mockGetAllianceStatistics,
  })),
}));

const mockGetStatistics = jest.fn().mockResolvedValue({
  totalBounties: 15,
  activeBounties: 4,
  completedBounties: 8,
  claimedBounties: 3,
  totalRewardsPosted: 50000,
  totalRewardsPaid: 30000,
  byType: {},
  byStatus: {},
  averageCompletionTime: 120,
});
jest.mock('../../../services/bounty/BountyService', () => ({
  BountyService: jest.fn().mockImplementation(() => ({
    getStatistics: mockGetStatistics,
  })),
}));

const mockGetUnifiedReputation = jest.fn().mockResolvedValue({
  userId: 'user-1',
  userReputation: {
    overallScore: 72,
    tier: 'Gold',
    totalSessions: 10,
    successRate: 0.9,
    averageRating: 4.2,
  },
  organizationTrust: [],
  combinedScore: 78,
  reliability: 'High',
});
jest.mock('../../../services/social/ReputationService', () => ({
  ReputationService: jest.fn().mockImplementation(() => ({
    getUnifiedReputation: mockGetUnifiedReputation,
  })),
}));

// ── Database & infrastructure mocks ──────────────────────────────────────────
const mockFindOne = jest.fn();
const mockCount = jest.fn();
const mockCreateQueryBuilder = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawOne: jest.fn().mockResolvedValue(null),
  getMany: jest.fn().mockResolvedValue([]),
  getCount: jest.fn().mockResolvedValue(0),
  then: jest.fn().mockResolvedValue(0),
});

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: mockFindOne,
      count: mockCount,
      createQueryBuilder: mockCreateQueryBuilder,
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// ── SUT ──────────────────────────────────────────────────────────────────────
import { DashboardSummaryController } from '../../../controllers/v2/dashboardSummaryController';

describe('DashboardSummaryController', () => {
  let controller: DashboardSummaryController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let successPayload: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DashboardSummaryController();

    mockReq = { user: { id: 'user-1' } } as unknown as Partial<Request>;
    successPayload = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      success: jest.fn((data: unknown) => {
        successPayload = data as Record<string, unknown>;
      }),
    } as unknown as Partial<Response>;

    // Default: user has an org membership
    mockFindOne.mockResolvedValue({
      organizationId: 'org-1',
      role: 'admin',
    });
    mockCount.mockResolvedValue(12);
  });

  describe('getSummary — new domains', () => {
    it('should include alliances stats in the response', async () => {
      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(mockGetAllianceStatistics).toHaveBeenCalledWith('org-1');
      expect(successPayload).toHaveProperty('alliances');
      expect((successPayload as Record<string, unknown>).alliances).toEqual({
        total: 3,
        mutual: 2,
        averageHealth: 85,
      });
    });

    it('should include bounty stats in the response', async () => {
      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(mockGetStatistics).toHaveBeenCalledWith('org-1');
      expect(successPayload).toHaveProperty('bounties');
      expect((successPayload as Record<string, unknown>).bounties).toEqual({
        totalBounties: 15,
        activeBounties: 4,
        completedBounties: 8,
      });
    });

    it('should include reputation stats in the response', async () => {
      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(mockGetUnifiedReputation).toHaveBeenCalledWith('user-1', 'org-1');
      expect(successPayload).toHaveProperty('reputation');
      expect((successPayload as Record<string, unknown>).reputation).toEqual({
        combinedScore: 78,
        reliability: 'High',
      });
    });

    it('should return null for alliances when service fails', async () => {
      mockGetAllianceStatistics.mockRejectedValueOnce(new Error('DB down'));

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(successPayload).toHaveProperty('alliances', null);
    });

    it('should return null for bounties when service fails', async () => {
      mockGetStatistics.mockRejectedValueOnce(new Error('timeout'));

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(successPayload).toHaveProperty('bounties', null);
    });

    it('should return null for reputation when service fails', async () => {
      mockGetUnifiedReputation.mockRejectedValueOnce(new Error('not found'));

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(successPayload).toHaveProperty('reputation', null);
    });

    it('should return null for all 3 new domains when user has no org', async () => {
      // No org membership
      mockFindOne.mockResolvedValueOnce(null);

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(successPayload).toHaveProperty('alliances', null);
      expect(successPayload).toHaveProperty('bounties', null);
      expect(successPayload).toHaveProperty('reputation', null);
    });
  });
});
