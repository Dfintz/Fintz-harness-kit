/**
 * Roles Controller V2
 * Handles role management and RBAC operations with standardized responses
 */

import { Request, Response } from 'express';
import { In, IsNull } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { Role as RoleEntity } from '../../models/Role';
import { User } from '../../models/User';
import { MemberRoleAssignmentService } from '../../services/organization/MemberRoleAssignmentService';
import {
  PermissionChangeEventService,
  PermissionChangeType,
} from '../../services/security/permissions/PermissionChangeEventService';
import { ApiErrorCode } from '../../types/api';
import { ApiError } from '../../utils/apiErrors';
import { getAuthenticatedUserId } from '../../utils/authHelpers';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { BaseController } from '../BaseController';

interface RoleResponse {
  id: string;
  name: string;
  description: string;
  scope: string;
  permissions: string[];
  priority?: number;
  isSystemRole?: boolean;
  organizationId?: string | null;
  default?: boolean;
  createdAt?: Date;
  modifiable?: boolean;
}

// ── Request body interfaces for type-safe destructuring ─────────────────────

interface CreateRoleBody {
  name: string;
  description?: string;
  scope: string;
  permissions?: string[];
  organizationId?: string;
  priority?: number;
}

interface UpdateRoleBody {
  name?: string;
  description?: string;
  permissions?: string[];
  priority?: number;
}

interface AssignRoleBody {
  userId: string;
  organizationId: string;
}

interface AddPermissionBody {
  permissionId: string;
}

interface ApplyTemplateBody {
  roleName: string;
  organizationId?: string;
}

interface ReorderRolesBody {
  updates: Array<{
    roleId: string;
    priority: number;
  }>;
}

export class RolesControllerV2 extends BaseController {
  private readonly roleRepository = AppDataSource.getRepository(RoleEntity);
  private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);
  private readonly permissionChangeEventService = PermissionChangeEventService.getInstance();
  private readonly memberRoleAssignmentService = new MemberRoleAssignmentService();

  private async resolveAffectedUserIdsByRole(
    organizationId: string,
    roleId: string
  ): Promise<string[]> {
    const rows = await this.membershipRepository
      .createQueryBuilder('membership')
      .select('DISTINCT membership.userId', 'userId')
      .where('membership.organizationId = :organizationId', { organizationId })
      .andWhere('membership.roleId = :roleId', { roleId })
      .andWhere('membership.isActive = :isActive', { isActive: true })
      .getRawMany<{ userId: string }>();

    return rows.map(row => row.userId);
  }

  private async resolveAffectedUserIdsByRoles(
    organizationId: string,
    roleIds: string[]
  ): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rows = await this.membershipRepository
      .createQueryBuilder('membership')
      .select('DISTINCT membership.userId', 'userId')
      .where('membership.organizationId = :organizationId', { organizationId })
      .andWhere('membership.roleId IN (:...roleIds)', { roleIds })
      .andWhere('membership.isActive = :isActive', { isActive: true })
      .getRawMany<{ userId: string }>();

    return rows.map(row => row.userId);
  }

  private async processPermissionChange(
    organizationId: string,
    actorUserId: string,
    changeType: PermissionChangeType,
    affectedUserIds: string[]
  ): Promise<void> {
    await this.permissionChangeEventService.onRolePermissionChanged(
      organizationId,
      affectedUserIds,
      changeType,
      actorUserId
    );
  }

  /**
   * Verify the requesting user can manage roles.
   *
   * For organization-scoped roles the user must be an owner or admin *within*
   * that organization (checked via OrganizationMembership).  System-scoped
   * operations still require the global platform admin flag (`User.role`).
   */
  private async verifyRoleManagementAccess(
    userId: string,
    organizationId: string | null | undefined,
    action: string
  ): Promise<void> {
    if (organizationId) {
      // Org-scoped: verify membership role
      const membership = await this.membershipRepository.findOne({
        where: { userId, organizationId, isActive: true },
        relations: ['role'],
      });
      const roleName = getRoleName(membership?.role);
      if (!membership || !['owner', 'founder', 'admin'].includes(roleName)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          `Organization admin access required to ${action}`,
          403
        );
      }
    } else {
      // System-scoped: require platform admin
      const userRepository = AppDataSource.getRepository(User);
      const requestingUser = await userRepository.findOne({ where: { id: userId } });
      if (requestingUser?.role !== 'admin') {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          `Platform admin access required to ${action}`,
          403
        );
      }
    }
  }

  /**
   * GET /api/v2/roles
   * List all available system roles
   */
  async listRoles(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async request => {
      // Authentication enforced by middleware; call ensures 401 if missing
      getAuthenticatedUserId(request);
      const page = Number.parseInt(request.query.page as string) || 1;
      const limit = Math.min(Number.parseInt(request.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const organizationId = request.query.organizationId as string | undefined;
      const includeSystem = request.query.includeSystem as string | undefined;

      // Build query
      const where: Record<string, unknown> = {};

      if (organizationId) {
        // Show organization-specific roles
        where.organizationId = organizationId;
      } else if (includeSystem === 'true') {
        // Show only system roles
        where.isSystemRole = true;
      }

      // Fetch roles from database
      const [dbRoles, total] = await this.roleRepository.findAndCount({
        where,
        order: { priority: 'DESC', name: 'ASC' },
        skip: offset,
        take: limit,
      });

      // Map to response format
      const roles: RoleResponse[] = dbRoles.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description ?? '',
        scope: r.isSystemRole ? 'system' : 'organization',
        permissions: r.permissions ?? [],
        priority: r.priority,
        isSystemRole: r.isSystemRole,
        organizationId: r.organizationId ?? null,
        default: r.name === 'member' || r.name === 'user',
        createdAt: r.createdAt,
        modifiable: !r.isSystemRole,
      }));

      return {
        roles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    });
  }

  /**
   * GET /api/v2/roles/:roleId
   * Get detailed role information
   */
  async getRole(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async request => {
      const { roleId } = request.params;

      // Fetch role from database
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      // Get count of users with this role
      const userCount = await this.membershipRepository.count({
        where: { roleId: role.id },
      });

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        scope: role.isSystemRole ? 'system' : 'organization',
        organizationId: role.organizationId,
        permissions: role.permissions ?? [],
        priority: role.priority,
        isSystemRole: role.isSystemRole,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        modifiable: !role.isSystemRole,
        userCount,
      };
    });
  }

  /**
   * POST /api/v2/roles
   * Create a custom role (admin only)
   */
  async createRole(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(
      req,
      res,
      async request => {
        const userId = getAuthenticatedUserId(request);

        const { name, description, scope, permissions, organizationId, priority } =
          request.body as CreateRoleBody;

        // Note: name and scope are required — validated by Joi schema in routes

        // Determine if system role or organization role
        const isSystemRole = scope === 'system';

        if (!isSystemRole && !organizationId) {
          throw new ApiError(
            ApiErrorCode.MISSING_REQUIRED_FIELD,
            'Organization ID is required for organization-scoped roles',
            400
          );
        }

        // Verify access — org admin for org roles, platform admin for system roles
        await this.verifyRoleManagementAccess(
          userId,
          isSystemRole ? null : organizationId,
          'create roles'
        );

        // Check if role name already exists in this scope
        const orgIdForQuery = isSystemRole ? undefined : organizationId;
        const existingRole = await this.roleRepository.findOne({
          where: {
            name,
            ...(orgIdForQuery ? { organizationId: orgIdForQuery } : { organizationId: IsNull() }),
          },
        });

        if (existingRole) {
          throw new ApiError(
            ApiErrorCode.RESOURCE_ALREADY_EXISTS,
            'A role with this name already exists in this scope',
            409
          );
        }

        // Create new role
        const newRole = this.roleRepository.create({
          name,
          description,
          organizationId: isSystemRole ? undefined : organizationId,
          isSystemRole,
          priority: typeof priority === 'number' ? Math.max(1, Math.min(100, priority)) : 50,
          permissions: permissions ?? [],
        });

        const savedRole = await this.roleRepository.save(newRole);

        logger.info(`Custom role created: ${savedRole.id} (${name}) by user ${userId}`);

        return {
          id: savedRole.id,
          name: savedRole.name,
          description: savedRole.description,
          scope,
          organizationId: savedRole.organizationId,
          permissions: savedRole.permissions ?? [],
          priority: savedRole.priority,
          createdAt: savedRole.createdAt,
          createdBy: userId,
        };
      },
      201
    );
  }

  /**
   * PUT /api/v2/roles/:roleId
   * Update a custom role (admin only)
   */
  async updateRole(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async request => {
      const userId = getAuthenticatedUserId(request);
      const { roleId } = request.params;
      const { name, description, permissions, priority } = request.body as UpdateRoleBody;

      // Fetch the role from database
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      // Verify access — org admin for org roles, platform admin for system roles
      await this.verifyRoleManagementAccess(userId, role.organizationId, 'update roles');

      // Check if role is modifiable (system roles cannot be modified)
      if (role.isSystemRole) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'System roles cannot be modified', 403);
      }

      // Update role fields
      if (name) {
        role.name = name;
      }
      if (description !== undefined) {
        role.description = description;
      }
      if (permissions) {
        role.permissions = permissions;
      }
      if (typeof priority === 'number') {
        role.priority = Math.max(1, Math.min(100, priority));
      }

      const updatedRole = await this.roleRepository.save(role);

      // Invalidate cache and emit refresh events post-commit.
      if (updatedRole.organizationId) {
        const affectedUserIds = await this.resolveAffectedUserIdsByRole(
          updatedRole.organizationId,
          updatedRole.id
        );
        await this.processPermissionChange(
          updatedRole.organizationId,
          userId,
          'role_updated',
          affectedUserIds
        );
      }

      logger.info(`Role updated: ${roleId} by user ${userId}`);

      return {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        permissions: updatedRole.permissions,
        priority: updatedRole.priority,
        updatedAt: updatedRole.updatedAt,
      };
    });
  }

  /**
   * POST /api/v2/organizations/:orgId/roles/reorder
   * Atomically reorder role priorities for organization custom roles.
   */
  async reorderRoles(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async request => {
      const userId = getAuthenticatedUserId(request);
      const { orgId } = request.params;
      const { updates } = request.body as ReorderRolesBody;

      await this.verifyRoleManagementAccess(userId, orgId, 'reorder roles');

      const roleIds = updates.map(update => update.roleId);
      const uniqueRoleIds = new Set(roleIds);

      if (uniqueRoleIds.size !== roleIds.length) {
        throw new ApiError(
          ApiErrorCode.INVALID_INPUT,
          'Duplicate role IDs in reorder request',
          400
        );
      }

      await AppDataSource.transaction(async manager => {
        const roleRepository = manager.getRepository(RoleEntity);
        const roles = await roleRepository.find({
          where: {
            id: In(roleIds),
            organizationId: orgId,
          },
        });

        if (roles.length !== roleIds.length) {
          throw new ApiError(
            ApiErrorCode.RESOURCE_NOT_FOUND,
            'One or more roles were not found in this organization',
            404
          );
        }

        if (roles.some(role => role.isSystemRole)) {
          throw new ApiError(ApiErrorCode.FORBIDDEN, 'System roles cannot be reordered', 403);
        }

        const updatesByRoleId = new Map(updates.map(update => [update.roleId, update.priority]));

        for (const role of roles) {
          const nextPriority = updatesByRoleId.get(role.id);
          if (typeof nextPriority === 'number') {
            role.priority = Math.max(1, Math.min(100, nextPriority));
          }
        }

        await roleRepository.save(roles);
      });

      const affectedUserIds = await this.resolveAffectedUserIdsByRoles(orgId, roleIds);
      await this.processPermissionChange(orgId, userId, 'roles_reordered', affectedUserIds);

      logger.info(`Roles reordered for organization ${orgId} by user ${userId}`);

      return {
        organizationId: orgId,
        updatedCount: updates.length,
        updatedAt: new Date(),
      };
    });
  }

  /**
   * DELETE /api/v2/roles/:roleId
   * Delete a custom role (admin only)
   */
  async deleteRole(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async request => {
      const userId = getAuthenticatedUserId(request);
      const { roleId } = request.params;

      // Fetch the role
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      // Verify access — org admin for org roles, platform admin for system roles
      await this.verifyRoleManagementAccess(userId, role.organizationId, 'delete roles');

      // Prevent deletion of system roles
      if (role.isSystemRole) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'System roles cannot be deleted', 403);
      }

      // Check if any users have this role
      const usersWithRole = await this.membershipRepository.count({
        where: { roleId: role.id },
      });

      if (usersWithRole > 0) {
        // Reassign all users with this role to 'member' role
        const memberRole = await this.roleRepository.findOne({
          where: { name: 'member', organizationId: role.organizationId },
        });
        if (memberRole) {
          await this.membershipRepository.update({ roleId: role.id }, { roleId: memberRole.id });
        }

        logger.info(`Reassigned ${usersWithRole} users from role ${role.name} to member`);
      }

      // Delete the role
      await this.roleRepository.remove(role);

      // Invalidate cache
      if (role.organizationId) {
        const affectedUserIds = await this.resolveAffectedUserIdsByRole(
          role.organizationId,
          role.id
        );
        await this.processPermissionChange(
          role.organizationId,
          userId,
          'role_deleted',
          affectedUserIds
        );
      }

      logger.info(`Role deleted: ${roleId} by user ${userId}`);

      return {
        deletedId: roleId,
        deletedAt: new Date(),
        reassignedUsers: usersWithRole,
      };
    });
  }

  /**
   * POST /api/v2/roles/:roleId/assign
   * Assign role to user in organization
   */
  async assignRoleToUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { roleId } = req.params;
      // Body validated by Joi schema; destructure typed fields
      const { userId: targetUserId, organizationId } = req.body as AssignRoleBody;

      // Verify access — org admin for the target organization
      await this.verifyRoleManagementAccess(userId, organizationId, 'assign roles');

      // Delegate the grant to the canonical assignment service (shared with the
      // approval-driven auto-grant path) so role-assignment logic stays in one place.
      const result = await this.memberRoleAssignmentService.assignRole({
        organizationId,
        targetUserId,
        roleId,
        actorUserId: userId,
      });

      logger.info(
        `Role ${result.roleName} assigned to user ${targetUserId} in org ${organizationId} (previous: ${result.previousRoleName})`
      );

      res.status(201).success({
        userId: targetUserId,
        organizationId,
        roleId: result.roleId,
        roleName: result.roleName,
        previousRoleId: result.previousRoleName,
        assignedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to assign role: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/roles/:roleId/assign/:userId
   * Remove role from user
   */
  async removeRoleFromUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { roleId, userId: targetUserId } = req.params;
      // organizationId via query param (DELETE body is unreliable)
      const organizationId = (req.query.organizationId ??
        (req.body as Record<string, unknown> | undefined)?.organizationId) as string | undefined;

      if (!organizationId) {
        throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'Organization ID is required', 400);
      }

      // Verify access — org admin for the target organization
      await this.verifyRoleManagementAccess(userId, organizationId, 'remove roles');

      // Look up the role to get its name — must exist since roleId is validated
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      // Find membership
      const membership = await this.membershipRepository.findOne({
        where: { userId: targetUserId, organizationId },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'User is not a member of this organization',
          404
        );
      }

      // Compare by roleId (reliable) instead of name string comparison
      if (membership.roleId !== roleId) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'User does not have this role', 400);
      }

      // Reassign to member role (users must always have a role)
      const memberRole = await this.roleRepository.findOne({
        where: { name: 'member', organizationId },
      });
      if (!memberRole) {
        throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Default member role not found', 500);
      }
      membership.roleId = memberRole.id;
      await this.membershipRepository.save(membership);

      await this.permissionChangeEventService.onUserRoleChanged(
        organizationId,
        targetUserId,
        'role_revoked',
        userId
      );

      logger.info(`Role ${role.name} removed from user ${targetUserId} in org ${organizationId}`);

      res.success({
        userId: targetUserId,
        organizationId,
        removedRoleId: roleId,
        newRoleId: 'member',
        newRoleName: 'member',
        removedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to remove role: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/roles/:roleId/permissions
   * Get all permissions for a role
   */
  async getRolePermissions(req: Request, res: Response): Promise<void> {
    try {
      const { roleId } = req.params;

      // Fetch role with permissions
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      const permissions = role.permissions ?? [];

      res.success({
        roleId,
        roleName: role.name,
        permissions,
        count: permissions.length,
        isSystemRole: role.isSystemRole,
        priority: role.priority,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get role permissions: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/roles/:roleId/permissions
   * Add permission to role
   */
  async addPermissionToRole(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { roleId } = req.params;
      const { permissionId } = req.body as AddPermissionBody;

      // Fetch role
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      // Verify access — org admin for org roles, platform admin for system roles
      await this.verifyRoleManagementAccess(userId, role.organizationId, 'modify role permissions');

      // Check if role is modifiable
      if (role.isSystemRole) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Cannot modify permissions of system roles',
          403
        );
      }

      // Add permission if not already present
      const permissions = role.permissions ?? [];
      if (!permissions.includes(permissionId)) {
        permissions.push(permissionId);
        role.permissions = permissions;
        await this.roleRepository.save(role);

        // Invalidate cache and emit refresh events post-commit.
        if (role.organizationId) {
          const affectedUserIds = await this.resolveAffectedUserIdsByRole(
            role.organizationId,
            role.id
          );
          await this.processPermissionChange(
            role.organizationId,
            userId,
            'permission_added',
            affectedUserIds
          );
        }

        logger.info(`Permission ${permissionId} added to role ${roleId}`);
      }

      res.status(201).success({
        roleId,
        roleName: role.name,
        permissionId,
        permissions: role.permissions,
        addedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to add permission: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/roles/:roleId/permissions/:permissionId
   * Remove permission from role
   */
  async removePermissionFromRole(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { roleId, permissionId } = req.params;

      // Fetch role
      const role = await this.roleRepository.findOne({ where: { id: roleId } });

      if (!role) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      // Verify access — org admin for org roles, platform admin for system roles
      await this.verifyRoleManagementAccess(userId, role.organizationId, 'modify role permissions');

      // Check if role is modifiable
      if (role.isSystemRole) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Cannot modify permissions of system roles',
          403
        );
      }

      // Remove permission
      const permissions = role.permissions ?? [];
      const initialLength = permissions.length;
      role.permissions = permissions.filter(p => p !== permissionId);

      if (role.permissions.length < initialLength) {
        await this.roleRepository.save(role);

        // Invalidate cache and emit refresh events post-commit.
        if (role.organizationId) {
          const affectedUserIds = await this.resolveAffectedUserIdsByRole(
            role.organizationId,
            role.id
          );
          await this.processPermissionChange(
            role.organizationId,
            userId,
            'permission_removed',
            affectedUserIds
          );
        }

        logger.info(`Permission ${permissionId} removed from role ${roleId}`);
      }

      res.success({
        roleId,
        roleName: role.name,
        removedPermissionId: permissionId,
        permissions: role.permissions,
        removedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to remove permission: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/roles/search/by-scope
   * Search roles by scope
   */
  async searchByScope(req: Request, res: Response): Promise<void> {
    try {
      // scope is validated by Joi schema in the route
      const scope = req.query.scope as string;
      const searchOrgId = req.query.organizationId as string | undefined;

      // Build query based on scope
      let dbRoles: Array<{
        id: string;
        name: string;
        description?: string;
        permissions?: string[];
        isSystemRole?: boolean;
        createdAt: Date;
        priority?: number;
      }> = [];
      if (scope === 'system') {
        // System roles have no organizationId and isSystemRole = true
        dbRoles = await this.roleRepository.find({
          where: { isSystemRole: true },
          order: { priority: 'DESC' },
        });
      } else if (scope === 'organization' && searchOrgId) {
        // Organization-specific roles
        dbRoles = await this.roleRepository.find({
          where: { organizationId: searchOrgId, isSystemRole: false },
          order: { priority: 'DESC' },
        });
      } else {
        // Return empty if no organizationId provided for non-system scopes
        dbRoles = [];
      }

      // Map to response format
      const roles: RoleResponse[] = dbRoles.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description ?? '',
        scope,
        permissions: r.permissions ?? [],
        priority: r.priority,
        isSystemRole: !!r.isSystemRole,
        organizationId: scope === 'organization' ? (searchOrgId ?? null) : null,
        createdAt: r.createdAt,
        modifiable: !r.isSystemRole,
      }));

      res.success({
        scope,
        organizationId: searchOrgId ?? null,
        roles,
        count: roles.length,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to search roles: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/roles/templates
   * Get predefined role templates
   */
  getTemplates(_req: Request, res: Response): void {
    try {
      const templates = [
        {
          id: 'template:org-admin',
          name: 'Organization Admin Template',
          description: 'Pre-configured for org administrators',
          scope: 'organization',
          permissions: [
            'org:members:manage',
            'org:settings:write',
            'org:permissions:manage',
            'fleet:manage_members',
            'fleet:manage_ships',
          ],
        },
        {
          id: 'template:fleet-lead',
          name: 'Fleet Leader Template',
          description: 'Pre-configured for fleet leaders',
          scope: 'fleet',
          permissions: ['fleet:*', 'org:read'],
        },
        {
          id: 'template:member',
          name: 'Standard Member Template',
          description: 'Pre-configured for regular members',
          scope: 'organization',
          permissions: ['org:read', 'org:members:read'],
        },
      ];

      res.success({
        templates,
        count: templates.length,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get templates: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/roles/templates/:templateId/apply
   * Apply a template to create or update a role
   */
  async applyTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { templateId } = req.params;
      const { roleName, organizationId } = req.body as ApplyTemplateBody;

      // Define templates
      const templates: Record<
        string,
        { description: string; permissions: string[]; priority: number; scope: string }
      > = {
        'template:org-admin': {
          description: 'Pre-configured for org administrators',
          permissions: [
            'org:members:manage',
            'org:settings:write',
            'org:permissions:manage',
            'fleet:manage_members',
            'fleet:manage_ships',
          ],
          priority: 90,
          scope: 'organization',
        },
        'template:fleet-lead': {
          description: 'Pre-configured for fleet leaders',
          permissions: ['fleet:*', 'org:read'],
          priority: 80,
          scope: 'fleet',
        },
        'template:member': {
          description: 'Pre-configured for regular members',
          permissions: ['org:read', 'org:members:read'],
          priority: 10,
          scope: 'organization',
        },
      };

      const template = templates[templateId];

      if (!template) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Template not found', 404);
      }

      // Verify access — org admin for org templates, platform admin for system
      await this.verifyRoleManagementAccess(
        userId,
        template.scope === 'system' ? null : organizationId,
        'apply role templates'
      );

      // For organization-scoped roles, organizationId is required
      if (template.scope !== 'system' && !organizationId) {
        throw new ApiError(
          ApiErrorCode.MISSING_REQUIRED_FIELD,
          'Organization ID is required for organization-scoped roles',
          400
        );
      }

      // Check if role name already exists
      const existingRole = await this.roleRepository.findOne({
        where: {
          name: roleName,
          ...(organizationId ? { organizationId } : { organizationId: IsNull() }),
        },
      });

      if (existingRole) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_ALREADY_EXISTS,
          'A role with this name already exists',
          409
        );
      }

      // Create new role from template
      const newRole = this.roleRepository.create({
        name: roleName,
        description: template.description,
        organizationId,
        isSystemRole: template.scope === 'system',
        priority: template.priority,
        permissions: template.permissions,
      });

      const savedRole = await this.roleRepository.save(newRole);

      logger.info(`Role created from template ${templateId}: ${savedRole.id} by user ${userId}`);

      res.status(201).success({
        id: savedRole.id,
        name: savedRole.name,
        description: savedRole.description,
        templateApplied: templateId,
        organizationId: savedRole.organizationId,
        permissions: savedRole.permissions,
        priority: savedRole.priority,
        createdAt: savedRole.createdAt,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to apply template: ${getErrorMessage(error)}`,
        500
      );
    }
  }
}
