/**
 * Permission Registry
 *
 * Centralized registry of all permissions in the SC Fleet Manager system.
 * Permissions follow the format: "resource:action" or "resource:*" for wildcards
 *
 * Usage:
 * - Import PERMISSIONS to get all permission strings
 * - Import PERMISSION_DESCRIPTIONS for human-readable descriptions
 * - Import PERMISSION_CATEGORIES to group permissions by resource
 */

/**
 * System-wide permissions (not organization-specific)
 */
export const SYSTEM_PERMISSIONS = {
  /** Full system access - admin only */
  ALL: 'system:*',
  /** Manage system-wide settings */
  SETTINGS: 'system:settings',
  /** View system health and metrics */
  HEALTH: 'system:health',
  /** Manage system users */
  USERS: 'system:users',
  /** View audit logs */
  AUDIT: 'system:audit',
} as const;

/**
 * Organization permissions
 */
export const ORGANIZATION_PERMISSIONS = {
  /** All organization permissions */
  ALL: 'org:*',
  /** View organization details */
  READ: 'org:read',
  /** Update organization settings */
  WRITE: 'org:write',
  /** Delete organization */
  DELETE: 'org:delete',
  /** Manage organization settings */
  SETTINGS_READ: 'org:settings:read',
  SETTINGS_WRITE: 'org:settings:write',
  /** Manage organization members */
  MEMBERS_READ: 'org:members:read',
  MEMBERS_INVITE: 'org:members:invite',
  MEMBERS_REMOVE: 'org:members:remove',
  MEMBERS_EDIT: 'org:members:edit',
  /** Manage organization roles */
  ROLES_READ: 'org:roles:read',
  ROLES_CREATE: 'org:roles:create',
  ROLES_EDIT: 'org:roles:edit',
  ROLES_DELETE: 'org:roles:delete',
  /** Manage permissions */
  PERMISSIONS_READ: 'org:permissions:read',
  PERMISSIONS_MANAGE: 'org:permissions:manage',
} as const;

/**
 * Member permissions (for organization members)
 */
export const MEMBER_PERMISSIONS = {
  /** All member permissions */
  ALL: 'member:*',
  /** View members */
  READ: 'member:read',
  /** Invite new members */
  INVITE: 'member:invite',
  /** Remove members */
  REMOVE: 'member:remove',
  /** Edit member details */
  EDIT: 'member:edit',
  /** Assign roles to members */
  ASSIGN_ROLE: 'member:assign_role',
} as const;

/**
 * Event/Activity permissions
 */
export const EVENT_PERMISSIONS = {
  /** All event permissions */
  ALL: 'event:*',
  /** View events */
  READ: 'event:read',
  /** Create new events */
  CREATE: 'event:create',
  /** Edit events */
  EDIT: 'event:edit',
  /** Delete events */
  DELETE: 'event:delete',
  /** RSVP to events */
  RSVP: 'event:rsvp',
  /** Manage event attendees */
  MANAGE_ATTENDEES: 'event:manage_attendees',
} as const;

/**
 * Fleet permissions
 */
export const FLEET_PERMISSIONS = {
  /** All fleet permissions */
  ALL: 'fleet:*',
  /** View fleet information */
  READ: 'fleet:read',
  /** Create fleet */
  CREATE: 'fleet:create',
  /** Edit fleet details */
  EDIT: 'fleet:edit',
  /** Delete fleet */
  DELETE: 'fleet:delete',
  /** Manage fleet members */
  MANAGE_MEMBERS: 'fleet:manage_members',
  /** Manage fleet ships */
  MANAGE_SHIPS: 'fleet:manage_ships',
} as const;

/**
 * Ship permissions
 */
export const SHIP_PERMISSIONS = {
  /** All ship permissions */
  ALL: 'ship:*',
  /** View ships */
  READ: 'ship:read',
  /** Add new ships */
  CREATE: 'ship:create',
  /** Edit ship details */
  EDIT: 'ship:edit',
  /** Delete ships */
  DELETE: 'ship:delete',
  /** Share ships with organization */
  SHARE: 'ship:share',
} as const;

/**
 * Intel/Intelligence permissions
 */
export const INTEL_PERMISSIONS = {
  /** All intel permissions */
  ALL: 'intel:*',
  /** View intel reports */
  READ: 'intel:read',
  /** Create intel reports */
  CREATE: 'intel:create',
  /** Edit intel reports */
  EDIT: 'intel:edit',
  /** Delete intel reports */
  DELETE: 'intel:delete',
  /** Manage intel classifications */
  MANAGE_CLASSIFICATION: 'intel:manage_classification',
  /** View member audit flags */
  AUDIT_VIEW: 'intel:audit:view',
  /** Create manual audit flags */
  AUDIT_CREATE: 'intel:audit:create',
  /** Resolve/dismiss/escalate audit flags */
  AUDIT_RESOLVE: 'intel:audit:resolve',
  /** View organization watchlist */
  WATCHLIST_VIEW: 'intel:watchlist:view',
  /** Manage (add/edit/remove) watchlist entries */
  WATCHLIST_MANAGE: 'intel:watchlist:manage',
} as const;

/**
 * Resource permissions (equipment, materials, etc.)
 */
export const RESOURCE_PERMISSIONS = {
  /** All resource permissions */
  ALL: 'resource:*',
  /** View resources */
  READ: 'resource:read',
  /** Create resource entries */
  CREATE: 'resource:create',
  /** Edit resource entries */
  EDIT: 'resource:edit',
  /** Delete resource entries */
  DELETE: 'resource:delete',
  /** Manage resource allocation */
  MANAGE: 'resource:manage',
} as const;

/**
 * Profile permissions (user profile)
 */
export const PROFILE_PERMISSIONS = {
  /** View own profile */
  READ: 'profile:read',
  /** Edit own profile */
  WRITE: 'profile:write',
} as const;

/**
 * Settings permissions (user settings)
 */
export const SETTINGS_PERMISSIONS = {
  /** All settings permissions */
  ALL: 'settings:*',
  /** View settings */
  READ: 'settings:read',
  /** Modify settings */
  WRITE: 'settings:write',
} as const;

/**
 * Announcement permissions
 */
export const ANNOUNCEMENT_PERMISSIONS = {
  /** All announcement permissions */
  ALL: 'announcement:*',
  /** View announcements */
  READ: 'announcement:read',
  /** Create announcements */
  CREATE: 'announcement:create',
  /** Edit announcements */
  EDIT: 'announcement:edit',
  /** Delete announcements */
  DELETE: 'announcement:delete',
} as const;

/**
 * Discord integration permissions
 */
export const DISCORD_PERMISSIONS = {
  /** All Discord permissions */
  ALL: 'discord:*',
  /** Configure Discord integration */
  CONFIGURE: 'discord:configure',
  /** Manage Discord sync */
  SYNC: 'discord:sync',
} as const;

/**
 * Wiki permissions
 */
export const WIKI_PERMISSIONS = {
  /** All wiki permissions */
  ALL: 'wiki:*',
  /** View wiki pages */
  READ: 'wiki:read',
  /** Create wiki pages */
  CREATE: 'wiki:create',
  /** Edit wiki pages */
  EDIT: 'wiki:edit',
  /** Delete wiki pages */
  DELETE: 'wiki:delete',
  /** Manage wiki tree structure */
  MANAGE_TREE: 'wiki:manage_tree',
  /** Restore wiki page revisions */
  RESTORE_REVISION: 'wiki:restore_revision',
} as const;

/**
 * RSI (Roberts Space Industries) integration permissions
 */
export const RSI_PERMISSIONS = {
  /** All RSI permissions */
  ALL: 'rsi:*',
  /** View RSI data */
  READ: 'rsi:read',
  /** Sync with RSI */
  SYNC: 'rsi:sync',
  /** Verify RSI account */
  VERIFY: 'rsi:verify',
} as const;

/**
 * Combined PERMISSIONS object with all permissions
 */
export const PERMISSIONS = {
  SYSTEM: SYSTEM_PERMISSIONS,
  ORG: ORGANIZATION_PERMISSIONS,
  MEMBER: MEMBER_PERMISSIONS,
  EVENT: EVENT_PERMISSIONS,
  FLEET: FLEET_PERMISSIONS,
  SHIP: SHIP_PERMISSIONS,
  INTEL: INTEL_PERMISSIONS,
  RESOURCE: RESOURCE_PERMISSIONS,
  PROFILE: PROFILE_PERMISSIONS,
  SETTINGS: SETTINGS_PERMISSIONS,
  ANNOUNCEMENT: ANNOUNCEMENT_PERMISSIONS,
  DISCORD: DISCORD_PERMISSIONS,
  RSI: RSI_PERMISSIONS,
  WIKI: WIKI_PERMISSIONS,
} as const;

/**
 * Flattened array of all permission strings
 */
export const ALL_PERMISSIONS = [
  ...Object.values(SYSTEM_PERMISSIONS),
  ...Object.values(ORGANIZATION_PERMISSIONS),
  ...Object.values(MEMBER_PERMISSIONS),
  ...Object.values(EVENT_PERMISSIONS),
  ...Object.values(FLEET_PERMISSIONS),
  ...Object.values(SHIP_PERMISSIONS),
  ...Object.values(INTEL_PERMISSIONS),
  ...Object.values(RESOURCE_PERMISSIONS),
  ...Object.values(PROFILE_PERMISSIONS),
  ...Object.values(SETTINGS_PERMISSIONS),
  ...Object.values(ANNOUNCEMENT_PERMISSIONS),
  ...Object.values(DISCORD_PERMISSIONS),
  ...Object.values(RSI_PERMISSIONS),
  ...Object.values(WIKI_PERMISSIONS),
] as const;

/**
 * Permission descriptions for UI/documentation
 */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // System
  'system:*': 'Full system administrator access',
  'system:settings': 'Manage system-wide settings',
  'system:health': 'View system health and metrics',
  'system:users': 'Manage system users',
  'system:audit': 'View audit logs',

  // Organization
  'org:*': 'All organization permissions',
  'org:read': 'View organization details',
  'org:write': 'Update organization settings',
  'org:delete': 'Delete organization',
  'org:settings:read': 'View organization settings',
  'org:settings:write': 'Manage organization settings',
  'org:members:read': 'View organization members',
  'org:members:invite': 'Invite new members',
  'org:members:remove': 'Remove members',
  'org:members:edit': 'Edit member details',
  'org:roles:read': 'View roles',
  'org:roles:create': 'Create custom roles',
  'org:roles:edit': 'Edit roles',
  'org:roles:delete': 'Delete roles',
  'org:permissions:read': 'View permissions',
  'org:permissions:manage': 'Manage permissions',

  // Members
  'member:*': 'All member management permissions',
  'member:read': 'View members',
  'member:invite': 'Invite new members',
  'member:remove': 'Remove members',
  'member:edit': 'Edit member details',
  'member:assign_role': 'Assign roles to members',

  // Events
  'event:*': 'All event permissions',
  'event:read': 'View events',
  'event:create': 'Create new events',
  'event:edit': 'Edit events',
  'event:delete': 'Delete events',
  'event:rsvp': 'RSVP to events',
  'event:manage_attendees': 'Manage event attendees',

  // Fleet
  'fleet:*': 'All fleet permissions',
  'fleet:read': 'View fleet information',
  'fleet:create': 'Create fleets',
  'fleet:edit': 'Edit fleet details',
  'fleet:delete': 'Delete fleets',
  'fleet:manage_members': 'Manage fleet members',
  'fleet:manage_ships': 'Manage fleet ships',

  // Ships
  'ship:*': 'All ship permissions',
  'ship:read': 'View ships',
  'ship:create': 'Add new ships',
  'ship:edit': 'Edit ship details',
  'ship:delete': 'Delete ships',
  'ship:share': 'Share ships with organization',

  // Intel
  'intel:*': 'All intelligence permissions',
  'intel:read': 'View intel reports',
  'intel:create': 'Create intel reports',
  'intel:edit': 'Edit intel reports',
  'intel:delete': 'Delete intel reports',
  'intel:manage_classification': 'Manage intel classifications',
  'intel:audit:view': 'View member audit flags',
  'intel:audit:create': 'Create manual audit flags',
  'intel:audit:resolve': 'Resolve, dismiss, or escalate audit flags',
  'intel:watchlist:view': 'View organization watchlist',
  'intel:watchlist:manage': 'Manage watchlist entries (add, edit, remove)',

  // Resources
  'resource:*': 'All resource permissions',
  'resource:read': 'View resources',
  'resource:create': 'Create resource entries',
  'resource:edit': 'Edit resource entries',
  'resource:delete': 'Delete resource entries',
  'resource:manage': 'Manage resource allocation',

  // Profile
  'profile:read': 'View own profile',
  'profile:write': 'Edit own profile',

  // Settings
  'settings:*': 'All settings permissions',
  'settings:read': 'View settings',
  'settings:write': 'Modify settings',

  // Announcements
  'announcement:*': 'All announcement permissions',
  'announcement:read': 'View announcements',
  'announcement:create': 'Create announcements',
  'announcement:edit': 'Edit announcements',
  'announcement:delete': 'Delete announcements',

  // Wiki
  'wiki:*': 'All wiki permissions',
  'wiki:read': 'View wiki pages',
  'wiki:create': 'Create wiki pages',
  'wiki:edit': 'Edit wiki pages',
  'wiki:delete': 'Delete wiki pages',
  'wiki:manage_tree': 'Manage wiki tree structure',
  'wiki:restore_revision': 'Restore wiki page revisions',

  // Discord
  'discord:*': 'All Discord integration permissions',
  'discord:configure': 'Configure Discord integration',
  'discord:sync': 'Sync with Discord',

  // RSI
  'rsi:*': 'All RSI integration permissions',
  'rsi:read': 'View RSI data',
  'rsi:sync': 'Sync with RSI',
  'rsi:verify': 'Verify RSI account',
};

/**
 * Permission categories for UI grouping
 */
export const PERMISSION_CATEGORIES = {
  system: {
    label: 'System',
    permissions: SYSTEM_PERMISSIONS,
    description: 'System-wide administrative permissions',
  },
  organization: {
    label: 'Organization',
    permissions: ORGANIZATION_PERMISSIONS,
    description: 'Organization management permissions',
  },
  members: {
    label: 'Members',
    permissions: MEMBER_PERMISSIONS,
    description: 'Member management permissions',
  },
  events: {
    label: 'Events',
    permissions: EVENT_PERMISSIONS,
    description: 'Event and activity permissions',
  },
  fleet: {
    label: 'Fleet',
    permissions: FLEET_PERMISSIONS,
    description: 'Fleet management permissions',
  },
  ships: {
    label: 'Ships',
    permissions: SHIP_PERMISSIONS,
    description: 'Ship management permissions',
  },
  intel: {
    label: 'Intelligence',
    permissions: INTEL_PERMISSIONS,
    description: 'Intelligence and reports permissions',
  },
  resources: {
    label: 'Resources',
    permissions: RESOURCE_PERMISSIONS,
    description: 'Resource management permissions',
  },
  profile: {
    label: 'Profile',
    permissions: PROFILE_PERMISSIONS,
    description: 'User profile permissions',
  },
  settings: {
    label: 'Settings',
    permissions: SETTINGS_PERMISSIONS,
    description: 'Settings management permissions',
  },
  announcements: {
    label: 'Announcements',
    permissions: ANNOUNCEMENT_PERMISSIONS,
    description: 'Announcement permissions',
  },
  wiki: {
    label: 'Wiki',
    permissions: WIKI_PERMISSIONS,
    description: 'Wiki page management permissions',
  },
  integrations: {
    label: 'Integrations',
    permissions: { ...DISCORD_PERMISSIONS, ...RSI_PERMISSIONS },
    description: 'Third-party integration permissions',
  },
} as const;

/**
 * Helper function to check if a permission string is valid
 */
export function isValidPermission(permission: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ALL_PERMISSIONS.includes(permission as any);
}

/**
 * Helper function to get permission description
 */
export function getPermissionDescription(permission: string): string {
  return PERMISSION_DESCRIPTIONS[permission] || 'Unknown permission';
}

/**
 * Type for all permission strings
 */
export type PermissionString = (typeof ALL_PERMISSIONS)[number];

/**
 * Type for permission categories
 */
export type PermissionCategory = keyof typeof PERMISSION_CATEGORIES;
