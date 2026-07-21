import { Repository } from 'typeorm';

import { RsiMemberCache } from '../../models/RsiMemberCache';
import { RsiRoleSyncService } from '../external/RsiRoleSyncService';

// Mock dependencies
jest.mock('../../data-source', () => ({
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

// Mock the RSI API service
jest.mock('../external/RSIApiService', () => ({
  rsiApiService: {
    fetchOrganizationData: jest.fn(),
    verifyOrganizationMembership: jest.fn(),
    fetchUserData: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';
import { rsiApiService } from '../external/RSIApiService';

describe('RsiRoleSyncService', () => {
  let service: RsiRoleSyncService;
  let mockMemberCacheRepo: jest.Mocked<Repository<RsiMemberCache>>;

  const testOrganizationId = 'org-123';
  const testRsiOrgSid = 'TESTORG';
  const testRsiHandle = 'TestPlayer';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository
    mockMemberCacheRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<RsiMemberCache>>;

    // Setup AppDataSource mock
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockMemberCacheRepo);

    // Create service instance with test config
    service = new RsiRoleSyncService({
      refreshInterval: 60000, // 1 minute for testing
      cacheTTL: 120000, // 2 minutes for testing
      autoRefreshEnabled: false,
    });
  });

  afterEach(() => {
    // Stop any auto refresh timers
    service.stopAllAutoRefresh();
  });

  describe('constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new RsiRoleSyncService();
      const config = defaultService.getConfig();

      expect(config.refreshInterval).toBeDefined();
      expect(config.cacheTTL).toBeDefined();
      expect(config.maxMembersPerRequest).toBe(100);
      expect(config.paginationDelay).toBe(1000);
      expect(config.autoRefreshEnabled).toBe(false);

      defaultService.stopAllAutoRefresh();
    });

    it('should allow custom configuration', () => {
      const customService = new RsiRoleSyncService({
        refreshInterval: 30000,
        cacheTTL: 60000,
        maxMembersPerRequest: 50,
      });

      const config = customService.getConfig();
      expect(config.refreshInterval).toBe(30000);
      expect(config.cacheTTL).toBe(60000);
      expect(config.maxMembersPerRequest).toBe(50);

      customService.stopAllAutoRefresh();
    });

    it('should update configuration', () => {
      service.updateConfig({ refreshInterval: 45000 });

      const config = service.getConfig();
      expect(config.refreshInterval).toBe(45000);
    });
  });

  describe('fetchOrganizationMembers', () => {
    it('should return cached members when available', async () => {
      const cachedMembers: RsiMemberCache[] = [
        {
          id: 'cache-1',
          organizationId: testOrganizationId,
          rsiOrgSid: testRsiOrgSid,
          rsiHandle: 'Player1',
          rsiRank: 'Member',
          rsiRankOrder: 1,
          isAffiliate: false,
          cachedAt: new Date(),
        },
        {
          id: 'cache-2',
          organizationId: testOrganizationId,
          rsiOrgSid: testRsiOrgSid,
          rsiHandle: 'Player2',
          rsiRank: 'Officer',
          rsiRankOrder: 3,
          isAffiliate: false,
          cachedAt: new Date(),
        },
      ];

      // Mock query builder for cached members
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(cachedMembers),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.fetchOrganizationMembers(testOrganizationId, testRsiOrgSid);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.members).toHaveLength(2);
      expect(result.members[0].rsiHandle).toBe('Player1');
      expect(result.members[1].rsiHandle).toBe('Player2');
    });

    it('should fetch from RSI API when cache is empty', async () => {
      // Mock empty cache
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock RSI API response
      (rsiApiService.fetchOrganizationData as jest.Mock).mockResolvedValue({
        sid: testRsiOrgSid,
        name: 'Test Organization',
      });

      const result = await service.fetchOrganizationMembers(testOrganizationId, testRsiOrgSid);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(rsiApiService.fetchOrganizationData).toHaveBeenCalledWith(testRsiOrgSid);
    });

    it('should force refresh when forceRefresh is true', async () => {
      // Mock RSI API response
      (rsiApiService.fetchOrganizationData as jest.Mock).mockResolvedValue({
        sid: testRsiOrgSid,
        name: 'Test Organization',
      });

      // Mock empty cache for update
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.fetchOrganizationMembers(
        testOrganizationId,
        testRsiOrgSid,
        true // Force refresh
      );

      expect(result.fromCache).toBe(false);
      expect(rsiApiService.fetchOrganizationData).toHaveBeenCalled();
    });

    it('should return stale cache on API error', async () => {
      const staleCachedMembers: RsiMemberCache[] = [
        {
          id: 'cache-1',
          organizationId: testOrganizationId,
          rsiOrgSid: testRsiOrgSid,
          rsiHandle: 'Player1',
          rsiRank: 'Member',
          isAffiliate: false,
          cachedAt: new Date(Date.now() - 1000000), // Old cache
        },
      ];

      // First call returns empty (force refresh), second call returns stale cache
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce([]) // Empty cache on first call (expired)
          .mockResolvedValueOnce(staleCachedMembers), // Stale cache fallback
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock API error
      (rsiApiService.fetchOrganizationData as jest.Mock).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await service.fetchOrganizationMembers(testOrganizationId, testRsiOrgSid);

      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(true);
      expect(result.error).toContain('API error');
      expect(result.members).toHaveLength(1);
    });
  });

  describe('verifyAndCacheMember', () => {
    it('should verify and cache a valid member', async () => {
      (rsiApiService.verifyOrganizationMembership as jest.Mock).mockResolvedValue({
        verified: true,
        isOwner: false,
        isAdmin: false,
        membershipStatus: 'member',
        rank: 'Officer',
      });

      mockMemberCacheRepo.findOne.mockResolvedValue(null);
      mockMemberCacheRepo.create.mockImplementation(
        (data: Partial<RsiMemberCache>) => data as RsiMemberCache
      );
      mockMemberCacheRepo.save.mockImplementation((entity: RsiMemberCache) =>
        Promise.resolve(entity)
      );

      const result = await service.verifyAndCacheMember(
        testOrganizationId,
        testRsiOrgSid,
        testRsiHandle
      );

      expect(result).not.toBeNull();
      expect(result.status).toBe('verified');
      expect(result.member?.rsiHandle).toBe(testRsiHandle);
      expect(result.member?.rsiRank).toBe('Officer');
      expect(mockMemberCacheRepo.save).toHaveBeenCalled();
    });

    it('should return departed status for non-member', async () => {
      (rsiApiService.verifyOrganizationMembership as jest.Mock).mockResolvedValue({
        verified: true,
        isOwner: false,
        isAdmin: false,
        membershipStatus: 'not_member',
        error: 'User is not a member of this organization',
      });

      mockMemberCacheRepo.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.verifyAndCacheMember(
        testOrganizationId,
        testRsiOrgSid,
        testRsiHandle
      );

      expect(result.status).toBe('departed');
      expect(result.member).toBeUndefined();
    });

    it('should return departed status for deleted RSI account', async () => {
      (rsiApiService.verifyOrganizationMembership as jest.Mock).mockResolvedValue({
        verified: false,
        isOwner: false,
        isAdmin: false,
        membershipStatus: 'account_not_found',
        error: 'RSI account not found',
      });

      mockMemberCacheRepo.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.verifyAndCacheMember(
        testOrganizationId,
        testRsiOrgSid,
        testRsiHandle
      );

      expect(result.status).toBe('departed');
      expect(result.member).toBeUndefined();
    });

    it('should return api_error when verification fails due to API issues', async () => {
      (rsiApiService.verifyOrganizationMembership as jest.Mock).mockResolvedValue({
        verified: false,
        isOwner: false,
        isAdmin: false,
        membershipStatus: 'unknown',
        error: 'Request timeout',
      });

      const result = await service.verifyAndCacheMember(
        testOrganizationId,
        testRsiOrgSid,
        testRsiHandle
      );

      expect(result.status).toBe('api_error');
      expect(result.member).toBeUndefined();
      expect(mockMemberCacheRepo.delete).not.toHaveBeenCalled();
    });

    it('should return api_error when user data fetch fails', async () => {
      (rsiApiService.verifyOrganizationMembership as jest.Mock).mockResolvedValue({
        verified: false,
        isOwner: false,
        isAdmin: false,
        membershipStatus: 'unknown',
        error: 'Error fetching user data: 503 - Service Unavailable',
      });

      const result = await service.verifyAndCacheMember(
        testOrganizationId,
        testRsiOrgSid,
        testRsiHandle
      );

      expect(result.status).toBe('api_error');
      expect(result.member).toBeUndefined();
      expect(mockMemberCacheRepo.delete).not.toHaveBeenCalled();
    });

    it('should update existing cache entry', async () => {
      (rsiApiService.verifyOrganizationMembership as jest.Mock).mockResolvedValue({
        verified: true,
        isOwner: true,
        isAdmin: true,
        membershipStatus: 'member',
        rank: 'Founder',
      });

      const existingCache: RsiMemberCache = {
        id: 'existing-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        rsiHandle: testRsiHandle,
        rsiRank: 'Member',
        isAffiliate: false,
        cachedAt: new Date(Date.now() - 86400000), // 1 day old
      };

      mockMemberCacheRepo.findOne.mockResolvedValue(existingCache);
      mockMemberCacheRepo.save.mockImplementation((entity: RsiMemberCache) =>
        Promise.resolve(entity)
      );

      const result = await service.verifyAndCacheMember(
        testOrganizationId,
        testRsiOrgSid,
        testRsiHandle
      );

      expect(result).not.toBeNull();
      expect(result.status).toBe('verified');
      expect(result.member?.rsiRank).toBe('Founder');
      expect(mockMemberCacheRepo.save).toHaveBeenCalled();
    });
  });

  describe('getCachedMember', () => {
    it('should return cached member if valid', async () => {
      const cachedMember: RsiMemberCache = {
        id: 'cache-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        rsiHandle: testRsiHandle,
        rsiRank: 'Member',
        rsiRankOrder: 1,
        isAffiliate: false,
        cachedAt: new Date(), // Fresh cache
      };

      mockMemberCacheRepo.findOne.mockResolvedValue(cachedMember);

      const result = await service.getCachedMember(testOrganizationId, testRsiHandle);

      expect(result).not.toBeNull();
      expect(result?.rsiHandle).toBe(testRsiHandle);
    });

    it('should return null for expired cache', async () => {
      const expiredMember: RsiMemberCache = {
        id: 'cache-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        rsiHandle: testRsiHandle,
        rsiRank: 'Member',
        isAffiliate: false,
        cachedAt: new Date(Date.now() - 1000000000), // Very old
      };

      mockMemberCacheRepo.findOne.mockResolvedValue(expiredMember);

      const result = await service.getCachedMember(testOrganizationId, testRsiHandle);

      expect(result).toBeNull();
    });

    it('should return null when not found', async () => {
      mockMemberCacheRepo.findOne.mockResolvedValue(null);

      const result = await service.getCachedMember(testOrganizationId, testRsiHandle);

      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear cache for organization', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.clearCache(testOrganizationId);

      expect(result).toBe(5);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should clear cache for specific org SID', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.clearCache(testOrganizationId, testRsiOrgSid);

      expect(result).toBe(3);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          count: '10',
          oldest: new Date('2024-01-01'),
          newest: new Date('2024-01-15'),
        }),
        getCount: jest.fn().mockResolvedValue(2),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const stats = await service.getCacheStats(testOrganizationId);

      expect(stats.totalCached).toBe(10);
      expect(stats.oldestEntry).toEqual(new Date('2024-01-01'));
      expect(stats.newestEntry).toEqual(new Date('2024-01-15'));
      expect(stats.expiredEntries).toBe(2);
    });
  });

  describe('needsRefresh', () => {
    it('should return true when no cache exists', async () => {
      mockMemberCacheRepo.findOne.mockResolvedValue(null);

      const result = await service.needsRefresh(testOrganizationId, testRsiOrgSid);

      expect(result).toBe(true);
    });

    it('should return true when cache is old', async () => {
      const oldCache: RsiMemberCache = {
        id: 'cache-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        rsiHandle: 'Player1',
        rsiRank: 'Member',
        isAffiliate: false,
        cachedAt: new Date(Date.now() - 1000000), // Old cache
      };

      mockMemberCacheRepo.findOne.mockResolvedValue(oldCache);

      const result = await service.needsRefresh(testOrganizationId, testRsiOrgSid);

      expect(result).toBe(true);
    });

    it('should return false when cache is fresh', async () => {
      const freshCache: RsiMemberCache = {
        id: 'cache-1',
        organizationId: testOrganizationId,
        rsiOrgSid: testRsiOrgSid,
        rsiHandle: 'Player1',
        rsiRank: 'Member',
        isAffiliate: false,
        cachedAt: new Date(), // Fresh cache
      };

      mockMemberCacheRepo.findOne.mockResolvedValue(freshCache);

      const result = await service.needsRefresh(testOrganizationId, testRsiOrgSid);

      expect(result).toBe(false);
    });
  });

  describe('mapUserOrgToMember', () => {
    it('should map RSI user org data to member format', () => {
      const userOrg = {
        sid: testRsiOrgSid,
        name: 'Test Org',
        rank: 'Officer',
        stars: 3,
        isAffiliate: false,
      };

      const result = service.mapUserOrgToMember(userOrg, testRsiHandle);

      expect(result.rsiHandle).toBe(testRsiHandle);
      expect(result.rsiRank).toBe('Officer');
      expect(result.rsiRankOrder).toBe(3);
      expect(result.isAffiliate).toBe(false);
    });

    it('should handle affiliate members', () => {
      const userOrg = {
        sid: testRsiOrgSid,
        name: 'Test Org',
        rank: 'Affiliate Member',
        stars: 1,
        isAffiliate: true,
      };

      const result = service.mapUserOrgToMember(userOrg, testRsiHandle);

      expect(result.isAffiliate).toBe(true);
    });

    it('should handle missing rank', () => {
      const userOrg = {
        sid: testRsiOrgSid,
        name: 'Test Org',
      };

      const result = service.mapUserOrgToMember(userOrg, testRsiHandle);

      expect(result.rsiRank).toBe('Unknown');
    });
  });

  describe('auto refresh', () => {
    it('should start and stop auto refresh', () => {
      // Enable auto refresh
      service.updateConfig({ autoRefreshEnabled: true });

      service.startAutoRefresh(testOrganizationId, testRsiOrgSid);

      // Should not throw
      service.stopAutoRefresh(testOrganizationId, testRsiOrgSid);
    });

    it('should not start when disabled', () => {
      service.updateConfig({ autoRefreshEnabled: false });

      // This should log a warning but not start
      service.startAutoRefresh(testOrganizationId, testRsiOrgSid);

      // Stop should not throw even if not started
      service.stopAutoRefresh(testOrganizationId, testRsiOrgSid);
    });

    it('should stop all auto refresh timers', () => {
      service.updateConfig({ autoRefreshEnabled: true });

      service.startAutoRefresh(testOrganizationId, testRsiOrgSid);
      service.startAutoRefresh('org-2', 'ANOTHERORG');

      // Should not throw
      service.stopAllAutoRefresh();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

