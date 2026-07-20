/**
 * Health Check Service Tests
 */

import { ApiClient, apiClient, isApiClientError } from '@/services/apiClient';
import { checkBackendHealth, monitorBackendHealth } from '@/services/healthService';

// Mock the config/env module
jest.mock('../../config/env', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:3000'),
}));

jest.mock('../../services/apiClient', () => ({
  ApiClient: {
    skipRetry: jest.fn((config = {}) => ({ ...config, __skipRetry: true })),
  },
  apiClient: {
    getRaw: jest.fn(),
  },
  isApiClientError: jest.fn(),
}));

const mockGetRaw = apiClient.getRaw as jest.Mock;
const mockSkipRetry = ApiClient.skipRetry as jest.Mock;
const mockIsApiClientError = isApiClientError as jest.Mock;

describe('healthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetRaw.mockResolvedValue({});
    mockSkipRetry.mockImplementation((config = {}) => ({ ...config, __skipRetry: true }));
    mockIsApiClientError.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkBackendHealth', () => {
    it('should return healthy when backend responds with 200', async () => {
      const result = await checkBackendHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.backendUrl).toBe('http://localhost:3000');
      expect(result.error).toBeUndefined();
      expect(mockSkipRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
          withCredentials: false,
        })
      );
      expect(mockGetRaw).toHaveBeenCalledWith(
        '/health',
        expect.objectContaining({
          timeout: 5000,
          withCredentials: false,
          __skipRetry: true,
        })
      );
    });

    it('should return unhealthy when backend responds with error status', async () => {
      const apiError = { statusCode: 503, message: 'Request failed' };
      mockGetRaw.mockRejectedValueOnce(apiError);
      mockIsApiClientError.mockReturnValue(true);

      const result = await checkBackendHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.backendUrl).toBe('http://localhost:3000');
      expect(result.error).toBe('Backend returned status 503');
    });

    it('should return unhealthy when fetch fails', async () => {
      const apiError = { statusCode: 0, message: 'Network error' };
      mockGetRaw.mockRejectedValueOnce(apiError);
      mockIsApiClientError.mockReturnValue(true);

      const result = await checkBackendHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.backendUrl).toBe('http://localhost:3000');
      expect(result.error).toBe(
        'Cannot connect to backend server - server may not be running'
      );
    });

    it('should handle timeout', async () => {
      const apiError = { statusCode: 0, message: 'Request timeout after 50ms' };
      mockGetRaw.mockRejectedValueOnce(apiError);
      mockIsApiClientError.mockReturnValue(true);

      const result = await checkBackendHealth(50);

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should handle generic errors', async () => {
      mockGetRaw.mockRejectedValueOnce(new Error('Network error'));
      mockIsApiClientError.mockReturnValue(false);

      const result = await checkBackendHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetRaw.mockRejectedValueOnce('String error');
      mockIsApiClientError.mockReturnValue(false);

      const result = await checkBackendHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe('Unknown error checking backend health');
    });

    it('should use custom timeout', async () => {
      await checkBackendHealth(10000);

      expect(mockSkipRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
          withCredentials: false,
        })
      );
    });
  });

  describe('monitorBackendHealth', () => {
    it('should check health immediately and call callback', async () => {
      mockGetRaw.mockResolvedValue({});

      const callback = jest.fn();
      const stopMonitoring = monitorBackendHealth(callback, 1000);

      // Wait for initial check
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isHealthy: true,
          backendUrl: 'http://localhost:3000',
        })
      );

      stopMonitoring();
    });

    it('should check health periodically', async () => {
      mockGetRaw.mockResolvedValue({});

      const callback = jest.fn();
      const stopMonitoring = monitorBackendHealth(callback, 1000);

      // Wait for initial check
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);

      // Advance time and wait for next check
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Should not call callback again if health hasn't changed
      expect(callback).toHaveBeenCalledTimes(1);

      stopMonitoring();
    });

    it('should call callback when health status changes', async () => {
      mockGetRaw.mockResolvedValueOnce({}).mockRejectedValueOnce({
        statusCode: 0,
        message: 'Network error',
      });
      mockIsApiClientError.mockReturnValue(true);

      const callback = jest.fn();
      const stopMonitoring = monitorBackendHealth(callback, 1000);

      // Wait for initial check (healthy)
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isHealthy: true })
      );

      // Advance time for next check (unhealthy)
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isHealthy: false })
      );

      stopMonitoring();
    });

    it('should stop monitoring when cleanup function is called', async () => {
      mockGetRaw.mockResolvedValue({});

      const callback = jest.fn();
      const stopMonitoring = monitorBackendHealth(callback, 1000);

      // Wait for initial check
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);

      // Stop monitoring
      stopMonitoring();

      // Advance time - callback should not be called again
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
