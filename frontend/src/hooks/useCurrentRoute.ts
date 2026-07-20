/**
 * useCurrentRoute Hook
 *
 * Provides information about the currently active route:
 * - Current route definition from registry
 * - Hub context
 * - Breadcrumb trail
 * - Current page indicator
 *
 * Eliminates prop drilling for route-aware components.
 */

import { matchBreadcrumbConfig } from '@/components/navigation/breadcrumbConfig';
import { getHubForPath } from '@/components/navigation/hubConfig';
import type { RouteDefinition } from '@/components/navigation/navigationRegistry';
import { getRouteByLocation } from '@/components/navigation/navigationRegistry';
import type { Hub } from '@/components/navigation/types';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export interface CurrentRouteInfo {
  /** Current route definition from registry (if found) */
  route: RouteDefinition | null;
  /** Current hub context */
  hub: Hub | null;
  /** Current pathname */
  pathname: string;
  /** Breadcrumb trail for current route */
  breadcrumbs: Array<{ label: string; path?: string }>;
  /** Whether current route requires organization */
  requiresOrg: boolean;
}

/**
 * Hook to get current route information
 *
 * @example
 * const { route, hub, breadcrumbs } = useCurrentRoute();
 * // Use for breadcrumb rendering, current hub highlighting, etc.
 */
export function useCurrentRoute(): CurrentRouteInfo {
  const location = useLocation();

  return useMemo(() => {
    const pathname = location.pathname;

    // Find matching route from registry using canonical matcher
    const route = getRouteByLocation(location.pathname, location.search) ?? null;

    // Get hub for current path
    const hub = getHubForPath(location.pathname, location.search) ?? null;

    // Get breadcrumb trail
    const breadcrumbConfig = matchBreadcrumbConfig({
      pathname: location.pathname,
      search: location.search,
    });
    const breadcrumbs = breadcrumbConfig?.items || [];

    return {
      route,
      hub,
      pathname,
      breadcrumbs,
      requiresOrg: route?.requiresOrg || false,
    };
  }, [location.pathname, location.search]);
}
