import { logger } from '@/utils/logger';
import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Interval between service-worker update checks (ms). */
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface AppUpdateState {
  /** A new version has been detected and is ready to activate. */
  needRefresh: boolean;
  /** The service worker has been installed for the first time (offline-ready). */
  offlineReady: boolean;
  /** Apply the update and reload the page. */
  updateApp: () => void;
  /** Dismiss the update prompt until the next detection. */
  dismiss: () => void;
}

/**
 * Detects new app versions via VitePWA service-worker lifecycle and
 * surfaces a `needRefresh` flag so the UI can prompt the user.
 */
export function useAppUpdate(): AppUpdateState {
  const [dismissed, setDismissed] = useState(false);

  // Purge the legacy api-cache that was causing stale data issues.
  // Previous versions cached all /api/ responses with NetworkFirst strategy,
  // which combined with browser ETag/304 served stale data after mutations.
  useEffect(() => {
    if ('caches' in globalThis) {
      caches.delete('api-cache').catch(() => {
        /* non-critical */
      });
    }
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Check for SW updates on a fixed interval so long-lived tabs still
    // pick up deployments without a full page navigation.
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (registration) {
        setInterval(() => {
          registration.update().catch((err: unknown) => {
            logger.debug('SW update check failed', {
              error: err instanceof Error ? err : new Error(String(err)),
            });
          });
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onRegisterError(error: Error) {
      logger.error('Service worker registration failed', error);
    },
  });

  // Reset dismissed state when a *new* update is detected.
  useEffect(() => {
    if (needRefresh) {
      setDismissed(false);
    }
  }, [needRefresh]);

  const updateApp = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setNeedRefresh(false);
    setOfflineReady(false);
  }, [setNeedRefresh, setOfflineReady]);

  return {
    needRefresh: needRefresh && !dismissed,
    offlineReady,
    updateApp,
    dismiss,
  };
}
