/**
 * Root Layout Component for React Router
 *
 * Wraps all routes with the main Layout component and provides
 * Suspense boundary for lazy-loaded routes, navigation progress indicator,
 * and session idle timeout management.
 */

import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { NavigationProgress } from '@/components/NavigationProgress';
import { RouteAnnouncer } from '@/components/RouteAnnouncer';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useProactiveTokenRefresh } from '@/hooks/useProactiveTokenRefresh';
import { useRealtimeQueryInvalidation } from '@/hooks/useRealtime';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import React, { Suspense, useCallback, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

// Configuration for idle timeout
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
const WARNING_TIMEOUT = 60 * 1000; // 1 minute warning before logout

export const RootLayout: React.FC = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const refreshAuth = useAuthStore(state => state.refreshAuth);
  const activeOrgId = useAuthStore(state => state.user?.organizationId ?? state.user?.activeOrgId);
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  // Proactively refresh tokens before they expire for active users
  useProactiveTokenRefresh();

  // Phase 3.3: Invalidate React Query caches when domain events arrive
  // over the WebSocket — keeps the UI in sync with bot/server mutations.
  useRealtimeQueryInvalidation(isAuthenticated ? activeOrgId : undefined);

  // Handle idle state - show warning modal
  const handleIdle = useCallback(() => {
    setShowWarning(true);
  }, []);

  // Handle timeout - navigate to /logout which handles cleanup and redirect
  const handleTimeout = useCallback(() => {
    setShowWarning(false);
    navigate('/logout?reason=session-timeout');
  }, [navigate]);

  // Handle user becoming active again
  const handleActive = useCallback(() => {
    setShowWarning(false);
  }, []);

  // Use idle timeout hook
  const { remainingTime, reset } = useIdleTimeout({
    idleTimeout: IDLE_TIMEOUT,
    warningTimeout: WARNING_TIMEOUT,
    onIdle: handleIdle,
    onTimeout: handleTimeout,
    onActive: handleActive,
    enabled: isAuthenticated,
  });

  // Handle "Keep Session" button — refresh token to extend the session
  const handleKeepSession = useCallback(() => {
    setShowWarning(false);
    reset();
    // Refresh auth token so the session is fully extended
    refreshAuth().catch(err => {
      logger.warn(
        'Keep session refresh failed',
        err instanceof Error ? err : new Error(String(err))
      );
    });
  }, [reset, refreshAuth]);

  // Handle "Log Out" button from warning dialog
  const handleLogout = useCallback(() => {
    setShowWarning(false);
    navigate('/logout?reason=session-timeout');
  }, [navigate]);

  return (
    <>
      <NavigationProgress />
      <RouteAnnouncer />
      <Layout>
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </Layout>

      {/* Session timeout warning modal */}
      <SessionTimeoutWarning
        isOpen={showWarning}
        remainingTime={remainingTime}
        totalTime={WARNING_TIMEOUT}
        onKeepSession={handleKeepSession}
        onLogout={handleLogout}
      />
    </>
  );
};
