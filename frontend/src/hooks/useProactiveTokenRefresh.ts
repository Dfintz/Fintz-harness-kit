/**
 * useProactiveTokenRefresh Hook
 *
 * Proactively refreshes the access token before it expires,
 * preventing 401 errors for active users. Runs a timer that
 * triggers a silent refresh when the token is close to expiry.
 *
 * @module hooks/useProactiveTokenRefresh
 */

import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { useCallback, useEffect, useRef } from 'react';

/** Refresh the token 2 minutes before it expires */
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

/** Minimum interval between refresh attempts to prevent rapid retries */
const MIN_REFRESH_INTERVAL_MS = 30 * 1000;

/**
 * Proactively refresh the access token before expiry so that active
 * users never hit a 401.  The hook reads `expiresAt` from the auth
 * store and schedules a silent `refreshAuth()` call ahead of time.
 *
 * Only active when the user is authenticated.
 */
export function useProactiveTokenRefresh(): void {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const expiresAt = useAuthStore(state => state.expiresAt);
  const refreshAuth = useAuthStore(state => state.refreshAuth);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastRefreshRef = useRef<number>(0);

  const scheduleRefresh = useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    if (!isAuthenticated || !expiresAt) {
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Token already expired — let the 401 interceptor handle it
    if (timeUntilExpiry <= 0) {
      return;
    }

    // Schedule refresh REFRESH_BUFFER_MS before expiry, but at least 1 s from now
    const delay = Math.max(timeUntilExpiry - REFRESH_BUFFER_MS, 1000);

    timerRef.current = setTimeout(async () => {
      // Guard against rapid re-fires
      if (Date.now() - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }

      lastRefreshRef.current = Date.now();

      try {
        logger.info('[ProactiveRefresh] Refreshing token before expiry');
        await refreshAuth();
        // After successful refresh, expiresAt in the store will update
        // and this effect will re-run, scheduling the next refresh.
      } catch (err) {
        logger.warn(
          '[ProactiveRefresh] Silent refresh failed — user will be prompted on next 401',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }, delay);
  }, [isAuthenticated, expiresAt, refreshAuth]);

  useEffect(() => {
    scheduleRefresh();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [scheduleRefresh]);
}
