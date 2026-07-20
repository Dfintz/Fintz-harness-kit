import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React, { Suspense, useEffect, useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { CookieBanner } from './components/CookieBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalToastRenderer } from './components/GlobalToastRenderer';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AppUpdateBanner, OfflineBanner, PWAInstallPrompt } from './components/pwa';
import { queryClient } from './hooks/queries';
import { createAppRouter } from './router';
import { apiClient } from './services/apiClient';
import { errorTrackingService } from './services/errorTracking';
import { performanceMonitoringService } from './services/performanceMonitoring';
import { useAuthStore } from './store/authStore';
import { muiTheme } from './theme/muiTheme';
import { logger } from './utils/logger';

// Initialize error tracking service
errorTrackingService.initialize();

// Initialize performance monitoring service
performanceMonitoringService.initialize();

// Initialize CSRF token by making a simple GET request
const initializeCsrfToken = async () => {
  try {
    // Use apiClient to get the CSRF cookie set. /health is unproxied in dev,
    // so fall back to /api/v2/health when no VITE_API_URL is configured.
    const healthPath = import.meta.env.VITE_API_URL ? '/health' : '/api/v2/health';
    await apiClient.getRaw(healthPath);
  } catch (error) {
    // Silently fail - CSRF token will be set on first authenticated request
    logger.debug('CSRF token initialization skipped', { error });
  }
};

/** Race a promise against a timeout; returns 'timeout' if the deadline is exceeded. */
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> =>
  Promise.race([promise, new Promise<'timeout'>(resolve => setTimeout(resolve, ms, 'timeout'))]);

const App: React.FC = () => {
  const router = React.useMemo(() => createAppRouter(queryClient), []);
  const [csrfInitialized, setCsrfInitialized] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const { tryAuthWithCookies } = useAuthStore();

  useEffect(() => {
    // Initialize CSRF token and auth in parallel
    const initializeApp = async () => {
      try {
        // Initialize CSRF first (with timeout to prevent hanging)
        const csrfResult = await withTimeout(initializeCsrfToken(), 5000);
        if (csrfResult === 'timeout') {
          logger.warn('CSRF initialization timed out after 5s — proceeding without token');
        }
        setCsrfInitialized(true);

        // Then try to restore auth session (with timeout)
        const authPromise = tryAuthWithCookies().catch(error => {
          logger.debug('Session restoration failed', { error });
        });
        const authResult = await withTimeout(authPromise, 5000);
        if (authResult === 'timeout') {
          logger.warn('Auth session restoration timed out after 5s');
        }

        // Add a small delay to ensure Zustand state has propagated
        await new Promise(resolve => setTimeout(resolve, 10));
      } finally {
        setAuthCheckComplete(true);
        setCsrfInitialized(true); // Ensure we always unblock
      }
    };

    initializeApp();
  }, [tryAuthWithCookies]);

  if (!csrfInitialized || !authCheckComplete) {
    return (
      <HelmetProvider>
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
          <LoadingSpinner fullScreen />
        </ThemeProvider>
      </HelmetProvider>
    );
  }

  return (
    <HelmetProvider>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <RouterProvider router={router} />
            </Suspense>
            <CookieBanner />
            <PWAInstallPrompt />
            <OfflineBanner />
            <AppUpdateBanner />
            <GlobalToastRenderer />
          </ErrorBoundary>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
};

export default App;
