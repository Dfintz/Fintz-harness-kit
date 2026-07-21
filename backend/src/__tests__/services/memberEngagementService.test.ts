/**
 * MemberEngagementService Tests
 *
 * Tests for daily engagement tracking: message counts, voice minutes,
 * user stats aggregation, leaderboards, and data cleanup.
 */

// Mock dependencies before imports
jest.mock('../../utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../config/database';
import { MemberEngagementService } from '../../services/discord/MemberEngagementService';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  qb.update = jest.fn().mockReturnThis();
  qb.set = jest.fn().mockReturnThis();
  qb.setParameter = jest.fn().mockReturnThis();
  qb.where = jest.fn().mockReturnThis();
  qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
  qb.select = jest.fn().mockReturnThis();
  qb.addSelect = jest.fn().mockReturnThis();
  qb.groupBy = jest.fn().mockReturnThis();
  qb.orderBy = jest.fn().mockReturnThis();
  qb.limit = jest.fn().mockReturnThis();
  qb.delete = jest.fn().mockReturnThis();
  qb.from = jest.fn().mockReturnThis();
  qb.getRawOne = jest.fn().mockResolvedValue({ messageCount: '42', voiceMinutes: '120' });
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

function createMockRepo() {
  const qb = createMockQueryBuilder();
  return {
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('MemberEngagementService', () => {
  let service: MemberEngagementService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (MemberEngagementService as unknown as { instance: null }).instance = null;

    mockRepo = createMockRepo();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);

    service = MemberEngagementService.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance2 = MemberEngagementService.getInstance();
      expect(instance2).toBe(service);
    });
  });

  describe('incrementMessageCount', () => {
    it('should update existing row when affected > 0', async () => {
      mockRepo._qb.execute.mockResolvedValue({ affected: 1 });

      await service.incrementMessageCount('guild-1', 'user-1');

      expect(mockRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockRepo._qb.update).toHaveBeenCalled();
      expect(mockRepo._qb.set).toHaveBeenCalledWith({
        messageCount: expect.any(Function),
      });
      // Should NOT call create since affected > 0
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should insert new row when no existing row (affected = 0)', async () => {
      mockRepo._qb.execute.mockResolvedValue({ affected: 0 });

      await service.incrementMessageCount('guild-1', 'user-2');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-2',
          messageCount: 1,
          voiceMinutes: 0,
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should handle duplicate key error by retrying update', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint');
      mockRepo._qb.execute
        .mockRejectedValueOnce(duplicateError) // first attempt fails
        .mockResolvedValueOnce({ affected: 1 }); // retry succeeds
      mockRepo._qb.update.mockReturnValue(mockRepo._qb);
      mockRepo._qb.set.mockReturnValue(mockRepo._qb);
      mockRepo._qb.where.mockReturnValue(mockRepo._qb);

      // The initial update would fail, then race condition handler retries
      // We set affected=0 to trigger insert path, which throws duplicate, then retry
      mockRepo._qb.execute.mockReset();
      mockRepo._qb.execute
        .mockResolvedValueOnce({ affected: 0 }) // first update
        .mockResolvedValueOnce({ affected: 1 }); // retry update inside catch
      mockRepo.save.mockRejectedValueOnce(new Error('duplicate key'));

      // This should not throw
      await service.incrementMessageCount('guild-1', 'user-dup');
    });
  });

  describe('addVoiceMinutes', () => {
    it('should skip when minutes <= 0', async () => {
      await service.addVoiceMinutes('guild-1', 'user-1', 0);
      await service.addVoiceMinutes('guild-1', 'user-1', -5);

      expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should update existing row for positive minutes', async () => {
      mockRepo._qb.execute.mockResolvedValue({ affected: 1 });

      await service.addVoiceMinutes('guild-1', 'user-1', 15.7);

      expect(mockRepo._qb.update).toHaveBeenCalled();
      expect(mockRepo._qb.set).toHaveBeenCalledWith({
        voiceMinutes: expect.any(Function),
      });
    });

    it('should insert new row when no existing row (affected = 0)', async () => {
      mockRepo._qb.execute.mockResolvedValue({ affected: 0 });

      await service.addVoiceMinutes('guild-1', 'user-1', 30);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-1',
          voiceMinutes: 30,
          messageCount: 0,
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('should return aggregated stats for a user', async () => {
      mockRepo._qb.getRawOne.mockResolvedValue({
        messageCount: '42',
        voiceMinutes: '120',
      });

      const result = await service.getUserStats('guild-1', 'user-1', 30);

      expect(result).toEqual({ messageCount: 42, voiceMinutes: 120 });
      expect(mockRepo._qb.select).toHaveBeenCalled();
      expect(mockRepo._qb.where).toHaveBeenCalled();
    });

    it('should return zeros when no data exists', async () => {
      mockRepo._qb.getRawOne.mockResolvedValue(undefined);

      const result = await service.getUserStats('guild-1', 'user-none', 30);

      expect(result).toEqual({ messageCount: 0, voiceMinutes: 0 });
    });

    it('should default to 30 days when no days parameter', async () => {
      mockRepo._qb.getRawOne.mockResolvedValue({
        messageCount: '10',
        voiceMinutes: '5',
      });

      const result = await service.getUserStats('guild-1', 'user-1');

      expect(result).toEqual({ messageCount: 10, voiceMinutes: 5 });
    });
  });

  describe('getLeaderboard', () => {
    it('should return ranked users by messageCount', async () => {
      mockRepo._qb.getRawMany.mockResolvedValue([
        { userId: 'user-a', total: '500' },
        { userId: 'user-b', total: '300' },
        { userId: 'user-c', total: '100' },
      ]);

      const result = await service.getLeaderboard('guild-1', 'messageCount', 30, 10);

      expect(result).toEqual([
        { userId: 'user-a', total: 500 },
        { userId: 'user-b', total: 300 },
        { userId: 'user-c', total: 100 },
      ]);
      expect(mockRepo._qb.orderBy).toHaveBeenCalledWith('total', 'DESC');
      expect(mockRepo._qb.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no data', async () => {
      mockRepo._qb.getRawMany.mockResolvedValue([]);

      const result = await service.getLeaderboard('guild-1', 'voiceMinutes');

      expect(result).toEqual([]);
    });
  });

  describe('getGuildAggregates', () => {
    it('should return per-user aggregate stats', async () => {
      mockRepo._qb.getRawMany.mockResolvedValue([
        { userId: 'user-x', messageCount: '200', voiceMinutes: '60' },
        { userId: 'user-y', messageCount: '50', voiceMinutes: '180' },
      ]);

      const result = await service.getGuildAggregates('guild-1', 7);

      expect(result).toEqual([
        { userId: 'user-x', messageCount: 200, voiceMinutes: 60 },
        { userId: 'user-y', messageCount: 50, voiceMinutes: 180 },
      ]);
    });
  });

  describe('cleanupOldData', () => {
    it('should delete records older than retention days', async () => {
      mockRepo._qb.execute.mockResolvedValue({ affected: 42 });

      const result = await service.cleanupOldData(90);

      expect(result).toBe(42);
      expect(mockRepo._qb.delete).toHaveBeenCalled();
      expect(mockRepo._qb.where).toHaveBeenCalledWith(
        'date < :cutoff',
        expect.objectContaining({ cutoff: expect.any(String) })
      );
    });

    it('should return 0 when nothing to delete', async () => {
      mockRepo._qb.execute.mockResolvedValue({ affected: 0 });

      const result = await service.cleanupOldData(90);

      expect(result).toBe(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
