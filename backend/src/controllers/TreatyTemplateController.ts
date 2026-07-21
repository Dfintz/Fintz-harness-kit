import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { TreatyTemplateService } from '../services/organization/TreatyTemplateService';
import { BadRequestError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Controller for treaty template operations.
 * All methods require authenticated user with organization context.
 *
 * Treaty templates are reusable agreement blueprints for alliances and federations.
 */
export class TreatyTemplateController extends BaseController {
  private readonly templateService = new TreatyTemplateService();

  constructor() {
    super();
  }

  private getOrgContext(req: AuthRequest): { userId: string; orgId: string } {
    const userId = req.user?.id;
    const orgId = req.tenantContext?.organizationId ?? req.user?.currentOrganizationId;
    if (!userId || !orgId) {
      throw new BadRequestError('Organization context is required');
    }
    return { userId, orgId };
  }

  /**
   * GET /treaty-templates
   * List available templates (built-in + org-owned).
   */
  public list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      const { category, scope, search, page, limit } = req.query;

      return this.templateService.getTemplates(
        orgId,
        {
          category: category as string | undefined,
          scope: scope as string | undefined,
          search: search as string | undefined,
        } as Parameters<TreatyTemplateService['getTemplates']>[1],
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
        }
      );
    });
  };

  /**
   * GET /treaty-templates/:id
   * Get a single template by ID.
   */
  public getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.templateService.getTemplateById(orgId, req.params.id);
    });
  };

  /**
   * POST /treaty-templates
   * Create a new custom template.
   */
  public create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const { orgId } = this.getOrgContext(req);
        return this.templateService.createTemplate(orgId, req.body);
      },
      201
    );
  };

  /**
   * PUT /treaty-templates/:id
   * Update a custom template.
   */
  public update = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.templateService.updateTemplate(orgId, req.params.id, req.body);
    });
  };

  /**
   * DELETE /treaty-templates/:id
   * Delete a custom template.
   */
  public delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      await this.templateService.deleteTemplate(orgId, req.params.id);
      res.status(204).send();
    });
  };

  /**
   * POST /treaty-templates/instantiate
   * Generate terms from a template for use in an alliance or federation agreement.
   */
  public instantiate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.templateService.instantiateTemplate(orgId, req.body);
    });
  };
}
