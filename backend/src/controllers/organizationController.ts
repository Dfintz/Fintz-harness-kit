import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { ActivitySeverity, OrgActivityAction } from '../models/OrganizationActivity';
import { AnalyticsPeriod } from '../models/OrganizationAnalytics';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { TemplateCategory, TemplateVisibility } from '../models/OrganizationTemplate';
import { OrganizationActivityService } from '../services/organization/OrganizationActivityService';
import { OrganizationAnalyticsService } from '../services/organization/OrganizationAnalyticsService';
import { OrganizationBulkService } from '../services/organization/OrganizationBulkService';
import { OrganizationHierarchyService } from '../services/organization/OrganizationHierarchyService';
import { OrganizationMemberService } from '../services/organization/OrganizationMemberService';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { OrganizationService } from '../services/organization/OrganizationService';
import { OrganizationSettingsService } from '../services/organization/OrganizationSettingsService';
import { OrganizationTemplateService } from '../services/organization/OrganizationTemplateService';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';
import { getRoleName } from '../utils/roleUtils';

import { BaseController } from './BaseController';

/**
 * Controller for handling organization-related HTTP requests
 * Provides comprehensive organization management with hierarchy, permissions, and activity logging
 */
export class OrganizationController extends BaseController {
  private readonly organizationService = new OrganizationService();
  private readonly hierarchyService = new OrganizationHierarchyService();
  private readonly permissionService = new OrganizationPermissionService();
  private readonly memberService = new OrganizationMemberService();
  private readonly activityService = new OrganizationActivityService();
  private readonly settingsService = new OrganizationSettingsService();
  private readonly analyticsService = new OrganizationAnalyticsService();
  private readonly templateService = new OrganizationTemplateService();
  private readonly bulkService = new OrganizationBulkService();

  /**
   * Check if user has admin role
   * @throws ForbiddenError if user is not admin
   */
  private requireAdmin(req: AuthRequest): void {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }
  }

  // ==================== ORGANIZATION CRUD ====================

  /**
   * Create a new organization
   * POST /api/organizations
   */
  public createOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const orgData = req.body;
      const organization = await this.organizationService.createOrganization(orgData, userId);

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: organization,
      });
    });
  };

  /**
   * Get a specific organization by ID
   * GET /api/organizations/:id
   */
  public getOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { includeHierarchy } = req.query;

      let organization;
      if (includeHierarchy === 'true') {
        organization = await this.organizationService.getOrganizationWithHierarchy(id);
      } else {
        organization = await this.organizationService.getOrganizationById(id);
      }

      if (!organization) {
        throw new NotFoundError('Organization');
      }

      res.json({
        success: true,
        data: organization,
      });
    });
  };

  /**
   * List all organizations with pagination
   * GET /api/organizations
   */
  public listOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { page, limit, sortBy, sortOrder } = req.query;

      const result = await this.organizationService.getOrganizations(
        {},
        {
          page: Number.parseInt(page as string, 10) || 1,
          limit: Math.min(Number.parseInt(limit as string, 10) || 20, 200),
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'ASC' | 'DESC',
        }
      );

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Search organizations
   * GET /api/organizations/search
   */
  public searchOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { name, type, status, parentOrgId, level, tags, page, limit } = req.query;

      const filters: Record<string, unknown> = {};
      if (name) {
        filters.name = name;
      }
      if (type) {
        filters.type = type;
      }
      if (status) {
        filters.status = status;
      }
      if (parentOrgId !== undefined) {
        filters.parentOrgId = parentOrgId === 'null' ? null : parentOrgId;
      }
      if (level) {
        const parsedLevel = Number.parseInt(level as string, 10);
        if (!Number.isNaN(parsedLevel)) {
          filters.level = parsedLevel;
        }
      }
      if (typeof tags === 'string') {
        filters.tags = tags.split(',');
      }

      const pagination = {
        page: Number.parseInt(page as string, 10) || 1,
        limit: Math.min(Number.parseInt(limit as string, 10) || 20, 200),
      };

      const result = await this.organizationService.searchOrganizations(
        (name as string) || '',
        filters,
        pagination
      );

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Update organization
   * PATCH /api/organizations/:id
   */
  public updateOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.SETTINGS,
        PermissionAction.EDIT
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const updates = req.body;
      const organization = await this.organizationService.updateOrganization(id, updates, userId);

      if (!organization) {
        throw new NotFoundError('Organization');
      }

      res.json({
        success: true,
        message: 'Organization updated successfully',
        data: organization,
      });
    });
  };

  /**
   * Rename organization
   * PATCH /api/organizations/:id/rename
   */
  public renameOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { name } = req.body;
      const organization = await this.organizationService.renameOrganization(id, name, userId);

      res.json({
        success: true,
        message: 'Organization renamed successfully',
        data: organization,
      });
    });
  };

  /**
   * Sync organization name from RSI
   * POST /api/organizations/:id/sync-name-from-rsi
   */
  public syncNameFromRsi = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const result = await this.organizationService.syncNameFromRsi(id, userId);

      res.json({
        success: true,
        message:
          result.organization.name === result.rsiName
            ? 'Organization name is already up to date with RSI'
            : `Organization name updated to "${result.rsiName}" from RSI`,
        data: result.organization,
        rsiName: result.rsiName,
      });
    });
  };

  /**
   * Delete organization
   * DELETE /api/organizations/:id
   */
  public deleteOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { deleteDescendants, reason, gracePeriodDays } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is owner or admin
      const isOwnerOrAdmin = await this.permissionService.isOwnerOrAdmin(userId, id);
      if (!isOwnerOrAdmin) {
        throw new ForbiddenError('Only organization owner or admin can delete organization');
      }

      const result = await this.organizationService.deleteOrganization(
        id,
        userId,
        deleteDescendants === 'true',
        {
          reason: reason as string,
          gracePeriodDays: gracePeriodDays
            ? Number.parseInt(gracePeriodDays as string, 10) || undefined
            : undefined,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }
      );

      res.json({
        success: true,
        message: result.message,
        data: {
          requestId: result.requestId,
          scheduledFor: result.scheduledFor,
        },
      });
    });
  };

  // ==================== HIERARCHY MANAGEMENT ====================

  /**
   * Create sub-organization
   * POST /api/organizations/:id/sub-organizations
   */
  public createSubOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: parentId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        parentId,
        ResourceType.HIERARCHY,
        PermissionAction.CREATE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to create sub-organization');
      }

      const orgData = req.body;
      const subOrg = await this.hierarchyService.createSubOrganization(parentId, {
        ...orgData,
        ownerId: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Sub-organization created successfully',
        data: subOrg,
      });
    });
  };

  /**
   * Move organization to new parent
   * PATCH /api/organizations/:id/move
   */
  public moveOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { newParentId } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission on both organizations
      const hasPermissionSource = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.HIERARCHY,
        PermissionAction.EDIT
      );

      if (newParentId) {
        const hasPermissionTarget = await this.permissionService.checkPermission(
          userId,
          newParentId,
          ResourceType.HIERARCHY,
          PermissionAction.EDIT
        );

        if (!hasPermissionSource.allowed || !hasPermissionTarget.allowed) {
          throw new ForbiddenError('Insufficient permissions to move organization');
        }
      } else if (!hasPermissionSource.allowed) {
        throw new ForbiddenError('Insufficient permissions to move organization');
      }

      const result = await this.hierarchyService.moveOrganization(id, newParentId);

      res.json({
        success: true,
        message: 'Organization moved successfully',
        data: result,
      });
    });
  };

  /**
   * Detach organization from parent (make root)
   * POST /api/organizations/:id/detach
   */
  public detachOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is owner or admin
      const isOwnerOrAdmin = await this.permissionService.isOwnerOrAdmin(userId, id);
      if (!isOwnerOrAdmin) {
        throw new ForbiddenError('Only organization owner or admin can detach organization');
      }

      const result = await this.hierarchyService.detachFromParent(id);

      res.json({
        success: true,
        message: 'Organization detached successfully',
        data: result,
      });
    });
  };

  /**
   * Get organization tree
   * GET /api/organizations/:id/tree
   */
  public getOrganizationTree = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;

      const tree = await this.hierarchyService.getTree(id);

      res.json({
        success: true,
        data: tree,
      });
    });
  };

  /**
   * Get organization ancestors
   * GET /api/organizations/:id/ancestors
   */
  public getAncestors = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;

      const ancestors = await this.hierarchyService.getAncestors(id);

      res.json({
        success: true,
        data: ancestors,
      });
    });
  };

  /**
   * Get organization descendants
   * GET /api/organizations/:id/descendants
   */
  public getDescendants = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { maxDepth } = req.query;

      const descendants = await this.hierarchyService.getDescendants(
        id,
        maxDepth ? Number.parseInt(maxDepth as string, 10) || undefined : undefined
      );

      res.json({
        success: true,
        data: descendants,
      });
    });
  };

  /**
   * Get organization siblings
   * GET /api/organizations/:id/siblings
   */
  public getSiblings = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { includeSelf } = req.query;

      const siblings = await this.hierarchyService.getSiblings(id, includeSelf === 'true');

      res.json({
        success: true,
        data: siblings,
      });
    });
  };

  /**
   * Validate organization hierarchy
   * GET /api/organizations/:id/validate
   */
  public validateHierarchy = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;

      const validation = await this.hierarchyService.validateHierarchy(id);

      res.json({
        success: true,
        data: validation,
      });
    });
  };

  /**
   * Get hierarchy statistics
   * GET /api/organizations/:id/hierarchy/stats
   */
  public getHierarchyStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;

      const stats = await this.hierarchyService.getHierarchyStats(id);

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  // ==================== MEMBER MANAGEMENT ====================

  /**
   * Add member to organization
   * POST /api/organizations/:id/members
   */
  public addMember = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const { userId: targetUserId, role } = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      await this.memberService.addMember(
        orgId,
        targetUserId,
        role,
        undefined,
        { addedBy: actorId },
        undefined,
        { acquisitionSource: 'manual' }
      );

      res.status(201).json({
        success: true,
        message: 'Member added successfully',
      });
    });
  };

  /**
   * Remove member from organization
   * DELETE /api/organizations/:id/members/:userId
   */
  public removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId, userId: targetUserId } = req.params;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      await this.memberService.removeMember(orgId, targetUserId, false);

      res.json({
        success: true,
        message: 'Member removed successfully',
      });
    });
  };

  /**
   * Update member role
   * PATCH /api/organizations/:id/members/:userId/role
   */
  public updateMemberRole = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId, userId: targetUserId } = req.params;
      const { role: newRole } = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      await this.memberService.updateMemberRole(orgId, targetUserId, newRole);

      res.json({
        success: true,
        message: 'Member role updated successfully',
      });
    });
  };

  /**
   * Transfer member to another organization
   * POST /api/organizations/:id/members/:userId/transfer
   */
  public transferMember = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: fromOrgId, userId: targetUserId } = req.params;
      const { toOrgId } = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      await this.memberService.transferMember(fromOrgId, toOrgId, targetUserId, actorId);

      res.json({
        success: true,
        message: 'Member transferred successfully',
      });
    });
  };

  // ==================== PERMISSION MANAGEMENT ====================

  /**
   * Grant permission to user
   * POST /api/organizations/:id/permissions
   */
  public grantPermission = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const { userId: targetUserId, resource, actions, scope, ...permissionData } = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission to grant permissions
      const hasPermission = await this.permissionService.checkPermission(
        actorId,
        orgId,
        ResourceType.PERMISSIONS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to grant permissions');
      }

      const permission = await this.permissionService.grantPermission(
        orgId,
        targetUserId,
        { resource, actions, scope, ...permissionData },
        actorId
      );

      res.status(201).json({
        success: true,
        message: 'Permission granted successfully',
        data: permission,
      });
    });
  };

  /**
   * Revoke permission
   * DELETE /api/organizations/:id/permissions/:permissionId
   */
  public revokePermission = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId, permissionId } = req.params;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission to revoke permissions
      const hasPermission = await this.permissionService.checkPermission(
        actorId,
        orgId,
        ResourceType.PERMISSIONS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to revoke permissions');
      }

      await this.permissionService.revokePermission(permissionId);

      res.json({
        success: true,
        message: 'Permission revoked successfully',
      });
    });
  };

  /**
   * Update permission
   * PATCH /api/organizations/:id/permissions/:permissionId
   */
  public updatePermission = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId, permissionId } = req.params;
      const updates = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission to manage permissions
      const hasPermission = await this.permissionService.checkPermission(
        actorId,
        orgId,
        ResourceType.PERMISSIONS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to update permissions');
      }

      const permission = await this.permissionService.updatePermission(permissionId, updates);

      res.json({
        success: true,
        message: 'Permission updated successfully',
        data: permission,
      });
    });
  };

  /**
   * List permissions for organization
   * GET /api/organizations/:id/permissions
   */
  public listPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const userId = req.user?.id;

      let permissions;
      if (userId) {
        // Get user's permissions
        permissions = await this.permissionService.getUserPermissions(userId, orgId);
      } else {
        // Get all organization permissions (requires admin)
        permissions = await this.permissionService.getOrganizationPermissions(orgId);
      }

      res.json({
        success: true,
        data: permissions,
      });
    });
  };

  /**
   * Check permission
   * POST /api/organizations/:id/permissions/check
   */
  public checkPermission = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const { resource, action, resourceId } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const result = await this.permissionService.checkPermission(
        userId,
        orgId,
        resource,
        action,
        resourceId
      );

      res.json({
        success: true,
        data: result,
      });
    });
  };

  /**
   * Apply permission template
   * POST /api/organizations/:id/permissions/template
   */
  public applyPermissionTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const { userId: targetUserId, templateName } = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission to manage permissions
      const hasPermission = await this.permissionService.checkPermission(
        actorId,
        orgId,
        ResourceType.PERMISSIONS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to apply template');
      }

      const permissions = await this.permissionService.applyPermissionTemplate(
        orgId,
        targetUserId,
        templateName,
        actorId
      );

      res.status(201).json({
        success: true,
        message: 'Permission template applied successfully',
        data: permissions,
      });
    });
  };

  /**
   * Get permission statistics
   * GET /api/organizations/:id/permissions/stats
   */
  public getPermissionStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id: orgId } = req.params;

      const stats = await this.permissionService.getPermissionStats(orgId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching permission stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch permission stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // ==================== ACTIVITY LOGS ====================

  /**
   * Get organization activity log
   * GET /api/organizations/:id/activity
   */
  public getActivity = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const { action, actorId, severity, startDate, endDate, page, limit } = req.query;

      const filters: Record<string, unknown> = {};
      if (action) {
        filters.action = action;
      }
      if (actorId) {
        filters.actorId = actorId;
      }
      if (severity) {
        filters.severity = severity;
      }
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const pagination = {
        page: page ? Number.parseInt(page as string, 10) : 1,
        limit: Math.min(limit ? Number.parseInt(limit as string, 10) : 50, 200),
      };

      const result = await this.activityService.getOrganizationActivities(
        orgId,
        filters,
        pagination
      );

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Get activity statistics
   * GET /api/organizations/:id/activity/stats
   */
  public getActivityStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const { startDate, endDate } = req.query;

      const filters: Record<string, unknown> = {};
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const result = await this.activityService.getOrganizationActivities(orgId, filters);

      // Calculate statistics
      const resultData = result as {
        total?: number;
        pagination?: { total?: number };
        items?: unknown[];
        data?: unknown[];
      };
      const stats = {
        totalActivities: resultData.total || resultData.pagination?.total || 0,
        bySeverity: {} as Record<string, number>,
        byAction: {} as Record<string, number>,
        recentActivities: (resultData.items || resultData.data || []).slice(0, 10),
      };

      // Group by severity
      const activities = (resultData.items || resultData.data || []) as Array<{
        severity: string;
        action: string;
      }>;
      for (const activity of activities) {
        stats.bySeverity[activity.severity] = (stats.bySeverity[activity.severity] || 0) + 1;
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
      }

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  // ==================== SETTINGS ====================

  /**
   * Update organization settings
   * PATCH /api/organizations/:id/settings
   */
  public updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: orgId } = req.params;
      const settings = req.body;
      const actorId = req.user?.id;
      if (!actorId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        actorId,
        orgId,
        ResourceType.SETTINGS,
        PermissionAction.EDIT
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to update settings');
      }

      const organization = await this.settingsService.updateSettings(orgId, settings, true);

      if (!organization) {
        throw new NotFoundError('Organization');
      }

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: organization,
      });
    });
  };

  // ==================== ANALYTICS ====================

  /**
   * Get analytics dashboard
   * GET /api/organizations/:id/analytics/dashboard
   */
  public getAnalyticsDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { period, refresh } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.ANALYTICS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view analytics');
      }

      const dashboard = await this.analyticsService.getDashboard(
        id,
        (period as AnalyticsPeriod) || AnalyticsPeriod.WEEKLY,
        refresh === 'true'
      );

      res.json({
        success: true,
        data: dashboard,
      });
    });
  };

  /**
   * Get member statistics
   * GET /api/organizations/:id/analytics/members
   */
  public getMemberStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { period } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.ANALYTICS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view analytics');
      }

      const analytics = await this.analyticsService.generateAnalytics(
        id,
        (period as AnalyticsPeriod) || AnalyticsPeriod.WEEKLY
      );

      res.json({
        success: true,
        data: analytics.memberStats,
      });
    });
  };

  /**
   * Get activity metrics
   * GET /api/organizations/:id/analytics/activity
   */
  public getActivityMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { period } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.ANALYTICS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view analytics');
      }

      const analytics = await this.analyticsService.generateAnalytics(
        id,
        (period as AnalyticsPeriod) || AnalyticsPeriod.WEEKLY
      );

      res.json({
        success: true,
        data: analytics.activityMetrics,
      });
    });
  };

  /**
   * Get growth trends
   * GET /api/organizations/:id/analytics/growth
   */
  public getGrowthTrends = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { period } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.ANALYTICS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view analytics');
      }

      const analytics = await this.analyticsService.generateAnalytics(
        id,
        (period as AnalyticsPeriod) || AnalyticsPeriod.WEEKLY
      );

      res.json({
        success: true,
        data: analytics.growthMetrics,
      });
    });
  };

  /**
   * Export analytics
   * GET /api/organizations/:id/analytics/export
   */
  public exportAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { period, format } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.ANALYTICS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to export analytics');
      }

      const data = await this.analyticsService.exportAnalytics(
        id,
        (period as AnalyticsPeriod) || AnalyticsPeriod.WEEKLY,
        (format as 'json' | 'csv') || 'json'
      );

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${id}-${period || 'weekly'}.${format || 'json'}"`
      );
      res.send(data);
    });
  };

  // ==================== TEMPLATES ====================

  /**
   * Create template
   * POST /api/organizations/templates
   */
  public createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const template = await this.templateService.createTemplate(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template,
      });
    });
  };

  /**
   * Search marketplace
   * GET /api/organizations/templates/marketplace
   */
  public searchMarketplace = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { search, category, tags, minRating, sortBy, sortOrder, limit, offset } = req.query;

      const result = await this.templateService.searchMarketplace({
        search: search as string,
        category: category as TemplateCategory,
        tags: typeof tags === 'string' ? tags.split(',') : undefined,
        minRating: minRating ? Number.parseFloat(minRating as string) : undefined,
        sortBy: sortBy as 'usage' | 'rating' | 'recent' | 'name',
        sortOrder: sortOrder as 'ASC' | 'DESC',
        limit: Math.min(limit ? Number.parseInt(limit as string, 10) : 20, 200),
        offset: offset ? Number.parseInt(offset as string, 10) : 0,
      });

      res.json({
        success: true,
        data: result.templates,
        total: result.total,
      });
    });
  };

  /**
   * List templates
   * GET /api/organizations/templates
   */
  public listTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { category, visibility } = req.query;

      const templates = await this.templateService.getTemplatesByCategory(
        category as TemplateCategory,
        visibility as TemplateVisibility
      );

      res.json({
        success: true,
        data: templates,
      });
    });
  };

  /**
   * Get popular templates
   * GET /api/organizations/templates/popular
   */
  public getPopularTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { limit } = req.query;
      const templates = await this.templateService.getPopularTemplates(
        Math.min(limit ? Number.parseInt(limit as string, 10) : 10, 200)
      );

      res.json({
        success: true,
        data: templates,
      });
    });
  };

  /**
   * Get top rated templates
   * GET /api/organizations/templates/top-rated
   */
  public getTopRatedTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { limit } = req.query;
      const templates = await this.templateService.getTopRatedTemplates(
        Math.min(limit ? Number.parseInt(limit as string, 10) : 10, 200)
      );

      res.json({
        success: true,
        data: templates,
      });
    });
  };

  /**
   * Get template
   * GET /api/organizations/templates/:id
   */
  public getTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const template = await this.templateService.getTemplateById(id);

      if (!template) {
        throw new NotFoundError('Template');
      }

      res.json({
        success: true,
        data: template,
      });
    });
  };

  /**
   * Update template
   * PUT /api/organizations/templates/:id
   */
  public updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const template = await this.templateService.updateTemplate(id, userId, req.body);

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: template,
      });
    });
  };

  /**
   * Delete template
   * DELETE /api/organizations/templates/:id
   */
  public deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      await this.templateService.deleteTemplate(id, userId);

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    });
  };

  /**
   * Apply template
   * POST /api/organizations/templates/:id/apply
   */
  public applyTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // If applying to existing org, check permission
      if (req.body.organizationId) {
        const hasPermission = await this.permissionService.checkPermission(
          userId,
          req.body.organizationId,
          ResourceType.SETTINGS,
          PermissionAction.EDIT
        );

        if (!hasPermission.allowed) {
          throw new ForbiddenError('Insufficient permissions to apply template');
        }
      }

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, [
        'name',
        'description',
        'settings',
        'customizations',
      ]);

      const organization = await this.templateService.applyTemplate(id, {
        ...safeBody,
        ownerId: userId,
      });

      res.status(201).json({
        success: true,
        message: 'Template applied successfully',
        data: organization,
      });
    });
  };

  /**
   * Fork template
   * POST /api/organizations/templates/:id/fork
   */
  public forkTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const template = await this.templateService.forkTemplate(id, userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Template forked successfully',
        data: template,
      });
    });
  };

  /**
   * Rate template
   * POST /api/organizations/templates/:id/rate
   */
  public rateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { rating } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const template = await this.templateService.rateTemplate(id, userId, rating);

      res.json({
        success: true,
        message: 'Template rated successfully',
        data: template,
      });
    });
  };

  /**
   * Export template
   * GET /api/organizations/templates/:id/export
   */
  public exportTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const data = await this.templateService.exportTemplate(id);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="template-${id}.json"`);
      res.json(data);
    });
  };

  /**
   * Import template
   * POST /api/organizations/templates/import
   */
  public importTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const template = await this.templateService.importTemplate(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Template imported successfully',
        data: template,
      });
    });
  };

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk add members
   * POST /api/organizations/:id/bulk/add-members
   */
  public bulkAddMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { members } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.MEMBERS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to add members');
      }

      const result = await this.bulkService.bulkAddMembers(id, members, userId);

      res.json({
        success: true,
        message: `Successfully added ${result.successful} members, ${result.failed} failed`,
        data: result,
      });
    });
  };

  /**
   * Bulk remove members
   * POST /api/organizations/:id/bulk/remove-members
   */
  public bulkRemoveMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { userIds } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.MEMBERS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to remove members');
      }

      const result = await this.bulkService.bulkRemoveMembers(id, userIds, userId);

      res.json({
        success: true,
        message: `Successfully removed ${result.successful} members, ${result.failed} failed`,
        data: result,
      });
    });
  };

  /**
   * Bulk update roles
   * POST /api/organizations/:id/bulk/update-roles
   */
  public bulkUpdateRoles = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { updates } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.MEMBERS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to update roles');
      }

      const result = await this.bulkService.bulkUpdateRoles(id, updates, userId);

      res.json({
        success: true,
        message: `Successfully updated ${result.successful} roles, ${result.failed} failed`,
        data: result,
      });
    });
  };

  /**
   * Bulk grant permissions
   * POST /api/organizations/:id/bulk/grant-permissions
   */
  public bulkGrantPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { grants } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.PERMISSIONS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to grant permissions');
      }

      const result = await this.bulkService.bulkGrantPermissions(id, grants, userId);

      res.json({
        success: true,
        message: `Successfully granted permissions to ${result.successful} members, ${result.failed} failed`,
        data: result,
      });
    });
  };

  /**
   * Bulk revoke permissions
   * POST /api/organizations/:id/bulk/revoke-permissions
   */
  public bulkRevokePermissions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { revocations } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.PERMISSIONS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to revoke permissions');
      }

      const result = await this.bulkService.bulkRevokePermissions(id, revocations, userId);

      res.json({
        success: true,
        message: `Successfully revoked permissions from ${result.successful} members, ${result.failed} failed`,
        data: result,
      });
    });
  };

  /**
   * Import members from CSV
   * POST /api/organizations/:id/bulk/import
   */
  public importMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { csvContent } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.MEMBERS,
        PermissionAction.MANAGE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to import members');
      }

      const result = await this.bulkService.importMembersFromCSV(id, csvContent, userId);

      res.json({
        success: true,
        message: `Successfully imported ${result.successful} members, ${result.failed} failed`,
        data: result,
      });
    });
  };

  /**
   * Export members to CSV
   * GET /api/organizations/:id/bulk/export
   */
  public exportMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.MEMBERS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to export members');
      }

      const csv = await this.bulkService.exportMembersToCSV(id);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="members-${id}.csv"`);
      res.send(csv);
    });
  };

  /**
   * Get bulk operation stats
   * GET /api/organizations/:id/bulk/stats
   */
  public getBulkStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.ANALYTICS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view stats');
      }

      const stats = await this.bulkService.getBulkOperationStats(id);

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  // ==================== DISCORD INTEGRATION ====================

  /**
   * Connect Discord guild to organization
   * POST /api/organizations/:id/discord/connect
   *
   * Creates or updates a guild-to-organization mapping.
   * Auto-syncs when organization connects their Discord server.
   */
  public connectDiscordGuild = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { guildId, guildName } = req.body;

      if (!guildId) {
        throw new Error('Guild ID is required');
      }

      // Check permission - user must be owner/founder/admin of the organization
      let hasPermission = false;
      try {
        const permResult = await this.permissionService.checkPermission(
          userId,
          id,
          ResourceType.SETTINGS,
          PermissionAction.EDIT
        );
        hasPermission = permResult.allowed;
      } catch (permError) {
        // Permission service may fail (e.g., missing tables). Fall back to membership check.
        logger.warn('Permission check failed, falling back to membership role', {
          error: permError instanceof Error ? permError.message : String(permError),
        });
        const membership = await this.memberService.getMember(id, userId);
        const roleName = getRoleName(membership?.role);
        hasPermission = ['owner', 'founder', 'admin'].includes(roleName);
      }

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions to connect Discord guild');
      }

      // Verify organization exists
      const organization = await this.organizationService.getOrganizationById(id);
      if (!organization) {
        throw new NotFoundError('Organization');
      }

      // Import and use the GuildOrganizationService
      const { GuildOrganizationService } =
        await import('../services/discord/GuildOrganizationService');
      const guildOrgService = GuildOrganizationService.getInstance();

      // Resolve the real guild name and icon from Discord API
      const guildInfo = await guildOrgService.fetchGuildInfo(guildId as string);
      const resolvedGuildName =
        guildInfo?.name ?? (guildName as string) ?? `Guild ${guildId as string}`;

      // Sync the guild mapping
      const mapping = await guildOrgService.syncOnDiscordConnection(
        guildId,
        id,
        resolvedGuildName,
        userId
      );

      // Store the guild icon URL in settings if available
      if (guildInfo?.iconUrl) {
        const { discordSettingsService } =
          await import('../services/discord/DiscordSettingsService');
        const settings = await discordSettingsService.getOrCreateSettings(
          id,
          guildId as string,
          resolvedGuildName,
          guildInfo.iconUrl
        );
        if (settings && !settings.guildIconUrl) {
          settings.guildIconUrl = guildInfo.iconUrl;
          await discordSettingsService.saveSettings(settings);
        }
      }

      // Log the activity
      await this.activityService.logActivity({
        organizationId: id,
        actorId: userId,
        actorType: 'user',
        action: OrgActivityAction.SETTINGS_UPDATED,
        description: `Discord guild ${guildId} connected`,
        severity: ActivitySeverity.INFO,
        metadata: {
          setting: 'discord_guild',
          guildId,
          guildName: mapping.guildName,
          isPrimary: mapping.isPrimary,
        },
      });

      res.json({
        success: true,
        message: 'Discord guild connected successfully',
        data: {
          guildId: mapping.guildId,
          organizationId: mapping.organizationId,
          guildName: mapping.guildName,
          isPrimary: mapping.isPrimary,
          isActive: mapping.isActive,
        },
      });
    });
  };

  /**
   * Disconnect Discord guild from organization
   * DELETE /api/organizations/:id/discord/disconnect/:guildId
   */
  public disconnectDiscordGuild = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id, guildId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        ResourceType.SETTINGS,
        PermissionAction.EDIT
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to disconnect Discord guild');
      }

      // Import and use the GuildOrganizationService
      const { GuildOrganizationService } =
        await import('../services/discord/GuildOrganizationService');
      const guildOrgService = GuildOrganizationService.getInstance();

      const success = await guildOrgService.deactivateMapping(guildId, userId);

      if (!success) {
        throw new NotFoundError('Guild mapping');
      }

      // Log the activity
      await this.activityService.logActivity({
        organizationId: id,
        actorId: userId,
        actorType: 'user',
        action: OrgActivityAction.SETTINGS_UPDATED,
        description: `Discord guild ${guildId} disconnected`,
        severity: ActivitySeverity.INFO,
        metadata: {
          setting: 'discord_guild',
          action: 'disconnect',
          guildId,
        },
      });

      res.json({
        success: true,
        message: 'Discord guild disconnected successfully',
      });
    });
  };

  /**
   * Get Discord guilds for organization
   * GET /api/organizations/:id/discord/guilds
   */
  public getDiscordGuilds = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission with fallback to membership role
      let hasPermission = false;
      try {
        const permResult = await this.permissionService.checkPermission(
          userId,
          id,
          ResourceType.SETTINGS,
          PermissionAction.VIEW
        );
        hasPermission = permResult.allowed;
      } catch (permError) {
        logger.warn('Permission check failed for getDiscordGuilds, falling back to membership', {
          error: permError instanceof Error ? permError.message : String(permError),
        });
        const membership = await this.memberService.getMember(id, userId);
        hasPermission = !!membership; // Any active member can view guilds
      }

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions to view Discord guilds');
      }

      // Import and use the GuildOrganizationService
      const { GuildOrganizationService } =
        await import('../services/discord/GuildOrganizationService');
      const guildOrgService = GuildOrganizationService.getInstance();

      const guilds = await guildOrgService.getGuildsForOrganization(id);

      // Enrich guild names and icons from Discord API
      const enrichedGuilds = await Promise.all(
        guilds.map(async g => {
          let name = g.guildName;
          let iconUrl: string | null = null;

          // Fetch guild info from Discord API for enrichment
          const guildInfo = await guildOrgService.fetchGuildInfo(g.guildId);
          if (guildInfo) {
            iconUrl = guildInfo.iconUrl;
            if (!name || name.startsWith('Guild ')) {
              if (guildInfo.name !== name) {
                // Persist the resolved name for future requests
                name = guildInfo.name;
                await guildOrgService.createOrUpdateMapping(
                  g.guildId,
                  g.organizationId,
                  guildInfo.name,
                  g.isPrimary
                );
              }
            }
          }

          return {
            guildId: g.guildId,
            guildName: name,
            guildIconUrl: iconUrl,
            isPrimary: g.isPrimary,
            isActive: g.isActive,
            createdAt: g.createdAt,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedGuilds,
      });
    });
  };

  // ==================== DELETION REQUEST MANAGEMENT ====================

  /**
   * Get pending deletion requests (admin only)
   * GET /api/organizations/deletion-requests/pending
   */
  public getPendingDeletionRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Require admin role
      this.requireAdmin(req);

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const requests = await deletionService.getPendingRequests();

      res.json({
        success: true,
        data: requests,
      });
    });
  };

  /**
   * Get deletion request by ID
   * GET /api/organizations/deletion-requests/:requestId
   */
  public getDeletionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { requestId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const request = await deletionService.getRequestById(requestId);
      if (!request) {
        throw new NotFoundError('Deletion request');
      }

      res.json({
        success: true,
        data: request,
      });
    });
  };

  /**
   * Approve deletion request (admin only)
   * POST /api/organizations/deletion-requests/:requestId/approve
   */
  public approveDeletionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { requestId } = req.params;
      const { notes, generateExport } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Require admin role
      this.requireAdmin(req);

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const request = await deletionService.approveDeletionRequest(requestId, userId, {
        notes,
        generateExport: generateExport !== false,
      });

      res.json({
        success: true,
        message: 'Deletion request approved successfully',
        data: request,
      });
    });
  };

  /**
   * Reject deletion request (admin only)
   * POST /api/organizations/deletion-requests/:requestId/reject
   */
  public rejectDeletionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { requestId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!reason) {
        throw new Error('Rejection reason is required');
      }

      // Require admin role
      this.requireAdmin(req);

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const request = await deletionService.rejectDeletionRequest(requestId, userId, reason);

      res.json({
        success: true,
        message: 'Deletion request rejected successfully',
        data: request,
      });
    });
  };

  /**
   * Cancel deletion request
   * POST /api/organizations/deletion-requests/:requestId/cancel
   */
  public cancelDeletionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { requestId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const request = await deletionService.cancelDeletionRequest(requestId, userId, reason);

      res.json({
        success: true,
        message: 'Deletion request cancelled successfully',
        data: request,
      });
    });
  };

  /**
   * Get deletion preview
   * GET /api/organizations/:id/deletion-preview
   */
  public getDeletionPreview = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { deleteDescendants } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        id,
        'ORGANIZATION' as ResourceType,
        'DELETE' as PermissionAction
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const preview = await deletionService.generateDeletionPreview(
        id,
        deleteDescendants === 'true'
      );

      res.json({
        success: true,
        data: preview,
      });
    });
  };

  /**
   * Get latest deletion request for organization
   * GET /api/organizations/:id/deletion-requests/latest
   */
  public getLatestDeletionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const requests = await deletionService.getRequestsForOrganization(id);

      // Get the most recent non-completed, non-failed request
      const latestRequest = requests.find(
        r => !['completed', 'failed', 'rejected', 'cancelled'].includes(r.status)
      );

      if (!latestRequest) {
        throw new NotFoundError('No active deletion request found');
      }

      res.json({
        success: true,
        data: latestRequest,
      });
    });
  };

  // Legacy methods for backwards compatibility
  public getOrganizations = async (req: AuthRequest, res: Response): Promise<void> =>
    this.listOrganizations(req, res);

  public addOrganization = async (req: AuthRequest, res: Response): Promise<void> =>
    this.createOrganization(req, res);

  public removeOrganization = async (req: AuthRequest, res: Response): Promise<void> =>
    this.deleteOrganization(req, res);
}
