import { AppDataSource } from '../../config/database';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { MemberActivityService } from '../../services/organization/MemberActivityService';

jest.mock('../../config/database');

describe('MemberActivityService', () => {
  let service: MemberActivityService;
  let mockUserRepo: any;
  let mockUserOrgRepo: any;

  beforeEach(() => {
    // Create mock query builder
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      subQuery: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('(subquery)'),
      }),
      getCount: jest.fn(),
      getMany: jest.fn(),
      getRawMany: jest.fn(),
    };

    mockUserRepo = {
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    mockUserOrgRepo = {
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === User || entity.name === 'User') {
        return mockUserRepo;
      }
      if (entity === OrganizationMembership || entity.name === 'OrganizationMembership') {
        return mockUserOrgRepo;
      }
      return {};
    });

    service = new MemberActivityService();
    jest.clearAllMocks();
  });

  describe('getActiveMemberCount', () => {
    it('should return count of members active in last 30 days', async () => {
      const orgId = 'org-123';

      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getCount.mockResolvedValue(2);

      const result = await service.getActiveMemberCount(orgId);

      expect(result).toBe(2);
      expect(mockUserRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQB.where).toHaveBeenCalled();
      expect(mockQB.andWhere).toHaveBeenCalled();
      expect(mockQB.setParameter).toHaveBeenCalledWith('orgId', orgId);
      expect(mockQB.getCount).toHaveBeenCalled();
    });

    it('should return 0 when there are no active members', async () => {
      const orgId = 'org-empty';
      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getCount.mockResolvedValue(0);

      const result = await service.getActiveMemberCount(orgId);

      expect(result).toBe(0);
      expect(mockUserRepo.createQueryBuilder).toHaveBeenCalledWith('user');
    });

    it('should filter by 30-day threshold date', async () => {
      const orgId = 'org-123';
      mockUserOrgRepo.find.mockResolvedValue([{ userId: 'user-1' }]);

      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getCount.mockResolvedValue(1);

      await service.getActiveMemberCount(orgId);

      // Verify threshold date is approximately 30 days ago
      const calls = mockQB.andWhere.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const thresholdCall = calls.find(
        (call: any) => call[0].includes('lastActiveAt') && call[1]?.threshold
      );
      expect(thresholdCall).toBeDefined();

      const threshold = thresholdCall[1].threshold;
      const now = new Date();
      const daysDiff = (now.getTime() - threshold.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
    });
  });

  describe('getActivityTrends', () => {
    it('should return activity trends for specified days', async () => {
      const orgId = 'org-123';
      const days = 7;

      mockUserOrgRepo.count.mockResolvedValue(2);

      const mockQB = mockUserRepo.createQueryBuilder();

      // Mock the grouped query result for daily counts
      mockQB.getRawMany = jest.fn().mockResolvedValue([
        { date: '2024-12-01', count: '2' },
        { date: '2024-12-02', count: '1' },
        { date: '2024-12-03', count: '2' },
      ]);

      // Mock getActiveMemberCount call (for activeRate calculation)
      mockQB.getCount.mockResolvedValue(2);

      const result = await service.getActivityTrends(orgId, days);

      expect(result.totalMembers).toBe(2);
      expect(result.dailyActiveMembers).toHaveLength(days);
      expect(result.dailyActiveMembers[0]).toHaveProperty('date');
      expect(result.dailyActiveMembers[0]).toHaveProperty('count');
      expect(result.averageActiveMembers).toBeGreaterThanOrEqual(0);
      expect(result.activeRate).toBeGreaterThanOrEqual(0);
      expect(result.activeRate).not.toBeNaN();
      expect(result.period.start).toBeInstanceOf(Date);
      expect(result.period.end).toBeInstanceOf(Date);

      // Verify grouped query was used (more efficient)
      expect(mockQB.groupBy).toHaveBeenCalled();
    });

    it('should return empty trends for organization with no members', async () => {
      const orgId = 'org-empty';
      mockUserOrgRepo.count.mockResolvedValue(0);

      const result = await service.getActivityTrends(orgId, 30);

      expect(result.totalMembers).toBe(0);
      expect(result.dailyActiveMembers).toEqual([]);
      expect(result.averageActiveMembers).toBe(0);
      expect(result.activeRate).toBe(0);
    });

    it('should use default 30 days when days not specified', async () => {
      const orgId = 'org-123';
      mockUserOrgRepo.count.mockResolvedValue(1);

      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getRawMany = jest.fn().mockResolvedValue([]);
      mockQB.getCount.mockResolvedValue(0);

      const result = await service.getActivityTrends(orgId);

      expect(result.dailyActiveMembers).toHaveLength(30);
    });
  });

  describe('getActiveMembers', () => {
    it('should return list of active members', async () => {
      const orgId = 'org-123';
      const members = [{ userId: 'user-1' }, { userId: 'user-2' }];
      const activeUsers = [
        { id: 'user-1', username: 'user1', lastActiveAt: new Date('2024-12-01') },
        { id: 'user-2', username: 'user2', lastActiveAt: new Date('2024-12-02') },
      ];

      mockUserOrgRepo.find.mockResolvedValue(members);

      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getMany.mockResolvedValue(activeUsers);

      const result = await service.getActiveMembers(orgId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: 'user-1',
        username: 'user1',
        lastActiveAt: activeUsers[0].lastActiveAt,
      });
      expect(mockQB.orderBy).toHaveBeenCalledWith('user.lastActiveAt', 'DESC');
    });

    it('should respect limit parameter', async () => {
      const orgId = 'org-123';
      const limit = 50;
      mockUserOrgRepo.find.mockResolvedValue([{ userId: 'user-1' }]);

      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getMany.mockResolvedValue([]);

      await service.getActiveMembers(orgId, limit);

      expect(mockQB.limit).toHaveBeenCalledWith(limit);
    });

    it('should return empty array for organization with no members', async () => {
      const orgId = 'org-empty';

      const mockQB = mockUserRepo.createQueryBuilder();
      mockQB.getMany.mockResolvedValue([]);

      const result = await service.getActiveMembers(orgId);

      expect(result).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
