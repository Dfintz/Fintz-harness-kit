/**
 * Backend Health Hooks Tests
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import * as healthService from '@/services/healthService';
import {
  useBackendHealth,
  useBackendHealthCheck,
  useBackendHealthMonitor,
} from '@/hooks/useBackendHealth';

// Mock the health service
jest.mock('../../services/healthService');

const mockCheckBackendHealth = healthService.checkBackendHealth as jest.MockedFunction<
  typeof healthService.checkBackendHealth
>;
const mockMonitorBackendHealth = healthService.monitorBackendHealth as jest.MockedFunction<
  typeof healthService.monitorBackendHealth
>;

describe('useBackendHealth hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useBackendHealth', () => {
    it('should provide check function and loading state', () => {
      const { result } = renderHook(() => useBackendHealth());

      expect(result.current.health).toBeNull();
      expect(result.current.isChecking).toBe(false);
      expect(result.current.isHealthy).toBeNull();
      expect(typeof result.current.check).toBe('function');
    });

    it('should check health when check is called', async () => {
      const healthResult = {
        isHealthy: true,
        backendUrl: 'http://localhost:3000',
      };

      mockCheckBackendHealth.mockResolvedValueOnce(healthResult);

      const { result } = renderHook(() => useBackendHealth());

      await act(async () => {
        const checkResult = await result.current.check();
        expect(checkResult).toEqual(healthResult);
      });

      expect(result.current.health).toEqual(healthResult);
      expect(result.current.isHealthy).toBe(true);
      expect(result.current.isChecking).toBe(false);
    });

    it('should set loading state during check', async () => {
      mockCheckBackendHealth.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ isHealthy: true, backendUrl: 'test' }), 100))
      );

      const { result } = renderHook(() => useBackendHealth());

      act(() => {
        result.current.check();
      });

      expect(result.current.isChecking).toBe(true);

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });
    });

    it('should handle check errors', async () => {
      const healthResult = {
        isHealthy: false,
        backendUrl: 'http://localhost:3000',
        error: 'Connection failed',
      };

      mockCheckBackendHealth.mockResolvedValueOnce(healthResult);

      const { result } = renderHook(() => useBackendHealth());

      await act(async () => {
        await result.current.check();
      });

      expect(result.current.health).toEqual(healthResult);
      expect(result.current.isHealthy).toBe(false);
    });
  });

  describe('useBackendHealthMonitor', () => {
    it('should start monitoring when enabled', () => {
      const stopFn = jest.fn();
      mockMonitorBackendHealth.mockReturnValueOnce(stopFn);

      const { unmount } = renderHook(() => useBackendHealthMonitor());

      expect(mockMonitorBackendHealth).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );

      unmount();
      expect(stopFn).toHaveBeenCalled();
    });

    it('should not start monitoring when disabled', () => {
      renderHook(() => useBackendHealthMonitor({ enabled: false }));

      expect(mockMonitorBackendHealth).not.toHaveBeenCalled();
    });

    it('should use custom interval', () => {
      const stopFn = jest.fn();
      mockMonitorBackendHealth.mockReturnValueOnce(stopFn);

      renderHook(() => useBackendHealthMonitor({ intervalMs: 10000 }));

      expect(mockMonitorBackendHealth).toHaveBeenCalledWith(
        expect.any(Function),
        10000
      );
    });

    it('should update health state when monitor reports changes', () => {
      let healthCallback: ((result: healthService.HealthCheckResult) => void) | null = null;
      
      mockMonitorBackendHealth.mockImplementationOnce((callback) => {
        healthCallback = callback;
        return jest.fn();
      });

      const { result } = renderHook(() => useBackendHealthMonitor());

      expect(result.current.health).toBeNull();

      // Simulate health update
      act(() => {
        healthCallback?.({
          isHealthy: true,
          backendUrl: 'http://localhost:3000',
        });
      });

      expect(result.current.health).toEqual({
        isHealthy: true,
        backendUrl: 'http://localhost:3000',
      });
      expect(result.current.isHealthy).toBe(true);
      expect(result.current.backendUrl).toBe('http://localhost:3000');
    });

    it('should call onHealthChange callback', () => {
      let healthCallback: ((result: healthService.HealthCheckResult) => void) | null = null;
      const onHealthChange = jest.fn();
      
      mockMonitorBackendHealth.mockImplementationOnce((callback) => {
        healthCallback = callback;
        return jest.fn();
      });

      renderHook(() => useBackendHealthMonitor({ onHealthChange }));

      // Simulate health update
      act(() => {
        healthCallback?.({
          isHealthy: false,
          backendUrl: 'http://localhost:3000',
          error: 'Connection failed',
        });
      });

      expect(onHealthChange).toHaveBeenCalledWith({
        isHealthy: false,
        backendUrl: 'http://localhost:3000',
        error: 'Connection failed',
      });
    });

    it('should restart monitoring when dependencies change', () => {
      const stopFn1 = jest.fn();
      const stopFn2 = jest.fn();
      mockMonitorBackendHealth
        .mockReturnValueOnce(stopFn1)
        .mockReturnValueOnce(stopFn2);

      const { rerender } = renderHook(
        ({ interval }) => useBackendHealthMonitor({ intervalMs: interval }),
        { initialProps: { interval: 30000 } }
      );

      expect(mockMonitorBackendHealth).toHaveBeenCalledTimes(1);

      // Change interval
      rerender({ interval: 10000 });

      expect(stopFn1).toHaveBeenCalled();
      expect(mockMonitorBackendHealth).toHaveBeenCalledTimes(2);
    });
  });

  describe('useBackendHealthCheck', () => {
    it('should check health on mount', async () => {
      const healthResult = {
        isHealthy: true,
        backendUrl: 'http://localhost:3000',
      };

      mockCheckBackendHealth.mockResolvedValueOnce(healthResult);

      const { result } = renderHook(() => useBackendHealthCheck());

      expect(result.current.isChecking).toBe(true);

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.health).toEqual(healthResult);
      expect(result.current.isHealthy).toBe(true);
      expect(mockCheckBackendHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle unhealthy backend', async () => {
      const healthResult = {
        isHealthy: false,
        backendUrl: 'http://localhost:3000',
        error: 'Backend not available',
      };

      mockCheckBackendHealth.mockResolvedValueOnce(healthResult);

      const { result } = renderHook(() => useBackendHealthCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.health).toEqual(healthResult);
      expect(result.current.isHealthy).toBe(false);
    });

    it('should not update state after unmount', async () => {
      mockCheckBackendHealth.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ isHealthy: true, backendUrl: 'test' }), 100))
      );

      const { result, unmount } = renderHook(() => useBackendHealthCheck());

      expect(result.current.isChecking).toBe(true);

      // Unmount before check completes
      unmount();

      // Wait for check to complete
      await waitFor(() => new Promise(resolve => setTimeout(resolve, 150)));

      // State should not update after unmount
      // If this doesn't throw, the cleanup worked correctly
    });
  });
});
