/**
 * Feature Flag Hook
 * React hook for accessing feature flags in components
 */

import { useEffect, useState } from 'react';
import { featureFlagService } from '@/services/featureFlagService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

export interface UseFeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check if a feature flag is enabled
 * @param flagId - The ID of the feature flag to check
 * @param defaultValue - Default value if the flag hasn't loaded yet
 */
export function useFeatureFlag(flagId: string, defaultValue = false): UseFeatureFlagResult {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [isEnabled, setIsEnabled] = useState<boolean>(
    featureFlagService.isEnabledSync(flagId) || defaultValue
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Skip remote evaluation when unauthenticated to avoid redirect loops
    if (!isAuthenticated) {
      const cachedOrDefault = featureFlagService.isEnabledSync(flagId) || defaultValue;
      setIsEnabled(cachedOrDefault);
      setIsLoading(false);
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    const checkFlag = async () => {
      try {
        setIsLoading(true);
        const enabled = await featureFlagService.isEnabled(flagId);

        if (isMounted) {
          setIsEnabled(enabled);
          setError(null);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Failed to check feature flag:', { error, flagId });

        if (isMounted) {
          setError(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkFlag();

    // Listen for real-time updates
    const unsubscribe = featureFlagService.addChangeListener((changedFlagId, enabled) => {
      if (changedFlagId === flagId && isMounted) {
        setIsEnabled(enabled);
        logger.debug('Feature flag updated via WebSocket', { flagId, enabled });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [flagId, isAuthenticated, defaultValue]);

  return { isEnabled, isLoading, error };
}

/**
 * Hook to get all enabled feature flags
 */
export function useEnabledFeatureFlags(): {
  flags: string[];
  isLoading: boolean;
  error: Error | null;
} {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [flags, setFlags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated) {
      setFlags([]);
      setIsLoading(false);
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    const loadFlags = async () => {
      try {
        setIsLoading(true);
        const enabledFlags = await featureFlagService.getEnabledFlags();

        if (isMounted) {
          setFlags(enabledFlags);
          setError(null);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Failed to load enabled feature flags:', { error });

        if (isMounted) {
          setError(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFlags();

    // Listen for real-time updates - refresh the entire list when any flag changes
    const unsubscribe = featureFlagService.addChangeListener(() => {
      if (isMounted) {
        loadFlags();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isAuthenticated]);

  return { flags, isLoading, error };
}

/**
 * Hook to check multiple feature flags at once
 * @param flagIds - Array of feature flag IDs to check
 */
export function useFeatureFlags(flagIds: string[]): {
  flags: Record<string, boolean>;
  isLoading: boolean;
  error: Error | null;
} {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    // Initialize with sync values from cache
    const initial: Record<string, boolean> = {};
    flagIds.forEach(id => {
      initial[id] = featureFlagService.isEnabledSync(id);
    });
    return initial;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated) {
      setIsLoading(false);
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    const checkFlags = async () => {
      if (flagIds.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const results = await featureFlagService.evaluateBatch(flagIds);

        if (isMounted) {
          setFlags(results);
          setError(null);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Failed to check feature flags:', { error, flagIds });

        if (isMounted) {
          setError(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkFlags();

    // Listen for real-time updates for any of the flags in the list
    const unsubscribe = featureFlagService.addChangeListener((changedFlagId, enabled) => {
      if (flagIds.includes(changedFlagId) && isMounted) {
        setFlags(prev => ({
          ...prev,
          [changedFlagId]: enabled,
        }));
        logger.debug('Feature flag updated via WebSocket', { flagId: changedFlagId, enabled });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [flagIds.length, ...flagIds, isAuthenticated]); // Spread flagIds for stable dependency comparison

  return { flags, isLoading, error };
}
