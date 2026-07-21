import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { PermissionService, PermissionTemplateService } from '../services/security';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Controller for permission template operations
 * Extends BaseController for standardized error handling
 */
export class PermissionTemplateController extends BaseController {
  private templateService = new PermissionTemplateService();
  private permissionService = new PermissionService();

  /**
   * List all available permission templates
   * GET /api/permission-templates
   */
  public listTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.query.organizationId as string;
      const templates = this.templateService.listTemplates(organizationId);
      return {
        templates,
        count: templates.length,
      };
    });
  };

  /**
   * Get specific template
   * GET /api/permission-templates/:templateId
   */
  public getTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { templateId } = req.params;
      const template = this.templateService.getTemplate(templateId);

      if (!template) {
        throw new NotFoundError('Template');
      }

      return template;
    });
  };

  /**
   * Create custom permission template
   * POST /api/permission-templates
   */
  public createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { name, description, permissions, securityLevel, organizationId } = req.body;
      const user = this.getAuthUser(req);

      this.validateRequired(
        { name, description, permissions, organizationId },
        'name',
        'description',
        'permissions',
        'organizationId'
      );

      if (securityLevel === undefined) {
        throw new ValidationError('Security level is required');
      }

      // Check if user has permission to create templates
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        organizationId,
        'permissions',
        'manage'
      );

      if (!hasPermission && user.role !== 'admin') {
        throw new ForbiddenError('Insufficient permissions to create templates');
      }

      const template = this.templateService.createTemplate(
        name,
        description,
        permissions,
        securityLevel,
        organizationId,
        user.id
      );

      res.status(201).json(template);
    });
  };

  /**
   * Update custom permission template
   * PUT /api/permission-templates/:templateId
   */
  public updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { templateId } = req.params;
      const updates = req.body;
      const user = this.getAuthUser(req);

      const template = this.templateService.getTemplate(templateId);

      if (!template) {
        throw new NotFoundError('Template');
      }

      if (template.organizationId) {
        // Check if user has permission to manage templates
        const hasPermission = await this.permissionService.hasPermission(
          user.id,
          template.organizationId,
          'permissions',
          'manage'
        );

        if (!hasPermission && user.role !== 'admin') {
          throw new ForbiddenError('Insufficient permissions to update template');
        }
      }

      try {
        const updated = this.templateService.updateTemplate(templateId, updates);

        if (!updated) {
          throw new ValidationError('Failed to update template');
        }

        return updated;
      } catch (error) {
        if (error instanceof Error && error.message === 'Cannot modify system templates') {
          throw new ForbiddenError('Cannot modify system templates');
        }
        throw error;
      }
    });
  };

  /**
   * Delete custom permission template
   * DELETE /api/permission-templates/:templateId
   */
  public deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { templateId } = req.params;
      const user = this.getAuthUser(req);

      const template = this.templateService.getTemplate(templateId);

      if (!template) {
        throw new NotFoundError('Template');
      }

      if (template.organizationId) {
        // Check if user has permission to manage templates
        const hasPermission = await this.permissionService.hasPermission(
          user.id,
          template.organizationId,
          'permissions',
          'manage'
        );

        if (!hasPermission && user.role !== 'admin') {
          throw new ForbiddenError('Insufficient permissions to delete template');
        }
      }

      try {
        const deleted = this.templateService.deleteTemplate(templateId);

        if (!deleted) {
          throw new ValidationError('Failed to delete template');
        }

        return { message: 'Template deleted successfully' };
      } catch (error) {
        if (error instanceof Error && error.message === 'Cannot delete system templates') {
          throw new ForbiddenError('Cannot delete system templates');
        }
        throw error;
      }
    });
  };

  /**
   * Apply permission template to user
   * POST /api/permission-templates/:templateId/apply
   */
  public applyTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { templateId } = req.params;
      const { userId, organizationId, reason } = req.body;
      const user = this.getAuthUser(req);

      this.validateRequired({ userId, organizationId }, 'userId', 'organizationId');

      // Check if user has permission to manage permissions
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        organizationId,
        'permissions',
        'manage'
      );

      if (!hasPermission && user.role !== 'admin') {
        throw new ForbiddenError('Insufficient permissions to apply template');
      }

      await this.templateService.applyTemplate(templateId, userId, organizationId, user.id, reason);

      return {
        message: 'Template applied successfully',
        userId,
        organizationId,
        templateId,
      };
    });
  };

  /**
   * Get permission usage statistics for a user
   * GET /api/permission-templates/usage/:userId
   */
  public getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId } = req.params;
      const { organizationId } = req.query;
      const user = this.getAuthUser(req);

      this.validateRequired({ organizationId }, 'organizationId');

      // Check if user has permission to view stats
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        organizationId as string,
        'permissions',
        'read'
      );

      if (!hasPermission && user.role !== 'admin' && user.id !== userId) {
        throw new ForbiddenError('Insufficient permissions to view stats');
      }

      const stats = await this.templateService.getUserPermissionStats(
        userId,
        organizationId as string
      );

      if (!stats) {
        throw new NotFoundError('Permission data');
      }

      return stats;
    });
  };

  /**
   * Generate permission usage report for organization
   * GET /api/permission-templates/reports/:organizationId
   */
  public generateReport = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { organizationId } = req.params;
      const user = this.getAuthUser(req);

      // Check if user has permission to view reports
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        organizationId,
        'permissions',
        'read'
      );

      if (!hasPermission && user.role !== 'admin') {
        throw new ForbiddenError('Insufficient permissions to view reports');
      }

      return this.templateService.generateUsageReport(organizationId);
    });
  };

  /**
   * Get permission audit log
   * GET /api/permission-templates/audit
   */
  public getAuditLog = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { organizationId, userId, startDate, endDate, limit } = req.query;
      const user = this.getAuthUser(req);

      // Check if user has permission to view audit logs
      if (organizationId) {
        const hasPermission = await this.permissionService.hasPermission(
          user.id,
          organizationId as string,
          'permissions',
          'read'
        );

        if (!hasPermission && user.role !== 'admin') {
          throw new ForbiddenError('Insufficient permissions to view audit logs');
        }
      } else if (user.role !== 'admin') {
        throw new ForbiddenError('Admin access required for cross-organization audit logs');
      }

      const auditLog = this.templateService.getAuditLog(
        organizationId as string | undefined,
        userId as string | undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        Math.min(limit ? parseInt(limit as string) : 100, 200)
      );

      return {
        entries: auditLog,
        count: auditLog.length,
      };
    });
  };

  /**
   * Get service statistics
   * GET /api/permission-templates/stats
   */
  public getServiceStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.requireRole(req, 'admin');

      return this.templateService.getServiceStats();
    });
  };
}
