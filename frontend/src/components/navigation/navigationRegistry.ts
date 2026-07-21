/**
 * Navigation Route Registry
 *
 * Single source of truth for all application routes and navigation structure.
 * This registry is used to generate hubConfig, commandConfig, and breadcrumbConfig
 * automatically, ensuring consistency across the application.
 *
 * To add a new route:
 * 1. Add entry to routeRegistry below
 * 2. Configs auto-generate from registry
 * 3. No need to update multiple files
 */

import { findBestPathMatch } from './routeMatcher';
import { HubId } from './types';

import type { OrgRoleName } from '@/utils/roleUtils';

export interface RouteDefinition {
  // Core identifiers
  id: string;
  label: string;
  path: string;
  icon: string; // Spectrum icon name

  // Hub organization
  hub: HubId;
  category?: 'dashboard' | 'ops' | 'organization' | 'alliance' | 'community' | 'tools' | 'help';
  /** Section name within the hub sidebar (e.g. 'Planning', 'Communication'). Routes with sections are grouped visually. */
  section?: string;

  // Route properties
  requiresOrg?: boolean;
  adminOnly?: boolean;
  requiresRsiVerified?: boolean;
  requiresOrgOwner?: boolean;
  /** Minimum org role required (e.g. 'officer' means officer+ can access) */
  minRole?: OrgRoleName;
  disabledTooltip?: string;
  order?: number;

  // Feature discovery
  description?: string;
  keywords?: string[];
  shortcut?: string;

  // Config inclusion flags
  includeInHub?: boolean;
  includeInCommand?: boolean;
  includeInBreadcrumb?: boolean;

  // Breadcrumb config
  breadcrumbLabel?: string;
  breadcrumbPath?: string;

  // Action override
  action?: () => void;
}

/**
 * Complete registry of all application routes
 * Organized by hub for clarity
 *
 * Each route definition generates entries in:
 * - hubConfig: Hub sidebar items
 * - commandConfig: Command palette entries
 * - breadcrumbConfig: Breadcrumb routing rules
 */
export const routeRegistry: Record<string, RouteDefinition> = {
  // ============================================================================
  // DASHBOARD HUB
  // ============================================================================
  'dashboard-main': {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'Home',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'View your personal dashboard and quick stats',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 1,
  },
  'personal-hangar': {
    id: 'personal-hangar',
    label: 'Personal Hangar',
    path: '/hangar',
    icon: 'Box',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'View your personal ship collection',
    keywords: ['my ships', 'personal ships', 'ships'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 2,
  },
  inbox: {
    id: 'inbox',
    label: 'Inbox',
    path: '/inbox',
    icon: 'Inbox',
    hub: 'dashboard',
    category: 'dashboard',
    section: 'Communication',
    description: 'Messages, invitations, and support tickets',
    keywords: ['messages', 'inbox', 'contact', 'replies', 'invitations', 'tickets', 'diplomacy'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 3,
  },
  'tickets-hr': {
    id: 'tickets-hr',
    label: 'HR Tickets',
    path: '/tickets?category=hr',
    icon: 'Groups',
    hub: 'dashboard',
    category: 'dashboard',
    section: 'Communication',
    description: 'Open the HR ticket queue',
    keywords: ['tickets', 'hr', 'support', 'inbox'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 3.1,
  },
  'tickets-diplomacy': {
    id: 'tickets-diplomacy',
    label: 'Diplomacy Tickets',
    path: '/tickets?category=diplomacy',
    icon: 'Handshake',
    hub: 'dashboard',
    category: 'dashboard',
    section: 'Communication',
    description: 'Open the Diplomacy ticket queue',
    keywords: ['tickets', 'diplomacy', 'external relations', 'inbox'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 3.2,
  },
  scstats: {
    id: 'scstats',
    label: 'SCStats',
    path: '/scstats',
    icon: 'BarChart',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'Import and view your Star Citizen gameplay statistics',
    keywords: ['scstats', 'stats', 'gameplay', 'combat', 'kd', 'missions', 'hours'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 4,
  },

  // ============================================================================
  // OPS CENTER HUB \u2014 Fleet Section
  // ============================================================================
  'fleet-main': {
    id: 'fleet',
    label: 'Fleet',
    path: '/fleet',
    icon: 'ViewList',
    hub: 'ops',
    category: 'ops',
    section: 'Fleet',
    description: 'View and manage organization fleets',
    keywords: ['fleets', 'organization fleet'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 1,
  },
  'organization-ships': {
    id: 'organization-ships',
    label: 'Organization Ships',
    path: '/fleet/ships',
    icon: 'Box',
    hub: 'ops',
    category: 'ops',
    section: 'Fleet',
    description: 'View all ships in the organization',
    keywords: ['org ships', 'shared ships', 'fleet ships'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 2,
  },
  // Ship Loans: disabled — feature not production-ready (recoverable from git history)
  'ship-loadouts': {
    id: 'ship-loadouts',
    label: 'Ship Loadouts',
    path: '/shared-resources',
    icon: 'Globe',
    hub: 'ops',
    category: 'ops',
    section: 'Fleet',
    description: 'Manage and view ship loadout configurations',
    keywords: ['loadouts', 'ship configs', 'configurations'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 3,
  },
  'ship-comparison': {
    id: 'ship-comparison',
    label: 'Ship Comparison',
    path: '/fleet/compare',
    icon: 'CompareArrows',
    hub: 'ops',
    category: 'ops',
    section: 'Fleet',
    description: 'Compare ships side by side and analyze fleet composition',
    keywords: ['compare', 'comparison', 'ship analysis', 'versus', 'roles'],
    requiresOrg: true,
    disabledTooltip: 'Coming Soon™',
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 4,
  },

  // ============================================================================
  // OPS CENTER HUB
  // ============================================================================
  activities: {
    id: 'activities',
    label: 'Activities',
    path: '/activities',
    icon: 'Calendar',
    hub: 'ops',
    category: 'ops',
    section: 'Planning',
    description: 'View and join activities, events, and looking-for-group posts',
    keywords: ['activities', 'lfg', 'looking for group', 'missions', 'events', 'calendar'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 10,
  },
  'activities-calendar': {
    id: 'activities-calendar',
    label: 'Calendar',
    path: '/activities?tab=calendar',
    icon: 'Calendar',
    hub: 'ops',
    category: 'ops',
    section: 'Planning',
    description: 'Calendar view for activities and event scheduling',
    keywords: ['calendar', 'schedule', 'events', 'activities'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 10,
  },
  'activity-templates': {
    id: 'activity-templates',
    label: 'Activity Templates',
    path: '/activity-templates',
    icon: 'Assignment',
    hub: 'ops',
    category: 'ops',
    section: 'Planning',
    description: 'Create and manage reusable activity templates',
    keywords: ['templates', 'activity templates', 'presets'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 11,
  },
  // Calendar: removed from sidebar — now embedded as a tab in Activities page
  briefings: {
    id: 'briefings',
    label: 'Briefings',
    path: '/briefings',
    icon: 'Map',
    hub: 'ops',
    category: 'ops',
    section: 'Planning',
    description: 'Tactical briefings with maps and fleet icons',
    keywords: ['briefings', 'operations', 'missions', 'tactical', 'map'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 13,
  },
  'interdiction-planner': {
    id: 'interdiction-planner',
    label: 'Interdiction Planner',
    path: '/briefings/interdiction',
    icon: 'GpsFixed',
    hub: 'ops',
    category: 'ops',
    section: 'Planning',
    description: 'Plan quantum interdiction points with jump point maps',
    keywords: ['interdiction', 'snare', 'quantum', 'jump point', 'qed', 'intercept', 'ambush'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 14,
  },
  trading: {
    id: 'trading',
    label: 'Trading',
    path: '/trading',
    icon: 'Storefront',
    hub: 'ops',
    category: 'ops',
    section: 'Ledger',
    description: 'View and manage trading opportunities',
    keywords: ['trading', 'goods', 'commerce', 'market'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 40,
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    path: '/logistics',
    icon: 'Inventory2',
    hub: 'ops',
    category: 'ops',
    section: 'Ledger',
    description: 'Manage inventory and logistics',
    keywords: ['inventory', 'logistics', 'cargo', 'storage'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 41,
  },
  treasury: {
    id: 'treasury',
    label: 'Treasury',
    path: '/treasury',
    icon: 'AccountBalance',
    hub: 'ops',
    category: 'ops',
    section: 'Ledger',
    description: 'Manage organization credits, dues, and commissary',
    keywords: ['treasury', 'credits', 'balance', 'dues', 'commissary', 'finances', 'auec'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 42,
  },
  loot: {
    id: 'loot',
    label: 'Loot Distribution',
    path: '/loot',
    icon: 'MilitaryTech',
    hub: 'ops',
    category: 'ops',
    section: 'Ledger',
    description: 'Distribute mission loot via need/greed, bids, rolls, or even split',
    keywords: [
      'loot',
      'distribution',
      'spoils',
      'bid',
      'need',
      'greed',
      'roll',
      'commissary',
      'mission',
    ],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 43,
  },
  // Standalone mining page disabled — mining remains as activity type
  // mining: {
  //   id: 'mining',
  //   label: 'Mining',
  //   path: '/mining',
  //   icon: 'Construction',
  //   hub: 'ops',
  //   category: 'ops',
  //   description: 'Manage mining operations, crews, and resources',
  //   keywords: ['mining', 'resources', 'ore', 'extraction', 'crew'],
  //   includeInHub: true,
  //   includeInCommand: true,
  //   includeInBreadcrumb: true,
  //   order: 9,
  // },
  'intel-vault': {
    id: 'intel-vault',
    label: 'Intel Vault',
    path: '/intel',
    icon: 'Shield',
    hub: 'organization',
    category: 'organization',
    section: 'Intel',
    description: 'View and manage intelligence reports',
    keywords: ['intel', 'intelligence', 'vault', 'security'],
    requiresOrg: true,
    minRole: 'officer',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 4,
  },
  'intel-audit': {
    id: 'intel-audit',
    label: 'Member Audit',
    path: '/intel/audit',
    icon: 'Flag',
    hub: 'organization',
    category: 'organization',
    section: 'Intel',
    description: 'Audit flags, watchlist, member intel profiles, and RSI intelligence',
    keywords: ['audit', 'flags', 'watchlist', 'intel', 'member', 'security', 'intelligence', 'rsi'],
    requiresOrg: true,
    minRole: 'officer',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 5,
  },
  teams: {
    id: 'teams',
    label: 'Teams & Squads',
    path: '/teams',
    icon: 'Groups',
    hub: 'ops',
    category: 'ops',
    section: 'Tracking',
    keywords: ['teams', 'squads', 'divisions', 'units', 'roster'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 20,
  },
  missions: {
    id: 'missions',
    label: 'Operations',
    path: '/missions',
    icon: 'RocketLaunch',
    hub: 'ops',
    category: 'ops',
    section: 'Planning',
    keywords: ['missions', 'operations', 'objectives', 'ops'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 12,
  },
  bounties: {
    id: 'bounties',
    label: 'Bounties',
    path: '/bounties',
    icon: 'Target',
    hub: 'ops',
    category: 'ops',
    section: 'Communication',
    description: 'Create, manage, and claim bounties',
    keywords: ['bounties', 'rewards', 'claims', 'tasks', 'contracts'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 32,
  },
  lfg: {
    id: 'lfg',
    label: 'Looking For Group',
    path: '/lfg',
    icon: 'Groups',
    hub: 'ops',
    category: 'ops',
    section: 'Communication',
    description: 'Find players for any activity or create a group',
    keywords: ['lfg', 'looking for group', 'find players', 'group', 'session', 'play'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 33,
  },
  announcements: {
    id: 'announcements',
    label: 'Announcements',
    path: '/announcements',
    icon: 'Campaign',
    hub: 'ops',
    category: 'ops',
    section: 'Communication',
    description: 'Create, schedule, and publish announcements to Discord',
    keywords: ['announcements', 'broadcast', 'news', 'publish', 'discord'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 30,
  },
  polls: {
    id: 'polls',
    label: 'Polls',
    path: '/polls',
    icon: 'Poll',
    hub: 'ops',
    category: 'ops',
    section: 'Communication',
    keywords: ['polls', 'voting', 'survey', 'election', 'ballot'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 31,
  },
  attendance: {
    id: 'attendance',
    label: 'Attendance',
    path: '/attendance',
    icon: 'EventAvailable',
    hub: 'ops',
    category: 'ops',
    section: 'Tracking',
    keywords: ['attendance', 'events', 'leaderboard', 'reliability', 'check-in'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 21,
  },
  moderation: {
    id: 'moderation',
    label: 'Moderation',
    path: '/moderation',
    icon: 'Gavel',
    hub: 'organization',
    category: 'organization',
    description: 'Manage moderation incidents, repeat offenders, and cross-org sharing',
    keywords: ['moderation', 'blacklist', 'ban', 'kick', 'incidents', 'offenders'],
    requiresOrg: true,
    minRole: 'officer',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 6,
  },
  'org-settings': {
    id: 'org-settings',
    label: 'Organization Settings',
    path: '/org-settings',
    icon: 'Settings',
    hub: 'organization',
    category: 'organization',
    section: 'Management',
    description: 'Manage organization settings and configuration',
    keywords: ['settings', 'organization', 'config', 'administration'],
    requiresOrg: true,
    minRole: 'admin',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 9,
  },
  'org-members': {
    id: 'org-members',
    label: 'Members & Permissions',
    path: '/org-settings/members',
    icon: 'People',
    hub: 'organization',
    category: 'organization',
    section: 'Members',
    description: 'Manage organization member roles and permissions',
    keywords: ['members', 'roles', 'permissions', 'organization', 'manage'],
    requiresOrg: true,
    minRole: 'admin',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 1,
  },
  'org-hierarchy': {
    id: 'org-hierarchy',
    label: 'Org Hierarchy',
    path: '/org-settings/hierarchy',
    icon: 'AccountTree',
    hub: 'organization',
    category: 'organization',
    section: 'Members',
    description: 'View organization structure and member tiers',
    keywords: ['hierarchy', 'org chart', 'structure', 'divisions', 'departments', 'tiers'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 2,
  },
  'discord-settings': {
    id: 'discord-settings',
    label: 'Discord Integration',
    path: '/discord',
    icon: 'Discord',
    hub: 'organization',
    category: 'organization',
    section: 'Management',
    description: 'Configure Discord bot and integration settings',
    keywords: ['discord', 'bot', 'integration', 'chat', 'webhooks'],
    requiresOrg: true,
    minRole: 'admin',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 8,
  },
  'voice-server': {
    id: 'voice-server',
    label: 'Voice Servers',
    path: '/voice',
    icon: 'HeadsetMic',
    hub: 'organization',
    category: 'organization',
    section: 'Communication',
    description: 'Monitor voice server status, users, and activity statistics',
    keywords: ['voice', 'mumble', 'teamspeak', 'ventrilo', 'voip', 'comms', 'server'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 9,
  },
  'intel-officers': {
    id: 'intel-officers',
    label: 'Intel Officers',
    path: '/intel/officers',
    icon: 'SupervisorAccount',
    hub: 'organization',
    category: 'organization',
    description: 'Manage intel officers and their assignments',
    keywords: ['intel', 'officers', 'management', 'assignments'],
    requiresOrg: true,
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 6,
  },
  badges: {
    id: 'badges',
    label: 'Titles & Badges',
    path: '/badges',
    icon: 'MilitaryTech',
    hub: 'organization',
    category: 'organization',
    section: 'Management',
    description: 'Create and manage custom titles and badges for members',
    keywords: ['badges', 'titles', 'awards', 'achievements', 'gamification'],
    requiresOrg: true,
    minRole: 'officer',
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 7,
  },
  'bounty-profile': {
    id: 'bounty-profile',
    label: 'Bounty Hunter Profile',
    path: '/bounty/profile',
    icon: 'Target',
    hub: 'dashboard',
    category: 'tools',
    description: 'View your bounty hunter stats, reputation, and history',
    keywords: ['bounty', 'hunter', 'profile', 'reputation', 'stats'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 14,
  },

  // ============================================================================
  // COMMUNITY HUB
  // ============================================================================
  'directory-organizations': {
    id: 'directory-organizations',
    label: 'Organizations',
    path: '/directories?tab=organizations',
    icon: 'Organisations',
    hub: 'community',
    category: 'community',
    description: 'Browse public organizations and create your own',
    keywords: ['organizations', 'orgs', 'directory', 'public', 'browse', 'create'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 1,
  },
  'directory-alliances': {
    id: 'directory-alliances',
    label: 'Alliances',
    path: '/directories?tab=alliances',
    icon: 'Globe',
    hub: 'community',
    category: 'community',
    description: 'Browse public alliances and create your own',
    keywords: ['alliances', 'federations', 'directory', 'public', 'browse', 'create'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 2,
  },
  opportunities: {
    id: 'opportunities',
    label: 'Jobs & Opportunities',
    path: '/directories?tab=opportunities',
    icon: 'Work',
    hub: 'community',
    category: 'community',
    description: 'Discover jobs, services, and activities across organizations',
    keywords: [
      'opportunities',
      'jobs',
      'services',
      'activities',
      'hiring',
      'recruitment',
      'discover',
    ],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 3,
  },
  'community-members': {
    id: 'community-members',
    label: 'Members',
    path: '/directories?tab=members',
    icon: 'People',
    hub: 'community',
    category: 'community',
    description: 'Browse community members with public profiles',
    keywords: ['members', 'users', 'community', 'people', 'profiles', 'browse'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 4,
  },
  'public-stats': {
    id: 'public-stats',
    label: 'Platform Stats',
    path: '/directories?tab=stats',
    icon: 'BarChart',
    hub: 'community',
    category: 'community',
    description: 'View live platform-wide statistics',
    keywords: ['stats', 'statistics', 'platform', 'public', 'metrics', 'community'],
    disabledTooltip: 'Coming Soon™',
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 4,
  },
  diplomacy: {
    id: 'diplomacy',
    label: 'Relations',
    path: '/organizations',
    icon: 'Handshake',
    hub: 'alliance',
    category: 'alliance',
    description: 'Manage relations with other organizations',
    keywords: ['diplomacy', 'relations', 'orgs', 'organizations'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 3,
  },
  recruitment: {
    id: 'recruitment',
    label: 'Recruitment',
    path: '/recruitment',
    icon: 'Campaign',
    hub: 'community',
    category: 'community',
    description: 'Manage recruitment posts and review applicants',
    keywords: ['recruitment', 'hiring', 'applications', 'recruitment posts', 'applicants'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 5,
  },
  members: {
    id: 'members',
    label: 'User Management',
    path: '/users',
    icon: 'UserGroup',
    hub: 'community',
    category: 'community',
    description: 'Organization member directory (redirects to Members & Permissions)',
    keywords: ['members', 'users', 'people', 'team', 'user management'],
    adminOnly: true,
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 5,
  },
  wiki: {
    id: 'wiki',
    label: 'Wiki',
    path: '/wiki',
    icon: 'MenuBook',
    hub: 'organization',
    category: 'organization',
    section: 'Management',
    description: 'Organization knowledge base and documentation wiki',
    keywords: ['wiki', 'knowledge base', 'documentation', 'articles', 'pages', 'guides'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 7,
  },
  'federation-management': {
    id: 'federation-management',
    label: 'Federation Management',
    path: '/federation',
    icon: 'Handshake',
    hub: 'alliance',
    category: 'alliance',
    description: 'Manage alliances, federations, and inter-org coordination',
    keywords: ['federation', 'alliance', 'inter-org', 'coordination', 'coalition'],
    requiresOrg: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 10,
  },

  directories: {
    id: 'directories',
    label: 'Directories',
    path: '/directories',
    icon: 'Explore',
    hub: 'community',
    category: 'community',
    description: 'Browse organizations, alliances, and public directories',
    keywords: ['directories', 'browse', 'explore', 'organizations', 'alliances'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 0,
  },
  'admin-panel': {
    id: 'admin-panel',
    label: 'Admin Panel',
    path: '/admin',
    icon: 'AdminPanelSettings',
    hub: 'community',
    category: 'community',
    description: 'Platform administration and system management',
    keywords: ['admin', 'administration', 'system', 'management', 'platform'],
    adminOnly: true,
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 8,
  },

  // ============================================================================
  // HELP
  // ============================================================================
  'help-center': {
    id: 'help-center',
    label: 'Help Center',
    path: '/help',
    icon: 'HelpOutline',
    hub: 'dashboard',
    category: 'help',
    description: 'Browse FAQ and get help with SC Fleet Manager',
    keywords: ['help', 'faq', 'support', 'questions', 'how to', 'guide'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 99,
  },
  changelog: {
    id: 'changelog',
    label: 'Changelog',
    path: '/changelog',
    icon: 'NewReleases',
    hub: 'dashboard',
    category: 'help',
    description: 'View platform release notes and updates',
    keywords: ['changelog', 'release', 'updates', 'version', 'whats new'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 98,
  },

  // ============================================================================
  // PERSONAL / ACCOUNT (Dashboard Hub)
  // ============================================================================
  'user-profile': {
    id: 'user-profile',
    label: 'Profile',
    path: '/profile',
    icon: 'Person',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'View and edit your user profile',
    keywords: ['profile', 'user', 'avatar', 'bio'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 5,
  },
  notifications: {
    id: 'notifications',
    label: 'Notifications',
    path: '/notifications',
    icon: 'Notifications',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'View your notifications and alerts',
    keywords: ['notifications', 'alerts', 'updates'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 6,
  },
  'user-settings': {
    id: 'user-settings',
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    hub: 'dashboard',
    category: 'tools',
    description: 'Manage your account and application settings',
    keywords: ['settings', 'preferences', 'configuration'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 10,
  },
  'account-settings': {
    id: 'account-settings',
    label: 'Account Settings',
    path: '/account-settings',
    icon: 'ManageAccounts',
    hub: 'dashboard',
    category: 'tools',
    description: 'Manage your account details and linked accounts',
    keywords: ['account', 'settings', 'linked accounts', 'email'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 11,
  },
  'security-settings': {
    id: 'security-settings',
    label: 'Security',
    path: '/security',
    icon: 'Shield',
    hub: 'dashboard',
    category: 'tools',
    description: 'Manage two-factor authentication and security settings',
    keywords: ['security', '2fa', 'totp', 'password', 'authentication'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 12,
  },
  'privacy-settings': {
    id: 'privacy-settings',
    label: 'Privacy',
    path: '/privacy',
    icon: 'Lock',
    hub: 'dashboard',
    category: 'tools',
    description: 'Manage privacy settings and data preferences',
    keywords: ['privacy', 'data', 'gdpr', 'visibility'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 13,
  },
  'notification-preferences': {
    id: 'notification-preferences',
    label: 'Notification Preferences',
    path: '/notification-settings',
    icon: 'Notifications',
    hub: 'dashboard',
    category: 'tools',
    description: 'Configure notification channels and preferences',
    keywords: ['notification', 'preferences', 'email', 'push', 'alerts'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 14,
  },
  'api-keys': {
    id: 'api-keys',
    label: 'API Keys',
    path: '/api-keys',
    icon: 'VpnKey',
    hub: 'dashboard',
    category: 'tools',
    description: 'Manage API keys for third-party integrations',
    keywords: ['api', 'keys', 'tokens', 'integration', 'developer'],
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 15,
  },

  // ============================================================================
  // BOT DOCUMENTATION (Sprint 23-B)
  // ============================================================================
  'bot-commands': {
    id: 'bot-commands',
    label: 'Bot Commands',
    path: '/bot-commands',
    icon: 'Discord',
    hub: 'dashboard',
    category: 'help',
    description: 'Browse all available Discord bot commands and usage',
    keywords: ['bot', 'discord', 'commands', 'slash', 'help', 'reference'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 100,
  },

  // ============================================================================
  // MOBILE APP DOWNLOAD
  // ============================================================================
  'mobile-app': {
    id: 'mobile-app',
    label: 'Mobile App',
    path: '/mobile',
    icon: 'PhoneIphone',
    hub: 'dashboard',
    category: 'help',
    description: 'Download the Fringe Core companion app for Android',
    keywords: ['mobile', 'app', 'download', 'android', 'apk', 'phone'],
    includeInHub: true,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 97,
  },

  // ============================================================================
  // CROSS-SYSTEM ANALYTICS (Sprint 23-F)
  // ============================================================================
  'cross-system-analytics': {
    id: 'cross-system-analytics',
    label: 'Cross-System Analytics',
    path: '/analytics/cross-system',
    icon: 'Analytics',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'Crew formation trends, job placement rates, and LFG conversion metrics',
    keywords: ['analytics', 'crew', 'formation', 'placement', 'lfg', 'conversion', 'trends'],
    disabledTooltip: 'Coming Soon™',
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 45,
  },

  // ============================================================================
  // BOT STATISTICS (Sprint 26 — Gap Analysis)
  // ============================================================================
  'bot-stats': {
    id: 'bot-stats',
    label: 'Bot Statistics',
    path: '/analytics/bot-stats',
    icon: 'Discord',
    hub: 'dashboard',
    category: 'dashboard',
    description: 'Discord bot command usage, game presence, and activity heatmaps',
    keywords: ['bot', 'discord', 'commands', 'presence', 'games', 'heatmap', 'statistics'],
    disabledTooltip: 'Coming Soon™',
    includeInHub: false,
    includeInCommand: true,
    includeInBreadcrumb: true,
    order: 46,
  },
};

/**
 * Get route by ID
 */
export function getRoute(id: string): RouteDefinition | undefined {
  return Object.values(routeRegistry).find(route => route.id === id);
}

/**
 * Get all routes for a specific hub
 */
export function getHubRoutes(hub: HubId): RouteDefinition[] {
  return Object.values(routeRegistry)
    .filter(route => route.hub === hub && route.includeInHub !== false)
    .sort((a, b) => (a.order || 999) - (b.order || 999));
}

/**
 * Get all routes available in command palette
 */
export function getCommandRoutes(): RouteDefinition[] {
  return Object.values(routeRegistry)
    .filter(route => route.includeInCommand !== false)
    .sort((a, b) => (a.order || 999) - (b.order || 999));
}

/**
 * Get route by path
 */
export function getRouteByPath(path: string): RouteDefinition | undefined {
  return findBestPathMatch(Object.values(routeRegistry), path, {
    allowPrefixMatch: true,
    ignoreRouteSearch: false,
  });
}

/**
 * Get route by the current router location (pathname + search)
 */
export function getRouteByLocation(
  pathname: string,
  search: string = ''
): RouteDefinition | undefined {
  return findBestPathMatch(
    Object.values(routeRegistry),
    { pathname, search },
    {
      allowPrefixMatch: true,
      ignoreRouteSearch: false,
    }
  );
}

/**
 * Check if route requires organization
 */
export function requiresOrganization(routeId: string): boolean {
  const route = getRoute(routeId);
  return route?.requiresOrg ?? false;
}

/**
 * Get all hub IDs in order
 */
export function getHubIds(): HubId[] {
  const hubs = new Set<HubId>();
  Object.values(routeRegistry).forEach(route => hubs.add(route.hub));
  return Array.from(hubs);
}

/**
 * Count routes by hub
 */
export function getRouteCountByHub(): Record<HubId, number> {
  const counts: Record<HubId, number> = {} as Record<HubId, number>;
  getHubIds().forEach(hub => {
    counts[hub] = getHubRoutes(hub).length;
  });
  return counts;
}
