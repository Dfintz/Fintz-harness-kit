/**
 * Breadcrumb Configuration
 *
 * Defines breadcrumb trails for all application routes with support for:
 * - Static breadcrumbs (e.g., Dashboard, Fleet)
 * - Dynamic segments (e.g., :userId, :orgId)
 * - Hub context awareness
 * - Conditional breadcrumbs based on user/org state
 *
 * @module navigation/breadcrumbConfig
 */

import { generateBreadcrumbConfig } from './configGenerators';
import { routeRegistry } from './navigationRegistry';
import { findBestPathMatch, type RouteLocationInput } from './routeMatcher';
import type { HubId } from './types';

/**
 * Breadcrumb item configuration
 */
export interface BreadcrumbItem {
  /** Display label (can include :param placeholders) */
  label: string;
  /** Route path */
  path: string;
  /** Hub context this belongs to */
  hub?: HubId;
  /** Whether this is a dynamic segment that needs resolution */
  isDynamic?: boolean;
  /** Function to resolve dynamic label from route params */
  resolveLabel?: (params: Record<string, string>, data?: any) => string;
}

/**
 * Breadcrumb trail configuration for a route
 */
export interface BreadcrumbConfig {
  /** Route pattern (matches React Router path) */
  pattern: string;
  /** Breadcrumb items to display (in order) */
  items: BreadcrumbItem[];
  /** Whether this route requires organization context */
  requiresOrg?: boolean;
}

/**
 * Breadcrumb configurations for all application routes
 *
 * NOTE: Now auto-generated from navigationRegistry
 * This ensures single source of truth and consistent breadcrumbs.
 * To add breadcrumb support for a route, just add/update the route in navigationRegistry.ts
 */
export const breadcrumbConfigs: BreadcrumbConfig[] = Object.entries(
  generateBreadcrumbConfig(routeRegistry)
).map(([pattern, items]) => ({
  pattern,
  items: items.map(item => ({
    label: item.label,
    path: item.path || '',
  })),
}));

/**
 * Match a pathname against breadcrumb configurations
 * Finds the most specific matching breadcrumb config for a given path
 *
 * @param pathname - The current pathname (e.g., '/fleet/ships')
 * @returns The matching breadcrumb config or null if no match
 *
 * Example:
 * matchBreadcrumbConfig('/fleet/ships/ABC123') =>
 * {
 *   pattern: '/fleet/ships',
 *   items: [
 *     { label: 'Home', path: '/' },
 *     { label: 'Fleet', path: '/fleet' },
 *     { label: 'Ships', path: '/fleet/ships' }
 *   ]
 * }
 */
export function matchBreadcrumbConfig(
  pathnameOrLocation: string | RouteLocationInput
): BreadcrumbConfig | null {
  const configsWithPath = breadcrumbConfigs.map(config => ({
    ...config,
    path: config.pattern,
  }));

  const match = findBestPathMatch(configsWithPath, pathnameOrLocation, {
    allowPrefixMatch: true,
    ignoreRouteSearch: false,
  });

  if (!match) {
    return null;
  }

  const { path: _path, ...config } = match;
  return config;
}

/**
 * Extract route parameters from a pathname using a pattern
 *
 * @param pathname - The actual pathname (e.g., '/users/123')
 * @param pattern - The pattern from breadcrumb config (e.g., '/users/:userId')
 * @returns Object mapping parameter names to values
 *
 * Example:
 * extractRouteParams('/users/123', '/users/:userId') => { userId: '123' }
 * extractRouteParams('/fleet/ships/ABC', '/fleet/ships/:shipId') => { shipId: 'ABC' }
 */
export function extractRouteParams(pathname: string, pattern: string): Record<string, string> {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathParts[i] || '';
    }
  }

  return params;
}

/**
 * Generate breadcrumb trail for a pathname
 * Resolves dynamic segments and applies custom label resolvers
 *
 * @param pathname - The current pathname
 * @param paramsData - Optional data for resolving dynamic labels
 * @returns Array of breadcrumb items or empty array if no matching config
 *
 * Example:
 * generateBreadcrumbs('/fleet/ships') =>
 * [
 *   { label: 'Home', path: '/' },
 *   { label: 'Fleet', path: '/fleet' },
 *   { label: 'Ships', path: '/fleet/ships' }
 * ]
 */
export function generateBreadcrumbs(
  pathnameOrLocation: string | RouteLocationInput,
  paramsData?: Record<string, any>
): BreadcrumbItem[] {
  const config = matchBreadcrumbConfig(pathnameOrLocation);
  if (!config) {
    return [];
  }

  const pathname =
    typeof pathnameOrLocation === 'string'
      ? pathnameOrLocation.split('?')[0]
      : pathnameOrLocation.pathname;

  const params = extractRouteParams(pathname, config.pattern);

  // Resolve dynamic labels and build final breadcrumbs
  return config.items.map(item => {
    if (item.isDynamic && item.resolveLabel) {
      return {
        ...item,
        label: item.resolveLabel(params, paramsData),
      };
    }
    return item;
  });
}
