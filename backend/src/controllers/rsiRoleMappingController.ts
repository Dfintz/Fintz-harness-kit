/**
 * RSI Role Mapping Controller
 *
 * Handles RSI role mapping configuration endpoints for managing
 * the mapping between RSI ranks and Discord roles / RBAC permissions.
 *
 * Phase 2: RSI Role Sync System - Role Mapping Configuration
 */

import { Response } from 'express';

import { AppDataSource } from '../data-source';
import { AuthRequest } from '../middleware/auth';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { RbacPermissions } from '../models/RsiRoleMapping';
import { RsiRoleMappingService, rsiRoleMappingService } from '../services/rsi';
import { ForbiddenError, NotFoundError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * Request body for creating a role mapping
 */
interface CreateMappingBody {
  rsiRank: string;
  discordRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive?: boolean;
  priority?: number;
  description?: string;
  internalRoleId?: string;
}

/**
 * Request body for updating a role mapping
 */
interface UpdateMappingBody {
  discordRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive?: boolean;
  priority?: number;
  description?: string;
  internalRoleId?: string;
}

/**
 * Request body for applying a template
 */
interface ApplyTemplateBody {
  templateName: string;
  discordRoleMappings?: Record<string, string>;
}

/**
 * Request body for bulk upsert
 */
interface BulkUpsertBody {
  mappings: Array<{
    rsiRank: string;
    discordRoleId?: string;
    rbacPermissions?: RbacPermissions;
    priority?: number;
    description?: string;
  }>;
}

/**
 * Request body for cloning mappings
 */
interface CloneMappingsBody {
  sourceOrgId: string;
  includeDiscordRoles?: boolean;
}

/**
 * RSI Role Mapping Controller
 * Manages RSI rank to Discord role and RBAC permission mappings
 */
export class RsiRoleMappingController extends BaseController {
  private readonly roleMappingService: RsiRoleMappingService;

  constructor() {
    super();
    this.roleMappingService = rsiRoleMappingService;
  }

  /**
   * Get all role mappings for an organization
   * GET /api/organizations/:organizationId/rsi-role-mappings
   */
  public getMappings = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.organizationId;
      const includeInactive = parseBooleanQuery(req.query.includeInactive);

      const mappings = await this.roleMappingService.getMappingsByOrganization(
        organizationId,
        includeInactive
      );

      return {
        mappings: mappings.map(m => ({
          id: m.id,
          rsiRank: m.rsiRank,
          discordRoleId: m.discordRoleId,
          internalRoleId: m.internalRoleId,
          rbacPermissions: m.rbacPermissions,
          isActive: m.isActive,
          priority: m.priority,
          description: m.description,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          summary: m.getSummary(),
        })),
        count: mappings.length,
      };
    });
  };

  /**
   * Get discovered RSI ranks from crawled member data
   * GET /api/v2/rsi-role-mappings/:organizationId/discovered-ranks
   */
  public getDiscoveredRanks = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.organizationId;
      return this.roleMappingService.getDiscoveredRanks(organizationId);
    });
  };

  /**
   * Get a read-only dry-run preview of applying the current role mappings
   * GET /api/v2/rsi/role-mapping/:organizationId/preview
   */
  public getSyncPreview = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.organizationId;
      const user = this.getAuthUser(req);

      // Authorize: the requester must be an active member of the organization.
      // This gates the new endpoint explicitly (the sibling read endpoints predate
      // an org-membership check — tracked as a separate hardening follow-up).
      const membership = await AppDataSource.getRepository(OrganizationMembership).findOne({
        where: { userId: user.id, organizationId, isActive: true },
      });
      if (!membership) {
        throw new ForbiddenError('You are not an active member of this organization');
      }

      return this.roleMappingService.buildSyncPreview(organizationId);
    });
  };

  /**
   * Get a specific role mapping by ID
   * GET /api/organizations/:organizationId/rsi-role-mappings/:id
   */
  public getMapping = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { organizationId, id } = req.params;

      const mapping = await this.roleMappingService.getMappingById(id, organizationId);

      if (!mapping) {
        throw new NotFoundError('Role mapping');
      }

      return {
        id: mapping.id,
        rsiRank: mapping.rsiRank,
        discordRoleId: mapping.discordRoleId,
        internalRoleId: mapping.internalRoleId,
        rbacPermissions: mapping.rbacPermissions,
        isActive: mapping.isActive,
        priority: mapping.priority,
        description: mapping.description,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt,
        enabledPermissions: mapping.getEnabledPermissions(),
      };
    });
  };

  /**
   * Create a new role mapping
   * POST /api/organizations/:organizationId/rsi-role-mappings
   */
  public createMapping = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const user = this.getAuthUser(req);
        const organizationId = req.params.organizationId;
        const body = req.body as CreateMappingBody;

        const mapping = await this.roleMappingService.createMapping({
          organizationId,
          rsiRank: body.rsiRank,
          discordRoleId: body.discordRoleId,
          rbacPermissions: body.rbacPermissions,
          isActive: body.isActive,
          priority: body.priority,
          description: body.description,
          internalRoleId: body.internalRoleId,
        });

        logger.info(`Role mapping created by user ${user.id}`, {
          mappingId: mapping.id,
          organizationId,
          rsiRank: body.rsiRank,
        });

        return {
          message: 'Role mapping created successfully',
          mapping: {
            id: mapping.id,
            rsiRank: mapping.rsiRank,
            discordRoleId: mapping.discordRoleId,
            internalRoleId: mapping.internalRoleId,
            rbacPermissions: mapping.rbacPermissions,
            isActive: mapping.isActive,
            priority: mapping.priority,
            description: mapping.description,
            createdAt: mapping.createdAt,
          },
        };
      },
      201
    );
  };

  /**
   * Update a role mapping
   * PUT /api/organizations/:organizationId/rsi-role-mappings/:id
   */
  public updateMapping = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { organizationId, id } = req.params;
      const body = req.body as UpdateMappingBody;

      const mapping = await this.roleMappingService.updateMapping(
        id,
        {
          discordRoleId: body.discordRoleId,
          rbacPermissions: body.rbacPermissions,
          isActive: body.isActive,
          priority: body.priority,
          description: body.description,
          internalRoleId: body.internalRoleId,
        },
        organizationId
      );

      if (!mapping) {
        throw new NotFoundError('Role mapping');
      }

      logger.info(`Role mapping updated by user ${user.id}`, {
        mappingId: id,
      });

      return {
        message: 'Role mapping updated successfully',
        mapping: {
          id: mapping.id,
          rsiRank: mapping.rsiRank,
          discordRoleId: mapping.discordRoleId,
          internalRoleId: mapping.internalRoleId,
          rbacPermissions: mapping.rbacPermissions,
          isActive: mapping.isActive,
          priority: mapping.priority,
          description: mapping.description,
          updatedAt: mapping.updatedAt,
        },
      };
    });
  };

  /**
   * Delete a role mapping
   * DELETE /api/organizations/:organizationId/rsi-role-mappings/:id
   */
  public deleteMapping = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { organizationId, id } = req.params;

      const deleted = await this.roleMappingService.deleteMapping(id, user.id, organizationId);

      if (!deleted) {
        throw new NotFoundError('Role mapping');
      }

      logger.info(`Role mapping deleted by user ${user.id}`, {
        mappingId: id,
      });

      return {
        message: 'Role mapping deleted successfully',
      };
    });
  };

  /**
   * Get available templates
   * GET /api/rsi-role-mappings/templates
   */
  public getTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/require-await
    await this.executeAndReturn(req, res, async () => {
      const templates = this.roleMappingService.getAvailableTemplates();

      return {
        templates,
      };
    });
  };

  /**
   * Get template details
   * GET /api/rsi-role-mappings/templates/:templateName
   */
  public getTemplateDetails = async (req: AuthRequest, res: Response): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/require-await
    await this.executeAndReturn(req, res, async () => {
      const { templateName } = req.params;

      const template = this.roleMappingService.getTemplateDetails(templateName);

      if (!template) {
        throw new NotFoundError('Template');
      }

      return {
        name: template.name,
        description: template.description,
        mappings: template.mappings,
      };
    });
  };

  /**
   * Apply a template to an organization
   * POST /api/organizations/:organizationId/rsi-role-mappings/apply-template
   */
  public applyTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = req.params.organizationId;
      const body = req.body as ApplyTemplateBody;

      const result = await this.roleMappingService.applyTemplate(
        organizationId,
        body.templateName,
        body.discordRoleMappings
      );

      logger.info(`Template "${body.templateName}" applied by user ${user.id}`, {
        organizationId,
        result,
      });

      return {
        message: `Template "${body.templateName}" applied successfully`,
        result,
      };
    });
  };

  /**
   * Bulk upsert mappings
   * POST /api/organizations/:organizationId/rsi-role-mappings/bulk
   */
  public bulkUpsert = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = req.params.organizationId;
      const body = req.body as BulkUpsertBody;

      const result = await this.roleMappingService.upsertMappings(organizationId, body.mappings);

      logger.info(`Bulk upsert performed by user ${user.id}`, {
        organizationId,
        result,
      });

      return {
        message: 'Bulk operation completed',
        result,
      };
    });
  };

  /**
   * Clone mappings from another organization
   * POST /api/organizations/:organizationId/rsi-role-mappings/clone
   */
  public cloneMappings = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = req.params.organizationId;
      const body = req.body as CloneMappingsBody;

      const result = await this.roleMappingService.cloneMappings(
        body.sourceOrgId,
        organizationId,
        body.includeDiscordRoles ?? false
      );

      logger.info(`Mappings cloned by user ${user.id}`, {
        sourceOrgId: body.sourceOrgId,
        targetOrgId: organizationId,
        result,
      });

      return {
        message: 'Mappings cloned successfully',
        result,
      };
    });
  };

  /**
   * Get organization mapping summary
   * GET /api/organizations/:organizationId/rsi-role-mappings/summary
   */
  public getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.organizationId;

      const summary = await this.roleMappingService.getOrganizationMappingSummary(organizationId);

      return summary;
    });
  };

  /**
   * Delete all mappings for an organization
   * DELETE /api/organizations/:organizationId/rsi-role-mappings
   */
  public deleteAllMappings = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = req.params.organizationId;

      const deletedCount = await this.roleMappingService.deleteAllMappings(organizationId, user.id);

      logger.info(`All mappings deleted by user ${user.id}`, {
        organizationId,
        deletedCount,
      });

      return {
        message: 'All mappings deleted successfully',
        deletedCount,
      };
    });
  };
}
