import type { Role } from '../models/Role';

/** Accepts a Role entity, string name, null, or undefined */
type RoleInput = Role | string | null | undefined;

/**
 * Extract role name from a Role entity or string.
 * Backward-compatible: handles both old entity-based and new string-based roles.
 * Role is now a plain string column (no longer a TypeORM relation).
 * This helper remains for backward compatibility in case any code still passes a Role entity.
 */
export function getRoleName(role: RoleInput): string {
  if (!role) {
    return '';
  }
  if (typeof role === 'string') {
    return role.toLowerCase();
  }
  return (role.name ?? '').toLowerCase();
}

/**
 * Default permissions for each organization role.
 * Used when the Role entity/table doesn't exist — permissions are inferred from role name.
 */
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  founder: ['*'],
  owner: ['*'], // Legacy alias for founder
  admin: ['org:*', 'fleet:*', 'member:*', 'activity:*', 'intel:*', 'settings:*'],
  senior_officer: [
    'fleet:read',
    'fleet:create',
    'fleet:edit',
    'fleet:manage_members',
    'fleet:manage_ships',
    'member:read',
    'activity:read',
    'activity:create',
    'activity:edit',
    'intel:read',
  ],
  fleet_commander: [
    // Legacy alias for senior_officer
    'fleet:read',
    'fleet:create',
    'fleet:edit',
    'fleet:manage_members',
    'fleet:manage_ships',
    'member:read',
    'activity:read',
    'activity:create',
    'activity:edit',
    'intel:read',
  ],
  officer: [
    'fleet:read',
    'fleet:create',
    'member:read',
    'activity:read',
    'activity:create',
    'intel:read',
  ],
  member: ['fleet:read', 'member:read', 'activity:read', 'activity:create'],
  recruit: ['fleet:read', 'member:read', 'activity:read'],
};

/**
 * Get the default permissions for a role name.
 * Falls back to member permissions for unknown roles.
 */
export function getDefaultPermissionsForRole(roleName: string): string[] {
  return (
    DEFAULT_ROLE_PERMISSIONS[roleName.toLowerCase()] || DEFAULT_ROLE_PERMISSIONS['member'] || []
  );
}

/**
 * Get role priority (higher = more privileged).
 */
export function getRolePriority(roleName: string): number {
  const priorities: Record<string, number> = {
    founder: 100,
    owner: 100,
    admin: 80,
    senior_officer: 60,
    fleet_commander: 60, // Legacy alias
    officer: 40,
    member: 10,
    recruit: 5,
  };
  return priorities[roleName.toLowerCase()] || 0;
}

/**
 * Roles that carry owner-level privileges.
 * 'founder' is the default role for organization creators; 'owner' is the legacy equivalent.
 */
const OWNER_ROLES = new Set(['owner', 'founder']);

/**
 * Roles that carry at least admin-level privileges (owner + admin).
 */
const ADMIN_ROLES = new Set(['owner', 'founder', 'admin']);

/**
 * Check whether a role name has owner-level privilege.
 * Accepts both the modern 'founder' role and the legacy 'owner' role.
 */
export function isOwnerRole(role: RoleInput): boolean {
  return OWNER_ROLES.has(getRoleName(role));
}

/**
 * Check whether a role name has at least admin-level privilege (owner, founder, or admin).
 */
export function isOwnerOrAdminRole(role: RoleInput): boolean {
  return ADMIN_ROLES.has(getRoleName(role));
}
