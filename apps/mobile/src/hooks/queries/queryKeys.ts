/**
 * Query Key Factories
 *
 * Type-safe query key factories following TanStack Query best practices.
 * Mirrors frontend/src/hooks/queries/queryKeys.ts for cache key consistency.
 */

// Fleet query keys
export const fleetKeys = {
  all: ['fleets'] as const,
  lists: () => [...fleetKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...fleetKeys.lists(), filters] as const,
  details: () => [...fleetKeys.all, 'detail'] as const,
  detail: (id: string) => [...fleetKeys.details(), id] as const,
  members: (id: string) => [...fleetKeys.detail(id), 'members'] as const,
  ships: (id: string, params?: Record<string, unknown>) =>
    [...fleetKeys.detail(id), 'ships', ...(params ? [params] : [])] as const,
  tree: (orgId: string) => [...fleetKeys.all, 'tree', orgId] as const,
  health: (id: string) => [...fleetKeys.detail(id), 'health'] as const,
  crewHealth: (id: string) => [...fleetKeys.detail(id), 'crewHealth'] as const,
  crewPositions: (id: string) => [...fleetKeys.detail(id), 'crewPositions'] as const,
  crewMembers: (id: string) => [...fleetKeys.detail(id), 'crewMembers'] as const,
  auditLog: (id: string) => [...fleetKeys.detail(id), 'auditLog'] as const,
};

// Organization query keys
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...organizationKeys.lists(), filters] as const,
  my: (userId?: string | null) => [...organizationKeys.all, 'my', userId ?? null] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  members: (id: string) => [...organizationKeys.detail(id), 'members'] as const,
  ships: (id: string, filters?: Record<string, unknown>) =>
    [...organizationKeys.detail(id), 'ships', filters] as const,
  fleetSummary: (id: string) => [...organizationKeys.detail(id), 'fleet-summary'] as const,
  activities: (id: string) => [...organizationKeys.detail(id), 'activities'] as const,
  settings: (id: string) => [...organizationKeys.detail(id), 'settings'] as const,
};

// Activity query keys
export const activityKeys = {
  all: ['activities'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...activityKeys.lists(), filters] as const,
  myActivities: (userId?: string | null, params?: Record<string, unknown>) =>
    [...activityKeys.all, 'my', userId ?? null, ...(params ? [params] : [])] as const,
  details: () => [...activityKeys.all, 'detail'] as const,
  detail: (id: string) => [...activityKeys.details(), id] as const,
  participants: (id: string) => [...activityKeys.detail(id), 'participants'] as const,
};

// User query keys
export const userKeys = {
  all: ['users'] as const,
  current: (userId?: string | null) => [...userKeys.all, 'current', userId ?? null] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  ships: (id: string) => [...userKeys.detail(id), 'ships'] as const,
  organizations: (id: string) => [...userKeys.detail(id), 'organizations'] as const,
  linkedAccounts: (userId?: string | null) =>
    [...userKeys.current(userId), 'linked-accounts'] as const,
  privacySettings: (userId?: string | null) =>
    [...userKeys.current(userId), 'privacy-settings'] as const,
};

// Ship query keys
export const shipKeys = {
  all: ['ships'] as const,
  catalog: () => [...shipKeys.all, 'catalog'] as const,
  roles: () => [...shipKeys.all, 'roles'] as const,
  lists: () => [...shipKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...shipKeys.lists(), filters] as const,
  details: () => [...shipKeys.all, 'detail'] as const,
  detail: (id: string) => [...shipKeys.details(), id] as const,
};

// Notification query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...notificationKeys.lists(), filters] as const,
  digest: () => [...notificationKeys.all, 'digest'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

// Dashboard query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  personalData: () => [...dashboardKeys.all, 'personal-data'] as const,
  memberActivity: (userId: string) => [...dashboardKeys.all, 'member-activity', userId] as const,
};

// Bounty query keys
export const bountyKeys = {
  all: ['bounties'] as const,
  lists: () => [...bountyKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...bountyKeys.lists(), filters] as const,
  details: () => [...bountyKeys.all, 'detail'] as const,
  detail: (id: string) => [...bountyKeys.details(), id] as const,
  claims: (bountyId: string) => [...bountyKeys.detail(bountyId), 'claims'] as const,
};
