import { Request, Response } from 'express';

import { ActivityType } from '../../models/Activity';
import { ActivityTemplateCategory } from '../../models/ActivityTemplate';
import {
  ActivityTemplateService,
  type ApplyTemplateDTO,
  type CreateTemplateDTO,
  type TemplateQueryFilters,
  type UpdateTemplateDTO,
} from '../../services/activity/activityTemplate.service';
import { ApiErrorCode } from '../../types/api';
import { ApiError } from '../../utils/ApiError';
import { parseBooleanQuery } from '../../utils/queryUtils';

/** Request with auth context (set by authenticate + tenantContext middleware) */
type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export class ActivityTemplateControllerV2 {
  private activityTemplateService: ActivityTemplateService;

  constructor() {
    this.activityTemplateService = new ActivityTemplateService();
  }

  private getOrgId(req: Request): string {
    const orgId = req.tenantContext?.organizationId;
    if (!orgId) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Organization context is required', 400);
    }
    return orgId;
  }

  private getUser(req: Request): { id: string; username: string } {
    const user = (req as AuthRequest).user;
    if (!user?.id) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }
    return { id: user.id, username: user.username ?? '' };
  }

  /**
   * GET /api/v2/templates
   * List activity templates for the current organization
   */
  async listTemplates(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);

    const filters: TemplateQueryFilters = {};
    if (req.query.category) {
      filters.category = req.query.category as ActivityTemplateCategory;
    }
    if (req.query.activityType) {
      filters.activityType = req.query.activityType as ActivityType;
    }
    if (req.query.isPublic !== undefined) {
      filters.isPublic = parseBooleanQuery(req.query.isPublic);
    }
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.page) {
      filters.page = Number(req.query.page);
    }
    if (req.query.limit) {
      filters.limit = Math.min(Number(req.query.limit), 200);
    }

    const result = await this.activityTemplateService.getTemplates(orgId, filters);

    res.success(result);
  }

  /**
   * POST /api/v2/templates
   * Create a new activity template
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);
    const user = this.getUser(req);
    const dto = req.body as CreateTemplateDTO;

    const template = await this.activityTemplateService.createTemplate(
      orgId,
      dto,
      user.id,
      user.username
    );

    res.status(201).success({ template });
  }

  /**
   * GET /api/v2/templates/:templateId
   * Get a specific activity template
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);
    const { templateId } = req.params;

    const template = await this.activityTemplateService.getTemplate(orgId, templateId);
    if (!template) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
    }

    res.success({ template });
  }

  /**
   * PUT /api/v2/templates/:templateId
   * Update an activity template
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);
    const user = this.getUser(req);
    const { templateId } = req.params;
    const dto = req.body as UpdateTemplateDTO;

    const template = await this.activityTemplateService.updateTemplate(
      orgId,
      templateId,
      dto,
      user.id
    );

    if (!template) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
    }

    res.success({ template });
  }

  /**
   * DELETE /api/v2/templates/:templateId
   * Delete an activity template (soft delete)
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);
    const user = this.getUser(req);
    const { templateId } = req.params;

    const deleted = await this.activityTemplateService.deleteTemplate(orgId, templateId, user.id);
    if (!deleted) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
    }

    res.status(204).send();
  }

  /**
   * POST /api/v2/templates/:templateId/clone
   * Clone an activity template
   */
  async cloneTemplate(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);
    const user = this.getUser(req);
    const { templateId } = req.params;

    const clone = await this.activityTemplateService.cloneTemplate(
      orgId,
      templateId,
      user.id,
      user.username
    );

    if (!clone) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
    }

    res.status(201).success({ template: clone });
  }

  /**
   * POST /api/v2/templates/:templateId/apply
   * Create an activity from a template
   */
  async applyTemplate(req: Request, res: Response): Promise<void> {
    const orgId = this.getOrgId(req);
    const user = this.getUser(req);
    const { templateId } = req.params;
    const dto = req.body as ApplyTemplateDTO;

    const activity = await this.activityTemplateService.createActivityFromTemplate(
      orgId,
      templateId,
      dto,
      user.id,
      user.username
    );

    if (!activity) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
    }

    res.status(201).success({ activity });
  }

  /**
   * GET /api/v2/templates/categories
   * Get available template categories
   */
  async getCategories(_req: Request, res: Response): Promise<void> {
    const categories = this.activityTemplateService.getCategories();
    res.success({ categories });
  }
}
