/**
 * Configuration Generators
 *
 * Automatically generates hubConfig, commandConfig, and breadcrumbConfig
 * from the navigation registry. This ensures consistency and reduces
 * code duplication across the navigation system.
 *
 * Benefits:
 * - Single source of truth (navigationRegistry)
 * - Automatic consistency between configs
 * - Reduced maintenance burden
 * - Easy to add new routes (just update registry)
 * - DRY principle applied to navigation
 */

import { logger } from '@/utils/logger';
import {
  AccountBalance as AccountBalanceIcon,
  AccountTree as AccountTreeIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Analytics as AnalyticsIcon,
  Assignment as AssignmentIcon,
  BarChart as BarChartIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarTodayIcon,
  Campaign as CampaignIcon,
  Chat as ChatIcon,
  CompareArrows as CompareArrowsIcon,
  EventAvailable as EventAvailableIcon,
  Explore as ExploreIcon,
  HelpOutline as FallbackIcon,
  Flag as FlagIcon,
  Folder as FolderIcon,
  Gavel as GavelIcon,
  GpsFixed as GpsFixedIcon,
  Group as GroupIcon,
  Groups as GroupsIcon,
  Handshake as HandshakeIcon,
  HeadsetMic as HeadsetMicIcon,
  Home as HomeIcon,
  Inbox as InboxIcon,
  Inventory2 as Inventory2Icon,
  List as ListIcon,
  Lock as LockIcon,
  ManageAccounts as ManageAccountsIcon,
  Map as MapIcon,
  MenuBook as MenuBookIcon,
  MilitaryTech as MilitaryTechIcon,
  NewReleases as NewReleasesIcon,
  Notifications as NotificationsIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  PhoneIphone as PhoneIphoneIcon,
  Poll as PollIcon,
  Public as PublicIcon,
  RocketLaunch as RocketLaunchIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  SmartToy as SmartToyIcon,
  Storefront as StorefrontIcon,
  SupervisorAccount as SupervisorAccountIcon,
  TrackChanges as TrackChangesIcon,
  TrendingUp as TrendingUpIcon,
  VpnKey as VpnKeyIcon,
  Work as WorkIcon,
  WorkspacePremium as WorkspacePremiumIcon,
} from '@mui/icons-material';
import { SvgIcon, type SvgIconProps } from '@mui/material';
import React from 'react';
import { RouteDefinition, routeRegistry } from './navigationRegistry';
import { Command, Hub, HubId, NavItem, NavSection } from './types';

// Custom Discord brand icon (official logo path)
const DiscordIcon: React.FC<SvgIconProps> = props => (
  <SvgIcon {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </SvgIcon>
);

// Icon name mapping to actual MUI icon components
const ICON_MAP: Record<string, React.ComponentType> = {
  Discord: DiscordIcon,
  AccountBalance: AccountBalanceIcon,
  AccountTree: AccountTreeIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  Analytics: AnalyticsIcon,
  Assignment: AssignmentIcon,
  BarChart: BarChartIcon,
  Box: FolderIcon,
  BoxList: ListIcon,
  Briefcase: WorkIcon,
  Work: WorkIcon,
  Calendar: CalendarTodayIcon,
  Campaign: CampaignIcon,
  Chat: ChatIcon,
  CompareArrows: CompareArrowsIcon,
  EventAvailable: EventAvailableIcon,
  Explore: ExploreIcon,
  Flag: FlagIcon,
  Gavel: GavelIcon,
  Globe: PublicIcon,
  GpsFixed: GpsFixedIcon,
  GraphTrend: TrendingUpIcon,
  Groups: GroupsIcon,
  Handshake: HandshakeIcon,
  HeadsetMic: HeadsetMicIcon,
  HelpOutline: FallbackIcon,
  Home: HomeIcon,
  Inbox: InboxIcon,
  Inventory2: Inventory2Icon,
  Lock: LockIcon,
  ManageAccounts: ManageAccountsIcon,
  Map: MapIcon,
  MenuBook: MenuBookIcon,
  MilitaryTech: MilitaryTechIcon,
  NewReleases: NewReleasesIcon,
  Notifications: NotificationsIcon,
  Organisations: BusinessIcon,
  People: PeopleIcon,
  Person: PersonIcon,
  PhoneIphone: PhoneIphoneIcon,
  Poll: PollIcon,
  RocketLaunch: RocketLaunchIcon,
  Settings: SettingsIcon,
  Shield: SecurityIcon,
  SmartToy: SmartToyIcon,
  Storefront: StorefrontIcon,
  SupervisorAccount: SupervisorAccountIcon,
  Target: TrackChangesIcon,
  UserGroup: GroupIcon,
  ViewList: ListIcon, // Maps ViewList (Spectrum) to ListIcon (MUI)
  VpnKey: VpnKeyIcon,
  WorkspacePremium: WorkspacePremiumIcon,
};

// Resolve icon name to an MUI icon component
const getIconComponent = (iconName: string | undefined): React.ComponentType => {
  if (!iconName) return FallbackIcon;
  return ICON_MAP[iconName] || FallbackIcon;
};

/**
 * Helper: Create icon component from string name
 * Maps icon names to actual MUI icon components
 */
function createIconComponent(iconName: string | undefined): React.ComponentType {
  return getIconComponent(iconName);
}

function getCanonicalPath(path: string): string {
  const [pathname] = path.split('?');
  const normalizedPath = pathname || '/';
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    return normalizedPath.slice(0, -1);
  }
  return normalizedPath;
}

function toNavItem(route: RouteDefinition): NavItem {
  return {
    id: route.id,
    label: route.label,
    path: route.path,
    icon: createIconComponent(route.icon),
    requiresOrg: route.requiresOrg,
    adminOnly: route.adminOnly,
    requiresRsiVerified: route.requiresRsiVerified,
    requiresOrgOwner: route.requiresOrgOwner,
    minRole: route.minRole,
    disabledTooltip: route.disabledTooltip,
  };
}

function buildHubNavData(sortedRoutes: RouteDefinition[]): Pick<Hub, 'sections' | 'items'> {
  const hasSections = sortedRoutes.some(route => route.section);

  if (!hasSections) {
    return { items: sortedRoutes.map(toNavItem) };
  }

  const sectionMap = new Map<string, NavItem[]>();
  const unsectionedItems: NavItem[] = [];

  for (const route of sortedRoutes) {
    const item = toNavItem(route);
    if (!route.section) {
      unsectionedItems.push(item);
      continue;
    }

    const existingSectionItems = sectionMap.get(route.section);
    if (existingSectionItems) {
      existingSectionItems.push(item);
    } else {
      sectionMap.set(route.section, [item]);
    }
  }

  const sections: NavSection[] = [...sectionMap.entries()].map(([title, items]) => ({
    title,
    items,
  }));

  if (unsectionedItems.length > 0) {
    return { sections, items: unsectionedItems };
  }

  return { sections };
}

/**
 * Generate Hub configuration from navigation registry
 * Transforms RouteDefinitions into Hub array structure
 */
export function generateHubConfig(
  registry: Record<string, RouteDefinition> = routeRegistry
): Hub[] {
  const hubIds = new Set<string>();

  // Collect unique hub IDs in order
  Object.values(registry).forEach(route => {
    if (route.includeInHub !== false) {
      hubIds.add(route.hub);
    }
  });

  // Create hub entries
  const hubsArray: Hub[] = [];
  const hubLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    ops: 'Ops Center',
    organization: 'Organization',
    alliance: 'Alliance',
    community: 'Community Hub',
  };

  hubIds.forEach(hubId => {
    const routes = Object.values(registry).filter(r => r.hub === hubId && r.includeInHub !== false);

    if (routes.length === 0) return;

    // Get primary route for hub metadata (prefer non-restricted routes for landing page)
    const sortedRoutes = [...routes].sort((a, b) => (a.order || 999) - (b.order || 999));
    const primaryRoute =
      sortedRoutes.find(
        r => !r.adminOnly && !r.requiresOrg && !r.requiresRsiVerified && !r.requiresOrgOwner
      ) || sortedRoutes[0];
    const { sections, items } = buildHubNavData(sortedRoutes);

    hubsArray.push({
      id: hubId as Hub['id'],
      label: hubLabels[hubId],
      icon: createIconComponent(primaryRoute.icon),
      path: getCanonicalPath(primaryRoute.path),
      sections,
      items,
      // Hub is only gated if ALL routes require org — hubs with a mix of
      // public and org-restricted routes remain accessible (individual items
      // are still greyed out per-item in HubSidebar).
      requiresOrg: routes.every(r => r.requiresOrg || r.adminOnly),
    });
  });

  return hubsArray;
}

/**
 * Generate Command configuration from navigation registry
 * Transforms RouteDefinitions into Command array structure
 */
export function generateCommandConfig(
  registry: Record<string, RouteDefinition> = routeRegistry
): Command[] {
  return Object.values(registry)
    .filter(route => route.includeInCommand !== false && !route.disabledTooltip)
    .sort((a, b) => {
      // Sort by hub, then by order within hub
      const hubOrder: Record<HubId, number> = {
        dashboard: 1,
        ops: 2,
        organization: 3,
        community: 4,
        alliance: 5,
      };
      const aHubOrder = hubOrder[a.hub] ?? 999;
      const bHubOrder = hubOrder[b.hub] ?? 999;

      if (aHubOrder !== bHubOrder) return aHubOrder - bHubOrder;
      return (a.order ?? 999) - (b.order ?? 999);
    })
    .map(route => ({
      id: route.id,
      label: route.label,
      description: route.description || '',
      path: route.path,
      category: route.category || 'tools',
      hub: route.hub,
      keywords: route.keywords,
      icon: route.icon,
      order: route.order,
      shortcut: route.shortcut,
      requiresOrg: route.requiresOrg,
      adminOnly: route.adminOnly,
      minRole: route.minRole,
    }));
}

/**
 * Generate Breadcrumb routing configuration from navigation registry
 * Maps paths to breadcrumb chains
 */
export function generateBreadcrumbConfig(
  registry: Record<string, RouteDefinition> = routeRegistry
): Record<string, { label: string; path?: string }[]> {
  const breadcrumbMap: Record<string, { label: string; path?: string }[]> = {};

  Object.values(registry)
    .filter(route => route.includeInBreadcrumb !== false)
    .forEach(route => {
      const hubRoute = Object.values(registry)
        .filter(r => r.hub === route.hub && r.includeInHub !== false)
        .sort((a, b) => (a.order || 999) - (b.order || 999))[0];

      if (!hubRoute) return;

      const breadcrumbs: Array<{ label: string; path?: string }> = [
        { label: 'Home', path: '/' },
        { label: hubRoute.label, path: hubRoute.path },
      ];

      // Add section label as intermediate breadcrumb when available
      // e.g., Home > Ops Center > Fleet > Organization Ships
      if (route.section && route.path !== hubRoute.path) {
        breadcrumbs.push({ label: route.section });
      }

      // Add intermediate parent routes based on path hierarchy
      // e.g., /intel/officers → finds /intel (Intel Vault) as parent
      if (route.path !== hubRoute.path) {
        const segments = route.path.split('/').filter(Boolean);
        for (let i = 1; i < segments.length; i++) {
          const parentPath = '/' + segments.slice(0, i).join('/');
          if (parentPath !== hubRoute.path) {
            const parentRoute = Object.values(registry).find(
              r => r.path === parentPath && r.includeInBreadcrumb !== false
            );
            if (parentRoute) {
              breadcrumbs.push({
                label: parentRoute.breadcrumbLabel || parentRoute.label,
                path: parentRoute.breadcrumbPath || parentRoute.path,
              });
            }
          }
        }

        // Add current page as last breadcrumb
        breadcrumbs.push({
          label: route.breadcrumbLabel || route.label,
          path: route.breadcrumbPath || route.path,
        });
      }

      breadcrumbMap[route.path] = breadcrumbs;
    });

  return breadcrumbMap;
}

/**
 * Validate registry consistency
 * Checks for common issues like missing required fields
 */
export function validateRegistry(registry: Record<string, RouteDefinition>): string[] {
  const errors: string[] = [];

  Object.entries(registry).forEach(([key, route]) => {
    // Check required fields
    if (!route.id) errors.push(`${key}: missing id`);
    if (!route.label) errors.push(`${key}: missing label`);
    if (!route.path) errors.push(`${key}: missing path`);
    if (!route.hub) errors.push(`${key}: missing hub`);
    if (!route.icon) errors.push(`${key}: missing icon`);

    // Check path format
    if (route.path && !route.path.startsWith('/')) {
      errors.push(`${key}: path must start with /`);
    }

    // Check hub value
    if (
      route.hub &&
      !['dashboard', 'ops', 'organization', 'alliance', 'community'].includes(route.hub)
    ) {
      errors.push(`${key}: invalid hub "${route.hub}"`);
    }
  });

  // Check for duplicate IDs
  const ids = Object.values(registry).map(r => r.id);
  const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    errors.push(`Duplicate route IDs: ${duplicates.join(', ')}`);
  }

  // Check for duplicate paths within the same hub
  const pathsByHub = new Map<string, string[]>();
  Object.values(registry).forEach(r => {
    const key = `${r.hub}:${r.path}`;
    const existing = pathsByHub.get(key) ?? [];
    existing.push(r.id);
    pathsByHub.set(key, existing);
  });
  const duplicatePaths = [...pathsByHub.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key]) => key);
  if (duplicatePaths.length > 0) {
    errors.push(`Duplicate paths: ${duplicatePaths.join(', ')}`);
  }

  return errors;
}

/**
 * Print registry summary for debugging (development only)
 */
export function printRegistrySummary(registry: Record<string, RouteDefinition>): void {
  if (process.env.NODE_ENV === 'production') return;

  // Development debugging - use logger
  const totalRoutes = Object.keys(registry).length;
  const byHub = new Map<string, RouteDefinition[]>();

  Object.values(registry).forEach(route => {
    if (!byHub.has(route.hub)) {
      byHub.set(route.hub, []);
    }
    byHub.get(route.hub)!.push(route);
  });

  // Only log in development if explicitly needed
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_NAVIGATION) {
    logger.debug('Navigation Registry Summary', {
      totalRoutes,
      hubs: Array.from(byHub.entries()).map(([hub, routes]) => ({
        hub,
        count: routes.length,
        routes: routes.map(r => ({ label: r.label, path: r.path })),
      })),
    });
  }
}

// Development-time validation
if (process.env.NODE_ENV !== 'production') {
  const errors = validateRegistry(routeRegistry);
  if (errors.length > 0 && import.meta.env.DEV) {
    logger.warn('Navigation Registry Validation Errors', errors);
  }
}
