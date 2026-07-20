/**
 * Organization Role Utilities
 *
 * Single source of truth for role hierarchy and role checks on the frontend.
 * Mirrors backend/src/utils/roleUtils.ts priorities.
 */

/** Valid organization role names */
export type OrgRoleName =
  | 'founder'
  | 'owner'
  | 'admin'
  | 'senior_officer'
  | 'fleet_commander'
  | 'officer'
  | 'member'
  | 'recruit';

/**
 * Role priority map — higher number = more privileged.
 * Must stay in sync with backend/src/utils/roleUtils.ts getRolePriority().
 */
export const ORG_ROLE_PRIORITIES: Record<string, number> = {
  founder: 100,
  owner: 100,
  admin: 80,
  senior_officer: 60,
  fleet_commander: 60,
  officer: 40,
  member: 10,
  recruit: 5,
};

/**
 * Check whether a user's org role meets or exceeds the required minimum role.
 * Returns false for unknown roles (fail-closed).
 */
export function meetsMinOrgRole(userOrgRole: string | undefined, minRole: string): boolean {
  if (!userOrgRole) return false;
  const userPriority = ORG_ROLE_PRIORITIES[userOrgRole.toLowerCase()] ?? 0;
  const requiredPriority = ORG_ROLE_PRIORITIES[minRole.toLowerCase()];
  // Fail-closed: if minRole is unknown, deny access
  if (requiredPriority === undefined) return false;
  return userPriority >= requiredPriority;
}

/** Whether a given org role is founder or owner (top-level org roles). */
export function isOwnerOrFounderRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'owner' || r === 'founder';
}
