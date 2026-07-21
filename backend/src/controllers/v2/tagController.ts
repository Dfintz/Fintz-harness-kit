import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { TagService } from '../../services/tag/TagService';
import { ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

/** Validated request body shapes (Joi-validated before controller entry) */
interface CreateTagBody {
  name: string;
  color?: string;
  description?: string;
}
interface UpdateTagBody {
  name?: string;
  color?: string;
  description?: string;
}
interface TagResourceBody {
  resourceType: string;
  resourceId: string;
}

export class TagController extends BaseController {
  private readonly tagService: TagService;

  constructor() {
    super();
    this.tagService = new TagService();
  }

  listTags = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { search, limit } = req.query;
      const tags = await this.tagService.listTags(organizationId, {
        search: search as string | undefined,
        limit: limit ? Math.min(parseInt(limit as string, 10), 200) : undefined,
      });

      res.json({ success: true, data: tags });
    });
  };

  getTag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const tag = await this.tagService.getTag(organizationId, req.params.tagId);
      if (!tag) {
        res.status(404).json({ success: false, error: 'Tag not found' });
        return;
      }
      res.json({ success: true, data: tag });
    });
  };

  createTag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as CreateTagBody;
      const tag = await this.tagService.createTag(organizationId, userId, body);
      res.status(201).json({ success: true, data: tag });
    });
  };

  updateTag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as UpdateTagBody;
      const tag = await this.tagService.updateTag(organizationId, req.params.tagId, body);
      res.json({ success: true, data: tag });
    });
  };

  deleteTag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      await this.tagService.deleteTag(organizationId, req.params.tagId);
      res.json({ success: true, message: 'Tag deleted' });
    });
  };

  applyTag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      const { resourceType, resourceId } = req.body as TagResourceBody;
      const assignment = await this.tagService.applyTag(
        organizationId,
        userId,
        req.params.tagId,
        resourceType,
        resourceId
      );
      res.json({ success: true, data: assignment });
    });
  };

  removeTag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { resourceType, resourceId } = req.body as TagResourceBody;
      await this.tagService.removeTag(organizationId, req.params.tagId, resourceType, resourceId);
      res.json({ success: true, message: 'Tag removed from resource' });
    });
  };

  getPopularTags = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const tags = await this.tagService.getPopularTags(organizationId, limit);
      res.json({ success: true, data: tags });
    });
  };
}
