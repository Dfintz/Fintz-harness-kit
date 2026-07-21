import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { TitleBadgeService } from '../../services/gamification/TitleBadgeService';
import { BaseController } from '../BaseController';

/**
 * Achievement Controller (v2)
 *
 * Manages org-scoped custom titles and badges.
 * Follows BaseController pattern with auth + tenant scoping.
 */
export class AchievementController extends BaseController {
  private readonly titleBadgeService: TitleBadgeService;

  constructor() {
    super();
    this.titleBadgeService = new TitleBadgeService();
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { category, rarity, type } = req.query as Record<string, string>;
      const { page, limit } = this.getPaginationParams(req);

      const { items, total } = await this.titleBadgeService.list(organizationId, {
        category,
        rarity,
        type,
      });

      res.json({
        success: true,
        ...this.createPaginatedResponse(items, total, page, limit),
      });
    });
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const achievement = await this.titleBadgeService.create(organizationId, user.id, req.body);

      res.status(201).json({ success: true, data: achievement });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { achievementId } = req.params;

      const achievement = await this.titleBadgeService.getById(achievementId, organizationId);
      if (!achievement) {
        res.status(404).json({ success: false, error: 'Title or badge not found' });
        return;
      }

      res.json({ success: true, data: achievement });
    });
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { achievementId } = req.params;

      const achievement = await this.titleBadgeService.update(
        achievementId,
        organizationId,
        req.body
      );

      res.json({ success: true, data: achievement });
    });
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { achievementId } = req.params;

      await this.titleBadgeService.delete(achievementId, organizationId);

      res.json({ success: true, message: `Title/badge ${achievementId} deleted` });
    });
  };

  award = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { achievementId } = req.params;
      const { userId } = req.body as { userId: string };

      const userAchievement = await this.titleBadgeService.award(
        achievementId,
        organizationId,
        userId,
        user.id
      );

      res.json({ success: true, data: userAchievement });
    });
  };

  revoke = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { achievementId } = req.params;
      const { userId } = req.body as { userId: string };

      await this.titleBadgeService.revoke(achievementId, organizationId, userId, user.id);

      res.json({ success: true, message: 'Title/badge revoked' });
    });
  };

  getUserItems = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { userId } = req.params;

      const items = await this.titleBadgeService.getUserItems(organizationId, userId);

      res.json({ success: true, data: items });
    });
  };

  /**
   * Public endpoint: Get all displayed badges for a user across all orgs.
   * Does not require org context.
   */
  getPublicUserItems = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { userId } = req.params;

      const items = await this.titleBadgeService.getUserPublicItems(userId);

      res.json({ success: true, data: items });
    });
  };

  getRecipients = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { achievementId } = req.params;

      const recipients = await this.titleBadgeService.getRecipients(achievementId, organizationId);

      res.json({ success: true, data: recipients });
    });
  };

  toggleDisplay = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { userAchievementId } = req.params;
      const { isDisplayed } = req.body as { isDisplayed: boolean };

      const updated = await this.titleBadgeService.toggleDisplay(
        userAchievementId,
        user.id,
        isDisplayed
      );

      res.json({ success: true, data: updated });
    });
  };
}
