/**
 * Tests for useProactiveTokenRefresh hook
 */

import { useProactiveTokenRefresh } from '@/hooks/useProactiveTokenRefresh';
import { useAuthStore } from '@/store/authStore';
import { act, renderHook } from '@testing-library/react';

// Mock the auth store
jest.mock('@/store/authStore');
// Mock logger to suppress output
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

describe('useProactiveTokenRefresh', () => {
  const mockRefreshAuth = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockRefreshAuth.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  function setupAuthStore(overrides: { isAuthenticated?: boolean; expiresAt?: number | null }) {
    const defaults = {
      isAuthenticated: false,
      expiresAt: null,
      refreshAuth: mockRefreshAuth,
    };
    const state = { ...defaults, ...overrides };

    mockUseAuthStore.mockImplementation((selector: (s: typeof state) => unknown) =>
      selector(state)
    );
  }

  it('should not schedule refresh when not authenticated', () => {
    setupAuthStore({ isAuthenticated: false, expiresAt: null });

    renderHook(() => useProactiveTokenRefresh());

    // Advance far into the future — no refresh should fire
    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('should not schedule refresh when expiresAt is null', () => {
    setupAuthStore({ isAuthenticated: true, expiresAt: null });

    renderHook(() => useProactiveTokenRefresh());

    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('should schedule refresh 2 minutes before expiry', () => {
    const now = Date.now();
    // Token expires in 10 minutes → refresh should fire at 8 minutes
    const expiresAt = now + 10 * 60 * 1000;

    setupAuthStore({ isAuthenticated: true, expiresAt });

    renderHook(() => useProactiveTokenRefresh());

    // Just before the refresh window (7m 59s) — should not fire
    act(() => {
      jest.advanceTimersByTime(7 * 60 * 1000 + 59 * 1000);
    });
    expect(mockRefreshAuth).not.toHaveBeenCalled();

    // At 8 minutes — should fire
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
  });

  it('should not call refresh when token is already expired', () => {
    const now = Date.now();
    // Token already expired
    setupAuthStore({ isAuthenticated: true, expiresAt: now - 1000 });

    renderHook(() => useProactiveTokenRefresh());

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('should clean up timer on unmount', () => {
    const now = Date.now();
    setupAuthStore({ isAuthenticated: true, expiresAt: now + 10 * 60 * 1000 });

    const { unmount } = renderHook(() => useProactiveTokenRefresh());

    unmount();

    // Advance past the refresh point — should NOT fire since hook unmounted
    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('should handle refresh failure gracefully', async () => {
    const now = Date.now();
    // Token expires in 3 minutes → refresh fires at 1 minute
    setupAuthStore({ isAuthenticated: true, expiresAt: now + 3 * 60 * 1000 });
    mockRefreshAuth.mockRejectedValue(new Error('Network error'));

    renderHook(() => useProactiveTokenRefresh());

    // Advance to trigger refresh
    await act(async () => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });

    // Should have called refresh and not thrown
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
  });
});
