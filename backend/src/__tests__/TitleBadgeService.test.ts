import { Achievement, AchievementType } from '../models/Achievement';
import { UserAchievement } from '../models/UserAchievement';
import { TitleBadgeService } from '../services/gamification/TitleBadgeService';
import { ConflictError, NotFoundError } from '../utils/apiErrors';

// ── Mock repositories ──

const mockAchievementRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserAchievementRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }),
};

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Achievement) return mockAchievementRepo;
      if (entity === UserAchievement) return mockUserAchievementRepo;
      return {};
    }),
  },
}));

jest.mock('../services/gamification/GamificationAuditLogger', () => ({
  gamificationAuditLogger: {
    logBadgeCreated: jest.fn(),
    logBadgeUpdated: jest.fn(),
    logBadgeDeleted: jest.fn(),
    logBadgeAwarded: jest.fn(),
    logBadgeRevoked: jest.fn(),
  },
}));

describe('TitleBadgeService', () => {
  let service: TitleBadgeService;

  const orgId = 'org-uuid-1';
  const userId = 'user-uuid-1';
  const awardedBy = 'admin-uuid-1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TitleBadgeService();
  });

  // ── list ──

  describe('list', () => {
    it('should return items and total for an organization', async () => {
      const items = [
        { id: 'a-1', name: 'Hero', organizationId: orgId } as Achievement,
        { id: 'a-2', name: 'Leader', organizationId: orgId } as Achievement,
      ];
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([items, 2]),
      };
      mockAchievementRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list(orgId);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(qb.where).toHaveBeenCalledWith('a.organizationId = :organizationId', {
        organizationId: orgId,
      });
    });

    it('should apply type filter', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAchievementRepo.createQueryBuilder.mockReturnValue(qb);

      await service.list(orgId, { type: 'badge' });

      expect(qb.andWhere).toHaveBeenCalledWith('a.type = :type', { type: 'badge' });
    });

    it('should apply category and rarity filters', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAchievementRepo.createQueryBuilder.mockReturnValue(qb);

      await service.list(orgId, { category: 'leadership', rarity: 'epic' });

      expect(qb.andWhere).toHaveBeenCalledWith('a.category = :category', {
        category: 'leadership',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('a.rarity = :rarity', { rarity: 'epic' });
    });
  });

  // ── getById ──

  describe('getById', () => {
    it('should return achievement when found', async () => {
      const achievement = { id: 'a-1', name: 'Hero', organizationId: orgId } as Achievement;
      mockAchievementRepo.findOne.mockResolvedValue(achievement);

      const result = await service.getById('a-1', orgId);

      expect(result).toEqual(achievement);
      expect(mockAchievementRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'a-1', organizationId: orgId },
      });
    });

    it('should return null when not found', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);

      const result = await service.getById('nonexistent', orgId);

      expect(result).toBeNull();
    });

    it('should scope by organizationId for tenant isolation', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);

      await service.getById('a-1', orgId);

      expect(mockAchievementRepo.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: orgId }),
      });
    });
  });

  // ── create ──

  describe('create', () => {
    const validData = { name: 'Fleet Commander', description: 'Led 100 missions' };

    it('should create a badge with valid data', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null); // no duplicate
      const created = {
        id: 'new-uuid',
        ...validData,
        type: AchievementType.BADGE,
        organizationId: orgId,
        createdBy: userId,
      };
      mockAchievementRepo.create.mockReturnValue(created);
      mockAchievementRepo.save.mockResolvedValue(created);

      const result = await service.create(orgId, userId, validData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Fleet Commander');
      expect(mockAchievementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fleet Commander',
          organizationId: orgId,
          createdBy: userId,
          type: AchievementType.BADGE,
        })
      );
    });

    it('should throw error for duplicate name in same org', async () => {
      mockAchievementRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create(orgId, userId, validData)).rejects.toThrow(ConflictError);
    });

    it('should allow same name in different organizations', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);
      const created = { id: 'new-uuid', ...validData, organizationId: 'org-2', createdBy: userId };
      mockAchievementRepo.create.mockReturnValue(created);
      mockAchievementRepo.save.mockResolvedValue(created);

      const result = await service.create('org-2', userId, validData);

      expect(result.organizationId).toBe('org-2');
    });

    it('should default to badge type when not specified', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);
      const created = { id: 'id', ...validData, type: AchievementType.BADGE };
      mockAchievementRepo.create.mockReturnValue(created);
      mockAchievementRepo.save.mockResolvedValue(created);

      await service.create(orgId, userId, validData);

      expect(mockAchievementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: AchievementType.BADGE })
      );
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update an existing achievement', async () => {
      const existing = {
        id: 'a-1',
        name: 'Old Name',
        organizationId: orgId,
        createdBy: userId,
      } as Achievement;
      mockAchievementRepo.findOne.mockResolvedValue(existing);
      mockAchievementRepo.save.mockImplementation(a => Promise.resolve(a));

      const result = await service.update('a-1', orgId, { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw error when achievement not found', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', orgId, { name: 'X' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should scope update query by organizationId', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);

      try {
        await service.update('a-1', orgId, { name: 'X' });
      } catch {
        // Expected
      }

      expect(mockAchievementRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'a-1', organizationId: orgId },
      });
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete an existing achievement', async () => {
      const existing = {
        id: 'a-1',
        name: 'Hero',
        organizationId: orgId,
        createdBy: userId,
      } as Achievement;
      mockAchievementRepo.findOne.mockResolvedValue(existing);
      mockAchievementRepo.remove.mockResolvedValue(undefined);

      await service.delete('a-1', orgId);

      expect(mockAchievementRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw error when achievement not found', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent', orgId)).rejects.toThrow(NotFoundError);
    });
  });

  // ── award ──

  describe('award', () => {
    it('should award a badge to a user', async () => {
      const achievement = { id: 'a-1', name: 'Hero', organizationId: orgId } as Achievement;
      mockAchievementRepo.findOne.mockResolvedValue(achievement);
      mockUserAchievementRepo.findOne.mockResolvedValue(null); // not already awarded
      const ua = {
        id: 'ua-1',
        achievementId: 'a-1',
        userId,
        organizationId: orgId,
        awardedBy,
      };
      mockUserAchievementRepo.create.mockReturnValue(ua);
      mockUserAchievementRepo.save.mockResolvedValue(ua);

      const result = await service.award('a-1', orgId, userId, awardedBy);

      expect(result.achievementId).toBe('a-1');
      expect(result.userId).toBe(userId);
      expect(result.awardedBy).toBe(awardedBy);
    });

    it('should throw error when achievement not found', async () => {
      mockAchievementRepo.findOne.mockResolvedValue(null);

      await expect(service.award('nonexistent', orgId, userId, awardedBy)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw error when user already has the badge', async () => {
      mockAchievementRepo.findOne.mockResolvedValue({ id: 'a-1' });
      mockUserAchievementRepo.findOne.mockResolvedValue({ id: 'existing-ua' });

      await expect(service.award('a-1', orgId, userId, awardedBy)).rejects.toThrow(ConflictError);
    });

    it('should scope award queries by organizationId', async () => {
      const achievement = { id: 'a-1', name: 'Hero', organizationId: orgId } as Achievement;
      mockAchievementRepo.findOne.mockResolvedValue(achievement);
      mockUserAchievementRepo.findOne.mockResolvedValue(null);
      const ua = { id: 'ua-1', achievementId: 'a-1', userId, organizationId: orgId, awardedBy };
      mockUserAchievementRepo.create.mockReturnValue(ua);
      mockUserAchievementRepo.save.mockResolvedValue(ua);

      await service.award('a-1', orgId, userId, awardedBy);

      expect(mockAchievementRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'a-1', organizationId: orgId },
      });
      expect(mockUserAchievementRepo.findOne).toHaveBeenCalledWith({
        where: { achievementId: 'a-1', userId, organizationId: orgId },
      });
    });
  });

  // ── revoke ──

  describe('revoke', () => {
    it('should revoke a badge from a user', async () => {
      const ua = {
        id: 'ua-1',
        achievementId: 'a-1',
        userId,
        organizationId: orgId,
        achievement: { name: 'Hero' },
      } as unknown as UserAchievement;
      mockUserAchievementRepo.findOne.mockResolvedValue(ua);
      mockUserAchievementRepo.remove.mockResolvedValue(undefined);

      await service.revoke('a-1', orgId, userId);

      expect(mockUserAchievementRepo.remove).toHaveBeenCalledWith(ua);
    });

    it('should throw error when user does not have the badge', async () => {
      mockUserAchievementRepo.findOne.mockResolvedValue(null);

      await expect(service.revoke('a-1', orgId, userId)).rejects.toThrow(NotFoundError);
    });
  });

  // ── getUserItems ──

  describe('getUserItems', () => {
    it('should return user achievements with relations', async () => {
      const items = [
        { id: 'ua-1', userId, achievement: { name: 'Hero' } },
        { id: 'ua-2', userId, achievement: { name: 'Leader' } },
      ] as unknown as UserAchievement[];

      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(items),
      };
      mockUserAchievementRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUserItems(orgId, userId);

      expect(result).toHaveLength(2);
      expect(mockUserAchievementRepo.createQueryBuilder).toHaveBeenCalledWith('ua');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('ua.achievement', 'achievement');
      expect(qb.where).toHaveBeenCalledWith('ua.organizationId = :organizationId', {
        organizationId: orgId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ua.userId = :userId', { userId });
      expect(qb.orderBy).toHaveBeenCalledWith('ua.displaySlot', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('ua.awardedAt', 'DESC');
    });
  });

  // ── toggleDisplay ──

  describe('toggleDisplay', () => {
    it('should toggle display visibility', async () => {
      const ua = { id: 'ua-1', userId, isDisplayed: true } as UserAchievement;
      mockUserAchievementRepo.findOne.mockResolvedValue(ua);
      mockUserAchievementRepo.save.mockImplementation(data => Promise.resolve(data));

      const result = await service.toggleDisplay('ua-1', userId, false);

      expect(result.isDisplayed).toBe(false);
    });

    it('should throw error when assignment not found', async () => {
      mockUserAchievementRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleDisplay('nonexistent', userId, true)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should scope by userId for security', async () => {
      mockUserAchievementRepo.findOne.mockResolvedValue(null);

      try {
        await service.toggleDisplay('ua-1', userId, true);
      } catch {
        // Expected
      }

      expect(mockUserAchievementRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ua-1', userId },
      });
    });
  });

  // ── updateDisplaySlot ──

  describe('updateDisplaySlot', () => {
    it('should update display slot', async () => {
      const ua = { id: 'ua-1', userId, displaySlot: null } as UserAchievement;
      mockUserAchievementRepo.findOne.mockResolvedValue(ua);
      mockUserAchievementRepo.save.mockImplementation(data => Promise.resolve(data));

      const result = await service.updateDisplaySlot('ua-1', userId, 3);

      expect(result.displaySlot).toBe(3);
    });

    it('should throw error when assignment not found', async () => {
      mockUserAchievementRepo.findOne.mockResolvedValue(null);

      await expect(service.updateDisplaySlot('nonexistent', userId, 1)).rejects.toThrow(
        NotFoundError
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
