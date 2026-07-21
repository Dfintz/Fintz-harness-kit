import { AppDataSource } from '../../../data-source';
import {
  Bounty,
  BountyDifficulty,
  BountyRewardType,
  BountyStatus,
  BountyTargetType,
  BountyType,
  BountyVisibility,
} from '../../../models/Bounty';
import { BountyService, CreateBountyDTO } from '../BountyService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');

describe('BountyService', () => {
  let bountyService: BountyService;
  let mockRepository: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testUserName = 'TestUser';

  const mockBounty: Bounty = {
    id: 'bounty-123',
    organizationId: testOrgId,
    createdBy: testUserId,
    createdByName: testUserName,
    title: 'Test Bounty',
    description: 'Test description',
    bountyType: BountyType.KILL,
    targetType: BountyTargetType.PLAYER,
    targetName: 'TargetPlayer',
    rewardType: BountyRewardType.CREDITS,
    rewardAmount: 10000,
    status: BountyStatus.ACTIVE,
    difficulty: BountyDifficulty.MEDIUM,
    visibility: BountyVisibility.ORGANIZATION,
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
    sharedWithOrgs: [],
    isActive: true,
    isClaimed: false,
    isCompleted: false,
    isExpired: false,
    canBeClaimed: true,
    hasReward: true,
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
    addSharedOrg: jest.fn(),
    removeSharedOrg: jest.fn(),
    isOwnedBy: jest.fn(),
    getAccessibleOrgs: jest.fn(),
    isSoftDeleted: jest.fn(),
    isNotDeleted: jest.fn(),
  } as unknown as Bounty;

  const createBountyDTO: CreateBountyDTO = {
    title: 'New Bounty',
    description: 'New bounty description',
    bountyType: BountyType.CAPTURE,
    targetType: BountyTargetType.NPC,
    targetName: 'NPC Target',
    rewardType: BountyRewardType.CREDITS,
    rewardAmount: 5000,
    difficulty: BountyDifficulty.EASY,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock repository methods
    mockRepository = {
      create: jest.fn(data => ({ ...mockBounty, ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getCount: jest.fn(() => Promise.resolve(1)),
        getMany: jest.fn(() => Promise.resolve([mockBounty])),
        getManyAndCount: jest.fn(() => Promise.resolve([[mockBounty], 1])),
        getRawMany: jest.fn(() => Promise.resolve([])),
        getRawOne: jest.fn(() => Promise.resolve(null)),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 1 })),
      })),
      count: jest.fn(() => Promise.resolve(0)),
      query: jest.fn(() => Promise.resolve([])),
      metadata: { name: 'Bounty' },
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    // Create service instance
    bountyService = new BountyService();
  });

  describe('createBounty', () => {
    it('should create a new bounty successfully', async () => {
      const createdBounty = { ...mockBounty, ...createBountyDTO };
      mockRepository.save.mockResolvedValueOnce(createdBounty);

      const result = await bountyService.createBounty(
        testOrgId,
        testUserId,
        testUserName,
        createBountyDTO
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.title).toBe(createBountyDTO.title);
      expect(result.bountyType).toBe(createBountyDTO.bountyType);
    });

    it('should set default status to ACTIVE', async () => {
      const createdBounty = { ...mockBounty, ...createBountyDTO, status: BountyStatus.ACTIVE };
      mockRepository.save.mockResolvedValueOnce(createdBounty);

      const result = await bountyService.createBounty(
        testOrgId,
        testUserId,
        testUserName,
        createBountyDTO
      );

      expect(result.status).toBe(BountyStatus.ACTIVE);
    });

    it('should set default visibility to ORGANIZATION', async () => {
      const createdBounty = {
        ...mockBounty,
        ...createBountyDTO,
        visibility: BountyVisibility.ORGANIZATION,
      };
      mockRepository.save.mockResolvedValueOnce(createdBounty);

      const result = await bountyService.createBounty(
        testOrgId,
        testUserId,
        testUserName,
        createBountyDTO
      );

      expect(result.visibility).toBe(BountyVisibility.ORGANIZATION);
    });
  });

  describe('getBountyById', () => {
    it('should return bounty when found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockBounty);

      const result = await bountyService.getBountyById(testOrgId, mockBounty.id);

      expect(result).toEqual(mockBounty);
    });

    it('should return null when bounty not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await bountyService.getBountyById(testOrgId, 'non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('claimBounty', () => {
    const hunterId = 'hunter-456';
    const hunterName = 'BountyHunter';

    it('should claim an active bounty successfully', async () => {
      const activeBounty = { ...mockBounty, status: BountyStatus.ACTIVE };
      mockRepository.findOne.mockResolvedValueOnce(activeBounty);

      const claimedBounty = {
        ...activeBounty,
        status: BountyStatus.CLAIMED,
        claimedBy: hunterId,
        claimedByName: hunterName,
        claimedAt: new Date(),
      };
      mockRepository.save.mockResolvedValueOnce(claimedBounty);

      const result = await bountyService.claimBounty(
        testOrgId,
        mockBounty.id,
        hunterId,
        hunterName
      );

      expect(result.status).toBe(BountyStatus.CLAIMED);
      expect(result.claimedBy).toBe(hunterId);
    });

    it('should throw error when bounty not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        bountyService.claimBounty(testOrgId, 'non-existent', hunterId, hunterName)
      ).rejects.toThrow('Bounty not found');
    });

    it('should throw error when creator tries to claim own bounty', async () => {
      const activeBounty = {
        ...mockBounty,
        status: BountyStatus.ACTIVE,
        canBeClaimed: true,
      };
      mockRepository.findOne.mockResolvedValueOnce(activeBounty);

      await expect(
        bountyService.claimBounty(testOrgId, mockBounty.id, testUserId, testUserName)
      ).rejects.toThrow('Cannot claim your own bounty');
    });
  });

  describe('completeBounty', () => {
    const hunterId = 'hunter-456';
    const hunterName = 'BountyHunter';

    it('should complete a claimed bounty successfully', async () => {
      const claimedBounty = {
        ...mockBounty,
        status: BountyStatus.CLAIMED,
        claimedBy: hunterId,
        claimedByName: hunterName,
      };
      mockRepository.findOne.mockResolvedValueOnce(claimedBounty);

      const completedBounty = {
        ...claimedBounty,
        status: BountyStatus.COMPLETED,
        completedAt: new Date(),
      };
      mockRepository.save.mockResolvedValueOnce(completedBounty);

      const result = await bountyService.completeBounty(
        testOrgId,
        mockBounty.id,
        hunterId,
        hunterName
      );

      expect(result.status).toBe(BountyStatus.COMPLETED);
    });

    it('should throw error when non-claimer tries to complete', async () => {
      const claimedBounty = {
        ...mockBounty,
        status: BountyStatus.CLAIMED,
        claimedBy: hunterId,
      };
      mockRepository.findOne.mockResolvedValueOnce(claimedBounty);

      await expect(
        bountyService.completeBounty(testOrgId, mockBounty.id, 'other-user', 'OtherUser')
      ).rejects.toThrow('Only the bounty hunter can mark it as completed');
    });
  });

  describe('cancelBounty', () => {
    it('should cancel a bounty successfully', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockBounty);

      const cancelledBounty = {
        ...mockBounty,
        status: BountyStatus.CANCELLED,
      };
      mockRepository.save.mockResolvedValueOnce(cancelledBounty);

      const result = await bountyService.cancelBounty(
        testOrgId,
        mockBounty.id,
        testUserId,
        testUserName,
        'No longer needed'
      );

      expect(result.status).toBe(BountyStatus.CANCELLED);
    });

    it('should throw error when non-creator tries to cancel', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockBounty);

      await expect(
        bountyService.cancelBounty(testOrgId, mockBounty.id, 'other-user', 'OtherUser')
      ).rejects.toThrow('Only the bounty creator can cancel it');
    });
  });

  describe('searchBounties', () => {
    it('should search bounties with filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(() => Promise.resolve([[mockBounty], 1])),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(
        mockQueryBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
      );

      const result = await bountyService.searchBounties(
        testOrgId,
        { bountyType: BountyType.KILL, status: BountyStatus.ACTIVE },
        1,
        10
      );

      expect(result.bounties).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should return empty array when no bounties found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
      };
      mockRepository.createQueryBuilder.mockReturnValueOnce(
        mockQueryBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
      );

      const result = await bountyService.searchBounties(testOrgId, {}, 1, 10);

      expect(result.bounties).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      const makeStatsQueryBuilder = () => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getRawOne: jest.fn(),
      });

      const statusBuilder = makeStatsQueryBuilder();
      statusBuilder.getRawMany.mockResolvedValueOnce([
        { status: BountyStatus.ACTIVE, count: 2, rewardSum: '15000' },
        { status: BountyStatus.COMPLETED, count: 1, rewardSum: '3000' },
        { status: BountyStatus.CLAIMED, count: 1, rewardSum: '2000' },
      ]);

      const typeBuilder = makeStatsQueryBuilder();
      typeBuilder.getRawMany.mockResolvedValueOnce([
        { bountyType: BountyType.KILL, count: 1 },
        { bountyType: BountyType.CAPTURE, count: 3 },
      ]);

      const avgBuilder = makeStatsQueryBuilder();
      avgBuilder.getRawOne.mockResolvedValueOnce({ avgMinutes: 45 });

      mockRepository.createQueryBuilder
        .mockReturnValueOnce(
          statusBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
        )
        .mockReturnValueOnce(
          typeBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
        )
        .mockReturnValueOnce(
          avgBuilder as unknown as ReturnType<typeof mockRepository.createQueryBuilder>
        );

      const result = await bountyService.getStatistics(testOrgId);

      expect(result.totalBounties).toBe(4);
      expect(result.activeBounties).toBe(2);
      expect(result.completedBounties).toBe(1);
      expect(result.claimedBounties).toBe(1);
      expect(result.totalRewardsPosted).toBe(20000);
    });
  });

  describe('verifyBounty', () => {
    it('should verify a completed bounty successfully', async () => {
      const completedBounty = {
        ...mockBounty,
        status: BountyStatus.COMPLETED,
        claimedBy: 'hunter-123',
      };
      mockRepository.findOne.mockResolvedValueOnce(completedBounty);

      const verifiedBounty = {
        ...completedBounty,
        status: BountyStatus.VERIFIED,
        verifiedBy: testUserId,
        verifiedAt: new Date(),
      };
      mockRepository.save.mockResolvedValueOnce(verifiedBounty);

      const result = await bountyService.verifyBounty(
        testOrgId,
        mockBounty.id,
        testUserId,
        testUserName,
        true
      );

      expect(result.status).toBe(BountyStatus.VERIFIED);
      expect(result.verifiedBy).toBe(testUserId);
    });

    it('should reject verification if not creator', async () => {
      const completedBounty = {
        ...mockBounty,
        status: BountyStatus.COMPLETED,
      };
      mockRepository.findOne.mockResolvedValueOnce(completedBounty);

      await expect(
        bountyService.verifyBounty(testOrgId, mockBounty.id, 'other-user', 'OtherUser', true)
      ).rejects.toThrow('Only the bounty creator can verify completion');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

