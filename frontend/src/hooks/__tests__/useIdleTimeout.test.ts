/**
 * Tests for useIdleTimeout hook
 */

import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { act, renderHook } from '@testing-library/react';

describe('useIdleTimeout', () => {
  const mockOnIdle = jest.fn();
  const mockOnTimeout = jest.fn();
  const mockOnActive = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Reset to a known time
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('should start idle timer when enabled', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({
        idleTimeout: 5000,
        warningTimeout: 2000,
        onIdle: mockOnIdle,
        onTimeout: mockOnTimeout,
        enabled: true,
      })
    );

    expect(result.current.isIdle).toBe(false);
    expect(mockOnIdle).not.toHaveBeenCalled();
  });

  it('should trigger onIdle after idle timeout', () => {
    renderHook(() =>
      useIdleTimeout({
        idleTimeout: 5000,
        warningTimeout: 2000,
        onIdle: mockOnIdle,
        onTimeout: mockOnTimeout,
        enabled: true,
      })
    );

    // Fast-forward time to trigger idle
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockOnIdle).toHaveBeenCalledTimes(1);
  });

  it('should trigger onTimeout after warning timeout', () => {
    renderHook(() =>
      useIdleTimeout({
        idleTimeout: 5000,
        warningTimeout: 2000,
        onIdle: mockOnIdle,
        onTimeout: mockOnTimeout,
        enabled: true,
      })
    );

    // Fast-forward to idle state
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockOnIdle).toHaveBeenCalledTimes(1);

    // Fast-forward through warning timeout
    // Use runAllTimers to execute all pending timers (interval + timeout)
    act(() => {
      jest.runAllTimers();
    });

    expect(mockOnTimeout).toHaveBeenCalledTimes(1);
  });

  it('should reset timer when user is active', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({
        idleTimeout: 5000,
        warningTimeout: 2000,
        onIdle: mockOnIdle,
        onTimeout: mockOnTimeout,
        onActive: mockOnActive,
        enabled: true,
      })
    );

    // Fast-forward partway through idle timeout
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockOnIdle).not.toHaveBeenCalled();

    // Simulate user activity by calling reset
    act(() => {
      result.current.reset();
    });

    // Fast-forward the original remaining time
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should not be idle yet since we reset
    expect(mockOnIdle).not.toHaveBeenCalled();

    // Fast-forward to trigger idle after reset
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockOnIdle).toHaveBeenCalledTimes(1);
  });

  it('should not start timer when disabled', () => {
    renderHook(() =>
      useIdleTimeout({
        idleTimeout: 5000,
        warningTimeout: 2000,
        onIdle: mockOnIdle,
        onTimeout: mockOnTimeout,
        enabled: false,
      })
    );

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(mockOnIdle).not.toHaveBeenCalled();
    expect(mockOnTimeout).not.toHaveBeenCalled();
  });
});
