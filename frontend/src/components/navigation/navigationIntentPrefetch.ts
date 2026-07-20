/**
 * Navigation intent prefetch utilities.
 *
 * Best-effort route prefetch for high-traffic navigation targets. These calls
 * are intentionally non-blocking and safe to skip when context is incomplete
 * (for example, org-scoped routes when no org is active).
 */

import { activityKeys, fleetKeys, organizationKeys, userShipKeys } from '@/hooks/queries/queryKeys';
import { fetchUserShips } from '@/hooks/queries/useUserShipQueries';
import {
  buildPersonalHangarQueryFilters,
  PERSONAL_HANGAR_FILTER_DEFAULTS,
} from '@/pages/personalHangarFilters';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { fleetServiceV2 } from '@/services/fleetServiceV2';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { logger } from '@/utils/logger';
import type { QueryClient } from '@tanstack/react-query';

const NAV_INTENT_PREFETCH_STALE_TIME_MS = 60 * 1000;

export interface NavigationIntentPrefetchOptions {
  organizationId?: string | null;
}

function normalizeIntentPath(path: string): string {
  const [pathname] = path.split('?');
  if (!pathname) {
    return '/';
  }

  return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Prefetch route data for likely next navigation targets.
 *
 * This function never throws by design; callers should fire-and-forget.
 */
export async function prefetchNavigationIntent(
  queryClient: QueryClient,
  path: string | undefined,
  options: NavigationIntentPrefetchOptions = {}
): Promise<void> {
  if (!path) {
    return;
  }

  const pathname = normalizeIntentPath(path);
  const organizationId = options.organizationId ?? undefined;

  try {
    switch (pathname) {
      case '/fleet':
        if (!organizationId) {
          return;
        }

        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: fleetKeys.list({ organizationId }),
            queryFn: () => fleetServiceV2.getFleets(organizationId),
            staleTime: NAV_INTENT_PREFETCH_STALE_TIME_MS,
          }),
          queryClient.prefetchQuery({
            queryKey: [...fleetKeys.lists(), 'statistics', organizationId],
            queryFn: () => fleetServiceV2.getFleetStatistics(organizationId),
            staleTime: NAV_INTENT_PREFETCH_STALE_TIME_MS,
          }),
        ]);
        return;

      case '/activities':
        if (!organizationId) {
          return;
        }

        await queryClient.prefetchQuery({
          queryKey: activityKeys.list({ organizationId }),
          queryFn: () => activityServiceV2.getActivities(organizationId),
          staleTime: NAV_INTENT_PREFETCH_STALE_TIME_MS,
        });
        return;

      case '/fleet/ships':
        if (!organizationId) {
          return;
        }

        await queryClient.prefetchQuery({
          queryKey: organizationKeys.detail(organizationId),
          queryFn: () => organizationServiceV2.getOverview(organizationId),
          staleTime: NAV_INTENT_PREFETCH_STALE_TIME_MS,
        });
        return;

      case '/hangar': {
        const filters = buildPersonalHangarQueryFilters(PERSONAL_HANGAR_FILTER_DEFAULTS);
        await queryClient.prefetchQuery({
          queryKey: userShipKeys.list(filters),
          queryFn: () => fetchUserShips(filters),
          staleTime: NAV_INTENT_PREFETCH_STALE_TIME_MS,
        });
        return;
      }

      default:
        return;
    }
  } catch (error) {
    logger.debug('Navigation intent prefetch skipped after error', {
      path: pathname,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
