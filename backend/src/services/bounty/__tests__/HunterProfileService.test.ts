import { AppDataSource } from '../../../data-source';
import {
  Bounty,
  BountyRewardType,
  BountyStatus,
  BountyTargetType,
  BountyType,
} from '../../../models/Bounty';
import { BountyClaim, BountyClaimStatus } from '../../../models/BountyClaim';
import { HunterProfile, HunterRank } from '../../../models/HunterProfile';
import { logAuditEvent } from '../../../utils/auditLogger';
import { HunterProfileService } from '../HunterProfileService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');

// A rank-up promotion fires a best-effort hunter notification after the recalc.
const mockNotifyHunterRankPromotion = jest.fn();
jest.mock('../BountyNotificationService', () => ({
  BountyNotificationService: jest.fn().mockImplementation(() => ({
    notifyHunterRankPromotion: mockNotifyHunterRankPromotion,
  })),
}));

const mockLogAuditEvent = logAuditEvent as jest.Mock;

describe('HunterProfileService', () => {
  let hunterProfileService: HunterProfileService;
  let mockProfileRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockClaimRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockBountyRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockQueryBuilder: Record<string, jest.Mock>;

  // Test data
  const testOrgId = 'org-123';
  const testUserId = '00000000-0000-4000-a000-000000000456';
  const testUserName = 'TestHunter';

  const mockProfile: HunterProfile = {
    id: 'profile-123',
    userId: testUserId,
    userName: testUserName,
    organizationId: testOrgId,
    totalBountiesCompleted: 10,
    totalBountiesClaimed: 15,
    totalBountiesAbandoned: 3,
    totalBountiesRejected: 2,
    totalRewardsEarned: 100000,
    successRate: 66.67,
    averageCompletionTimeMinutes: 120,
    rank: HunterRank.HUNTER,
    reputationScore: 150,
    killBountiesCompleted: 5,
    captureBountiesCompleted: 2,
    intelBountiesCompleted: 1,
    transportBountiesCompleted: 1,
    rescueBountiesCompleted: 1,
    customBountiesCompleted: 0,
    lastBountyCompletedAt: new Date(),
    currentStreak: 3,
    longestStreak: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    primarySpecialization: 'kill',
  } as unknown as HunterProfile;

  const mockBounty: Bounty = {
    id: 'bounty-123',
    organizationId: testOrgId,
    createdBy: 'creator-789',
    title: 'Test Bounty',
    bountyType: BountyType.KILL,
    targetType: BountyTargetType.PLAYER,
    rewardType: BountyRewardType.CREDITS,
    rewardAmount: 10000,
    status: BountyStatus.PAID,
    visibility: 'organization',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Bounty;

  const mockClaim: BountyClaim = {
    id: 'claim-123',
    bountyId: 'bounty-123',
    hunterId: testUserId,
    hunterName: testUserName,
    organizationId: testOrgId,
    status: BountyClaimStatus.COMPLETED,
    claimedAt: new Date(Date.now() - 7200000), // 2 hours ago
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    bounty: mockBounty,
  } as unknown as BountyClaim;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock profile repository
    mockProfileRepository = {
      create: jest.fn(data => ({ ...mockProfile, ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
    };

    // Mock query builder for SQL aggregation queries
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ totalRewards: '0', avgMinutes: null, lastCompletedAt: null }),
    };

    // Mock claim repository
    mockClaimRepository = {
      find: jest.fn(() => Promise.resolve([])),
      findAndCount: jest.fn(() => Promise.resolve([[], 0])),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    // Mock bounty repository
    mockBountyRepository = {
      find: jest.fn(() => Promise.resolve([])),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === HunterProfile) return mockProfileRepository;
      if (entity === BountyClaim) return mockClaimRepository;
      if (entity === Bounty) return mockBountyRepository;
      return mockProfileRepository;
    });

    // Create service instance
    hunterProfileService = new HunterProfileService();
  });

  describe('getOrCreateProfile', () => {
    it('should return existing profile if found', async () => {
      mockProfileRepository.findOne.mockResolvedValueOnce(mockProfile);

      const result = await hunterProfileService.getOrCreateProfile(
        testOrgId,
        testUserId,
        testUserName
      );

      expect(result).toEqual(mockProfile);
      expect(mockProfileRepository.findOne).toHaveBeenCalledWith({
        where: { userId: testUserId, organizationId: testOrgId },
      });
      expect(mockProfileRepository.create).not.toHaveBeenCalled();
    });

    it('should create new profile if not found', async () => {
      mockProfileRepository.findOne.mockResolvedValueOnce(null);
      const newProfile = { ...mockProfile, totalBountiesCompleted: 0, rank: HunterRank.ROOKIE };
      mockProfileRepository.save.mockResolvedValueOnce(newProfile);

      const result = await hunterProfileService.getOrCreateProfile(
        testOrgId,
        testUserId,
        testUserName
      );

      expect(mockProfileRepository.create).toHaveBeenCalled();
      expect(mockProfileRepository.save).toHaveBeenCalled();
      expect(result.rank).toBe(HunterRank.ROOKIE);
    });

    it('should update username if changed', async () => {
      const profileWithOldName = { ...mockProfile, userName: 'OldName' };
      mockProfileRepository.findOne.mockResolvedValueOnce(profileWithOldName);
      mockProfileRepository.save.mockResolvedValueOnce({
        ...profileWithOldName,
        userName: 'NewName',
      });

      const result = await hunterProfileService.getOrCreateProfile(
        testOrgId,
        testUserId,
        'NewName'
      );

      expect(mockProfileRepository.save).toHaveBeenCalled();
      expect(result.userName).toBe('NewName');
    });
  });

  describe('getProfileByUserId', () => {
    it('should return profile for user', async () => {
      mockProfileRepository.findOne.mockResolvedValueOnce(mockProfile);

      const result = await hunterProfileService.getProfileByUserId(testOrgId, testUserId);

      expect(result).toEqual(mockProfile);
    });

    it('should return null if profile not found', async () => {
      mockProfileRepository.findOne.mockResolvedValueOnce(null);

      const result = await hunterProfileService.getProfileByUserId(testOrgId, testUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateHunterStats', () => {
    it('should calculate and update hunter statistics', async () => {
      mockProfileRepository.findOne.mockResolvedValueOnce({
        ...mockProfile,
        totalBountiesCompleted: 0,
      });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));

      // Mock statusCounts query (first createQueryBuilder call)
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { status: BountyClaimStatus.COMPLETED, count: 2 },
        { status: BountyClaimStatus.ABANDONED, count: 1 },
      ]);
      // Mock rewardStats query (second createQueryBuilder call)
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalRewards: '20000',
        avgMinutes: 120,
        lastCompletedAt: new Date().toISOString(),
      });
      // Mock typeCounts query (third createQueryBuilder call)
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bountyType: BountyType.KILL, count: 2 },
      ]);

      const result = await hunterProfileService.updateHunterStats(
        testOrgId,
        testUserId,
        testUserName
      );

      expect(result.totalBountiesCompleted).toBe(2);
      expect(result.totalBountiesAbandoned).toBe(1);
      expect(result.totalBountiesClaimed).toBe(3);
      expect(mockProfileRepository.save).toHaveBeenCalled();
    });

    it('should calculate success rate correctly', async () => {
      mockProfileRepository.findOne.mockResolvedValueOnce({ ...mockProfile, successRate: 0 });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));

      // Mock statusCounts query: 2 completed, 1 abandoned, 1 rejected
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { status: BountyClaimStatus.COMPLETED, count: 2 },
        { status: BountyClaimStatus.ABANDONED, count: 1 },
        { status: BountyClaimStatus.REJECTED, count: 1 },
      ]);
      // Mock rewardStats query
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalRewards: '20000',
        avgMinutes: 60,
        lastCompletedAt: new Date().toISOString(),
      });
      // Mock typeCounts query
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bountyType: BountyType.KILL, count: 2 },
      ]);

      const result = await hunterProfileService.updateHunterStats(
        testOrgId,
        testUserId,
        testUserName
      );

      // 2 completed out of 4 total attempts = 50%
      expect(result.successRate).toBe(50);
    });

    it('logs RANK_CHANGED when the recalculation promotes the hunter', async () => {
      // Start as ROOKIE; 10 completed at 100% success promotes to HUNTER.
      mockProfileRepository.findOne.mockResolvedValueOnce({
        ...mockProfile,
        rank: HunterRank.ROOKIE,
        totalBountiesCompleted: 0,
      });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { status: BountyClaimStatus.COMPLETED, count: 10 },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalRewards: '50000',
        avgMinutes: 30,
        lastCompletedAt: new Date().toISOString(),
      });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bountyType: BountyType.KILL, count: 10 },
      ]);

      const result = await hunterProfileService.updateHunterStats(
        testOrgId,
        testUserId,
        testUserName
      );

      expect(result.rank).toBe(HunterRank.HUNTER);
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RANK_CHANGED',
          metadata: expect.objectContaining({
            previousRank: HunterRank.ROOKIE,
            newRank: HunterRank.HUNTER,
          }),
        })
      );
      // The promotion is surfaced to the hunter (best-effort recognition).
      expect(mockNotifyHunterRankPromotion).toHaveBeenCalledWith(
        expect.objectContaining({ rank: HunterRank.HUNTER }),
        HunterRank.ROOKIE,
        HunterRank.HUNTER
      );
    });

    it('does not log RANK_CHANGED when the rank is unchanged', async () => {
      // Already HUNTER; 10 completed at 100% keeps the rank at HUNTER.
      mockProfileRepository.findOne.mockResolvedValueOnce({
        ...mockProfile,
        rank: HunterRank.HUNTER,
      });
      mockProfileRepository.save.mockImplementation(entity => Promise.resolve(entity));
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { status: BountyClaimStatus.COMPLETED, count: 10 },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalRewards: '50000',
        avgMinutes: 30,
        lastCompletedAt: new Date().toISOString(),
      });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bountyType: BountyType.KILL, count: 10 },
      ]);

      await hunterProfileService.updateHunterStats(testOrgId, testUserId, testUserName);

      expect(mockLogAuditEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RANK_CHANGED' })
      );
      // No rank change ⇒ no promotion recognition.
      expect(mockNotifyHunterRankPromotion).not.toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard sorted by completed bounties', async () => {
      const profiles = [
        { ...mockProfile, totalBountiesCompleted: 20 },
        { ...mockProfile, id: '2', userId: 'user-2', totalBountiesCompleted: 15 },
        { ...mockProfile, id: '3', userId: 'user-3', totalBountiesCompleted: 10 },
      ];
      mockProfileRepository.find.mockResolvedValueOnce(profiles);

      const result = await hunterProfileService.getLeaderboard(testOrgId, 'completed', 10);

      expect(result).toHaveLength(3);
      expect(result[0].totalBountiesCompleted).toBe(20);
      expect(mockProfileRepository.find).toHaveBeenCalledWith({
        where: { organizationId: testOrgId },
        order: { totalBountiesCompleted: 'DESC' },
        take: 10,
      });
    });

    it('should return leaderboard sorted by rewards', async () => {
      const profiles = [
        { ...mockProfile, totalRewardsEarned: 500000 },
        { ...mockProfile, id: '2', userId: 'user-2', totalRewardsEarned: 300000 },
      ];
      mockProfileRepository.find.mockResolvedValueOnce(profiles);

      const result = await hunterProfileService.getLeaderboard(testOrgId, 'rewards', 10);

      expect(result).toHaveLength(2);
      expect(mockProfileRepository.find).toHaveBeenCalledWith({
        where: { organizationId: testOrgId },
        order: { totalRewardsEarned: 'DESC' },
        take: 10,
      });
    });

    it('should return empty array when no profiles exist', async () => {
      mockProfileRepository.find.mockResolvedValueOnce([]);

      const result = await hunterProfileService.getLeaderboard(testOrgId, 'completed', 10);

      expect(result).toHaveLength(0);
    });
  });

  describe('getHunterHistory', () => {
    it('should return paginated bounty history', async () => {
      const claims = [mockClaim, { ...mockClaim, id: '2', bountyId: 'bounty-2' }];
      mockClaimRepository.findAndCount.mockResolvedValueOnce([claims, 2]);

      const result = await hunterProfileService.getHunterHistory(testOrgId, testUserId, 1, 10);

      expect(result.history).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate correct total pages', async () => {
      const claims = [mockClaim];
      mockClaimRepository.findAndCount.mockResolvedValueOnce([claims, 25]);

      const result = await hunterProfileService.getHunterHistory(testOrgId, testUserId, 1, 10);

      expect(result.totalPages).toBe(3); // 25 / 10 = 2.5, ceil = 3
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should return correct analytics summary', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      const profiles = [
        { ...mockProfile, lastBountyCompletedAt: recentDate, totalBountiesCompleted: 10 },
        {
          ...mockProfile,
          id: '2',
          userId: 'user-2',
          lastBountyCompletedAt: oldDate,
          totalBountiesCompleted: 5,
        },
      ];
      mockProfileRepository.find.mockResolvedValueOnce(profiles);
      mockProfileRepository.find.mockResolvedValueOnce(profiles); // For leaderboard call

      const result = await hunterProfileService.getAnalyticsSummary(testOrgId);

      expect(result.totalHunters).toBe(2);
      expect(result.activeHunters).toBe(1); // Only one active in last 30 days
      expect(result.totalBountiesCompleted).toBe(15);
      expect(result.topHunters).toBeDefined();
    });
  });

  describe('getProfileCount', () => {
    it('should return profile count for organization', async () => {
      mockProfileRepository.count.mockResolvedValueOnce(25);

      const result = await hunterProfileService.getProfileCount(testOrgId);

      expect(result).toBe(25);
      expect(mockProfileRepository.count).toHaveBeenCalledWith({
        where: { organizationId: testOrgId },
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

