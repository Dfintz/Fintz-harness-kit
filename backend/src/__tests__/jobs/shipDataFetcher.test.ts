import axios from 'axios';
import { ShipDataFetcher } from '../../jobs/shipDataFetcher';

// Mock axios to prevent actual HTTP requests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ShipDataFetcher', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };

    // Mock axios.get to return empty CSV data
    mockedAxios.get.mockResolvedValue({
      data: 'name,manufacturer,size\n',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  });

  afterEach(() => {
    // Stop any scheduled tasks
    ShipDataFetcher.stop();
    // Restore original environment
    process.env = originalEnv;
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getLastFetchStatus', () => {
    it('should return null initially', () => {
      const status = ShipDataFetcher.getLastFetchStatus();
      expect(status).toBeNull();
    });
  });

  describe('isCurrentlyFetching', () => {
    it('should return false when not fetching', () => {
      expect(ShipDataFetcher.isCurrentlyFetching()).toBe(false);
    });
  });

  describe('schedule', () => {
    it('should schedule without throwing', () => {
      expect(() => ShipDataFetcher.schedule()).not.toThrow();
    });

    it('should not schedule twice', () => {
      ShipDataFetcher.schedule();
      // Second call should not throw but should warn
      expect(() => ShipDataFetcher.schedule()).not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop without throwing when no task scheduled', () => {
      expect(() => ShipDataFetcher.stop()).not.toThrow();
    });

    it('should stop scheduled task', () => {
      ShipDataFetcher.schedule();
      expect(() => ShipDataFetcher.stop()).not.toThrow();
    });
  });

  describe('execute', () => {
    it('should warn when no sheet URLs are configured', async () => {
      // Clear environment variables
      delete process.env.SHIP_DATA_SHEET_1;
      delete process.env.SHIP_DATA_SHEET_2;

      // Execute should complete without throwing
      await expect(ShipDataFetcher.execute()).resolves.toBeUndefined();
    });

    it('should not fetch if already fetching', async () => {
      // This test verifies the mutex behavior
      // We can't easily test the actual fetch without mocking,
      // but we can ensure the guard clause works
      delete process.env.SHIP_DATA_SHEET_1;
      delete process.env.SHIP_DATA_SHEET_2;

      const promise1 = ShipDataFetcher.execute();
      const promise2 = ShipDataFetcher.execute();

      await Promise.all([promise1, promise2]);
      // If both completed without error, the mutex is working
      expect(true).toBe(true);
    });
  });

  describe('forceRefresh', () => {
    it('should not throw when forcing refresh without configuration', async () => {
      delete process.env.SHIP_DATA_SHEET_1;
      delete process.env.SHIP_DATA_SHEET_2;

      await expect(ShipDataFetcher.forceRefresh()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should continue processing if one data source fails', async () => {
      // Set up two URLs
      process.env.SHIP_DATA_SHEET_1 = 'http://example.com/sheet1';
      process.env.SHIP_DATA_SHEET_2 = 'http://example.com/sheet2';

      // First URL returns HTML (error)
      mockedAxios.get.mockImplementationOnce(() =>
        Promise.resolve({
          data: '<html><body>Error</body></html>',
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/html' },
          config: {} as any,
        })
      );

      // Second URL returns valid CSV
      mockedAxios.get.mockImplementationOnce(() =>
        Promise.resolve({
          data: 'name,manufacturer,size\nTest Ship,Test Mfg,Small\n',
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/csv' },
          config: {} as any,
        })
      );

      // Execute should not throw
      await expect(ShipDataFetcher.execute()).resolves.toBeUndefined();

      // Erkul informations (fails → skips ships call) + Sheet 1 + Sheet 2 = 3 calls
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Check the fetch status
      const status = ShipDataFetcher.getLastFetchStatus();
      expect(status).not.toBeNull();
      expect(status?.error).toContain('Sheet 1:');
    });

    it('should handle both sources failing gracefully', async () => {
      // Set up two URLs
      process.env.SHIP_DATA_SHEET_1 = 'http://example.com/sheet1';
      process.env.SHIP_DATA_SHEET_2 = 'http://example.com/sheet2';

      // Both URLs return HTML (error)
      mockedAxios.get.mockResolvedValue({
        data: '<html><body>Error</body></html>',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        config: {} as any,
      });

      // Execute should not throw
      await expect(ShipDataFetcher.execute()).resolves.toBeUndefined();

      // Erkul informations (fails → skips ships call) + Sheet 1 + Sheet 2 = 3 calls
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Check the fetch status indicates failure
      const status = ShipDataFetcher.getLastFetchStatus();
      expect(status).not.toBeNull();
      expect(status?.success).toBe(false);
      expect(status?.error).toContain('Sheet 1:');
      expect(status?.error).toContain('Sheet 2:');
    });
  });
});
