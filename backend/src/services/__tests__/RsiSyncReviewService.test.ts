import { Repository } from 'typeorm';

import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';
import {
  ReviewReason,
  ReviewResolution,
  RsiSyncReviewService,
} from '../external/RsiSyncReviewService';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';

describe('RsiSyncReviewService', () => {
  let service: RsiSyncReviewService;
  let mockRepo: jest.Mocked<Repository<RsiUserLink>>;

  const testOrgId = 'org-123';
  const testAdminId = 'admin-456';

  const createMockLink = (overrides: Partial<RsiUserLink> = {}): RsiUserLink => {
    const link = new RsiUserLink();
    Object.assign(link, {
      id: 'link-1',
      userId: 'user-1',
      organizationId: testOrgId,
      rsiHandle: 'TestPilot',
      syncStatus: SyncStatus.NEEDS_REVIEW,
      lastKnownRank: 'Officer',
      isAffiliate: false,
      discordUserId: '123456789012345678',
      metadata: {
        reviewReason: ReviewReason.RANK_MISMATCH,
        reviewFlaggedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return link;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<RsiUserLink>>;

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

    service = new RsiSyncReviewService();
  });

  describe('getReviewQueue', () => {
    it('should return review items and total count', async () => {
      const mockLinks = [createMockLink(), createMockLink({ id: 'link-2', rsiHandle: 'Pilot2' })];
      mockRepo.findAndCount.mockResolvedValue([mockLinks, 2]);

      const result = await service.getReviewQueue(testOrgId);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].rsiHandle).toBe('TestPilot');
      expect(result.items[0].reviewReason).toBe(ReviewReason.RANK_MISMATCH);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: testOrgId,
            syncStatus: SyncStatus.NEEDS_REVIEW,
          },
        })
      );
    });

    it('should support pagination', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getReviewQueue(testOrgId, { limit: 10, offset: 20 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should handle empty queue', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getReviewQueue(testOrgId);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('resolveReviewItem', () => {
    it('should approve a review item and mark as synced', async () => {
      const link = createMockLink();
      mockRepo.findOne.mockResolvedValue(link);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const result = await service.resolveReviewItem(
        { linkId: 'link-1', resolution: ReviewResolution.APPROVED },
        testAdminId
      );

      expect(result).not.toBeNull();
      expect(result!.syncStatus).toBe(SyncStatus.SYNCED);
      expect(result!.metadata).toMatchObject({
        lastReviewResolution: ReviewResolution.APPROVED,
        reviewResolvedBy: testAdminId,
      });
    });

    it('should reject a review item and mark as failed', async () => {
      const link = createMockLink();
      mockRepo.findOne.mockResolvedValue(link);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const result = await service.resolveReviewItem(
        { linkId: 'link-1', resolution: ReviewResolution.REJECTED, adminNotes: 'Invalid handle' },
        testAdminId
      );

      expect(result).not.toBeNull();
      expect(result!.syncStatus).toBe(SyncStatus.FAILED);
      expect(result!.metadata).toMatchObject({
        lastReviewResolution: ReviewResolution.REJECTED,
        reviewAdminNotes: 'Invalid handle',
      });
    });

    it('should resync a review item by resetting to pending', async () => {
      const link = createMockLink();
      mockRepo.findOne.mockResolvedValue(link);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const result = await service.resolveReviewItem(
        { linkId: 'link-1', resolution: ReviewResolution.RESYNCED, updatedRank: 'Captain' },
        testAdminId
      );

      expect(result).not.toBeNull();
      expect(result!.syncStatus).toBe(SyncStatus.PENDING);
      expect(result!.lastKnownRank).toBe('Captain');
    });

    it('should remove a review item', async () => {
      const link = createMockLink();
      mockRepo.findOne.mockResolvedValue(link);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const result = await service.resolveReviewItem(
        { linkId: 'link-1', resolution: ReviewResolution.REMOVED },
        testAdminId
      );

      expect(result).not.toBeNull();
      expect(result!.syncStatus).toBe(SyncStatus.REMOVED);
    });

    it('should return null for non-existent link', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveReviewItem(
        { linkId: 'nonexistent', resolution: ReviewResolution.APPROVED },
        testAdminId
      );

      expect(result).toBeNull();
    });
  });

  describe('flagForReview', () => {
    it('should flag a link for review with reason', async () => {
      const link = createMockLink({ syncStatus: SyncStatus.SYNCED });
      mockRepo.findOne.mockResolvedValue(link);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const result = await service.flagForReview('link-1', ReviewReason.RANK_MISMATCH);

      expect(result).not.toBeNull();
      expect(result!.syncStatus).toBe(SyncStatus.NEEDS_REVIEW);
      expect(result!.metadata?.reviewReason).toBe(ReviewReason.RANK_MISMATCH);
    });

    it('should include additional context in metadata', async () => {
      const link = createMockLink({ syncStatus: SyncStatus.SYNCED, metadata: {} });
      mockRepo.findOne.mockResolvedValue(link);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const result = await service.flagForReview('link-1', ReviewReason.HANDLE_NOT_FOUND, {
        previousRank: 'Officer',
        newRank: 'Unknown',
      });

      expect(result!.metadata).toMatchObject({
        previousRank: 'Officer',
        newRank: 'Unknown',
      });
    });

    it('should return null for non-existent link', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.flagForReview('nonexistent', ReviewReason.MANUAL_FLAG);

      expect(result).toBeNull();
    });
  });

  describe('getReviewStats', () => {
    it('should return statistics for review queue', async () => {
      const links = [
        createMockLink({ metadata: { reviewReason: ReviewReason.RANK_MISMATCH } }),
        createMockLink({ id: 'link-2', metadata: { reviewReason: ReviewReason.RANK_MISMATCH } }),
        createMockLink({
          id: 'link-3',
          metadata: { reviewReason: ReviewReason.MULTIPLE_FAILURES },
        }),
      ];
      mockRepo.find.mockResolvedValue(links);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      const stats = await service.getReviewStats(testOrgId);

      expect(stats.totalPendingReview).toBe(3);
      expect(stats.byReason[ReviewReason.RANK_MISMATCH]).toBe(2);
      expect(stats.byReason[ReviewReason.MULTIPLE_FAILURES]).toBe(1);
      expect(stats.resolvedLast30Days).toBe(5);
    });

    it('should handle empty queue', async () => {
      mockRepo.find.mockResolvedValue([]);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      const stats = await service.getReviewStats(testOrgId);

      expect(stats.totalPendingReview).toBe(0);
      expect(stats.oldestReviewItem).toBeNull();
      expect(stats.resolvedLast30Days).toBe(0);
    });
  });

  describe('flagMultipleFailures', () => {
    it('should flag links exceeding failure threshold', async () => {
      const failedLinks = [
        createMockLink({
          id: 'link-1',
          syncStatus: SyncStatus.FAILED,
          metadata: { consecutiveFailures: 5 },
        }),
        createMockLink({
          id: 'link-2',
          syncStatus: SyncStatus.FAILED,
          metadata: { consecutiveFailures: 1 },
        }),
        createMockLink({
          id: 'link-3',
          syncStatus: SyncStatus.FAILED,
          metadata: { consecutiveFailures: 3 },
        }),
      ];
      mockRepo.find.mockResolvedValue(failedLinks);
      mockRepo.save.mockImplementation(async entity => entity as RsiUserLink);

      const flagged = await service.flagMultipleFailures(testOrgId, 3);

      expect(flagged).toBe(2); // link-1 (5 >= 3) and link-3 (3 >= 3)
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should flag nothing when no links exceed threshold', async () => {
      const failedLinks = [
        createMockLink({ syncStatus: SyncStatus.FAILED, metadata: { consecutiveFailures: 1 } }),
      ];
      mockRepo.find.mockResolvedValue(failedLinks);

      const flagged = await service.flagMultipleFailures(testOrgId, 3);

      expect(flagged).toBe(0);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

