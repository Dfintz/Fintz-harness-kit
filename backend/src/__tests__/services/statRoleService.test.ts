/**
 * StatRoleService Tests
 *
 * Tests for stat-role CRUD and member eligibility evaluation.
 */

jest.mock('../../utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/discord/MemberEngagementService', () => ({
  MemberEngagementService: {
    getInstance: jest.fn(),
  },
}));

import { AppDataSource } from '../../config/database';
import { MemberEngagementService } from '../../services/discord/MemberEngagementService';
import { StatRoleService } from '../../services/discord/StatRoleService';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockRepo() {
  return {
    create: jest.fn((data: Record<string, unknown>) => ({ id: 'sr-1', ...data })),
    save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function createMockEngagementService() {
  return {
    getGuildAggregates: jest.fn().mockResolvedValue([]),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('StatRoleService', () => {
  let service: StatRoleService;
  let mockRepo: ReturnType<typeof createMockRepo>;
  let mockEngagement: ReturnType<typeof createMockEngagementService>;

  beforeEach(() => {
    jest.clearAllMocks();
    (StatRoleService as unknown as { instance: null }).instance = null;

    mockRepo = createMockRepo();
    mockEngagement = createMockEngagementService();

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    (MemberEngagementService.getInstance as jest.Mock).mockReturnValue(mockEngagement);

    service = StatRoleService.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance2 = StatRoleService.getInstance();
      expect(instance2).toBe(service);
    });
  });

  describe('createStatRole', () => {
    it('should create a stat role with defaults', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.save.mockImplementation(data => Promise.resolve(data));

      await service.createStatRole({
        guildId: 'guild-1',
        roleId: 'role-1',
        roleName: 'Active Member',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          roleId: 'role-1',
          roleName: 'Active Member',
          minMessages: 0,
          minVoiceMinutes: 0,
          windowDays: 30,
          autoRemove: true,
          enabled: true,
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw if stat role already exists for the Discord role', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createStatRole({
          guildId: 'guild-1',
          roleId: 'role-1',
          roleName: 'Duplicate',
        })
      ).rejects.toThrow('A stat role for this Discord role already exists');
    });

    it('should use custom thresholds when provided', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.save.mockImplementation(data => Promise.resolve(data));

      await service.createStatRole({
        guildId: 'guild-1',
        roleId: 'role-2',
        roleName: 'Voice King',
        minMessages: 50,
        minVoiceMinutes: 120,
        windowDays: 7,
        autoRemove: false,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          minMessages: 50,
          minVoiceMinutes: 120,
          windowDays: 7,
          autoRemove: false,
        })
      );
    });
  });

  describe('deleteStatRole', () => {
    it('should return true when deletion succeeds', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteStatRole('guild-1', 'role-1');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith({
        guildId: 'guild-1',
        roleId: 'role-1',
      });
    });

    it('should return false when nothing was deleted', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteStatRole('guild-1', 'role-nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getStatRolesForGuild', () => {
    it('should return enabled stat roles for a guild', async () => {
      const roles = [
        { id: 'sr-1', guildId: 'guild-1', roleId: 'role-1', enabled: true },
        { id: 'sr-2', guildId: 'guild-1', roleId: 'role-2', enabled: true },
      ];
      mockRepo.find.mockResolvedValue(roles);

      const result = await service.getStatRolesForGuild('guild-1');

      expect(result).toEqual(roles);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { guildId: 'guild-1', enabled: true },
      });
    });
  });

  describe('evaluateGuild', () => {
    it('should return empty array when no stat roles exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.evaluateGuild('guild-1');

      expect(result).toEqual([]);
      expect(mockEngagement.getGuildAggregates).not.toHaveBeenCalled();
    });

    it('should identify qualified users based on message threshold', async () => {
      mockRepo.find.mockResolvedValue([
        {
          id: 'sr-1',
          guildId: 'guild-1',
          roleId: 'role-1',
          minMessages: 100,
          minVoiceMinutes: 0,
          windowDays: 30,
          autoRemove: true,
          enabled: true,
        },
      ]);

      mockEngagement.getGuildAggregates.mockResolvedValue([
        { userId: 'user-a', messageCount: 150, voiceMinutes: 0 },
        { userId: 'user-b', messageCount: 50, voiceMinutes: 0 },
        { userId: 'user-c', messageCount: 200, voiceMinutes: 10 },
      ]);

      const result = await service.evaluateGuild('guild-1');

      expect(result).toHaveLength(1);
      expect(result[0].roleId).toBe('role-1');
      expect(result[0].addUserIds).toContain('user-a');
      expect(result[0].addUserIds).toContain('user-c');
      expect(result[0].addUserIds).not.toContain('user-b');
      expect(result[0].removeUserIds).toContain('user-b');
    });

    it('should identify qualified users based on voice threshold', async () => {
      mockRepo.find.mockResolvedValue([
        {
          id: 'sr-1',
          guildId: 'guild-1',
          roleId: 'role-voice',
          minMessages: 0,
          minVoiceMinutes: 60,
          windowDays: 7,
          autoRemove: true,
          enabled: true,
        },
      ]);

      mockEngagement.getGuildAggregates.mockResolvedValue([
        { userId: 'user-a', messageCount: 5, voiceMinutes: 120 },
        { userId: 'user-b', messageCount: 0, voiceMinutes: 30 },
      ]);

      const result = await service.evaluateGuild('guild-1');

      expect(result[0].addUserIds).toContain('user-a');
      expect(result[0].removeUserIds).toContain('user-b');
    });

    it('should not include removeUserIds when autoRemove is false', async () => {
      mockRepo.find.mockResolvedValue([
        {
          id: 'sr-1',
          guildId: 'guild-1',
          roleId: 'role-1',
          minMessages: 100,
          minVoiceMinutes: 0,
          windowDays: 30,
          autoRemove: false,
          enabled: true,
        },
      ]);

      mockEngagement.getGuildAggregates.mockResolvedValue([
        { userId: 'user-a', messageCount: 150, voiceMinutes: 0 },
        { userId: 'user-b', messageCount: 50, voiceMinutes: 0 },
      ]);

      const result = await service.evaluateGuild('guild-1');

      expect(result[0].addUserIds).toContain('user-a');
      expect(result[0].removeUserIds).toEqual([]);
    });

    it('should handle multiple stat roles with different windows', async () => {
      mockRepo.find.mockResolvedValue([
        {
          id: 'sr-1', guildId: 'guild-1', roleId: 'role-7d',
          minMessages: 50, minVoiceMinutes: 0, windowDays: 7, autoRemove: true, enabled: true,
        },
        {
          id: 'sr-2', guildId: 'guild-1', roleId: 'role-30d',
          minMessages: 200, minVoiceMinutes: 0, windowDays: 30, autoRemove: true, enabled: true,
        },
      ]);

      // 30-day aggregates (max window)
      mockEngagement.getGuildAggregates
        .mockResolvedValueOnce([
          { userId: 'user-a', messageCount: 300, voiceMinutes: 0 },
          { userId: 'user-b', messageCount: 100, voiceMinutes: 0 },
        ])
        // 7-day aggregates
        .mockResolvedValueOnce([
          { userId: 'user-a', messageCount: 60, voiceMinutes: 0 },
          { userId: 'user-b', messageCount: 20, voiceMinutes: 0 },
        ]);

      const result = await service.evaluateGuild('guild-1');

      expect(result).toHaveLength(2);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
