import { AppDataSource } from '../../../data-source';
import {
  Bounty,
  BountyRewardType,
  BountyStatus,
  BountyTargetType,
  BountyType,
} from '../../../models/Bounty';
import { BountyClaim, BountyClaimStatus } from '../../../models/BountyClaim';
import { BountyEvidence, EvidenceType } from '../../../models/BountyEvidence';
import { BountyClaimService, CreateClaimDTO, SubmitEvidenceDTO } from '../BountyClaimService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/auditLogger');
jest.mock('../../../websocket/controllers/notificationWebSocketController');

// Hunter stats are recalculated (best-effort) after approve/abandon/reject.
const mockUpdateHunterStats = jest.fn();
jest.mock('../HunterProfileService', () => ({
  HunterProfileService: jest.fn().mockImplementation(() => ({
    updateHunterStats: mockUpdateHunterStats,
  })),
}));

describe('BountyClaimService', () => {
  let claimService: BountyClaimService;
  let mockClaimRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockEvidenceRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockBountyRepository: jest.Mocked<Record<string, jest.Mock>>;

  // Test data
  const testOrgId = 'org-123';
  const testHunterId = 'hunter-456';
  const testHunterName = 'BountyHunter';
  const testCreatorId = 'creator-789';
  const testBountyId = 'bounty-123';
  const testClaimId = 'claim-123';

  const mockBounty: Bounty = {
    id: testBountyId,
    organizationId: testOrgId,
    createdBy: testCreatorId,
    createdByName: 'Creator',
    title: 'Test Bounty',
    description: 'Test description',
    bountyType: BountyType.KILL,
    targetType: BountyTargetType.PLAYER,
    targetName: 'TargetPlayer',
    rewardType: BountyRewardType.CREDITS,
    rewardAmount: 10000,
    status: BountyStatus.ACTIVE,
    visibility: 'organization',
    tags: [],
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

  const mockClaim: BountyClaim = {
    id: testClaimId,
    bountyId: testBountyId,
    hunterId: testHunterId,
    hunterName: testHunterName,
    organizationId: testOrgId,
    status: BountyClaimStatus.ACTIVE,
    claimedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isSubmitted: false,
    isCompleted: false,
    canSubmitEvidence: true,
    canBeAbandoned: true,
  } as unknown as BountyClaim;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateHunterStats.mockResolvedValue(undefined);

    // Mock query builder for SQL aggregation queries
    const mockQueryBuilder: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
    };

    // Mock claim repository
    mockClaimRepository = {
      create: jest.fn(data => ({ ...mockClaim, ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    // Mock evidence repository
    mockEvidenceRepository = {
      create: jest.fn(data => ({ id: 'evidence-123', ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    // Mock bounty repository
    mockBountyRepository = {
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === BountyClaim) return mockClaimRepository;
      if (entity === BountyEvidence) return mockEvidenceRepository;
      if (entity === Bounty) return mockBountyRepository;
      return mockClaimRepository;
    });

    // Create service instance
    claimService = new BountyClaimService();
  });

  describe('claim limits', () => {
    it('should count active claims for a hunter', async () => {
      mockClaimRepository.count.mockResolvedValueOnce(3);

      const count = await claimService.getActiveClaimsCount(testHunterId);

      expect(count).toBe(3);
      expect(mockClaimRepository.count).toHaveBeenCalledWith({
        where: {
          hunterId: testHunterId,
          status: BountyClaimStatus.ACTIVE,
        },
      });
    });

    it('should return true when hunter can claim (under limit)', async () => {
      mockClaimRepository.count.mockResolvedValueOnce(2);

      const canClaim = await claimService.canHunterClaim(testHunterId);

      expect(canClaim).toBe(true);
    });

    it('should return false when hunter is at claim limit', async () => {
      mockClaimRepository.count.mockResolvedValueOnce(5);

      const canClaim = await claimService.canHunterClaim(testHunterId);

      expect(canClaim).toBe(false);
    });
  });

  describe('createClaim', () => {
    const createClaimDTO: CreateClaimDTO = {
      bountyId: testBountyId,
      hunterId: testHunterId,
      hunterName: testHunterName,
    };

    it('should create a claim successfully', async () => {
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);
      mockClaimRepository.findOne.mockResolvedValueOnce(null); // No existing claim
      mockClaimRepository.count.mockResolvedValueOnce(0); // Under hunter limit
      mockClaimRepository.count.mockResolvedValueOnce(0); // Under bounty limit
      mockClaimRepository.save.mockResolvedValueOnce(mockClaim);

      const result = await claimService.createClaim(testOrgId, createClaimDTO);

      expect(mockClaimRepository.create).toHaveBeenCalled();
      expect(mockClaimRepository.save).toHaveBeenCalled();
      expect(mockBountyRepository.update).toHaveBeenCalledWith(
        testBountyId,
        expect.objectContaining({
          status: BountyStatus.CLAIMED,
          claimedBy: testHunterId,
          claimedByName: testHunterName,
        })
      );
      expect(result.status).toBe(BountyClaimStatus.ACTIVE);
    });

    it('should throw error when bounty not found', async () => {
      mockBountyRepository.findOne.mockResolvedValueOnce(null);

      await expect(claimService.createClaim(testOrgId, createClaimDTO)).rejects.toThrow(
        'Bounty not found'
      );
    });

    it('should throw error when bounty is not active', async () => {
      const claimedBounty = { ...mockBounty, status: BountyStatus.CLAIMED };
      mockBountyRepository.findOne.mockResolvedValueOnce(claimedBounty);

      await expect(claimService.createClaim(testOrgId, createClaimDTO)).rejects.toThrow(
        'Bounty is not available for claiming'
      );
    });

    it('should throw error when hunter already has active claim', async () => {
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);
      mockClaimRepository.findOne.mockResolvedValueOnce(mockClaim);

      await expect(claimService.createClaim(testOrgId, createClaimDTO)).rejects.toThrow(
        'You already have an active claim on this bounty'
      );
    });

    it('should throw error when creator tries to claim own bounty', async () => {
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);
      mockClaimRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        claimService.createClaim(testOrgId, {
          ...createClaimDTO,
          hunterId: testCreatorId,
        })
      ).rejects.toThrow('Cannot claim your own bounty');
    });
  });

  describe('submitEvidence', () => {
    const submitEvidenceDTO: SubmitEvidenceDTO = {
      evidenceType: EvidenceType.SCREENSHOT,
      content: 'Screenshot of target elimination',
      fileUrl: 'https://example.com/screenshot.png',
    };

    it('should submit evidence successfully', async () => {
      const claimWithEvidence = {
        ...mockClaim,
        canSubmitEvidence: true,
        evidence: [],
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(claimWithEvidence);
      mockEvidenceRepository.save.mockResolvedValueOnce({
        id: 'evidence-123',
        ...submitEvidenceDTO,
        claimId: testClaimId,
        submittedBy: testHunterId,
        submittedAt: new Date(),
      });

      const result = await claimService.submitEvidence(
        testClaimId,
        testHunterId,
        submitEvidenceDTO
      );

      expect(mockEvidenceRepository.create).toHaveBeenCalled();
      expect(mockEvidenceRepository.save).toHaveBeenCalled();
      expect(result.evidenceType).toBe(EvidenceType.SCREENSHOT);
    });

    it('should throw error when claim not found', async () => {
      mockClaimRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        claimService.submitEvidence(testClaimId, testHunterId, submitEvidenceDTO)
      ).rejects.toThrow('Claim not found');
    });

    it('should throw error when non-owner tries to submit', async () => {
      mockClaimRepository.findOne.mockResolvedValueOnce(mockClaim);

      await expect(
        claimService.submitEvidence(testClaimId, 'other-user', submitEvidenceDTO)
      ).rejects.toThrow('You can only submit evidence for your own claims');
    });
  });

  describe('submitClaimForReview', () => {
    it('should submit claim for review successfully', async () => {
      const claimWithEvidence = {
        ...mockClaim,
        status: BountyClaimStatus.ACTIVE,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(claimWithEvidence);
      mockEvidenceRepository.count.mockResolvedValueOnce(2); // Has evidence
      mockClaimRepository.save.mockResolvedValueOnce({
        ...claimWithEvidence,
        status: BountyClaimStatus.SUBMITTED,
        submittedAt: new Date(),
      });

      const result = await claimService.submitClaimForReview(
        testClaimId,
        testHunterId,
        testHunterName,
        'All evidence submitted'
      );

      expect(result.status).toBe(BountyClaimStatus.SUBMITTED);
      expect(mockBountyRepository.update).toHaveBeenCalledWith(
        testBountyId,
        expect.objectContaining({
          status: BountyStatus.COMPLETED,
        })
      );
    });

    it('should throw error when no evidence submitted', async () => {
      mockClaimRepository.findOne.mockResolvedValueOnce(mockClaim);
      mockEvidenceRepository.count.mockResolvedValueOnce(0);

      await expect(
        claimService.submitClaimForReview(testClaimId, testHunterId, testHunterName)
      ).rejects.toThrow('You must submit at least one piece of evidence');
    });
  });

  describe('abandonClaim', () => {
    it('should abandon claim successfully', async () => {
      const activeClaim = {
        ...mockClaim,
        canBeAbandoned: true,
        status: BountyClaimStatus.ACTIVE,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(activeClaim);
      mockClaimRepository.save.mockResolvedValueOnce({
        ...activeClaim,
        status: BountyClaimStatus.ABANDONED,
      });
      mockClaimRepository.count.mockResolvedValueOnce(0); // No other active claims

      const result = await claimService.abandonClaim(testClaimId, testHunterId, testHunterName);

      expect(result.status).toBe(BountyClaimStatus.ABANDONED);
      expect(mockBountyRepository.update).toHaveBeenCalledWith(
        testBountyId,
        expect.objectContaining({
          status: BountyStatus.ACTIVE,
        })
      );
      // Abandonment recalculates the hunter's stats (lowers success rate).
      expect(mockUpdateHunterStats).toHaveBeenCalledWith(testOrgId, testHunterId, testHunterName);
    });

    it('should throw error when not claim owner', async () => {
      mockClaimRepository.findOne.mockResolvedValueOnce(mockClaim);

      await expect(
        claimService.abandonClaim(testClaimId, 'other-user', 'OtherUser')
      ).rejects.toThrow('You can only abandon your own claims');
    });
  });

  describe('getHunterStats', () => {
    it('should return correct hunter statistics', async () => {
      // Mock SQL aggregation result from createQueryBuilder
      mockClaimRepository.createQueryBuilder().getRawMany.mockResolvedValueOnce([
        { status: BountyClaimStatus.ACTIVE, count: 2 },
        { status: BountyClaimStatus.COMPLETED, count: 1 },
        { status: BountyClaimStatus.ABANDONED, count: 1 },
        { status: BountyClaimStatus.REJECTED, count: 1 },
      ]);

      const stats = await claimService.getHunterStats(testHunterId);

      expect(stats.totalClaims).toBe(5);
      expect(stats.activeClaims).toBe(2);
      expect(stats.completedClaims).toBe(1);
      expect(stats.abandonedClaims).toBe(1);
      expect(stats.rejectedClaims).toBe(1);
    });
  });

  // Phase 3: Approval Workflow Tests
  describe('approveClaim', () => {
    it('should approve a submitted claim successfully', async () => {
      const submittedClaim = {
        ...mockClaim,
        status: BountyClaimStatus.SUBMITTED,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(submittedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);
      mockClaimRepository.save.mockResolvedValueOnce({
        ...submittedClaim,
        status: BountyClaimStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await claimService.approveClaim(
        testClaimId,
        testCreatorId,
        'Creator',
        'Great job!'
      );

      expect(result.status).toBe(BountyClaimStatus.COMPLETED);
      expect(mockBountyRepository.update).toHaveBeenCalledWith(
        testBountyId,
        expect.objectContaining({
          status: BountyStatus.VERIFIED,
          verifiedBy: testCreatorId,
        })
      );
      // Hunter stats are recalculated for the HUNTER (not the verifier).
      expect(mockUpdateHunterStats).toHaveBeenCalledWith(testOrgId, testHunterId, testHunterName);
    });

    it('still completes the claim when the hunter-stats recalculation fails (best-effort)', async () => {
      const submittedClaim = { ...mockClaim, status: BountyClaimStatus.SUBMITTED };
      mockClaimRepository.findOne.mockResolvedValueOnce(submittedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);
      mockClaimRepository.save.mockResolvedValueOnce({
        ...submittedClaim,
        status: BountyClaimStatus.COMPLETED,
        completedAt: new Date(),
      });
      mockUpdateHunterStats.mockRejectedValueOnce(new Error('profile service down'));

      const result = await claimService.approveClaim(testClaimId, testCreatorId, 'Creator');

      expect(result.status).toBe(BountyClaimStatus.COMPLETED);
      expect(mockUpdateHunterStats).toHaveBeenCalledTimes(1);
    });

    it('should throw error when claim not found', async () => {
      mockClaimRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        claimService.approveClaim(testClaimId, testCreatorId, 'Creator')
      ).rejects.toThrow('Claim not found');
    });

    it('should throw error when claim is not submitted', async () => {
      const activeClaim = { ...mockClaim, status: BountyClaimStatus.ACTIVE };
      mockClaimRepository.findOne.mockResolvedValueOnce(activeClaim);

      await expect(
        claimService.approveClaim(testClaimId, testCreatorId, 'Creator')
      ).rejects.toThrow('Only submitted claims can be approved');
    });

    it('should throw error when non-creator tries to approve', async () => {
      const submittedClaim = {
        ...mockClaim,
        status: BountyClaimStatus.SUBMITTED,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(submittedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);

      await expect(
        claimService.approveClaim(testClaimId, 'other-user', 'OtherUser')
      ).rejects.toThrow('Only the bounty creator can approve claims');
    });
  });

  describe('rejectClaim - Phase 3', () => {
    it('should reject a submitted claim with reason', async () => {
      const submittedClaim = {
        ...mockClaim,
        status: BountyClaimStatus.SUBMITTED,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(submittedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);
      mockClaimRepository.save.mockResolvedValueOnce({
        ...submittedClaim,
        status: BountyClaimStatus.REJECTED,
        notes: 'Rejected: Insufficient evidence',
      });

      const result = await claimService.rejectClaim(
        testClaimId,
        testCreatorId,
        'Creator',
        'Insufficient evidence'
      );

      expect(result.status).toBe(BountyClaimStatus.REJECTED);
      expect(mockBountyRepository.update).toHaveBeenCalledWith(
        testBountyId,
        expect.objectContaining({
          status: BountyStatus.ACTIVE,
          claimedBy: undefined,
        })
      );
      // Rejection recalculates the hunter's stats (lowers success rate).
      expect(mockUpdateHunterStats).toHaveBeenCalledWith(testOrgId, testHunterId, testHunterName);
    });

    it('should throw error when non-creator tries to reject', async () => {
      const submittedClaim = {
        ...mockClaim,
        status: BountyClaimStatus.SUBMITTED,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(submittedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);

      await expect(
        claimService.rejectClaim(testClaimId, 'other-user', 'OtherUser', 'No reason')
      ).rejects.toThrow('Only the bounty creator can reject claims');
    });
  });

  describe('markClaimPaid', () => {
    it('should mark a completed claim as paid', async () => {
      const completedClaim = {
        ...mockClaim,
        status: BountyClaimStatus.COMPLETED,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(completedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce({
        ...mockBounty,
        status: BountyStatus.VERIFIED,
      });

      const result = await claimService.markClaimPaid(
        testClaimId,
        testCreatorId,
        'Creator',
        'PAY-12345'
      );

      expect(mockBountyRepository.update).toHaveBeenCalledWith(
        testBountyId,
        expect.objectContaining({
          status: BountyStatus.PAID,
          metadata: expect.objectContaining({
            paymentReference: 'PAY-12345',
          }),
        })
      );
    });

    it('should throw error when claim is not completed', async () => {
      const activeClaim = { ...mockClaim, status: BountyClaimStatus.ACTIVE };
      mockClaimRepository.findOne.mockResolvedValueOnce(activeClaim);

      await expect(
        claimService.markClaimPaid(testClaimId, testCreatorId, 'Creator')
      ).rejects.toThrow('Only completed claims can be marked as paid');
    });

    it('should throw error when non-creator tries to mark as paid', async () => {
      const completedClaim = {
        ...mockClaim,
        status: BountyClaimStatus.COMPLETED,
      };
      mockClaimRepository.findOne.mockResolvedValueOnce(completedClaim);
      mockBountyRepository.findOne.mockResolvedValueOnce(mockBounty);

      await expect(
        claimService.markClaimPaid(testClaimId, 'other-user', 'OtherUser')
      ).rejects.toThrow('Only the bounty creator can mark claims as paid');
    });
  });

  describe('getRewardTrackingStats', () => {
    it('should return correct reward tracking statistics', async () => {
      const mockBounties = [
        { ...mockBounty, id: '1', status: BountyStatus.VERIFIED, rewardAmount: 10000 },
        { ...mockBounty, id: '2', status: BountyStatus.VERIFIED, rewardAmount: 20000 },
        { ...mockBounty, id: '3', status: BountyStatus.PAID, rewardAmount: 5000 },
        { ...mockBounty, id: '4', status: BountyStatus.ACTIVE, rewardAmount: 15000 },
      ];
      mockBountyRepository.find.mockResolvedValueOnce(mockBounties);

      const stats = await claimService.getRewardTrackingStats(testOrgId);

      expect(stats.totalPendingRewards).toBe(30000); // 10000 + 20000
      expect(stats.totalPaidRewards).toBe(5000);
      expect(stats.pendingClaimsCount).toBe(2);
      expect(stats.paidClaimsCount).toBe(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

