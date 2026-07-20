/**
 * useNavigation Hook
 *
 * Centralized hook for navigation functionality
 * Provides access to route registry, current route detection, and navigation utilities
 * Reduces prop drilling and component complexity
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { generateBreadcrumbs as buildBreadcrumbs } from './breadcrumbConfig';
import {
  getCommandRoutes,
  getHubIds,
  getHubRoutes,
  getRoute,
  getRouteByLocation,
  getRouteByPath,
  requiresOrganization,
  RouteDefinition,
} from './navigationRegistry';
import { HubId } from './types';

export interface UseNavigationReturn {
  // Current route info
  currentPath: string;
  currentRoute: RouteDefinition | undefined;
  currentHub: HubId | undefined;

  // Hub navigation
  hubs: HubId[];
  hubRoutes: (hubId: HubId) => RouteDefinition[];

  // Commands
  commandRoutes: RouteDefinition[];

  // Route lookup
  getRoute: (id: string) => RouteDefinition | undefined;
  getRouteByPath: (path: string) => RouteDefinition | undefined;
  requiresOrg: (routeId: string) => boolean;

  // Current page detection
  isCurrentHub: (hubId: HubId) => boolean;
  isCurrentRoute: (routeId: string) => boolean;

  // Breadcrumb generation
  generateBreadcrumbs: () => Array<{ label: string; path?: string }>;
}

/**
 * Navigation hook - provides centralized access to navigation system
 */
export function useNavigation(): UseNavigationReturn {
  const location = useLocation();
  const currentPath = location.pathname;

  // Memoize to prevent unnecessary recalculations
  const currentRoute = useMemo(
    () => getRouteByLocation(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const currentHub = useMemo(() => currentRoute?.hub, [currentRoute]);

  const hubs = useMemo(() => getHubIds(), []);

  const commandRoutes = useMemo(() => getCommandRoutes(), []);

  const isCurrentHub = (hubId: HubId): boolean => {
    return currentHub === hubId;
  };

  const isCurrentRoute = (routeId: string): boolean => {
    return currentRoute?.id === routeId;
  };

  const generateBreadcrumbs = (): Array<{ label: string; path?: string }> => {
    const breadcrumbs = buildBreadcrumbs({
      pathname: location.pathname,
      search: location.search,
    });

    if (breadcrumbs.length === 0) {
      return [{ label: 'Home', path: '/' }];
    }

    return breadcrumbs;
  };

  return {
    currentPath,
    currentRoute,
    currentHub,
    hubs,
    hubRoutes: (hubId: HubId) => getHubRoutes(hubId),
    commandRoutes,
    getRoute,
    getRouteByPath,
    requiresOrg: requiresOrganization,
    isCurrentHub,
    isCurrentRoute,
    generateBreadcrumbs,
  };
}

/**
 * useCurrentRoute Hook - simplified hook for just current route info
 */
export function useCurrentRoute(): RouteDefinition | undefined {
  const location = useLocation();
  return useMemo(
    () => getRouteByLocation(location.pathname, location.search),
    [location.pathname, location.search]
  );
}

/**
 * useCurrentHub Hook - simplified hook for just current hub
 */
export function useCurrentHub(): HubId | undefined {
  const currentRoute = useCurrentRoute();
  return useMemo(() => currentRoute?.hub, [currentRoute]);
}

/**
 * useHubRoutes Hook - get all routes for a specific hub with memoization
 */
export function useHubRoutes(hubId: HubId): RouteDefinition[] {
  return useMemo(() => getHubRoutes(hubId), [hubId]);
}

/**
 * useBreadcrumbs Hook - auto-generate breadcrumbs for current location
 */
export function useBreadcrumbs(): Array<{ label: string; path?: string }> {
  const location = useLocation();
  return useMemo(
    () =>
      buildBreadcrumbs({
        pathname: location.pathname,
        search: location.search,
      }),
    [location.pathname, location.search]
  );
}

/**
 * useIsCurrentPage Hook - check if on specific route
 */
export function useIsCurrentPage(routeId: string): boolean {
  const currentRoute = useCurrentRoute();
  return useMemo(() => currentRoute?.id === routeId, [currentRoute, routeId]);
}
