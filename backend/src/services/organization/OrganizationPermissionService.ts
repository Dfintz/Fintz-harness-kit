import { In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationPermission,
  PermissionAction,
  PermissionScope,
  PermissionTemplates,
  ResourceType,
} from '../../models/OrganizationPermission';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { AuditCategory, auditService } from '../audit/AuditService';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedPermissions?: OrganizationPermission[];
}

/**
 * Service for managing organization permissions
 * Handles granular permission checks with inheritance
 */
export class OrganizationPermissionService {
  private readonly permissionRepository = AppDataSource.getRepository(OrganizationPermission);
  private readonly organizationRepository = AppDataSource.getRepository(Organization);
  private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);

  // ==================== PERMISSION CHECKING ====================

  /**
   * Check if user has permission to perform action on resource
   * @param userId User ID
   * @param orgId Organization ID
   * @param resource Resource type
   * @param action Action to perform
   * @param resourceId Specific resource ID (optional)
   * @param requestIP IP address of the request (for IP whitelisting)
   * @returns Permission check result
   */
  async checkPermission(
    userId: string,
    orgId: string,
    resource: ResourceType,
    action: PermissionAction,
    resourceId?: string,
    requestIP?: string
  ): Promise<PermissionCheckResult> {
    // Owner/admin bypass — organization owners and admins have full permissions
    const isOwnerOrAdmin = await this.isOwnerOrAdmin(userId, orgId);
    if (isOwnerOrAdmin) {
      return {
        allowed: true,
        reason: 'Organization owner or admin',
      };
    }

    // Get all permissions for user in organization (including inherited)
    const permissions = await this.getUserPermissions(userId, orgId);

    // Filter permissions applicable to this resource and action
    const applicablePermissions = permissions.filter(p => {
      // Check if permission is valid
      if (!p.isValid()) {
        return false;
      }

      // Check resource type
      if (p.resource !== resource && p.resource !== ResourceType.CUSTOM) {
        return false;
      }

      // Check action
      if (!p.allowsAction(action)) {
        return false;
      }

      // Check specific resource
      if (!p.appliesToResource(resourceId)) {
        return false;
      }

      // Check time restrictions
      if (!p.matchesTimeRestrictions()) {
        return false;
      }

      // Check IP restrictions
      if (!p.matchesIPRestrictions(requestIP)) {
        return false;
      }

      return true;
    });

    if (applicablePermissions.length === 0) {
      return {
        allowed: false,
        reason: 'No applicable permissions found',
      };
    }

    // Sort by priority (highest first)
    applicablePermissions.sort((a, b) => b.priority - a.priority);

    return {
      allowed: true,
      matchedPermissions: applicablePermissions,
    };
  }

  /**
   * Check multiple permissions at once
   * @param userId User ID
   * @param orgId Organization ID
   * @param checks Array of permission checks
   * @returns Map of results
   */
  async checkMultiplePermissions(
    userId: string,
    orgId: string,
    checks: Array<{ resource: ResourceType; action: PermissionAction; resourceId?: string }>
  ): Promise<Map<string, PermissionCheckResult>> {
    const results = new Map<string, PermissionCheckResult>();

    for (const check of checks) {
      const key = `${check.resource}:${check.action}:${check.resourceId || 'any'}`;
      const result = await this.checkPermission(
        userId,
        orgId,
        check.resource,
        check.action,
        check.resourceId
      );
      results.set(key, result);
    }

    return results;
  }

  /**
   * Check if user is an owner or admin of the organization.
   *
   * Returns true if the user is either:
   * - The designated owner (org.ownerId)
   * - Has an admin or owner role via OrganizationMembership
   *
   * Uses OrganizationMembership with role-based lookup instead of legacy adminIds.
   *
   * @param userId - The user ID to check
   * @param orgId - The organization ID to check against
   * @returns Promise<boolean> - True if user is owner or admin, false otherwise
   */
  async isOwnerOrAdmin(userId: string, orgId: string): Promise<boolean> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      return false;
    }

    // Check if user is the designated owner
    if (org.ownerId === userId) {
      return true;
    }

    // Check if user has admin or owner role via membership
    const membership = await this.membershipRepository.findOne({
      where: { userId, organizationId: orgId, isActive: true },
    });

    if (!membership) {
      return false;
    }

    const roleName = getRoleName(membership.role);
    return roleName === 'admin' || roleName === 'owner' || roleName === 'founder';
  }

  // ==================== PERMISSION RETRIEVAL ====================

  /**
   * Get all permissions for user in organization (including inherited)
   * @param userId User ID
   * @param orgId Organization ID
   * @returns Array of permissions
   */
  async getUserPermissions(userId: string, orgId: string): Promise<OrganizationPermission[]> {
    // Get direct permissions
    const directPermissions = await this.permissionRepository.find({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    // Get inherited permissions from parent organizations
    const inheritedPermissions = await this.getInheritedPermissions(userId, orgId);

    // Combine and deduplicate
    const allPermissions = [...directPermissions, ...inheritedPermissions];

    // Remove duplicates (keep highest priority)
    const uniquePermissions = new Map<string, OrganizationPermission>();

    for (const perm of allPermissions) {
      const key = `${perm.resource}:${perm.resourceId || 'any'}:${perm.actions.join(',')}`;
      const existing = uniquePermissions.get(key);

      if (!existing || perm.priority > existing.priority) {
        uniquePermissions.set(key, perm);
      }
    }

    return Array.from(uniquePermissions.values());
  }

  /**
   * Get permissions inherited from parent organizations
   */
  private async getInheritedPermissions(
    userId: string,
    orgId: string
  ): Promise<OrganizationPermission[]> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org?.parentOrgId) {
      return [];
    }

    // Get organization settings to check if inheritance is enabled
    if (org.settings?.inheritPermissions === false) {
      return [];
    }

    // Get ancestor IDs
    const ancestorIds = org.getAncestorIds();
    if (ancestorIds.length === 0) {
      return [];
    }

    // Get inheritable permissions from ancestors
    const inheritedPermissions = await this.permissionRepository.find({
      where: {
        organizationId: In(ancestorIds),
        userId,
        inheritable: true,
        isActive: true,
      },
    });

    // Mark as inherited
    return inheritedPermissions.map(p => ({
      ...p,
      inherited: true,
      inheritedFrom: p.organizationId,
    })) as OrganizationPermission[];
  }

  /**
   * Get all permissions for organization
   * @param orgId Organization ID
   * @returns Array of permissions
   */
  async getOrganizationPermissions(orgId: string): Promise<OrganizationPermission[]> {
    return this.permissionRepository.find({
      where: { organizationId: orgId },
      relations: ['user'],
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get permissions by role
   * @param orgId Organization ID
   * @param roleId Role ID
   * @returns Array of permissions
   */
  async getRolePermissions(orgId: string, roleId: string): Promise<OrganizationPermission[]> {
    return this.permissionRepository.find({
      where: {
        organizationId: orgId,
        roleId,
      },
      order: { priority: 'DESC' },
    });
  }

  // ==================== PERMISSION MANAGEMENT ====================

  /**
   * Grant permission to user
   * @param orgId Organization ID
   * @param userId User ID
   * @param permissionData Permission data
   * @param grantedBy User ID who is granting permission
   * @returns Created permission
   */
  async grantPermission(
    orgId: string,
    userId: string,
    permissionData: Partial<OrganizationPermission>,
    grantedBy: string
  ): Promise<OrganizationPermission> {
    // Validate organization exists
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Create permission
    const permission = this.permissionRepository.create({
      organizationId: orgId,
      userId,
      ...permissionData,
      grantedBy,
      isActive: true,
      inherited: false,
    });

    logger.info('Granting permission', {
      userId,
      orgId,
      resource: permissionData.resource,
      action: permissionData.actions,
      grantedBy,
    });

    const saved = await this.permissionRepository.save(permission);

    auditService.log({
      category: AuditCategory.PERMISSION,
      action: 'PERMISSION_GRANTED',
      message: `Permission granted to user ${userId}`,
      userId: grantedBy,
      organizationId: orgId,
      resource: `permission/${saved.id}`,
      metadata: {
        grantedUserId: userId,
        resource: permissionData.resource,
        actions: permissionData.actions,
        grantedBy,
        grantedAt: new Date().toISOString(),
      },
    });

    return saved;
  }

  /**
   * Grant multiple permissions at once
   * @param orgId Organization ID
   * @param userId User ID
   * @param permissions Array of permission data
   * @param grantedBy User ID who is granting permissions
   * @returns Array of created permissions
   */
  async grantMultiplePermissions(
    orgId: string,
    userId: string,
    permissions: Array<Partial<OrganizationPermission>>,
    grantedBy: string
  ): Promise<OrganizationPermission[]> {
    logger.info('Granting multiple permissions', {
      userId,
      orgId,
      permissionCount: permissions.length,
      grantedBy,
    });

    const created: OrganizationPermission[] = [];

    for (const permData of permissions) {
      const permission = await this.grantPermission(orgId, userId, permData, grantedBy);
      created.push(permission);
    }

    auditService.log({
      category: AuditCategory.PERMISSION,
      action: 'PERMISSION_GRANTED_BULK',
      message: `Bulk permissions granted to user ${userId} - ${created.length} permissions`,
      userId: grantedBy,
      organizationId: orgId,
      resource: `user/${userId}/permissions/bulk`,
      metadata: {
        grantedUserId: userId,
        permissionCount: created.length,
        grantedBy,
        grantedAt: new Date().toISOString(),
      },
    });

    return created;
  }

  /**
   * Revoke permission
   * @param permissionId Permission ID
   */
  async revokePermission(permissionId: string): Promise<void> {
    logger.info('Revoking permission', { permissionId });

    // Fetch permission before revocation to get details for audit
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      logger.warn('Permission not found for revocation', { permissionId });
      return;
    }

    await this.permissionRepository.update({ id: permissionId }, { isActive: false });

    auditService.log({
      category: AuditCategory.PERMISSION,
      action: 'PERMISSION_REVOKED',
      message: `Permission revoked: ${permission.resource}`,
      organizationId: permission.organizationId,
      resource: `permission/${permissionId}`,
      metadata: {
        revokedPermissionId: permissionId,
        revokedUserId: permission.userId,
        previousResource: permission.resource,
        previousActions: permission.actions,
        revokedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Revoke all permissions for user in organization
   * @param userId User ID
   * @param orgId Organization ID
   */
  async revokeAllUserPermissions(userId: string, orgId: string): Promise<void> {
    logger.info('Revoking all user permissions', { userId, orgId });

    // Count permissions being revoked
    const revokedCount = await this.permissionRepository.countBy({
      organizationId: orgId,
      userId,
      isActive: true,
    });

    await this.permissionRepository.update(
      {
        organizationId: orgId,
        userId,
      },
      { isActive: false }
    );

    auditService.log({
      category: AuditCategory.PERMISSION,
      action: 'PERMISSION_REVOKED_ALL',
      message: `All permissions revoked for user ${userId} in organization`,
      organizationId: orgId,
      resource: `user/${userId}/permissions`,
      metadata: {
        revokedUserId: userId,
        revokedCount,
        revokedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Update permission
   * @param permissionId Permission ID
   * @param updates Permission updates
   * @returns Updated permission
   */
  async updatePermission(
    permissionId: string,
    updates: Partial<OrganizationPermission>
  ): Promise<OrganizationPermission> {
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    logger.info('Updating permission', { permissionId, updateFields: Object.keys(updates) });

    const previousValue = { ...permission };

    Object.assign(permission, updates);
    const saved = await this.permissionRepository.save(permission);

    auditService.log({
      category: AuditCategory.PERMISSION,
      action: 'PERMISSION_UPDATED',
      message: `Permission updated: ${permission.resource}`,
      organizationId: permission.organizationId,
      resource: `permission/${permissionId}`,
      metadata: {
        permissionId,
        previousValue: {
          resource: previousValue.resource,
          actions: previousValue.actions,
          priority: previousValue.priority,
          isActive: previousValue.isActive,
        },
        newValue: {
          resource: saved.resource,
          actions: saved.actions,
          priority: saved.priority,
          isActive: saved.isActive,
        },
        updatedFields: Object.keys(updates),
        updatedAt: new Date().toISOString(),
      },
    });

    return saved;
  }

  // ==================== PERMISSION TEMPLATES ====================

  /**
   * Apply permission template to user
   * @param orgId Organization ID
   * @param userId User ID
   * @param templateName Template name (OWNER, ADMIN, MANAGER, etc.)
   * @param grantedBy User ID who is applying template
   * @returns Array of created permissions
   */
  async applyPermissionTemplate(
    orgId: string,
    userId: string,
    templateName: keyof typeof PermissionTemplates,
    grantedBy: string
  ): Promise<OrganizationPermission[]> {
    const template = PermissionTemplates[templateName];

    if (!template) {
      throw new Error(`Unknown permission template: ${templateName}`);
    }

    // Revoke existing permissions
    await this.revokeAllUserPermissions(userId, orgId);

    // Apply template permissions
    const permissions = template.permissions.map(p => ({
      resource: p.resource,
      actions: p.actions,
      scope: p.scope,
      inheritable: true,
      priority: 5,
      reason: `Applied template: ${template.name}`,
    }));

    return this.grantMultiplePermissions(orgId, userId, permissions, grantedBy);
  }

  /**
   * Get available permission templates
   * @returns Array of template names and descriptions
   */
  getAvailableTemplates(): Array<{ name: string; description: string }> {
    return Object.entries(PermissionTemplates).map(([key, value]) => ({
      name: key,
      description: value.description,
    }));
  }

  // ==================== PERMISSION INHERITANCE ====================

  /**
   * Propagate permissions to child organizations
   * @param orgId Organization ID
   * @param permissionId Permission ID
   */
  async propagateToChildren(orgId: string, permissionId: string): Promise<void> {
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission?.inheritable) {
      throw new Error('Permission not found or not inheritable');
    }

    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get all descendant organizations
    const descendants = await this.organizationRepository.find({
      where: {
        path: In([`${org.path}.%`]),
      },
    });

    // Create inherited permissions for each descendant
    for (const descendant of descendants) {
      // Check if settings allow inheritance
      if (descendant.settings?.inheritPermissions === false) {
        continue;
      }

      // Check if permission already exists
      const existing = await this.permissionRepository.findOne({
        where: {
          organizationId: descendant.id,
          userId: permission.userId,
          resource: permission.resource,
          resourceId: permission.resourceId,
        },
      });

      if (!existing) {
        // Create inherited permission
        const inheritedPerm = this.permissionRepository.create({
          ...permission,
          id: undefined, // Generate new ID
          organizationId: descendant.id,
          inherited: true,
          inheritedFrom: orgId,
          priority: permission.priority - 1, // Lower priority than direct
        });

        await this.permissionRepository.save(inheritedPerm);
      }
    }
  }

  // ==================== PERMISSION CLEANUP ====================

  /**
   * Clean up expired permissions
   * @returns Number of permissions cleaned up
   */
  async cleanupExpiredPermissions(): Promise<number> {
    const result = await this.permissionRepository
      .createQueryBuilder()
      .update(OrganizationPermission)
      .set({ isActive: false })
      .where('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now: new Date() })
      .andWhere('isActive = true')
      .execute();

    return result.affected || 0;
  }

  /**
   * Remove permissions for deleted users/organizations
   */
  async cleanupOrphanedPermissions(): Promise<number> {
    // This would require checking against user and organization tables
    // For now, we rely on database CASCADE delete constraints
    return 0;
  }

  // ==================== PERMISSION STATISTICS ====================

  /**
   * Get permission statistics for organization
   * @param orgId Organization ID
   */
  async getPermissionStats(orgId: string): Promise<{
    totalPermissions: number;
    activePermissions: number;
    inheritedPermissions: number;
    directPermissions: number;
    permissionsByResource: Record<string, number>;
    userCount: number;
  }> {
    const allPermissions = await this.permissionRepository.find({
      where: { organizationId: orgId },
    });

    const activePermissions = allPermissions.filter(p => p.isActive);
    const inheritedPermissions = allPermissions.filter(p => p.inherited);
    const directPermissions = allPermissions.filter(p => !p.inherited);

    const permissionsByResource: Record<string, number> = {};
    for (const perm of allPermissions) {
      permissionsByResource[perm.resource] = (permissionsByResource[perm.resource] || 0) + 1;
    }

    const uniqueUsers = new Set(allPermissions.map(p => p.userId).filter(Boolean));

    return {
      totalPermissions: allPermissions.length,
      activePermissions: activePermissions.length,
      inheritedPermissions: inheritedPermissions.length,
      directPermissions: directPermissions.length,
      permissionsByResource,
      userCount: uniqueUsers.size,
    };
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Batch grant permissions to multiple users
   * PERFORMANCE OPTIMIZATION: Uses single bulk insert instead of sequential grants
   *
   * @param orgId Organization ID
   * @param grants Array of permission grants
   * @param grantedBy Who is granting the permissions
   * @returns Array of created permissions
   */
  async batchGrantPermissions(
    orgId: string,
    grants: Array<{
      userId: string;
      resource: ResourceType;
      actions: PermissionAction[];
      scope?: PermissionScope;
      resourceId?: string;
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
    }>,
    grantedBy: string
  ): Promise<OrganizationPermission[]> {
    if (!grants || grants.length === 0) {
      return [];
    }

    // Verify organization exists
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Create all permissions
    const permissions = grants.map(grant =>
      this.permissionRepository.create({
        organizationId: orgId,
        userId: grant.userId,
        resource: grant.resource,
        actions: grant.actions,
        scope: grant.scope || PermissionScope.ORGANIZATION,
        resourceId: grant.resourceId,
        inheritedFrom: undefined,
        priority: 100, // Default priority
        grantedBy,
        isActive: true,
        inherited: false,
        expiresAt: grant.expiresAt,
        metadata: grant.metadata,
      })
    );

    // Batch insert
    return this.permissionRepository.save(permissions);
  }

  /**
   * Batch revoke permissions
   *
   * @param permissionIds Array of permission IDs to revoke
   */
  async batchRevokePermissions(permissionIds: string[]): Promise<void> {
    if (!permissionIds || permissionIds.length === 0) {
      return;
    }

    await this.permissionRepository.delete(permissionIds);
  }

  /**
   * Batch grant permissions to a single user for multiple resources
   * Useful for setting up default permissions for new members
   *
   * @param orgId Organization ID
   * @param userId User ID
   * @param permissions Array of resource/action pairs
   * @param grantedBy Who is granting
   * @returns Created permissions
   */
  async batchGrantUserPermissions(
    orgId: string,
    userId: string,
    permissions: Array<{
      resource: ResourceType;
      actions: PermissionAction[];
    }>,
    grantedBy: string
  ): Promise<OrganizationPermission[]> {
    const grants = permissions.map(p => ({
      userId,
      resource: p.resource,
      actions: p.actions,
    }));

    return this.batchGrantPermissions(orgId, grants, grantedBy);
  }

  /**
   * Batch grant same permissions to multiple users
   * Useful for role-based permission assignment
   *
   * @param orgId Organization ID
   * @param userIds Array of user IDs
   * @param permissions Resource/action pairs
   * @param grantedBy Who is granting
   * @returns Created permissions
   */
  async batchGrantSamePermissions(
    orgId: string,
    userIds: string[],
    permissions: Array<{
      resource: ResourceType;
      actions: PermissionAction[];
    }>,
    grantedBy: string
  ): Promise<OrganizationPermission[]> {
    const grants = userIds.flatMap(userId =>
      permissions.map(p => ({
        userId,
        resource: p.resource,
        actions: p.actions,
      }))
    );

    return this.batchGrantPermissions(orgId, grants, grantedBy);
  }
}
