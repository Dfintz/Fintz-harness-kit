/**
 * Hub Configuration
 * Defines the 4-hub navigation structure
 */

import { routePathMatchesLocation } from './routeMatcher';
import { Hub, NavItem } from './types';

import { generateHubConfig } from './configGenerators';
import { routeRegistry } from './navigationRegistry';
/**
 * The 4 main hubs for the navigation system
 *
 * NOTE: Now auto-generated from navigationRegistry
 * This ensures single source of truth for navigation structure.
 * Routes are defined in navigationRegistry.ts and automatically
 * transformed into this hub config structure.
 *
 * Structure:
 * - Dashboard Hub: Overview and quick actions
 * - Fleet Hub: Fleet management, ships, loadouts
 * - Ops Center: Activities, briefings, trading, logistics
 * - Community Hub: Members, recruitment, diplomacy
 */
export const hubs: Hub[] = generateHubConfig(routeRegistry);
/**
 * Get hub by ID
 */
export function getHub(hubId: string): Hub | undefined {
  return hubs.find(hub => hub.id === hubId);
}

/**
 * Check if a normalized pathname matches a navigation item path
 */
function matchesItemPath(pathname: string, search: string, item: NavItem): boolean {
  return routePathMatchesLocation(
    item.path,
    { pathname, search },
    {
      allowPrefixMatch: true,
      ignoreRouteSearch: true,
    }
  );
}

/**
 * Collect all nav items from a hub (both direct items and section items)
 */
function getHubNavItems(hub: Hub): NavItem[] {
  const items: NavItem[] = [];
  if (hub.items) {
    items.push(...hub.items);
  }
  if (hub.sections) {
    for (const section of hub.sections) {
      items.push(...section.items);
    }
  }
  return items;
}

/**
 * Get hub for a given path
 */
export function getHubForPath(pathname: string, search: string = ''): Hub | undefined {
  // Landing page is not a hub
  if (pathname === '/') {
    return undefined;
  }

  // Normalize the path (remove trailing slash)
  const normalizedPath =
    pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

  // Find the hub that contains a matching nav item
  for (const hub of hubs) {
    const navItems = getHubNavItems(hub);
    if (navItems.some(item => matchesItemPath(normalizedPath, search, item))) {
      return hub;
    }
  }

  return undefined;
}

/**
 * Get all nav items across all hubs (flat list)
 */
export function getAllNavItems(): Array<{ hub: Hub; item: NavItem }> {
  const items: Array<{ hub: Hub; item: NavItem }> = [];

  hubs.forEach(hub => {
    getHubNavItems(hub).forEach(item => items.push({ hub, item }));
  });

  return items;
}
