/**
 * useFeatureFlag Hook Tests
 * Tests for feature flag evaluation hooks
 */

import { useEnabledFeatureFlags, useFeatureFlag, useFeatureFlags } from '@/hooks/useFeatureFlag';
import { featureFlagService } from '@/services/featureFlagService';
import { useAuthStore } from '@/store/authStore';
import { renderHook, waitFor } from '@testing-library/react';

// Mock the feature flag service
jest.mock('../../services/featureFlagService');
jest.mock('../../utils/logger');

describe('useFeatureFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true });
    // Mock addChangeListener to return an unsubscribe function
    (featureFlagService.addChangeListener as jest.Mock).mockReturnValue(() => {});
    (featureFlagService.isEnabledSync as jest.Mock).mockReturnValue(false);
  });

  it('should return loading state initially', () => {
    (featureFlagService.isEnabled as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useFeatureFlag('test-flag'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return enabled status when flag is enabled', async () => {
    (featureFlagService.isEnabled as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useFeatureFlag('test-flag'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should return disabled status when flag is disabled', async () => {
    (featureFlagService.isEnabled as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useFeatureFlag('test-flag'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should use default value while loading', () => {
    (featureFlagService.isEnabledSync as jest.Mock).mockReturnValue(false);
    (featureFlagService.isEnabled as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useFeatureFlag('test-flag', true));

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    (featureFlagService.isEnabled as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useFeatureFlag('test-flag'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isEnabled).toBe(false);
  });

  it('should update when flag changes via WebSocket', async () => {
    let changeListener: ((flagId: string, enabled: boolean) => void) | null = null;

    (featureFlagService.isEnabled as jest.Mock).mockResolvedValue(false);
    (featureFlagService.addChangeListener as jest.Mock).mockImplementation(listener => {
      changeListener = listener;
      return () => {}; // Unsubscribe function
    });

    const { result } = renderHook(() => useFeatureFlag('test-flag'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(false);

    // Simulate WebSocket update
    if (changeListener) {
      (changeListener as (flagId: string, enabled: boolean) => void)('test-flag', true);
    }

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });
  });

  it('should not update for different flag changes', async () => {
    let changeListener: ((flagId: string, enabled: boolean) => void) | null = null;

    (featureFlagService.isEnabled as jest.Mock).mockResolvedValue(false);
    (featureFlagService.addChangeListener as jest.Mock).mockImplementation(listener => {
      changeListener = listener;
      return () => {};
    });

    const { result } = renderHook(() => useFeatureFlag('test-flag'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(false);

    // Simulate WebSocket update for different flag
    if (changeListener) {
      (changeListener as (flagId: string, enabled: boolean) => void)('other-flag', true);
    }

    // Should not change
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(result.current.isEnabled).toBe(false);
  });

  it('should cleanup listener on unmount', async () => {
    const unsubscribe = jest.fn();
    (featureFlagService.isEnabled as jest.Mock).mockResolvedValue(true);
    (featureFlagService.addChangeListener as jest.Mock).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useFeatureFlag('test-flag'));

    await waitFor(() => {
      expect(featureFlagService.addChangeListener).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('useEnabledFeatureFlags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true });
    // Mock addChangeListener to return an unsubscribe function
    (featureFlagService.addChangeListener as jest.Mock).mockReturnValue(() => {});
  });

  it('should return list of enabled flags', async () => {
    const enabledFlags = ['flag-1', 'flag-2', 'flag-3'];
    (featureFlagService.getEnabledFlags as jest.Mock).mockResolvedValue(enabledFlags);

    const { result } = renderHook(() => useEnabledFeatureFlags());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual(enabledFlags);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch');
    (featureFlagService.getEnabledFlags as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useEnabledFeatureFlags());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.flags).toEqual([]);
  });
});

describe('useFeatureFlags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true });
    // Mock addChangeListener to return an unsubscribe function
    (featureFlagService.addChangeListener as jest.Mock).mockReturnValue(() => {});
    (featureFlagService.isEnabledSync as jest.Mock).mockReturnValue(false);
  });

  it('should evaluate multiple flags', async () => {
    const flagIds = ['flag-1', 'flag-2', 'flag-3'];
    const results = {
      'flag-1': true,
      'flag-2': false,
      'flag-3': true,
    };
    (featureFlagService.evaluateBatch as jest.Mock).mockResolvedValue(results);

    const { result } = renderHook(() => useFeatureFlags(flagIds));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual(results);
    expect(result.current.error).toBeNull();
  });

  it('should use sync cache for initial values', () => {
    (featureFlagService.isEnabledSync as jest.Mock)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    (featureFlagService.evaluateBatch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useFeatureFlags(['flag-1', 'flag-2']));

    expect(result.current.flags).toEqual({
      'flag-1': true,
      'flag-2': false,
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle empty flag list', async () => {
    const { result } = renderHook(() => useFeatureFlags([]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual({});
    expect(featureFlagService.evaluateBatch).not.toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    const error = new Error('Batch evaluation failed');
    (featureFlagService.evaluateBatch as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useFeatureFlags(['flag-1', 'flag-2']));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
