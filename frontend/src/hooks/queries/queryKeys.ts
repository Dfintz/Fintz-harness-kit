/**
 * Query Key Factories
 *
 * Type-safe query key factories following TanStack Query best practices.
 * These ensure consistent cache key management across the application.
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
  visibilityRules: (id: string) => [...fleetKeys.detail(id), 'visibilityRules'] as const,
};

// Treaty template query keys
export const treatyTemplateKeys = {
  all: ['treatyTemplates'] as const,
  lists: () => [...treatyTemplateKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...treatyTemplateKeys.lists(), filters] as const,
  details: () => [...treatyTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...treatyTemplateKeys.details(), id] as const,
};

// Organization query keys
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...organizationKeys.lists(), filters] as const,
  // User-scoped: include userId so that cached memberships from a previous user
  // session never leak into the next user's view (e.g. PublicOrgCard "Member" badge).
  my: (userId?: string | null) => [...organizationKeys.all, 'my', userId ?? null] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  members: (id: string) => [...organizationKeys.detail(id), 'members'] as const,
  ships: (id: string, filters?: Record<string, unknown>) =>
    [...organizationKeys.detail(id), 'ships', filters] as const,
  ship: (id: string, shipId: string) => [...organizationKeys.detail(id), 'ships', shipId] as const,
  fleetSummary: (id: string) => [...organizationKeys.detail(id), 'fleet-summary'] as const,
  activities: (id: string) => [...organizationKeys.detail(id), 'activities'] as const,
  settings: (id: string) => [...organizationKeys.detail(id), 'settings'] as const,
  discordGuilds: (id: string) => [...organizationKeys.detail(id), 'discord-guilds'] as const,
  publicProfile: (id: string) => [...organizationKeys.detail(id), 'public-profile'] as const,
  tree: (id: string) => [...organizationKeys.detail(id), 'tree'] as const,
};

// Activity query keys
export const activityKeys = {
  all: ['activities'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...activityKeys.lists(), filters] as const,
  // User-scoped: include userId so a previous user's "my" activities cannot leak into
  // the next signed-in user's view.
  myActivities: (userId?: string | null, params?: Record<string, unknown>) =>
    [...activityKeys.all, 'my', userId ?? null, ...(params ? [params] : [])] as const,
  details: () => [...activityKeys.all, 'detail'] as const,
  detail: (id: string) => [...activityKeys.details(), id] as const,
  participants: (id: string) => [...activityKeys.detail(id), 'participants'] as const,
  joinLink: (token: string) => [...activityKeys.all, 'join-link', token] as const,
  readyCheck: (id: string) => [...activityKeys.detail(id), 'readyCheck'] as const,
  commandChain: (id: string) => [...activityKeys.detail(id), 'commandChain'] as const,
  commands: (id: string) => [...activityKeys.detail(id), 'commands'] as const,
  command: (activityId: string, cmdId: string) =>
    [...activityKeys.commands(activityId), cmdId] as const,
};

// User query keys
export const userKeys = {
  all: ['users'] as const,
  // User-scoped: include userId so a previous user's profile/linked accounts/privacy
  // settings cannot leak into the next signed-in user's view.
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
  browse: (filters?: Record<string, unknown>) => [...userKeys.all, 'browse', filters] as const,
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

// Trading query keys
export const tradingKeys = {
  all: ['trading'] as const,
  routes: () => [...tradingKeys.all, 'routes'] as const,
  route: (id: string) => [...tradingKeys.routes(), id] as const,
  prices: () => [...tradingKeys.all, 'prices'] as const,
  alerts: () => [...tradingKeys.all, 'alerts'] as const,
  alert: (id: string) => [...tradingKeys.alerts(), id] as const,
  uexRoutes: (params?: Record<string, unknown>) =>
    [...tradingKeys.all, 'uex-routes', params] as const,
};

// Intel vault query keys
export const intelKeys = {
  all: ['intel'] as const,
  lists: () => [...intelKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...intelKeys.lists(), filters] as const,
  details: () => [...intelKeys.all, 'detail'] as const,
  detail: (id: string) => [...intelKeys.details(), id] as const,
  officers: (orgId?: string) => [...intelKeys.all, 'officers', orgId] as const,
  officer: (officerId: string) => [...intelKeys.all, 'officer', officerId] as const,
  auditLogs: (orgId?: string) => [...intelKeys.all, 'audit-logs', orgId] as const,
  access: (orgId?: string) => [...intelKeys.all, 'access', orgId] as const,
};

// Member Audit & Intel query keys (Wave 2.1)
export const memberAuditKeys = {
  all: ['member-audit'] as const,

  // Audit flags
  flagsList: (orgId: string) => [...memberAuditKeys.all, 'flags', orgId] as const,
  flags: (orgId: string, query?: Record<string, unknown>) =>
    [...memberAuditKeys.flagsList(orgId), query] as const,
  flag: (orgId: string, flagId: string) => [...memberAuditKeys.all, 'flag', orgId, flagId] as const,
  userStats: (orgId: string, userId: string) =>
    [...memberAuditKeys.all, 'user-stats', orgId, userId] as const,

  // Watchlist
  watchlistList: (orgId: string) => [...memberAuditKeys.all, 'watchlist', orgId] as const,
  watchlist: (orgId: string, query?: Record<string, unknown>) =>
    [...memberAuditKeys.watchlistList(orgId), query] as const,
  watchlistEntry: (orgId: string, entryId: string) =>
    [...memberAuditKeys.all, 'watchlist-entry', orgId, entryId] as const,

  // Member profile
  profile: (orgId: string, userId: string) =>
    [...memberAuditKeys.all, 'profile', orgId, userId] as const,
};

// Team query keys (Phase 1.3)
export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: (orgId: string, filters?: Record<string, unknown>) =>
    [...teamKeys.lists(), orgId, filters] as const,
  tree: (orgId: string) => [...teamKeys.all, 'tree', orgId] as const,
  details: () => [...teamKeys.all, 'detail'] as const,
  detail: (id: string) => [...teamKeys.details(), id] as const,
  members: (id: string) => [...teamKeys.detail(id), 'members'] as const,
};

// SCStats query keys (Phase 3)
export const scStatsKeys = {
  all: ['scstats'] as const,
  userData: (userId: string) => [...scStatsKeys.all, 'user', userId] as const,
  csvData: (userId: string) => [...scStatsKeys.all, 'csv', userId] as const,
  orgAnalytics: (orgId: string) => [...scStatsKeys.all, 'org', orgId] as const,
  orgAnalyticsPublic: (orgId: string) => [...scStatsKeys.all, 'org', orgId, 'public'] as const,
};

// Notification query keys (Phase 3)
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...notificationKeys.lists(), filters] as const,
  digest: () => [...notificationKeys.all, 'digest'] as const,
  digestById: (digestId: string) => [...notificationKeys.digest(), digestId] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

// Dashboard query keys (Sprint 0 — unified endpoint)
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  personalData: () => [...dashboardKeys.all, 'personal-data'] as const,
  memberActivity: (userId: string) => [...dashboardKeys.all, 'member-activity', userId] as const,
};

// Bounty query keys (Sprint 0.5)
export const bountyKeys = {
  all: ['bounties'] as const,
  lists: () => [...bountyKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...bountyKeys.lists(), filters] as const,
  details: () => [...bountyKeys.all, 'detail'] as const,
  detail: (id: string) => [...bountyKeys.details(), id] as const,
  claims: (bountyId: string) => [...bountyKeys.detail(bountyId), 'claims'] as const,
  claim: (bountyId: string, claimId: string) => [...bountyKeys.claims(bountyId), claimId] as const,
};

// Hunter profile query keys (Sprint 24)
export const hunterKeys = {
  all: ['hunters'] as const,
  profile: (userId?: string) => [...hunterKeys.all, 'profile', userId] as const,
  leaderboard: (sortBy?: string) => [...hunterKeys.all, 'leaderboard', sortBy] as const,
  history: (userId?: string, page?: number) =>
    [...hunterKeys.all, 'history', userId, page] as const,
  analytics: () => [...hunterKeys.all, 'analytics'] as const,
};

// Audit log query keys (Sprint 24)
export const auditKeys = {
  all: ['audit'] as const,
  logs: (filters?: Record<string, unknown>) => [...auditKeys.all, 'logs', filters] as const,
  log: (logId: string) => [...auditKeys.all, 'log', logId] as const,
  statistics: (orgId?: string) => [...auditKeys.all, 'statistics', orgId] as const,
};

// Encryption query keys (Sprint 0.5)
export const encryptionKeys = {
  all: ['encryption'] as const,
  status: (orgId: string) => [...encryptionKeys.all, 'status', orgId] as const,
  key: (orgId: string) => [...encryptionKeys.all, 'key', orgId] as const,
  auditLog: (orgId: string) => [...encryptionKeys.all, 'audit-log', orgId] as const,
  pendingReEncryption: (orgId: string) =>
    [...encryptionKeys.all, 'pending-reencryption', orgId] as const,
  reEncryptionProgress: (orgId: string) =>
    [...encryptionKeys.all, 'reencryption-progress', orgId] as const,
  data: (orgId: string, dataId?: string) =>
    dataId
      ? ([...encryptionKeys.all, 'data', orgId, dataId] as const)
      : ([...encryptionKeys.all, 'data', orgId] as const),
  claims: (orgId: string) => [...encryptionKeys.all, 'claims', orgId] as const,
};

// Hybrid Encryption query keys (Phase 3-4)
export const hybridEncryptionKeys = {
  all: ['hybrid-encryption'] as const,
  publicKeys: (orgId: string) => [...hybridEncryptionKeys.all, 'public-keys', orgId] as const,
  publicKey: (orgId: string, userId: string) =>
    [...hybridEncryptionKeys.all, 'public-key', orgId, userId] as const,
  deks: (orgId: string) => [...hybridEncryptionKeys.all, 'deks', orgId] as const,
  dek: (orgId: string, dekId: string) =>
    [...hybridEncryptionKeys.all, 'dek', orgId, dekId] as const,
  hybridData: (orgId: string, dataId?: string) =>
    dataId
      ? ([...hybridEncryptionKeys.all, 'data', orgId, dataId] as const)
      : ([...hybridEncryptionKeys.all, 'data', orgId] as const),
  hybridDataList: (orgId: string, filters?: Record<string, unknown>) =>
    [...hybridEncryptionKeys.all, 'data-list', orgId, filters] as const,
  migrationProgress: (orgId: string) =>
    [...hybridEncryptionKeys.all, 'migration-progress', orgId] as const,
  migrationCandidates: (orgId: string) =>
    [...hybridEncryptionKeys.all, 'migration-candidates', orgId] as const,
};

// Permission query keys (Sprint 0.5)
export const permissionKeys = {
  all: ['permissions'] as const,
  lists: () => [...permissionKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...permissionKeys.lists(), filters] as const,
  details: () => [...permissionKeys.all, 'detail'] as const,
  detail: (id: string) => [...permissionKeys.details(), id] as const,
  check: (userId: string, permission: string) =>
    [...permissionKeys.all, 'check', userId, permission] as const,
  userPermissions: (userId: string) => [...permissionKeys.all, 'user', userId] as const,
  roles: (orgId: string) => [...permissionKeys.all, 'roles', orgId] as const,
  userRole: (orgId: string, userId: string) =>
    [...permissionKeys.all, 'user-role', orgId, userId] as const,
  rolePermissions: (roleId: string) => [...permissionKeys.all, 'role-permissions', roleId] as const,
  roleTemplates: () => [...permissionKeys.all, 'role-templates'] as const,
};

// Security Level query keys (Sprint 0.5)
export const securityLevelKeys = {
  all: ['security-levels'] as const,
  lists: () => [...securityLevelKeys.all, 'list'] as const,
  orgLevels: (orgId: string) => [...securityLevelKeys.all, 'org', orgId] as const,
};

// Crew Assignment query keys (Sprint 1)
export const crewAssignmentKeys = {
  all: ['crew-assignments'] as const,
  lists: () => [...crewAssignmentKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...crewAssignmentKeys.lists(), filters] as const,
  details: () => [...crewAssignmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...crewAssignmentKeys.details(), id] as const,
  byShip: (shipId: string) => [...crewAssignmentKeys.all, 'ship', shipId] as const,
};

// Social / LFG query keys (Sprint 17-D/17-E)
export const socialLfgKeys = {
  all: ['social-lfg'] as const,
  groups: {
    all: ['social-lfg', 'groups'] as const,
    lists: () => [...socialLfgKeys.groups.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...socialLfgKeys.groups.lists(), filters] as const,
    detail: (id: string) => [...socialLfgKeys.groups.all, 'detail', id] as const,
  },
  sessions: {
    all: ['social-lfg', 'sessions'] as const,
    lists: () => [...socialLfgKeys.sessions.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...socialLfgKeys.sessions.lists(), filters] as const,
    detail: (id: string) => [...socialLfgKeys.sessions.all, 'detail', id] as const,
  },
};

// Squadron query keys (Sprint 3-D)
export const squadronKeys = {
  all: ['squadrons'] as const,
  members: (squadronId: string) => [...squadronKeys.all, 'members', squadronId] as const,
  memberList: (squadronId: string, filters?: Record<string, unknown>) =>
    [...squadronKeys.members(squadronId), filters] as const,
  member: (squadronId: string, memberId: string) =>
    [...squadronKeys.members(squadronId), memberId] as const,
  count: (squadronId: string) => [...squadronKeys.all, 'count', squadronId] as const,
  activeCount: (squadronId: string) => [...squadronKeys.all, 'active-count', squadronId] as const,
  stats: (squadronId: string) => [...squadronKeys.all, 'stats', squadronId] as const,
  roleStats: (squadronId: string) => [...squadronKeys.all, 'role-stats', squadronId] as const,
  shipStats: (squadronId: string) => [...squadronKeys.all, 'ship-stats', squadronId] as const,
  userSquadrons: (userId: string) => [...squadronKeys.all, 'user', userId] as const,
};

// Mining query keys — standalone mining feature disabled but exported for useMiningQueries
export const miningKeys = {
  all: ['mining'] as const,
  lists: () => [...miningKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...miningKeys.lists(), filters] as const,
  details: () => [...miningKeys.all, 'detail'] as const,
  detail: (id: string) => [...miningKeys.details(), id] as const,
  regolith: (location: string) => [...miningKeys.all, 'regolith', location] as const,
};

// Shared Account query keys (Sprint 0.5)
export const sharedAccountKeys = {
  all: ['shared-accounts'] as const,
  lists: () => [...sharedAccountKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...sharedAccountKeys.lists(), filters] as const,
  byOrganization: (orgId: string) => [...sharedAccountKeys.lists(), 'org', orgId] as const,
  details: () => [...sharedAccountKeys.all, 'detail'] as const,
  detail: (id: string) => [...sharedAccountKeys.details(), id] as const,
  members: (accountId: string) => [...sharedAccountKeys.detail(accountId), 'members'] as const,
  auditLog: (accountId: string) => [...sharedAccountKeys.detail(accountId), 'audit-log'] as const,
};

// Consent query keys (Sprint 0.5)
export const consentKeys = {
  all: ['consent'] as const,
  lists: () => [...consentKeys.all, 'list'] as const,
  check: (consentType: string) => [...consentKeys.all, 'check', consentType] as const,
  version: (consentType: string) => [...consentKeys.all, 'version', consentType] as const,
};

// Alliance Diplomacy query keys (Sprint 0.5)
export const allianceKeys = {
  all: ['alliances'] as const,
  lists: () => [...allianceKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...allianceKeys.lists(), filters] as const,
  details: () => [...allianceKeys.all, 'detail'] as const,
  detail: (id: string) => [...allianceKeys.details(), id] as const,
  incidents: (allianceId: string) => [...allianceKeys.detail(allianceId), 'incidents'] as const,
};

// Mission query keys (Sprint 1 — Wave 3.1)
export const missionKeys = {
  all: ['missions'] as const,
  lists: (orgId?: string | null) => [...missionKeys.all, 'list', orgId ?? null] as const,
  list: (orgId: string | null | undefined, filters?: Record<string, unknown>) =>
    [...missionKeys.lists(orgId), filters] as const,
  active: (orgId?: string | null) => [...missionKeys.all, 'active', orgId ?? null] as const,
  templates: (orgId?: string | null) => [...missionKeys.all, 'templates', orgId ?? null] as const,
  details: (orgId?: string | null) => [...missionKeys.all, 'detail', orgId ?? null] as const,
  detail: (orgId: string | null | undefined, id: string) =>
    [...missionKeys.details(orgId), id] as const,
  workflow: (orgId: string | null | undefined, id: string) =>
    [...missionKeys.detail(orgId, id), 'workflow'] as const,
  participants: (orgId: string | null | undefined, id: string) =>
    [...missionKeys.detail(orgId, id), 'participants'] as const,
  objectives: (orgId: string | null | undefined, id: string) =>
    [...missionKeys.detail(orgId, id), 'objectives'] as const,
};

// Application query keys (Pending Approvals widget)
export const applicationKeys = {
  all: ['applications'] as const,
  lists: (orgId: string) => [...applicationKeys.all, 'list', orgId] as const,
  list: (orgId: string, filters?: Record<string, unknown>) =>
    [...applicationKeys.lists(orgId), filters] as const,
  mode: (orgId: string) => [...applicationKeys.all, 'mode', orgId] as const,
  check: (orgId: string) => [...applicationKeys.all, 'check', orgId] as const,
};

// Invitation query keys (Pending Approvals widget)
export const invitationKeys = {
  all: ['invitations'] as const,
  lists: (orgId: string) => [...invitationKeys.all, 'list', orgId] as const,
  list: (orgId: string, filters?: Record<string, unknown>) =>
    [...invitationKeys.lists(orgId), filters] as const,
};

// Wiki query keys (Sprint 2 — Wave 3.2)
export const wikiKeys = {
  all: ['wiki'] as const,
  tree: () => [...wikiKeys.all, 'tree'] as const,
  lists: () => [...wikiKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...wikiKeys.lists(), filters] as const,
  details: () => [...wikiKeys.all, 'detail'] as const,
  detail: (idOrSlug: string) => [...wikiKeys.details(), idOrSlug] as const,
  revisions: (pageId: string) => [...wikiKeys.detail(pageId), 'revisions'] as const,
  revision: (pageId: string, revisionId: string) =>
    [...wikiKeys.revisions(pageId), revisionId] as const,
  search: (query: string) => [...wikiKeys.all, 'search', query] as const,
};

// Security session query keys (Sprint 7)
export const securitySessionKeys = {
  all: ['securitySessions'] as const,
  sessions: () => [...securitySessionKeys.all, 'sessions'] as const,
  trustedDevices: () => [...securitySessionKeys.all, 'trustedDevices'] as const,
  accessLogs: (params?: { limit?: number; offset?: number }) =>
    [...securitySessionKeys.all, 'accessLogs', params] as const,
};

// Inventory / Logistics query keys (Sprint 22-C React Query migration)
export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...inventoryKeys.lists(), filters] as const,
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
  statistics: (fleetId?: string) => [...inventoryKeys.all, 'statistics', fleetId] as const,
  byCategory: (fleetId?: string) => [...inventoryKeys.all, 'by-category', fleetId] as const,
  lowStock: (fleetId?: string) => [...inventoryKeys.all, 'low-stock', fleetId] as const,
  marketPrices: (itemName: string) => [...inventoryKeys.all, 'market-prices', itemName] as const,
};

// Loadout query keys (Tech Debt — React Query migration)
export const loadoutKeys = {
  all: ['loadouts'] as const,
  lists: () => [...loadoutKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...loadoutKeys.lists(), filters] as const,
  userLoadouts: (userId: string, orgIds?: string) =>
    [...loadoutKeys.all, 'user', userId, orgIds] as const,
};

// Ship comparison query keys
export const shipComparisonKeys = {
  all: ['shipComparison'] as const,
  comparison: (shipIds: string[]) => {
    const sortedShipIds = [...shipIds].sort((a, b) => a.localeCompare(b));
    return [...shipComparisonKeys.all, 'compare', ...sortedShipIds] as const;
  },
  roles: (shipId: string) => [...shipComparisonKeys.all, 'roles', shipId] as const,
  similar: (shipId: string) => [...shipComparisonKeys.all, 'similar', shipId] as const,
  quickCompare: (shipId1: string, shipId2: string) => {
    const sortedPair = [shipId1, shipId2].sort((a, b) => a.localeCompare(b));
    return [...shipComparisonKeys.all, 'quick', ...sortedPair] as const;
  },
  fleetAnalysis: (fleetId: string) => [...shipComparisonKeys.all, 'fleet', fleetId] as const,
};

// Organization Template query keys (Sprint 19-D)
export const organizationTemplateKeys = {
  all: ['organization-templates'] as const,
  lists: () => [...organizationTemplateKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...organizationTemplateKeys.lists(), filters] as const,
  details: () => [...organizationTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationTemplateKeys.details(), id] as const,
  marketplace: (filters?: Record<string, unknown>) =>
    [...organizationTemplateKeys.all, 'marketplace', filters] as const,
  popular: (limit?: number) => [...organizationTemplateKeys.all, 'popular', limit] as const,
  topRated: (limit?: number) => [...organizationTemplateKeys.all, 'top-rated', limit] as const,
};

// Activity Template query keys (Sprint 19-D)
export const activityTemplateKeys = {
  all: ['activity-templates'] as const,
  lists: () => [...activityTemplateKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...activityTemplateKeys.lists(), filters] as const,
  details: () => [...activityTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...activityTemplateKeys.details(), id] as const,
  categories: () => [...activityTemplateKeys.all, 'categories'] as const,
};

// Opportunity search query keys (Sprint 19-G)
export const opportunityKeys = {
  all: ['opportunities'] as const,
  searches: () => [...opportunityKeys.all, 'search'] as const,
  search: (filters?: Record<string, unknown>) => [...opportunityKeys.searches(), filters] as const,
  details: () => [...opportunityKeys.all, 'detail'] as const,
  detail: (id: string) => [...opportunityKeys.details(), id] as const,
};

// Unified participation query keys (Sprint 20-E)
export const participationKeys = {
  all: ['participation'] as const,
  summaries: () => [...participationKeys.all, 'summary'] as const,
  // User-scoped: include userId so a previous user's participation summary cannot
  // leak into the next signed-in user's view.
  mySummary: (userId?: string | null, filters?: Record<string, unknown>) =>
    [...participationKeys.summaries(), 'me', userId ?? null, filters] as const,
  userSummary: (userId: string, filters?: Record<string, unknown>) =>
    [...participationKeys.summaries(), userId, filters] as const,
};

// Public stats query keys (Sprint 21-B)
export const publicStatsKeys = {
  all: ['publicStats'] as const,
  stats: () => [...publicStatsKeys.all, 'stats'] as const,
};

// Org trust score query keys (Sprint 21-A)
export const orgTrustScoreKeys = {
  all: ['orgTrustScore'] as const,
  detail: (orgId: string) => [...orgTrustScoreKeys.all, orgId] as const,
};

// Availability query keys (Sprint 22-I)
export const availabilityKeys = {
  all: ['availability'] as const,
  // User-scoped: include userId so a previous user's availability slots cannot leak
  // into the next signed-in user's view (e.g. on a shared browser).
  myAvailability: (orgId: string, userId?: string | null) =>
    [...availabilityKeys.all, 'me', orgId, userId ?? null] as const,
  heatmap: (orgId: string) => [...availabilityKeys.all, 'heatmap', orgId] as const,
  bestTimes: (orgId: string, duration: number, minAttendees: number) =>
    [...availabilityKeys.all, 'best-times', orgId, duration, minAttendees] as const,
};

// Recruitment query keys (Sprint 22-D)
export const recruitmentKeys = {
  all: ['recruitments'] as const,
  lists: () => [...recruitmentKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...recruitmentKeys.lists(), filters] as const,
  details: () => [...recruitmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...recruitmentKeys.details(), id] as const,
  applications: (id: string, filters?: Record<string, unknown>) =>
    [...recruitmentKeys.detail(id), 'applications', filters] as const,
};

// Event query keys (Sprint 22-A)
export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...eventKeys.lists(), filters] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
};

// Briefing query keys (Sprint 22-H)
export const briefingKeys = {
  all: ['briefings'] as const,
  lists: () => [...briefingKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...briefingKeys.lists(), filters] as const,
  details: () => [...briefingKeys.all, 'detail'] as const,
  detail: (id: string) => [...briefingKeys.details(), id] as const,
};

// Ship Maintenance query keys (Sprint 22-F)
export const shipMaintenanceKeys = {
  all: ['shipMaintenance'] as const,
  lists: () => [...shipMaintenanceKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...shipMaintenanceKeys.lists(), filters] as const,
  details: () => [...shipMaintenanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...shipMaintenanceKeys.details(), id] as const,
  upcoming: () => [...shipMaintenanceKeys.all, 'upcoming'] as const,
  overdue: () => [...shipMaintenanceKeys.all, 'overdue'] as const,
  summary: () => [...shipMaintenanceKeys.all, 'summary'] as const,
};

// User Trust Score keys (Sprint 22-K)
export const userTrustScoreKeys = {
  all: ['userTrustScore'] as const,
  detail: (userId: string) => [...userTrustScoreKeys.all, userId] as const,
};

// Bot command documentation keys (Sprint 23-B)
export const botCommandKeys = {
  all: ['botCommands'] as const,
  list: (category?: string) => [...botCommandKeys.all, 'list', category] as const,
};

// CAS (Composite Activity Score) keys
export const casKeys = {
  all: ['cas'] as const,
  score: (orgId: string) => [...casKeys.all, 'score', orgId] as const,
  history: (orgId: string, days: number) => [...casKeys.all, 'history', orgId, days] as const,
  breakdown: (orgId: string) => [...casKeys.all, 'breakdown', orgId] as const,
  heatmap: (orgId: string, days: number) => [...casKeys.all, 'heatmap', orgId, days] as const,
  ranking: () => [...casKeys.all, 'ranking'] as const,
};

// Voice Server keys
export const voiceServerKeys = {
  all: ['voiceServer'] as const,
  orgConfig: (orgId: string) => [...voiceServerKeys.all, 'orgConfig', orgId] as const,
  orgStatus: (orgId: string) => [...voiceServerKeys.all, 'orgStatus', orgId] as const,
  orgStats: (orgId: string) => [...voiceServerKeys.all, 'orgStats', orgId] as const,
  orgSuggestions: (orgId: string) => [...voiceServerKeys.all, 'orgSuggestions', orgId] as const,
  fedConfig: (fedId: string) => [...voiceServerKeys.all, 'fedConfig', fedId] as const,
  fedStatus: (fedId: string) => [...voiceServerKeys.all, 'fedStatus', fedId] as const,
  fedStats: (fedId: string) => [...voiceServerKeys.all, 'fedStats', fedId] as const,
  fedSuggestions: (fedId: string) => [...voiceServerKeys.all, 'fedSuggestions', fedId] as const,
  accessible: () => [...voiceServerKeys.all, 'accessible'] as const,
};

// Bot statistics keys (Sprint 26 — Gap Analysis)
export const botStatsKeys = {
  all: ['botStats'] as const,
  systemCommands: () => [...botStatsKeys.all, 'systemCommands'] as const,
  allCommands: () => [...botStatsKeys.all, 'allCommands'] as const,
  guildCommands: (guildId: string) => [...botStatsKeys.all, 'guildCommands', guildId] as const,
  presence: (guildId: string) => [...botStatsKeys.all, 'presence', guildId] as const,
  heatmap: (guildId: string, days?: number) =>
    [...botStatsKeys.all, 'heatmap', guildId, days] as const,
  games: (guildId: string, days?: number) => [...botStatsKeys.all, 'games', guildId, days] as const,
};

// Ticket keys (Sprint 22-G)
export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...ticketKeys.lists(), filters] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  byNumber: (ticketNumber: string) => [...ticketKeys.all, 'byNumber', ticketNumber] as const,
  stats: () => [...ticketKeys.all, 'stats'] as const,
};

// Federation Management keys (Sprint 22-B)
export const federationManagementKeys = {
  all: ['federationManagement'] as const,
  lists: () => [...federationManagementKeys.all, 'list'] as const,
  // User-scoped "my federations" — the list of federations the current user's org
  // belongs to. Keyed by userId so a previous user's federations cannot leak into the
  // next signed-in user's view. `lists()` is intentionally retained for invalidation
  // patterns; it prefix-matches `myList` when invalidated.
  myList: (userId?: string | null) =>
    [...federationManagementKeys.lists(), 'me', userId ?? null] as const,
  details: () => [...federationManagementKeys.all, 'detail'] as const,
  detail: (id: string) => [...federationManagementKeys.details(), id] as const,
  proposals: (id: string) => [...federationManagementKeys.detail(id), 'proposals'] as const,
  proposalList: (id: string, status?: string) =>
    [...federationManagementKeys.proposals(id), status] as const,
  stats: (id: string) => [...federationManagementKeys.detail(id), 'stats'] as const,
  contributions: (id: string) => [...federationManagementKeys.detail(id), 'contributions'] as const,
  settings: (id: string) => [...federationManagementKeys.detail(id), 'settings'] as const,
  fleets: (id: string) => [...federationManagementKeys.detail(id), 'fleets'] as const,
  ambassadors: (id: string) => [...federationManagementKeys.detail(id), 'ambassadors'] as const,
  // User-scoped: include userId so the previous user's ambassador profile cannot leak
  // into the next signed-in user's view.
  myAmbassador: (id: string, userId?: string | null) =>
    [...federationManagementKeys.detail(id), 'myAmbassador', userId ?? null] as const,
  wikiPages: (id: string) => [...federationManagementKeys.detail(id), 'wikiPages'] as const,
  wikiTree: (id: string) => [...federationManagementKeys.detail(id), 'wikiTree'] as const,
  wikiPage: (id: string, pageId: string) =>
    [...federationManagementKeys.wikiPages(id), pageId] as const,
  announcements: (id: string) => [...federationManagementKeys.detail(id), 'announcements'] as const,
  polls: (id: string) => [...federationManagementKeys.detail(id), 'polls'] as const,
  pollResults: (id: string, pollId: string) =>
    [...federationManagementKeys.polls(id), pollId, 'results'] as const,
  teams: (id: string) => [...federationManagementKeys.detail(id), 'teams'] as const,
  team: (id: string, teamId: string) => [...federationManagementKeys.teams(id), teamId] as const,
  intel: (id: string) => [...federationManagementKeys.detail(id), 'intel'] as const,
  intelEntry: (id: string, entryId: string) =>
    [...federationManagementKeys.intel(id), entryId] as const,
  personnel: (id: string) => [...federationManagementKeys.detail(id), 'personnel'] as const,
  personnelSummary: (id: string) => [...federationManagementKeys.personnel(id), 'summary'] as const,
  applicationMode: (id: string) =>
    [...federationManagementKeys.detail(id), 'applicationMode'] as const,
  applications: (id: string) => [...federationManagementKeys.detail(id), 'applications'] as const,
  discordStatus: (id: string) => [...federationManagementKeys.detail(id), 'discordStatus'] as const,
  discordConflicts: (id: string) =>
    [...federationManagementKeys.detail(id), 'discordConflicts'] as const,
  guildSettings: (id: string) => [...federationManagementKeys.detail(id), 'guildSettings'] as const,
  guildSettingsDetail: (id: string, guildId: string) =>
    [...federationManagementKeys.guildSettings(id), guildId] as const,
};

// Cross-System Analytics keys (Sprint 23-F)
export const crossSystemAnalyticsKeys = {
  all: ['crossSystemAnalytics'] as const,
  analytics: (params?: Record<string, unknown>) =>
    [...crossSystemAnalyticsKeys.all, params] as const,
  crewFormation: (params?: Record<string, unknown>) =>
    [...crossSystemAnalyticsKeys.all, 'crewFormation', params] as const,
  formationSpeed: (params?: Record<string, unknown>) =>
    [...crossSystemAnalyticsKeys.all, 'formationSpeed', params] as const,
  jobPlacement: (params?: Record<string, unknown>) =>
    [...crossSystemAnalyticsKeys.all, 'jobPlacement', params] as const,
  lfgConversion: (params?: Record<string, unknown>) =>
    [...crossSystemAnalyticsKeys.all, 'lfgConversion', params] as const,
};

// Announcement query keys (Sprint 26 — Announcement Dashboard)
export const announcementKeys = {
  all: ['announcements'] as const,
  lists: () => [...announcementKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...announcementKeys.lists(), filters] as const,
  details: () => [...announcementKeys.all, 'detail'] as const,
  detail: (id: string) => [...announcementKeys.details(), id] as const,
  stats: () => [...announcementKeys.all, 'stats'] as const,
};

// Poll query keys (Sprint 26 — Poll Dashboard)
export const pollKeys = {
  all: ['polls'] as const,
  lists: () => [...pollKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...pollKeys.lists(), filters] as const,
  details: () => [...pollKeys.all, 'detail'] as const,
  detail: (id: string) => [...pollKeys.details(), id] as const,
  results: (id: string) => [...pollKeys.detail(id), 'results'] as const,
};

export const attendanceKeys = {
  all: ['attendance'] as const,
  activityStats: (activityId: string) =>
    [...attendanceKeys.all, 'activity-stats', activityId] as const,
  activityReport: (activityId: string) =>
    [...attendanceKeys.all, 'activity-report', activityId] as const,
  userHistory: (userId: string, params?: Record<string, unknown>) =>
    [...attendanceKeys.all, 'user-history', userId, params] as const,
  leaderboard: (orgId: string, params?: Record<string, unknown>) =>
    [...attendanceKeys.all, 'leaderboard', orgId, params] as const,
};

export const moderationKeys = {
  all: ['moderation'] as const,
  incidents: () => [...moderationKeys.all, 'incidents'] as const,
  incidentList: (filters?: Record<string, unknown>) =>
    [...moderationKeys.incidents(), filters] as const,
  incidentDetail: (id: string) => [...moderationKeys.incidents(), id] as const,
  lookup: (discordId: string) => [...moderationKeys.all, 'lookup', discordId] as const,
  analytics: () => [...moderationKeys.all, 'analytics'] as const,
  repeatOffenders: () => [...moderationKeys.all, 'repeat-offenders'] as const,
  sharingConfig: () => [...moderationKeys.all, 'sharing-config'] as const,
};

// Public directory query keys (orgs, federations, job listings, public activities)
export const publicDirectoryKeys = {
  all: ['publicDirectory'] as const,
  jobs: () => [...publicDirectoryKeys.all, 'jobs'] as const,
  jobDetail: (slug: string) => [...publicDirectoryKeys.jobs(), slug] as const,
  jobApplications: (jobId: string, status?: string) =>
    [...publicDirectoryKeys.jobs(), jobId, 'applications', status] as const,
  publicActivities: () => [...publicDirectoryKeys.all, 'publicActivities'] as const,
  publicActivity: (id: string) => [...publicDirectoryKeys.publicActivities(), id] as const,
  // Public org directory listings + aggregated stats
  orgs: () => [...publicDirectoryKeys.all, 'orgs'] as const,
  orgList: (filters: object, params: Record<string, unknown>) =>
    [...publicDirectoryKeys.orgs(), 'list', filters, params] as const,
  orgStats: () => [...publicDirectoryKeys.all, 'orgStats'] as const,
  // Public federation directory listings + aggregated stats
  federations: () => [...publicDirectoryKeys.all, 'federations'] as const,
  federationList: (filters: object, params: Record<string, unknown>) =>
    [...publicDirectoryKeys.federations(), 'list', filters, params] as const,
  federationStats: () => [...publicDirectoryKeys.all, 'federationStats'] as const,
};

// Available ships for fleet assignment (org + member ships)
export const availableShipKeys = {
  all: ['availableShips'] as const,
  orgShips: (orgId: string) => [...availableShipKeys.all, 'org', orgId] as const,
};

// Relationship keys (Organization Diplomacy)
export const relationshipKeys = {
  all: ['relationships'] as const,
  lists: () => [...relationshipKeys.all, 'list'] as const,
  list: (orgId: string) => [...relationshipKeys.lists(), orgId] as const,
  details: () => [...relationshipKeys.all, 'detail'] as const,
  detail: (id: string) => [...relationshipKeys.details(), id] as const,
  history: (id: string) => [...relationshipKeys.detail(id), 'history'] as const,
  orgSearch: (query: string) => [...relationshipKeys.all, 'orgSearch', query] as const,
};

// Inbox query keys (React Query migration)
export const inboxKeys = {
  all: ['inbox'] as const,
  messages: () => [...inboxKeys.all, 'messages'] as const,
  detail: (id: string) => [...inboxKeys.all, 'detail', id] as const,
};

// User Ship (Personal Hangar) query keys
export const userShipKeys = {
  all: ['userShips'] as const,
  lists: () => [...userShipKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...userShipKeys.lists(), filters] as const,
  details: () => [...userShipKeys.all, 'detail'] as const,
  detail: (id: string) => [...userShipKeys.details(), id] as const,
  summary: () => [...userShipKeys.all, 'summary'] as const,
};

// RSI Role Mapping query keys
export const roleMappingKeys = {
  all: ['roleMappings'] as const,
  lists: () => [...roleMappingKeys.all, 'list'] as const,
  list: (orgId: string, filters?: Record<string, unknown>) =>
    [...roleMappingKeys.lists(), orgId, filters] as const,
  templates: () => [...roleMappingKeys.all, 'templates'] as const,
  orgRoles: (orgId: string) => [...roleMappingKeys.all, 'orgRoles', orgId] as const,
  discordRoles: (guildId: string) => [...roleMappingKeys.all, 'discordRoles', guildId] as const,
  discoveredRanks: (orgId: string) => [...roleMappingKeys.all, 'discoveredRanks', orgId] as const,
};

// RSI Member Intelligence query keys (Wave 3.3)
export const rsiMemberIntelKeys = {
  all: ['rsi-member-intel'] as const,
  lists: () => [...rsiMemberIntelKeys.all, 'list'] as const,
  list: (orgId: string) => [...rsiMemberIntelKeys.lists(), orgId] as const,
  cards: () => [...rsiMemberIntelKeys.all, 'card'] as const,
  card: (orgId: string, rsiHandle: string) =>
    [...rsiMemberIntelKeys.cards(), orgId, rsiHandle] as const,
  linkCandidates: (orgId: string, query?: string) =>
    [...rsiMemberIntelKeys.all, 'link-candidates', orgId, query] as const,
};

// Admin dashboard query keys
export const adminKeys = {
  all: ['admin'] as const,
  compliance: () => [...adminKeys.all, 'compliance'] as const,
  featureFlags: () => [...adminKeys.all, 'feature-flags'] as const,
  legalHolds: () => [...adminKeys.all, 'legal-holds'] as const,
  metrics: () => [...adminKeys.all, 'metrics'] as const,
  metricsTimeseries: () => [...adminKeys.all, 'metrics-timeseries'] as const,
  moderationAnalytics: () => [...adminKeys.all, 'moderation-analytics'] as const,
  deletionApprovals: () => [...adminKeys.all, 'deletion-approvals'] as const,
  performance: () => [...adminKeys.all, 'performance'] as const,
  securityLogs: () => [...adminKeys.all, 'security-logs'] as const,
  gdprRequests: () => [...adminKeys.all, 'gdpr-requests'] as const,
  operationsOverview: () => [...adminKeys.all, 'operations-overview'] as const,
};

// Global search query keys
export const globalSearchKeys = {
  all: ['globalSearch'] as const,
  search: (query: string, types?: string[]) => [...globalSearchKeys.all, query, types] as const,
};

// RSI Crawler query keys
export const rsiCrawlerKeys = {
  all: ['rsi-crawler'] as const,
  organization: (sid: string) => [...rsiCrawlerKeys.all, 'org', sid] as const,
  memberCountHistory: (sid: string) =>
    [...rsiCrawlerKeys.all, 'member-count-history', sid] as const,
};

// Badge / Title query keys (Gamification)
export const badgeKeys = {
  all: ['badges'] as const,
  lists: () => [...badgeKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...badgeKeys.lists(), filters] as const,
  details: () => [...badgeKeys.all, 'detail'] as const,
  detail: (id: string) => [...badgeKeys.details(), id] as const,
  userBadges: (userId: string) => [...badgeKeys.all, 'user', userId] as const,
  recipients: (achievementId: string) => [...badgeKeys.all, 'recipients', achievementId] as const,
};

// Treasury query keys
export const treasuryKeys = {
  all: ['treasury'] as const,
  balance: () => [...treasuryKeys.all, 'balance'] as const,
  transactions: (filters?: Record<string, unknown>) =>
    [...treasuryKeys.all, 'transactions', filters] as const,
  statistics: (period?: string) => [...treasuryKeys.all, 'statistics', period] as const,
  leaderboard: (limit?: number) => [...treasuryKeys.all, 'leaderboard', limit] as const,
  dues: () => [...treasuryKeys.all, 'dues'] as const,
  duesDetail: (id: string) => [...treasuryKeys.dues(), id] as const,
  commissary: () => [...treasuryKeys.all, 'commissary'] as const,
  commissaryList: (filters?: Record<string, unknown>) =>
    [...treasuryKeys.commissary(), 'list', filters] as const,
  commissaryDetail: (id: string) => [...treasuryKeys.commissary(), id] as const,
  purchases: (filters?: Record<string, unknown>) =>
    [...treasuryKeys.all, 'purchases', filters] as const,
};

// Loot distribution query keys
export const lootKeys = {
  all: ['loot'] as const,
  pools: (filters?: Record<string, unknown>) => [...lootKeys.all, 'pools', filters] as const,
  pool: (poolId: string) => [...lootKeys.all, 'pool', poolId] as const,
  participants: (poolId: string) => [...lootKeys.all, 'pool', poolId, 'participants'] as const,
};

// Discord guild settings query keys
export const discordSettingsKeys = {
  all: ['discord-settings'] as const,
  guild: (orgId: string, guildId: string) => [...discordSettingsKeys.all, orgId, guildId] as const,
};
