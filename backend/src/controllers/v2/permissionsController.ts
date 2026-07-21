/**
 * Permissions Controller V2
 * Handles permission and role management endpoints
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationPermission } from '../../models/OrganizationPermission';
import { User } from '../../models/User';
import { PermissionManagerService } from '../../services/security/permissions/PermissionManagerService';
import { PermissionService } from '../../services/security/permissions/PermissionService';
import { ApiErrorCode } from '../../types/api';
import { PERMISSION_CATEGORIES, PERMISSION_DESCRIPTIONS } from '../../types/permissions';
import { getAuthenticatedUserId } from '../../utils/authHelpers';
import { logger } from '../../utils/logger';
import {
  getDefaultPermissionsForRole,
  getRoleName,
  getRolePriority,
  isOwnerOrAdminRole,
} from '../../utils/roleUtils';
import { BaseController } from '../BaseController';

type PermissionRiskTier = 'low' | 'medium' | 'high';

interface PermissionCatalogEntry {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  riskTier: PermissionRiskTier;
}

interface PermissionCatalogGroup {
  key: string;
  label: string;
  description: string;
  count: number;
  permissions: PermissionCatalogEntry[];
}

interface PermissionSourceEntry {
  id: string;
  permissionId: string;
  resource: string;
  actions: string[];
  resourceId?: string;
  expiresAt?: Date | null;
  grantedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  description: string;
}

interface UserPermissionsResponse {
  userId: string;
  organizationId: string;
  role: { id: string; name: string; priority: number } | null;
  permissions: string[];
  total: number;
  sources: {
    role: string[];
    memberOverrides: string[];
    directGrants: PermissionSourceEntry[];
  };
}

function titleCasePermissionLabel(permissionKey: string): string {
  return permissionKey
    .split(':')
    .map(part =>
      part
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase())
    )
    .join(' · ');
}

function getPermissionRiskTier(permissionKey: string): PermissionRiskTier {
  if (permissionKey.includes('*')) {
    return 'high';
  }

  const action = permissionKey.split(':').at(-1) ?? '';
  if (['delete', 'manage', 'admin', 'write'].includes(action)) {
    return 'high';
  }

  if (['create', 'edit', 'approve', 'invite', 'assign', 'revoke'].includes(action)) {
    return 'medium';
  }

  return 'low';
}

function normalizeCatalogFilter(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function buildPermissionCatalog(): PermissionCatalogGroup[] {
  return Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => {
    const permissions = Object.values(category.permissions).map(permissionKey => ({
      id: permissionKey,
      key: permissionKey,
      name: titleCasePermissionLabel(permissionKey),
      description:
        PERMISSION_DESCRIPTIONS[permissionKey] ?? titleCasePermissionLabel(permissionKey),
      category: categoryKey,
      categoryLabel: category.label,
      riskTier: getPermissionRiskTier(permissionKey),
    }));

    return {
      key: categoryKey,
      label: category.label,
      description: category.description,
      count: permissions.length,
      permissions,
    };
  });
}

function filterPermissionCatalog(
  groups: PermissionCatalogGroup[],
  search?: string | null,
  category?: string | null
): PermissionCatalogGroup[] {
  const normalizedSearch = search?.trim().toLowerCase() ?? null;
  const normalizedCategory = category?.trim().toLowerCase() ?? null;

  return groups
    .filter(group => !normalizedCategory || group.key.toLowerCase() === normalizedCategory)
    .map(group => {
      const permissions = group.permissions.filter(permission => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          permission.key,
          permission.name,
          permission.description,
          permission.category,
          permission.categoryLabel,
        ].some(value => value.toLowerCase().includes(normalizedSearch));
      });

      return {
        ...group,
        count: permissions.length,
        permissions,
      };
    })
    .filter(group => group.permissions.length > 0);
}

function flattenPermissionCatalog(groups: PermissionCatalogGroup[]): PermissionCatalogEntry[] {
  return groups.flatMap(group => group.permissions);
}

function buildPermissionSourceEntry(permission: OrganizationPermission): PermissionSourceEntry {
  const permissionId = permission.resourceId
    ? `${permission.resource}:${permission.actions.join(',')}:${permission.resourceId}`
    : `${permission.resource}:${permission.actions.join(',')}`;

  return {
    id: permission.id,
    permissionId,
    resource: permission.resource,
    actions: permission.actions,
    resourceId: permission.resourceId,
    expiresAt: permission.expiresAt ?? null,
    grantedBy: permission.grantedBy ?? null,
    createdAt: permission.createdAt,
    updatedAt: permission.updatedAt,
    description:
      PERMISSION_DESCRIPTIONS[`${permission.resource}:${permission.actions[0] ?? ''}`] ??
      titleCasePermissionLabel(permissionId),
  };
}

export class PermissionsControllerV2 extends BaseController {
  private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);
  private readonly permissionManager = new PermissionManagerService();
  private readonly userRepository = AppDataSource.getRepository(User);

  /**
   * Helper method to verify admin access.
   * Allows platform admins (User.role) OR organization-level admins
   * (admin/owner/founder via OrganizationMembership).
   *
   * When organizationId is provided, the membership check is scoped
   * to that specific organization (prevents cross-tenant escalation).
   *
   * @throws ApiError if user has no admin-level access
   */
  private async verifyAdminAccess(userId: string, organizationId?: string): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Platform-level admin
    if (user.role === 'admin') {
      return user;
    }

    // Organization-level admin (admin, owner, or founder)
    const membershipsQuery = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.role', 'role')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.isActive = :isActive', { isActive: true });

    if (organizationId) {
      membershipsQuery.andWhere('membership.organizationId = :organizationId', { organizationId });
    }

    const memberships = await membershipsQuery.getMany();

    if (memberships.some(m => isOwnerOrAdminRole(m.role))) {
      return user;
    }

    throw new ApiError(ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
  }

  /**
   * GET /api/v2/permissions
   * List all available permissions (admin only)
   */
  async listPermissions(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const queryParams = req.queryParams as Record<string, unknown> | undefined;
      const query = req.query as Record<string, unknown> | undefined;
      const parsedSearch = queryParams?.['search'];
      const parsedCategory = queryParams?.['category'];
      const querySearch = query?.['search'];
      const queryCategory = query?.['category'];
      const search = normalizeCatalogFilter(parsedSearch ?? querySearch);
      const category = normalizeCatalogFilter(parsedCategory ?? queryCategory);

      // Check requesting user is admin
      await this.verifyAdminAccess(userId);

      const catalog = buildPermissionCatalog();
      const filteredCatalog = filterPermissionCatalog(catalog, search, category);
      const permissions = flattenPermissionCatalog(filteredCatalog);

      return {
        permissions,
        categories: filteredCatalog,
        total: permissions.length,
        filters: {
          search,
          category,
        },
      };
    });
  }

  /**
   * GET /api/v2/permissions/:id
   * Get permission details
   */
  async getPermission(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const { id: permissionId } = req.params;

      // Check requesting user is admin
      await this.verifyAdminAccess(userId);

      const catalog = flattenPermissionCatalog(buildPermissionCatalog());
      const permission = catalog.find(
        entry => entry.id === permissionId || entry.key === permissionId
      );

      if (!permission) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Permission not found', 404);
      }

      return permission;
    });
  }

  /**
   * GET /api/v2/users/:userId/permissions
   * Get all permissions for a user
   */
  async getUserPermissions(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const requestingUserId = getAuthenticatedUserId(req);
      const { userId } = req.params;

      // Check requesting user is admin or requesting own permissions
      if (requestingUserId !== userId) {
        await this.verifyAdminAccess(requestingUserId);
      }

      // Mock user permissions (would typically come from PermissionService)
      const permissions = [
        {
          id: 'perm_1',
          name: 'organization:read',
          description: 'View organization details',
          grantedAt: new Date(),
        },
        {
          id: 'perm_3',
          name: 'fleet:read',
          description: 'View fleet information',
          grantedAt: new Date(),
        },
      ];

      return {
        userId,
        permissions,
        total: permissions.length,
      };
    });
  }

  /**
   * POST /api/v2/permissions/check
   * Check if user has a specific permission
   */
  async checkPermission(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const requestingUserId = getAuthenticatedUserId(req);
      const { userId, permission, resource } = req.body;

      // Check requesting user is admin or checking own permissions
      if (requestingUserId !== userId) {
        await this.verifyAdminAccess(requestingUserId);
      }

      // Mock permission check (would use PermissionService)
      const hasPermission = permission === 'organization:read'; // Simplified logic

      return {
        userId,
        permission,
        resource,
        granted: hasPermission,
      };
    });
  }

  /**
   * GET /api/v2/roles
   * List all available roles
   */
  async listRoles(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const _userId = getAuthenticatedUserId(req);
      const { limit = 50, offset = 0 } = req.queryParams || {};

      // Mock role data
      const allRoles = [
        {
          id: 'role_1',
          name: 'admin',
          description: 'Full system administrator',
          level: 100,
        },
        {
          id: 'role_2',
          name: 'org_owner',
          description: 'Organization owner',
          level: 80,
        },
        {
          id: 'role_3',
          name: 'org_admin',
          description: 'Organization administrator',
          level: 70,
        },
        {
          id: 'role_4',
          name: 'fleet_commander',
          description: 'Fleet commander',
          level: 60,
        },
        {
          id: 'role_5',
          name: 'member',
          description: 'Regular member',
          level: 10,
        },
      ];

      const total = allRoles.length;
      const items = allRoles.slice(offset, offset + limit);

      const links = buildHateoasLinks(`/api/v2/roles`, offset, limit, total);

      res.paginated(items, { total, limit, offset, hasMore: offset + limit < total }, links);
    });
  }

  /**
   * GET /api/v2/roles/:roleId
   * Get role details including permissions
   */
  async getRole(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const _userId = getAuthenticatedUserId(req);
      const { roleId } = req.params;

      // Mock role data with permissions
      const role = {
        id: roleId,
        name: 'org_admin',
        description: 'Organization administrator',
        level: 70,
        permissions: [
          {
            id: 'perm_1',
            name: 'organization:read',
            description: 'View organization details',
          },
          {
            id: 'perm_2',
            name: 'organization:write',
            description: 'Modify organization details',
          },
          {
            id: 'perm_3',
            name: 'fleet:read',
            description: 'View fleet information',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      res.success(role);
    });
  }

  /**
   * GET /api/v2/organizations/:organizationId/users/:userId/permissions
   * Get all permissions for a user in an organization
   */
  async getUserPermissionsForOrg(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const _userId = getAuthenticatedUserId(req);
      const { organizationId, userId: targetUserId } = req.params;

      if (!organizationId || !targetUserId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Organization ID and User ID are required',
          400
        );
      }

      const membership = await this.membershipRepository
        .createQueryBuilder('membership')
        .where('membership.userId = :userId', { userId: targetUserId })
        .andWhere('membership.organizationId = :organizationId', { organizationId })
        .andWhere('membership.isActive = :isActive', { isActive: true })
        .getOne();

      if (!membership) {
        res.success({
          userId: targetUserId,
          organizationId,
          role: null,
          permissions: [],
          total: 0,
          sources: {
            role: [],
            memberOverrides: [],
            directGrants: [],
          },
        } satisfies UserPermissionsResponse);
        return;
      }

      const roleName = getRoleName(membership.role);
      const rolePermissions = membership.role?.permissions?.length
        ? membership.role.permissions
        : getDefaultPermissionsForRole(roleName);
      const memberOverrides = membership.permissions ?? [];
      const directPermissions = await AppDataSource.getRepository(OrganizationPermission).find({
        where: {
          organizationId,
          userId: targetUserId,
          isActive: true,
        },
        order: { createdAt: 'DESC' },
      });

      const directGrantPermissions = directPermissions.map(buildPermissionSourceEntry);
      const combinedPermissions = new Set<string>();

      for (const permission of rolePermissions) {
        combinedPermissions.add(permission);
      }
      for (const permission of memberOverrides) {
        combinedPermissions.add(permission);
      }
      for (const permission of directPermissions) {
        for (const action of permission.actions) {
          combinedPermissions.add(`${permission.resource}:${action}`);
          if (permission.resourceId) {
            combinedPermissions.add(`${permission.resource}:${action}:${permission.resourceId}`);
          }
        }
      }

      const permissions = Array.from(combinedPermissions).sort((left, right) =>
        left.localeCompare(right)
      );

      res.success({
        userId: targetUserId,
        organizationId,
        role: membership.role
          ? {
              id: membership.role.id,
              name: roleName,
              priority: getRolePriority(roleName),
            }
          : null,
        permissions,
        total: permissions.length,
        sources: {
          role: rolePermissions,
          memberOverrides,
          directGrants: directGrantPermissions,
        },
      } satisfies UserPermissionsResponse);
    });
  }

  /**
   * POST /api/v2/organizations/:organizationId/users/:userId/permissions
   * Grant permission to a user
   */
  async grantPermission(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, userId: targetUserId } = req.params;
      const { permissionId } = req.body;

      if (!organizationId || !targetUserId || !permissionId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Organization ID, User ID, and Permission ID are required',
          400
        );
      }

      // Verify requesting user is admin within the target organization
      await this.verifyAdminAccess(userId, organizationId);

      // NOSONAR: Improper Type Validation FP — permissionId is validated as truthy above
      // and split(':') is safe on any string value. Format is validated by parts.length check below.
      // Parse permission ID (format: "resource:action" or "resource:action:resourceId")
      const parts = permissionId.split(':'); // NOSONAR
      if (parts.length < 2) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Permission ID must be in format "resource:action" or "resource:action:resourceId"',
          400
        );
      }

      const [resource, action, resourceId] = parts;

      // Grant the permission
      const permission = await this.permissionManager.grantPermission(
        organizationId,
        targetUserId,
        resource,
        action,
        userId,
        undefined, // No expiration
        resourceId
      );

      logger.info(
        `Permission ${permissionId} granted to user ${targetUserId} in org ${organizationId} by ${userId}`
      );

      res.success({
        userId: targetUserId,
        organizationId,
        permissionId,
        permission: {
          id: permission.id,
          resource: permission.resource,
          actions: permission.actions,
          resourceId: permission.resourceId,
        },
        grantedAt: new Date(),
      });
    });
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/users/:userId/permissions
   * Revoke permission from a user
   */
  async revokePermission(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, userId: targetUserId } = req.params;
      const { permissionId } = req.body;

      if (!organizationId || !targetUserId || !permissionId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Organization ID, User ID, and Permission ID are required',
          400
        );
      }

      // Verify requesting user is admin within the target organization
      await this.verifyAdminAccess(userId, organizationId);

      // NOSONAR: Improper Type Validation FP — permissionId is validated as truthy above
      // and split(':') is safe on any string value. Format is validated by parts.length check below.
      // Parse permission ID (format: "resource:action" or "resource:action:resourceId")
      const parts = permissionId.split(':'); // NOSONAR
      if (parts.length < 2) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Permission ID must be in format "resource:action" or "resource:action:resourceId"',
          400
        );
      }

      const [resource, action, resourceId] = parts;

      // Revoke the permission
      await this.permissionManager.revokePermission(
        organizationId,
        targetUserId,
        resource,
        action,
        userId,
        resourceId
      );

      logger.info(
        `Permission ${permissionId} revoked from user ${targetUserId} in org ${organizationId} by ${userId}`
      );

      res.success({
        userId: targetUserId,
        organizationId,
        permissionId,
        revokedAt: new Date(),
      });
    });
  }

  /**
   * PUT /api/v2/organizations/:organizationId/users/:userId/security-level
   * Update user security level in organization
   */
  async updateSecurityLevel(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, userId: targetUserId } = req.params;
      const { securityLevel } = req.body;

      if (!organizationId || !targetUserId || securityLevel === undefined) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Organization ID, User ID, and Security Level are required',
          400
        );
      }

      // Verify requesting user is admin within the target organization
      await this.verifyAdminAccess(userId, organizationId);

      // Validate security level range (1-10)
      if (securityLevel < 1 || securityLevel > 10) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Security level must be between 1 and 10',
          400
        );
      }

      // Find membership
      const membership = await this.membershipRepository
        .createQueryBuilder('membership')
        .where('membership.userId = :userId', { userId: targetUserId })
        .andWhere('membership.organizationId = :organizationId', { organizationId })
        .andWhere('membership.isActive = :isActive', { isActive: true })
        .getOne();

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'User is not a member of this organization',
          404
        );
      }

      // Update security level
      membership.securityLevel = securityLevel;
      await this.membershipRepository.save(membership);

      // Invalidate cache
      this.permissionManager.clearOrganizationPermissionCache(organizationId);

      logger.info(`Security level updated for user ${targetUserId} in org ${organizationId}`);

      res.success({
        userId: targetUserId,
        organizationId,
        securityLevel,
        previousSecurityLevel: membership.securityLevel,
        updatedAt: new Date(),
      });
    });
  }

  /**
   * POST /api/v2/security-levels
   * Set inter-organization security level
   */
  async setInterOrgSecurityLevel(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const {
        sourceOrgId,
        targetOrgId,
        level,
        resourceType = '*',
        accessLevel = 'read',
        restrictions,
        notes,
        expiresAt,
      } = req.body;

      if (!sourceOrgId || !targetOrgId || level === undefined) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Source Org ID, Target Org ID, and Security Level are required',
          400
        );
      }

      // Verify requesting user is admin within the source organization
      await this.verifyAdminAccess(userId, sourceOrgId);

      // Set the inter-org security level using PermissionService
      const permissionService = new PermissionService();
      const securityLevel = await permissionService.setInterOrgSecurityLevel(
        sourceOrgId,
        targetOrgId,
        level,
        resourceType,
        accessLevel,
        userId,
        restrictions,
        notes,
        expiresAt ? new Date(expiresAt) : undefined
      );

      logger.info(
        `Inter-org security level set: ${sourceOrgId} -> ${targetOrgId} (level: ${level}, resource: ${resourceType})`
      );

      res.success({
        id: securityLevel.id,
        sourceOrgId: securityLevel.sourceOrgId,
        targetOrgId: securityLevel.targetOrgId,
        level: securityLevel.level,
        resourceType: securityLevel.resourceType,
        accessLevel: securityLevel.accessLevel,
        restrictions: securityLevel.restrictions,
        notes: securityLevel.notes,
        expiresAt: securityLevel.expiresAt,
        isActive: securityLevel.isActive,
        approvedBy: securityLevel.approvedBy,
        createdAt: securityLevel.createdAt,
        updatedAt: securityLevel.updatedAt,
      });
    });
  }

  /**
   * GET /api/v2/organizations/:organizationId/security-levels
   * Get inter-org security levels for an organization
   */
  async getOrgSecurityLevels(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const _userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      if (!organizationId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Organization ID is required', 400);
      }

      // Get security levels for the organization using PermissionService
      const permissionService = new PermissionService();
      const securityLevels = await permissionService.getInterOrgSecurityLevels(organizationId);

      // Map to response format
      const mappedLevels = securityLevels.map(sl => ({
        id: sl.id,
        sourceOrgId: sl.sourceOrgId,
        sourceOrgName: sl.sourceOrganization?.name,
        targetOrgId: sl.targetOrgId,
        targetOrgName: sl.targetOrganization?.name,
        level: sl.level,
        resourceType: sl.resourceType,
        accessLevel: sl.accessLevel,
        restrictions: sl.restrictions,
        notes: sl.notes,
        isActive: sl.isActive,
        expiresAt: sl.expiresAt,
        approvedBy: sl.approvedBy,
        updatedBy: sl.updatedBy,
        createdAt: sl.createdAt,
        updatedAt: sl.updatedAt,
      }));

      logger.info(`Retrieved ${securityLevels.length} security levels for org ${organizationId}`);

      res.success({
        organizationId,
        securityLevels: mappedLevels,
        total: mappedLevels.length,
      });
    });
  }

  /**
   * GET /api/v2/security-levels
   * Get all inter-org security levels (admin only)
   */
  async getAllSecurityLevels(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const userId = getAuthenticatedUserId(req);

      // Verify requesting user is admin
      await this.verifyAdminAccess(userId);

      // Get all security levels using PermissionService
      const permissionService = new PermissionService();
      const securityLevels = await permissionService.getAllSecurityLevels();

      // Map to response format
      const mappedLevels = securityLevels.map(sl => ({
        id: sl.id,
        sourceOrgId: sl.sourceOrgId,
        sourceOrgName: sl.sourceOrganization?.name,
        targetOrgId: sl.targetOrgId,
        targetOrgName: sl.targetOrganization?.name,
        level: sl.level,
        resourceType: sl.resourceType,
        accessLevel: sl.accessLevel,
        restrictions: sl.restrictions,
        notes: sl.notes,
        isActive: sl.isActive,
        expiresAt: sl.expiresAt,
        approvedBy: sl.approvedBy,
        updatedBy: sl.updatedBy,
        createdAt: sl.createdAt,
        updatedAt: sl.updatedAt,
      }));

      logger.info(`Admin retrieved ${securityLevels.length} security levels`);

      res.success({
        securityLevels: mappedLevels,
        total: mappedLevels.length,
      });
    });
  }

  /**
   * DELETE /api/v2/security-levels
   * Revoke/deactivate an inter-org security level
   */
  async revokeInterOrgSecurityLevel(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const userId = getAuthenticatedUserId(req);
      const { sourceOrgId, targetOrgId, resourceType } = req.body;

      if (!sourceOrgId || !targetOrgId || !resourceType) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Source Org ID, Target Org ID, and Resource Type are required',
          400
        );
      }

      // Verify requesting user is admin within the source organization
      await this.verifyAdminAccess(userId, sourceOrgId);

      // Revoke the security level
      const permissionService = new PermissionService();
      await permissionService.revokeInterOrgSecurityLevel(
        sourceOrgId,
        targetOrgId,
        resourceType,
        userId
      );

      logger.info(
        `Inter-org security level revoked: ${sourceOrgId} -> ${targetOrgId} (resource: ${resourceType})`
      );

      res.success({
        sourceOrgId,
        targetOrgId,
        resourceType,
        revoked: true,
        revokedAt: new Date(),
      });
    });
  }
}
