/**
 * Navigation Components
 * Exports for the 4-hub navigation system
 */

export { Breadcrumb } from './Breadcrumb';
export { commands, getCategories, getCommandsByCategory, searchCommands } from './commandConfig';
export { CommandPalette } from './CommandPalette';
export { getAllNavItems, getHub, getHubForPath, hubs } from './hubConfig';
export { HubSidebar } from './HubSidebar';
export { MobileBottomNavigation } from './MobileBottomNavigation';
export { TopNavigation } from './TopNavigation';
export type { BreadcrumbItem, Command, Hub, HubId, NavItem, NavSection } from './types';
// NEW: Navigation Registry and Hooks for Phase 5c Refactoring
export {
  generateBreadcrumbConfig,
  generateCommandConfig,
  generateHubConfig,
  validateRegistry,
} from './configGenerators';
export {
  getCommandRoutes,
  getHubIds,
  getHubRoutes,
  getRoute,
  getRouteByPath,
  requiresOrganization,
  routeRegistry,
} from './navigationRegistry';
export type { RouteDefinition } from './navigationRegistry';
export {
  useBreadcrumbs,
  useCurrentHub,
  useCurrentRoute,
  useHubRoutes,
  useIsCurrentPage,
  useNavigation,
} from './useNavigation';
