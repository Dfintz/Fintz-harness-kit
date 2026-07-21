import { RsiApiService as RSIApiService } from '../../services/external/RSIApiService';
import { rsiCrawlerService } from '../../services/external/RsiCrawlerService';

// Mock the crawler service
jest.mock('../../services/external/RsiCrawlerService', () => ({
  rsiCrawlerService: {
    crawlCitizen: jest.fn(),
    crawlOrganization: jest.fn(),
    crawlUserMemberships: jest.fn(),
    invalidateCitizenCache: jest.fn(),
    invalidateOrgCache: jest.fn(),
    getCircuitStatus: jest
      .fn()
      .mockReturnValue({ state: 'closed', failures: 0, lastFailure: null }),
  },
}));
const mockedCrawler = jest.mocked(rsiCrawlerService);

describe('RsiApiService', () => {
  let rsiApiService: RSIApiService;
  const originalEnv = process.env;

  // Crawler response helpers
  const makeCitizenData = (overrides: Record<string, unknown> = {}) => ({
    handle: 'testuser',
    displayName: 'Test User',
    bio: 'Test bio',
    avatarUrl: 'https://rsi.com/avatar.jpg',
    citizenRecord: '#12345',
    title: 'Ensign',
    enlisted: 'Jan 01, 2020',
    fluency: 'English',
    location: 'United States',
    website: 'https://example.com',
    ...overrides,
  });

  const makeMemberships = () => [
    { sid: 'TESTORG', name: 'Test Org', rank: 'Member', stars: 3, isMain: true },
  ];

  const makeOrgData = (overrides: Record<string, unknown> = {}) => ({
    sid: 'TESTORG',
    name: 'Test Organization',
    description: 'A test organization',
    memberCount: 100,
    affiliateCount: 10,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RSI_CACHE_TTL = '600';

    rsiApiService = new RSIApiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(rsiApiService).toBeInstanceOf(RSIApiService);
    });

    it('should use default values when env vars are not set', () => {
      delete process.env.RSI_CACHE_TTL;
      const defaultService = new RSIApiService();
      expect(defaultService).toBeInstanceOf(RSIApiService);
    });

    it('should not start stale cleanup interval in test environment', () => {
      process.env.NODE_ENV = 'test';
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const testService = new RSIApiService();

      expect(testService).toBeInstanceOf(RSIApiService);
      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });

    it('should start stale cleanup interval outside test environment', () => {
      process.env.NODE_ENV = 'development';
      const fakeHandle = { unref: jest.fn() } as unknown as NodeJS.Timeout;
      const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(fakeHandle);

      const devService = new RSIApiService();

      expect(devService).toBeInstanceOf(RSIApiService);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(fakeHandle.unref).toHaveBeenCalledTimes(1);
      setIntervalSpy.mockRestore();
    });
  });

  describe('fetchOrganizationData', () => {
    const mockIdentifier = 'TESTORG';

    it('should fetch and map organization data via crawler', async () => {
      mockedCrawler.crawlOrganization.mockResolvedValueOnce(makeOrgData());

      const result = await rsiApiService.fetchOrganizationData(mockIdentifier);

      expect(mockedCrawler.crawlOrganization).toHaveBeenCalledWith('TESTORG');
      expect(result.sid).toBe('TESTORG');
      expect(result.name).toBe('Test Organization');
      expect(result.description).toBe('A test organization');
      expect(result.memberCount).toBe(100);
    });

    it('should cache organization data', async () => {
      mockedCrawler.crawlOrganization.mockResolvedValueOnce(makeOrgData());

      const result1 = await rsiApiService.fetchOrganizationData(mockIdentifier);
      const result2 = await rsiApiService.fetchOrganizationData(mockIdentifier);

      expect(mockedCrawler.crawlOrganization).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should throw on crawler errors', async () => {
      mockedCrawler.crawlOrganization.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(rsiApiService.fetchOrganizationData(mockIdentifier)).rejects.toThrow(
        'Error fetching organization data: Connection refused'
      );
    });

    it('should handle null description', async () => {
      mockedCrawler.crawlOrganization.mockResolvedValueOnce(
        makeOrgData({ description: undefined })
      );

      const result = await rsiApiService.fetchOrganizationData(mockIdentifier);
      expect(result.description).toBeUndefined();
    });
  });

  describe('fetchUserData', () => {
    const mockHandle = 'testuser';

    it('should fetch and map citizen data via crawler', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce(makeMemberships());

      const result = await rsiApiService.fetchUserData(mockHandle);

      expect(mockedCrawler.crawlCitizen).toHaveBeenCalledWith('testuser');
      expect(result.handle).toBe('testuser');
      expect(result.displayName).toBe('Test User');
      expect(result.bio).toBe('Test bio');
      expect(result.title).toBe('Ensign');
      expect(result.citizenRecord).toBe('#12345');
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations?.[0].sid).toBe('TESTORG');
      expect(result.organizations?.[0].rank).toBe('Member');
      expect(result.organizations?.[0].stars).toBe(3);
      expect(result.organizations?.[0].isMain).toBe(true);
    });

    it('should cache user data', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce(makeMemberships());

      const result1 = await rsiApiService.fetchUserData(mockHandle);
      const result2 = await rsiApiService.fetchUserData(mockHandle);

      expect(mockedCrawler.crawlCitizen).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should return empty object when citizen not found (null)', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(null);

      const result = await rsiApiService.fetchUserData(mockHandle);
      expect(result).toEqual({});
    });

    it('should throw on crawler errors', async () => {
      mockedCrawler.crawlCitizen.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(rsiApiService.fetchUserData(mockHandle)).rejects.toThrow(
        'Error fetching user data: Connection refused'
      );
    });

    it('should fetch data for different users independently', async () => {
      mockedCrawler.crawlCitizen
        .mockResolvedValueOnce(makeCitizenData({ handle: 'user1', displayName: 'User One' }))
        .mockResolvedValueOnce(makeCitizenData({ handle: 'user2', displayName: 'User Two' }));
      mockedCrawler.crawlUserMemberships
        .mockResolvedValueOnce(makeMemberships())
        .mockResolvedValueOnce(makeMemberships());

      const result1 = await rsiApiService.fetchUserData('user1');
      const result2 = await rsiApiService.fetchUserData('user2');

      expect(result1.handle).toBe('user1');
      expect(result2.handle).toBe('user2');
      expect(mockedCrawler.crawlCitizen).toHaveBeenCalledTimes(2);
    });

    it('should still return citizen data when org membership crawl fails', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockRejectedValueOnce(new Error('Org crawl failed'));

      const result = await rsiApiService.fetchUserData(mockHandle);

      expect(result.handle).toBe('testuser');
      expect(result.organizations).toBeUndefined();
    });

    it('should map fluency string to array', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData({ fluency: 'German' }));
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([]);

      const result = await rsiApiService.fetchUserData('german-user');
      expect(result.fluency).toEqual(['German']);
    });

    it('should handle missing fluency', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData({ fluency: undefined }));
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([]);

      const result = await rsiApiService.fetchUserData('no-fluency');
      expect(result.fluency).toBeUndefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear all cached data', async () => {
      mockedCrawler.crawlOrganization.mockResolvedValue(makeOrgData());

      await rsiApiService.fetchOrganizationData('ORG-1');
      rsiApiService.clearCache();
      await rsiApiService.fetchOrganizationData('ORG-1');

      expect(mockedCrawler.crawlOrganization).toHaveBeenCalledTimes(2);
    });

    it('should return cache statistics', () => {
      const stats = rsiApiService.getCacheStats();

      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
    });

    it('should maintain separate cache keys for different data types', async () => {
      mockedCrawler.crawlOrganization.mockResolvedValueOnce(makeOrgData());
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([]);

      await rsiApiService.fetchOrganizationData('TEST');
      await rsiApiService.fetchUserData('TEST');

      expect(mockedCrawler.crawlOrganization).toHaveBeenCalledTimes(1);
      expect(mockedCrawler.crawlCitizen).toHaveBeenCalledTimes(1);
    });
  });

  describe('Health / monitoring', () => {
    it('should delegate getCircuitStatus to crawler', () => {
      mockedCrawler.getCircuitStatus.mockReturnValueOnce({
        state: 'open',
        failures: 5,
        lastFailure: new Date(),
      });

      const status = rsiApiService.getCircuitStatus();
      expect(status.state).toBe('open');
      expect(status.failures).toBe(5);
    });

    it('should report degraded when crawler circuit is open', () => {
      mockedCrawler.getCircuitStatus.mockReturnValueOnce({
        state: 'open',
        failures: 5,
        lastFailure: new Date(),
      });

      expect(rsiApiService.isDegraded()).toBe(true);
    });

    it('should report healthy when crawler circuit is closed', () => {
      mockedCrawler.getCircuitStatus.mockReturnValueOnce({
        state: 'closed',
        failures: 0,
        lastFailure: null,
      });

      expect(rsiApiService.isDegraded()).toBe(false);
    });
  });

  describe('verifyHandle', () => {
    it('should return verified result for existing handle', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce(makeMemberships());

      const result = await rsiApiService.verifyHandle('testuser');

      expect(result.verified).toBe(true);
      expect(result.handle).toBe('testuser');
      expect(result.displayName).toBe('Test User');
      expect(result.bio).toBe('Test bio');
      expect(mockedCrawler.invalidateCitizenCache).toHaveBeenCalledWith('testuser');
    });

    it('should return not-verified for non-existent handle', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(null);

      const result = await rsiApiService.verifyHandle('nonexistent');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('RSI handle not found');
    });

    it('should throw when crawler is unreachable', async () => {
      mockedCrawler.crawlCitizen.mockRejectedValueOnce(new Error('Network error'));

      await expect(rsiApiService.verifyHandle('testuser')).rejects.toThrow(
        'Error fetching user data: Network error'
      );
    });
  });

  describe('verifyBioCode', () => {
    it('should return true when code is in bio', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(
        makeCitizenData({ bio: 'My bio with VERIFY-ABC123 in it' })
      );
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([]);

      const result = await rsiApiService.verifyBioCode('testuser', 'VERIFY-ABC123');
      expect(result).toBe(true);
    });

    it('should return false when code is not in bio', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData({ bio: 'Just a bio' }));
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([]);

      const result = await rsiApiService.verifyBioCode('testuser', 'VERIFY-ABC123');
      expect(result).toBe(false);
    });

    it('should return false when no bio exists', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData({ bio: undefined }));
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([]);

      const result = await rsiApiService.verifyBioCode('testuser', 'VERIFY-ABC123');
      expect(result).toBe(false);
    });

    it('should return false on crawler error', async () => {
      mockedCrawler.crawlCitizen.mockRejectedValueOnce(new Error('Unavailable'));

      const result = await rsiApiService.verifyBioCode('testuser', 'VERIFY-ABC123');
      expect(result).toBe(false);
    });
  });

  describe('verifyOrganizationMembership', () => {
    it('should detect member with correct rank', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([
        { sid: 'TESTORG', name: 'Test Org', rank: 'Director', stars: 4, isMain: true },
      ]);

      const result = await rsiApiService.verifyOrganizationMembership('testuser', 'TESTORG');

      expect(result.verified).toBe(true);
      expect(result.membershipStatus).toBe('member');
      expect(result.isAdmin).toBe(true);
      expect(result.rank).toBe('Director');
    });

    it('should detect non-member', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([
        { sid: 'OTHER', name: 'Other Org', rank: 'Member', stars: 1, isMain: true },
      ]);

      const result = await rsiApiService.verifyOrganizationMembership('testuser', 'TESTORG');

      expect(result.verified).toBe(true);
      expect(result.membershipStatus).toBe('not_member');
    });

    it('should detect account not found', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(null);

      const result = await rsiApiService.verifyOrganizationMembership('deleted', 'TESTORG');

      expect(result.verified).toBe(false);
      expect(result.membershipStatus).toBe('account_not_found');
    });

    it('should detect owner rank', async () => {
      mockedCrawler.crawlCitizen.mockResolvedValueOnce(makeCitizenData());
      mockedCrawler.crawlUserMemberships.mockResolvedValueOnce([
        { sid: 'TESTORG', name: 'Test Org', rank: 'Founder', stars: 5, isMain: true },
      ]);

      const result = await rsiApiService.verifyOrganizationMembership('testuser', 'TESTORG');

      expect(result.isOwner).toBe(true);
      expect(result.isAdmin).toBe(true);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle undefined error objects', async () => {
      mockedCrawler.crawlOrganization.mockRejectedValueOnce(undefined);

      await expect(rsiApiService.fetchOrganizationData('ORG')).rejects.toThrow(
        'Error fetching organization data: Unknown error'
      );
    });

    it('should handle concurrent requests to same resource', async () => {
      mockedCrawler.crawlOrganization.mockResolvedValue(makeOrgData());

      const freshService = new RSIApiService();
      const promises = [
        freshService.fetchOrganizationData('ORG'),
        freshService.fetchOrganizationData('ORG'),
        freshService.fetchOrganizationData('ORG'),
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.sid).toBe('TESTORG');
      });
    });
  });
});
