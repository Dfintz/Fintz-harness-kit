import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { prefetchNavigationIntent } from './navigationIntentPrefetch';

/**
 * Shared navigation-intent prefetch callback used across navigation surfaces.
 */
export function useNavigationIntentPrefetch(organizationId?: string | null) {
  const queryClient = useQueryClient();

  return useCallback(
    (path?: string) => {
      if (!path) {
        return;
      }

      prefetchNavigationIntent(queryClient, path, {
        organizationId: organizationId ?? undefined,
      }).catch(() => {
        // Best-effort prefetch only.
      });
    },
    [organizationId, queryClient]
  );
}
