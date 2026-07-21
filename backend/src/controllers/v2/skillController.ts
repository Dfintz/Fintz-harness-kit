import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { SkillService } from '../../services/skill/SkillService';
import { ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

/** Validated request body shapes (Joi-validated before controller entry) */
interface CreateSkillBody {
  name: string;
  description?: string;
  category?: string;
}
interface UpdateSkillBody {
  name?: string;
  description?: string;
  category?: string;
}
interface EndorseSkillBody {
  userId: string;
}

export class SkillController extends BaseController {
  private readonly skillService: SkillService;

  constructor() {
    super();
    this.skillService = new SkillService();
  }

  listSkills = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { category, search, limit } = req.query;
      const data = await this.skillService.listSkills(organizationId, {
        category: category as string,
        search: search as string,
        limit: limit ? Math.min(parseInt(limit as string, 10), 200) : undefined,
      });

      res.json({ success: true, data });
    });
  };

  getSkill = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const skill = await this.skillService.getSkill(organizationId, req.params.skillId);
      if (!skill) {
        res.status(404).json({ success: false, error: 'Skill not found' });
        return;
      }
      res.json({ success: true, data: skill });
    });
  };

  createSkill = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as CreateSkillBody;
      const skill = await this.skillService.createSkill(organizationId, userId, body);
      res.status(201).json({ success: true, data: skill });
    });
  };

  updateSkill = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as UpdateSkillBody;
      const skill = await this.skillService.updateSkill(organizationId, req.params.skillId, body);
      res.json({ success: true, data: skill });
    });
  };

  deleteSkill = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      await this.skillService.deleteSkill(organizationId, req.params.skillId);
      res.json({ success: true, message: 'Skill deleted' });
    });
  };

  getUserSkills = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const skills = await this.skillService.getUserSkills(organizationId, req.params.userId);
      res.json({ success: true, data: skills });
    });
  };

  endorseSkill = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }
      const { userId: targetUserId } = req.body as EndorseSkillBody;
      const endorsement = await this.skillService.endorseSkill(
        organizationId,
        userId,
        req.params.skillId,
        targetUserId
      );
      res.status(201).json({ success: true, data: endorsement });
    });
  };

  getCategories = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const categories = this.skillService.getCategories();
      res.json({ success: true, data: categories });
    });
  };
}
