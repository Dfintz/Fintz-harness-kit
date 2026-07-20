/**
 * useNavigation Hook
 *
 * Provides access to navigation data and utilities:
 * - All available hubs
 * - All available commands/routes
 * - Quick navigation functions
 * - Organization gating checks
 *
 * Centralizes navigation logic and eliminates prop drilling.
 */

import { commands } from '@/components/navigation/commandConfig';
import { getAllNavItems, hubs } from '@/components/navigation/hubConfig';
import type { RouteDefinition } from '@/components/navigation/navigationRegistry';
import { routeRegistry } from '@/components/navigation/navigationRegistry';
import type { Command, Hub, NavItem } from '@/components/navigation/types';
import { selectUser, useAuthStore } from '@/store/authStore';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export interface NavigationData {
  /** All available hubs */
  hubs: Hub[];
  /** All flat navigation items across hubs */
  items: NavItem[];
  /** All available commands */
  commands: Command[];
  /** Check if user's org allows access to a route */
  canAccessRoute: (routeId: string) => boolean;
  /** Check if user's org allows access to a command */
  canAccessCommand: (commandId: string) => boolean;
  /** Navigate to a specific route */
  goToRoute: (path: string) => void;
  /** Get route definition by ID */
  getRoute: (id: string) => RouteDefinition | null;
}

/**
 * Hook to access navigation data and utilities
 *
 * @example
 * const { hubs, items, commands, canAccessRoute, goToRoute } = useNavigation();
 * // Use for rendering nav menus, command palette, etc.
 */
export function useNavigation(): NavigationData {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);

  const hubsList = useMemo(() => hubs, []);
  const items: NavItem[] = useMemo(() => getAllNavItems().map(entry => entry.item as NavItem), []);

  /**
   * Check if user's organization allows access to a route
   * Routes marked with requiresOrg require active organization context
   */
  const canAccessRoute = useCallback(
    (routeId: string): boolean => {
      const route = Object.values(routeRegistry).find(r => r.id === routeId);
      if (!route) return false;

      // If route requires org, user must have an org selected
      if (route.requiresOrg && !user?.organizationId) {
        return false;
      }

      return true;
    },
    [user?.organizationId]
  );

  /**
   * Check if user's organization allows access to a command
   */
  const canAccessCommand = useCallback(
    (commandId: string): boolean => {
      const cmd = commands.find(c => c.id === commandId);
      if (!cmd) return false;

      // If command requires org, user must have an org selected
      if (cmd.requiresOrg && !user?.organizationId) {
        return false;
      }

      return true;
    },
    [user?.organizationId]
  );

  /**
   * Navigate to a specific route
   */
  const goToRoute = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  /**
   * Get a route definition by ID
   */
  const getRoute = useCallback((id: string): RouteDefinition | null => {
    return Object.values(routeRegistry).find(r => r.id === id) || null;
  }, []);

  return useMemo(
    () => ({
      hubs: hubsList,
      items,
      commands,
      canAccessRoute,
      canAccessCommand,
      goToRoute,
      getRoute,
    }),
    [hubsList, items, canAccessRoute, canAccessCommand, goToRoute, getRoute]
  );
}
