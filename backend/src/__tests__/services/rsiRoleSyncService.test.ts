// Mock data-source and logger before imports
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/external/RSIApiService', () => ({
  rsiApiService: {
    fetchOrganizationData: jest.fn(),
    verifyOrganizationMembership: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';
import { RsiMemberCache } from '../../models/RsiMemberCache';
import { rsiApiService } from '../../services/external/RSIApiService';
import { RsiRoleSyncService } from '../../services/external/RsiRoleSyncService';

const mockedRsiApi = rsiApiService as jest.Mocked<typeof rsiApiService>;

describe('RsiRoleSyncService', () => {
  let service: RsiRoleSyncService;
  let mockMemberCacheRepo: any;

  const ORG_ID = 'org-abc';
  const RSI_ORG_SID = 'WILDKNIGHT';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset env vars used by the constructor
    delete process.env.RSI_SYNC_REFRESH_INTERVAL;
    delete process.env.RSI_SYNC_CACHE_TTL;

    mockMemberCacheRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => ({ ...data })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === RsiMemberCache) return mockMemberCacheRepo;
      return {};
    });

    service = new RsiRoleSyncService({ autoRefreshEnabled: false });
  });

  afterEach(() => {
    // Ensure timers are stopped to prevent leaks
    service.stopAllAutoRefresh();
  });

  // ─── Constructor / Config ─────────────────────────────────────────────

  describe('constructor and configuration', () => {
    it('should initialise with default config values', () => {
      const config = service.getConfig();
      expect(config.refreshInterval).toBe(3600000); // 1 hour
      expect(config.cacheTTL).toBe(7200000); // 2 hours
      expect(config.maxMembersPerRequest).toBe(100);
      expect(config.paginationDelay).toBe(1000);
      expect(config.autoRefreshEnabled).toBe(false);
    });

    it('should accept partial custom config', () => {
      const custom = new RsiRoleSyncService({ cacheTTL: 5000, maxMembersPerRequest: 50 });
      const config = custom.getConfig();
      expect(config.cacheTTL).toBe(5000);
      expect(config.maxMembersPerRequest).toBe(50);
      custom.stopAllAutoRefresh();
    });

    it('should read refresh interval from env if not provided in config', () => {
      process.env.RSI_SYNC_REFRESH_INTERVAL = '120000';
      const svc = new RsiRoleSyncService();
      expect(svc.getConfig().refreshInterval).toBe(120000);
      svc.stopAllAutoRefresh();
    });

    it('should update configuration via updateConfig', () => {
      service.updateConfig({ paginationDelay: 500 });
      expect(service.getConfig().paginationDelay).toBe(500);
    });
  });

  // ─── fetchOrganizationMembers ─────────────────────────────────────────

  describe('fetchOrganizationMembers', () => {
    it('should return cached members when cache is valid and forceRefresh is false', async () => {
      const cachedEntry = {
        rsiHandle: 'TestPilot',
        rsiRank: 'Officer',
        rsiRankOrder: 3,
        isAffiliate: false,
        displayName: undefined,
        cachedAt: new Date(),
      };

      // Mock getCachedMembers path via createQueryBuilder
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([cachedEntry]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.fetchOrganizationMembers(ORG_ID, RSI_ORG_SID, false);

      expect(result.fromCache).toBe(true);
      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].rsiHandle).toBe('TestPilot');
    });

    it('should fetch from RSI API when cache is empty', async () => {
      // Empty cache
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(qb);

      mockedRsiApi.fetchOrganizationData.mockResolvedValue({ sid: RSI_ORG_SID } as any);

      const result = await service.fetchOrganizationMembers(ORG_ID, RSI_ORG_SID);

      expect(result.fromCache).toBe(false);
      expect(result.success).toBe(true);
      expect(mockedRsiApi.fetchOrganizationData).toHaveBeenCalledWith(RSI_ORG_SID);
    });

    it('should force refresh and bypass cache when forceRefresh is true', async () => {
      mockedRsiApi.fetchOrganizationData.mockResolvedValue({ sid: RSI_ORG_SID } as any);

      // Even though cache would return data, forceRefresh skips it
      const result = await service.fetchOrganizationMembers(ORG_ID, RSI_ORG_SID, true);

      expect(result.fromCache).toBe(false);
      expect(mockedRsiApi.fetchOrganizationData).toHaveBeenCalled();
    });

    it('should return stale cache on API error when cache is available', async () => {
      // First call to getCachedMembers (before API call) returns empty
      // Second call (fallback) returns stale data
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce([]) // pre-cache check: empty → go to API
          .mockResolvedValueOnce([
            { rsiHandle: 'StalePilot', rsiRank: 'Member', rsiRankOrder: 1, isAffiliate: false },
          ]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(qb);

      mockedRsiApi.fetchOrganizationData.mockRejectedValue(new Error('RSI API timeout'));

      const result = await service.fetchOrganizationMembers(ORG_ID, RSI_ORG_SID);

      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(true);
      expect(result.error).toContain('API error');
      expect(result.members[0].rsiHandle).toBe('StalePilot');
    });

    it('should return empty members on API error with no cache', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(qb);

      mockedRsiApi.fetchOrganizationData.mockRejectedValue(new Error('network error'));

      const result = await service.fetchOrganizationMembers(ORG_ID, RSI_ORG_SID);

      expect(result.success).toBe(false);
      expect(result.members).toEqual([]);
      expect(result.fromCache).toBe(false);
    });
  });

  // ─── verifyAndCacheMember ─────────────────────────────────────────────

  describe('verifyAndCacheMember', () => {
    it('should return member data and cache it on successful verification', async () => {
      mockedRsiApi.verifyOrganizationMembership.mockResolvedValue({
        verified: true,
        membershipStatus: 'member',
        rank: 'Officer',
      } as any);
      mockMemberCacheRepo.findOne.mockResolvedValue(null);
      mockMemberCacheRepo.save.mockResolvedValue({});

      const result = await service.verifyAndCacheMember(ORG_ID, RSI_ORG_SID, 'CoolPilot');

      expect(result).not.toBeNull();
      expect(result.status).toBe('verified');
      expect(result.member!.rsiHandle).toBe('CoolPilot');
      expect(result.member!.rsiRank).toBe('Officer');
      expect(mockMemberCacheRepo.save).toHaveBeenCalled();
    });

    it('should return departed and remove cache entry when member left org', async () => {
      mockedRsiApi.verifyOrganizationMembership.mockResolvedValue({
        verified: true,
        membershipStatus: 'not_member',
        error: 'User is not a member of this organization',
      } as any);

      const result = await service.verifyAndCacheMember(ORG_ID, RSI_ORG_SID, 'ExMember');

      expect(result.status).toBe('departed');
      expect(result.member).toBeUndefined();
      expect(mockMemberCacheRepo.delete).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        rsiHandle: 'ExMember',
      });
    });

    it('should return departed when RSI account is deleted', async () => {
      mockedRsiApi.verifyOrganizationMembership.mockResolvedValue({
        verified: false,
        membershipStatus: 'account_not_found',
        error: 'RSI account not found',
      } as any);

      const result = await service.verifyAndCacheMember(ORG_ID, RSI_ORG_SID, 'DeletedUser');

      expect(result.status).toBe('departed');
      expect(result.member).toBeUndefined();
    });

    it('should return api_error on transient API failure', async () => {
      mockedRsiApi.verifyOrganizationMembership.mockResolvedValue({
        verified: false,
        membershipStatus: 'unknown',
        error: 'Error fetching user data: 503',
      } as any);

      const result = await service.verifyAndCacheMember(ORG_ID, RSI_ORG_SID, 'TempFail');

      expect(result.status).toBe('api_error');
      expect(mockMemberCacheRepo.delete).not.toHaveBeenCalled();
    });

    it('should return api_error on thrown exception', async () => {
      mockedRsiApi.verifyOrganizationMembership.mockRejectedValue(new Error('RSI 503'));

      const result = await service.verifyAndCacheMember(ORG_ID, RSI_ORG_SID, 'FailPilot');

      expect(result.status).toBe('api_error');
    });
  });

  // ─── getCachedMembers / getCachedMember ───────────────────────────────

  describe('getCachedMembers', () => {
    it('should query with organizationId and cache expiry', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getCachedMembers(ORG_ID, RSI_ORG_SID);

      expect(qb.where).toHaveBeenCalledWith('cache.organizationId = :organizationId', {
        organizationId: ORG_ID,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'cache.cachedAt > :cacheExpiry',
        expect.objectContaining({ cacheExpiry: expect.any(Date) })
      );
    });

    it('should return empty array on repository error', async () => {
      mockMemberCacheRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('DB connection lost');
      });

      const result = await service.getCachedMembers(ORG_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getCachedMember', () => {
    it('should return null when no cache entry exists', async () => {
      mockMemberCacheRepo.findOne.mockResolvedValue(null);

      const result = await service.getCachedMember(ORG_ID, 'Unknown');

      expect(result).toBeNull();
    });

    it('should return null when cache entry is expired', async () => {
      const expired = {
        rsiHandle: 'OldPilot',
        rsiRank: 'Member',
        cachedAt: new Date(Date.now() - 999_999_999), // very old
      };
      mockMemberCacheRepo.findOne.mockResolvedValue(expired);

      const result = await service.getCachedMember(ORG_ID, 'OldPilot');

      expect(result).toBeNull();
    });

    it('should return member when cache entry is fresh', async () => {
      const fresh = {
        rsiHandle: 'FreshPilot',
        rsiRank: 'Director',
        rsiRankOrder: 4,
        isAffiliate: false,
        displayName: 'Fresh',
        cachedAt: new Date(), // now
      };
      mockMemberCacheRepo.findOne.mockResolvedValue(fresh);

      const result = await service.getCachedMember(ORG_ID, 'FreshPilot');

      expect(result).not.toBeNull();
      expect(result!.rsiRank).toBe('Director');
    });
  });

  // ─── clearCache ───────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should delete cache entries and return deleted count', async () => {
      const deleteQb = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      mockMemberCacheRepo.createQueryBuilder.mockReturnValue(deleteQb);

      const deleted = await service.clearCache(ORG_ID, RSI_ORG_SID);

      expect(deleted).toBe(5);
    });

    it('should return 0 on error', async () => {
      mockMemberCacheRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('DB error');
      });

      const deleted = await service.clearCache(ORG_ID);

      expect(deleted).toBe(0);
    });
  });

  // ─── needsRefresh ─────────────────────────────────────────────────────

  describe('needsRefresh', () => {
    it('should return true when no cache entry exists', async () => {
      mockMemberCacheRepo.findOne.mockResolvedValue(null);

      const result = await service.needsRefresh(ORG_ID, RSI_ORG_SID);

      expect(result).toBe(true);
    });

    it('should return false when cache is fresh', async () => {
      mockMemberCacheRepo.findOne.mockResolvedValue({
        cachedAt: new Date(), // just cached
      });

      const result = await service.needsRefresh(ORG_ID, RSI_ORG_SID);

      expect(result).toBe(false);
    });

    it('should return true on repository error', async () => {
      mockMemberCacheRepo.findOne.mockRejectedValue(new Error('DB error'));

      const result = await service.needsRefresh(ORG_ID, RSI_ORG_SID);

      expect(result).toBe(true);
    });
  });

  // ─── mapUserOrgToMember ───────────────────────────────────────────────

  describe('mapUserOrgToMember', () => {
    it('should map RsiUserOrganization to RsiOrgMember', () => {
      const userOrg = {
        sid: RSI_ORG_SID,
        rank: 'Officer',
        stars: 3,
        isAffiliate: false,
      } as any;

      const member = service.mapUserOrgToMember(userOrg, 'Maverick');

      expect(member.rsiHandle).toBe('Maverick');
      expect(member.rsiRank).toBe('Officer');
      expect(member.rsiRankOrder).toBe(3);
      expect(member.isAffiliate).toBe(false);
    });

    it('should default rank to Unknown when not provided', () => {
      const userOrg = { sid: RSI_ORG_SID } as any;

      const member = service.mapUserOrgToMember(userOrg, 'NoRank');

      expect(member.rsiRank).toBe('Unknown');
    });
  });

  // ─── Auto Refresh ─────────────────────────────────────────────────────

  describe('auto refresh lifecycle', () => {
    it('should not start timer when autoRefreshEnabled is false', () => {
      jest.useFakeTimers();
      service.startAutoRefresh(ORG_ID, RSI_ORG_SID);

      // No timer set because config says disabled
      jest.advanceTimersByTime(service.getConfig().refreshInterval + 1000);
      jest.useRealTimers();
    });

    it('should stop all auto refresh timers', () => {
      service.stopAllAutoRefresh();
      // Should not throw
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
