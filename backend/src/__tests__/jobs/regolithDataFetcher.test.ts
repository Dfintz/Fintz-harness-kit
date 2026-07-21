import { RegolithDataFetcher } from '../../jobs/regolithDataFetcher';

describe('RegolithDataFetcher', () => {
  beforeEach(() => {
    // Clear any cached data before each test
    RegolithDataFetcher.clearCache();
  });

  afterEach(() => {
    // Stop any scheduled tasks
    RegolithDataFetcher.stop();
  });

  describe('getCachedData', () => {
    it('should return null when no data is cached', () => {
      const data = RegolithDataFetcher.getCachedData();
      expect(data).toBeNull();
    });
  });

  describe('getFetchStatuses', () => {
    it('should return empty array initially', () => {
      const statuses = RegolithDataFetcher.getFetchStatuses();
      expect(statuses).toEqual([]);
    });
  });

  describe('isCurrentlyFetching', () => {
    it('should return false when not fetching', () => {
      expect(RegolithDataFetcher.isCurrentlyFetching()).toBe(false);
    });
  });

  describe('isDataStale', () => {
    it('should return true when no data is cached', () => {
      expect(RegolithDataFetcher.isDataStale()).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should not throw when clearing empty cache', () => {
      expect(() => RegolithDataFetcher.clearCache()).not.toThrow();
    });
  });

  describe('schedule', () => {
    it('should schedule without throwing', () => {
      expect(() => RegolithDataFetcher.schedule()).not.toThrow();
    });

    it('should not schedule twice', () => {
      RegolithDataFetcher.schedule();
      // Second call should not throw
      expect(() => RegolithDataFetcher.schedule()).not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop without throwing when no task scheduled', () => {
      expect(() => RegolithDataFetcher.stop()).not.toThrow();
    });

    it('should stop scheduled task', () => {
      RegolithDataFetcher.schedule();
      expect(() => RegolithDataFetcher.stop()).not.toThrow();
    });
  });

  describe('execute', () => {
    it('should skip fetch when external fetches are disabled', async () => {
      const previous = process.env.DISABLE_EXTERNAL_FETCHES;
      process.env.DISABLE_EXTERNAL_FETCHES = 'true';

      await expect(RegolithDataFetcher.execute()).resolves.toBeUndefined();

      process.env.DISABLE_EXTERNAL_FETCHES = previous;
    });
  });
});
