import { Repository } from 'typeorm';

import { AppDataSource } from '../../../config/database';
import {
  OrganizationPermission,
  PermissionAction,
  ResourceType,
} from '../../../models/OrganizationPermission';
import { Role } from '../../../models/Role';
import { logger } from '../../../utils/logger';
import { getDefaultPermissionsForRole } from '../../../utils/roleUtils';

/**
 * Role Service
 * Centralized service for role management and lookups
 * Supports the Role entity migration
 */
export class RoleService {
  private readonly roleRepository: Repository<Role>;
  private readonly roleCache: Map<string, Role> = new Map();
  private readonly roleCacheByName: Map<string, Map<string, Role>> = new Map();

  constructor() {
    this.roleRepository = AppDataSource.getRepository(Role);
  }

  /**
   * Get a role by ID
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    if (this.roleCache.has(roleId)) {
      return this.roleCache.get(roleId) ?? null;
    }

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (role) {
      this.roleCache.set(roleId, role);
    }
    return role;
  }

  /**
   * Get a role by name and organization
   * @param name - Role name (e.g., 'owner', 'admin', 'member')
   * @param organizationId - Organization ID (null for system roles)
   */
  async getRoleByName(name: string, organizationId: string | null = null): Promise<Role | null> {
    const cacheKey = organizationId ?? 'system';
    const orgCache = this.roleCacheByName.get(cacheKey);

    if (orgCache?.has(name)) {
      return orgCache.get(name) ?? null;
    }

    const role = await this.roleRepository.findOne({
      where: { name, organizationId: organizationId ?? undefined },
    });

    if (role) {
      if (!this.roleCacheByName.has(cacheKey)) {
        this.roleCacheByName.set(cacheKey, new Map());
      }
      this.roleCacheByName.get(cacheKey)?.set(name, role);
      this.roleCache.set(role.id, role);
    }

    return role;
  }

  /**
   * Get role ID by name and organization
   * Convenience method for queries that only need the ID
   */
  async getRoleIdByName(
    name: string,
    organizationId: string | null = null
  ): Promise<string | null> {
    const role = await this.getRoleByName(name, organizationId);
    return role?.id ?? null;
  }

  /**
   * Get or create a role for an organization
   * Used during organization initialization
   */
  async getOrCreateRole(
    name: string,
    organizationId: string | null,
    description?: string,
    permissions?: string[],
    priority?: number
  ): Promise<Role> {
    let role = await this.getRoleByName(name, organizationId);

    if (!role) {
      role = this.roleRepository.create({
        name,
        organizationId,
        description,
        permissions,
        priority,
        isSystemRole: organizationId === null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as unknown as Role;
      await this.roleRepository.save(role);

      // Update cache
      this.roleCache.set(role.id, role);
      const cacheKey = organizationId ?? 'system';
      if (!this.roleCacheByName.has(cacheKey)) {
        this.roleCacheByName.set(cacheKey, new Map());
      }
      this.roleCacheByName.get(cacheKey)?.set(name, role);
    }

    return role;
  }

  /**
   * Get default member role for an organization
   */
  async getDefaultMemberRole(organizationId: string): Promise<Role> {
    return this.getOrCreateRole(
      'member',
      organizationId,
      'Standard organization member',
      undefined,
      10
    );
  }

  /**
   * Get the lowest-priority role for an organization to use as a fallback
   * default member role. Used when the conventional 'member' role has been
   * renamed or removed by the org admin (e.g. replaced with 'associate').
   *
   * Returns null only if the org has no roles at all.
   */
  async getFallbackMemberRoleId(organizationId: string): Promise<string | null> {
    const role = await this.roleRepository.findOne({
      where: { organizationId },
      order: { priority: 'ASC' },
    });
    return role?.id ?? null;
  }

  /**
   * Resolve a role name to an ID for an organization. If the requested role
   * does not exist (because the org renamed or removed it — e.g. 'member'
   * replaced with 'associate'), fall back to the lowest-priority role in the
   * org so membership operations remain robust against custom role schemes.
   *
   * Returns null only if the org has no roles at all.
   */
  async resolveRoleIdWithDefaultFallback(
    name: string,
    organizationId: string
  ): Promise<string | null> {
    const direct = await this.getRoleIdByName(name, organizationId);
    if (direct) {
      return direct;
    }
    const fallbackId = await this.getFallbackMemberRoleId(organizationId);
    if (fallbackId) {
      logger.warn(
        'RoleService.resolveRoleIdWithDefaultFallback — requested role missing; using lowest-priority role as fallback',
        { organizationId, requestedRole: name, fallbackRoleId: fallbackId }
      );
      return fallbackId;
    }
    return null;
  }

  /**
   * Get owner/founder role for an organization.
   * Returns 'founder' for new orgs; backward-compatible with legacy 'owner' role.
   */
  async getOwnerRole(organizationId: string): Promise<Role> {
    // Try founder first, fall back to owner for legacy orgs
    const founder = await this.getRoleByName('founder', organizationId);
    if (founder) {
      return founder;
    }
    return this.getOrCreateRole('founder', organizationId, 'Organization founder', undefined, 100);
  }

  /**
   * Get admin role for an organization
   */
  async getAdminRole(organizationId: string): Promise<Role> {
    return this.getOrCreateRole(
      'admin',
      organizationId,
      'Organization administrator',
      undefined,
      80
    );
  }

  /**
   * Get recruit role for an organization (lowest tier)
   */
  async getRecruitRole(organizationId: string): Promise<Role> {
    return this.getOrCreateRole(
      'recruit',
      organizationId,
      'New recruit — probationary member',
      undefined,
      5
    );
  }

  /**
   * Check if a role name matches
   * Handles both Role entity and role name string
   */
  roleNameEquals(role: Role | string | undefined, targetName: string): boolean {
    if (!role) {
      return false;
    }
    if (typeof role === 'string') {
      return role === targetName;
    }
    return role.name === targetName;
  }

  /**
   * Seed OrganizationPermission rows from the hardcoded default permissions
   * for a given role in an organization. This converts static role-permission
   * mappings into database-backed grants, enabling per-org customization.
   *
   * Skips permissions that already exist to be idempotent.
   */
  async seedDefaultRolePermissions(organizationId: string, role: Role): Promise<number> {
    const permRepo = AppDataSource.getRepository(OrganizationPermission);
    const defaults = getDefaultPermissionsForRole(role.name);
    let created = 0;

    for (const permKey of defaults) {
      const [resource, action] = permKey.split(':');
      if (!resource || !action) {
        continue;
      }

      // Check if this role-permission binding already exists
      const existing = await permRepo.findOne({
        where: {
          organizationId,
          roleId: role.id,
          resource: resource as ResourceType,
          isActive: true,
        },
      });

      if (existing) {
        // Add the action if not already present
        const actionUpper = action.toUpperCase() as PermissionAction;
        if (action === '*') {
          if (!existing.actions.includes(PermissionAction.ALL)) {
            existing.actions.push(PermissionAction.ALL);
            await permRepo.save(existing);
          }
        } else if (!existing.actions.includes(actionUpper)) {
          existing.actions.push(actionUpper);
          await permRepo.save(existing);
        }
        continue;
      }

      const actionUpper =
        action === '*' ? PermissionAction.ALL : (action.toUpperCase() as PermissionAction);
      const perm = permRepo.create({
        organizationId,
        roleId: role.id,
        resource: resource as ResourceType,
        actions: [actionUpper],
        isActive: true,
        priority: 1,
        inheritable: true,
        inherited: false,
        reason: `Seeded from default ${role.name} permissions`,
      });
      await permRepo.save(perm);
      created++;
    }

    return created;
  }

  /**
   * Seed default role permissions for ALL roles of an organization.
   * Called during org initialization or data migration.
   */
  async seedAllRolePermissions(organizationId: string): Promise<number> {
    const roles = await this.roleRepository.find({
      where: { organizationId },
    });

    let totalCreated = 0;
    for (const role of roles) {
      const count = await this.seedDefaultRolePermissions(organizationId, role);
      totalCreated += count;
    }

    logger.info(`Seeded ${totalCreated} role permissions for org ${organizationId}`);
    return totalCreated;
  }

  /**
   * Get all roles for an organization, including member counts
   */
  async getOrganizationRolesWithCounts(
    organizationId: string
  ): Promise<Array<Role & { memberCount: number }>> {
    const roles = await this.roleRepository.find({
      where: { organizationId },
      order: { priority: 'DESC' },
    });

    const membershipRepo = AppDataSource.getRepository('OrganizationMembership');

    const rolesWithCounts = await Promise.all(
      roles.map(async role => {
        const memberCount = await membershipRepo.count({
          where: { organizationId, roleId: role.id, isActive: true },
        });
        return { ...role, memberCount };
      })
    );

    return rolesWithCounts;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.roleCache.clear();
    this.roleCacheByName.clear();
  }

  /**
   * Initialize standard roles for an organization and seed their default permissions.
   *
   * Hierarchy (lowest → highest priority):
   *   recruit (5) → member (10) → officer (40) → senior_officer (60) → admin (80) → founder (100)
   */
  async initializeOrganizationRoles(organizationId: string): Promise<{
    founder: Role;
    admin: Role;
    senior_officer: Role;
    officer: Role;
    member: Role;
    recruit: Role;
  }> {
    const [founder, admin, senior_officer, officer, member, recruit] = await Promise.all([
      this.getOrCreateRole(
        'founder',
        organizationId,
        'Organization founder with full control',
        undefined,
        100
      ),
      this.getOrCreateRole('admin', organizationId, 'Organization administrator', undefined, 80),
      this.getOrCreateRole(
        'senior_officer',
        organizationId,
        'Senior officer — fleet and team management',
        undefined,
        60
      ),
      this.getOrCreateRole(
        'officer',
        organizationId,
        'Officer — operational leadership',
        undefined,
        40
      ),
      this.getOrCreateRole('member', organizationId, 'Standard organization member', undefined, 10),
      this.getOrCreateRole(
        'recruit',
        organizationId,
        'New recruit — probationary member',
        undefined,
        5
      ),
    ]);

    // Seed default permissions into OrganizationPermission rows
    await Promise.all([
      this.seedDefaultRolePermissions(organizationId, admin),
      this.seedDefaultRolePermissions(organizationId, senior_officer),
      this.seedDefaultRolePermissions(organizationId, officer),
      this.seedDefaultRolePermissions(organizationId, member),
      this.seedDefaultRolePermissions(organizationId, recruit),
    ]);
    // Founder gets wildcard via checkRoleBasedPermission — no need to seed

    return { founder, admin, senior_officer, officer, member, recruit };
  }
}

// Singleton instance
let roleServiceInstance: RoleService | null = null;

export function getRoleService(): RoleService {
  roleServiceInstance ??= new RoleService();
  return roleServiceInstance;
}

