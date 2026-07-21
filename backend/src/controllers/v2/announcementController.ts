import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import {
  AnnouncementService,
  CreateAnnouncementDTO,
  UpdateAnnouncementDTO,
} from '../../services/communication/announcement/AnnouncementService';
import { BaseController } from '../BaseController';

/**
 * Announcement Controller (v2)
 *
 * Manages org-scoped announcements with full CRUD, publish/send,
 * pin, and read-tracking. Wired to AnnouncementService (real backing service).
 */
export class AnnouncementController extends BaseController {
  private readonly announcementService: AnnouncementService;

  constructor() {
    super();
    this.announcementService = new AnnouncementService();
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { page, limit, status, targetType, createdBy } = req.query as Record<string, string>;

      const pageNum = Number.parseInt(page) || 1;
      const pageSize = Math.min(Number.parseInt(limit) || 20, 200);

      const result = await this.announcementService.list(
        organizationId,
        {
          status: status as never,
          targetType: targetType as never,
          createdBy,
        },
        pageNum,
        pageSize
      );

      res.json({
        success: true,
        data: result.announcements,
        pagination: {
          total: result.total,
          count: result.announcements.length,
          page: result.page,
          pageSize,
          hasMore: result.page < result.totalPages,
          totalPages: result.totalPages,
        },
      });
    });
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const dto: CreateAnnouncementDTO = {
        title: req.body.title,
        content: req.body.content,
        createdBy: user.id,
        createdByName: user.username,
        embedConfig: req.body.embedConfig,
        targetType: req.body.targetType,
        targetIds: req.body.targetIds,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      };

      const announcement = await this.announcementService.create(organizationId, dto);

      res.status(201).json({
        success: true,
        data: announcement,
      });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { announcementId } = req.params;

      const announcement = await this.announcementService.getById(announcementId);
      if (!announcement) {
        res.status(404).json({ success: false, error: 'Announcement not found' });
        return;
      }

      res.json({
        success: true,
        data: announcement,
      });
    });
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { announcementId } = req.params;

      const dto: UpdateAnnouncementDTO = {
        title: req.body.title,
        content: req.body.content,
        embedConfig: req.body.embedConfig,
        targetType: req.body.targetType,
        targetIds: req.body.targetIds,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
        status: req.body.status,
      };

      const announcement = await this.announcementService.update(announcementId, dto);

      res.json({
        success: true,
        data: announcement,
      });
    });
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { announcementId } = req.params;

      await this.announcementService.delete(announcementId, user.id);

      res.json({
        success: true,
        message: 'Announcement deleted',
      });
    });
  };

  publish = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { announcementId } = req.params;
      const { channelId } = req.body as { channelId: string };

      const result = await this.announcementService.send(announcementId, channelId);

      res.json({
        success: true,
        data: result,
      });
    });
  };

  pin = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { announcementId } = req.params;

      const result = await this.announcementService.togglePin(announcementId, user.id);

      res.json({
        success: true,
        data: {
          announcementId,
          pinned: result.pinned,
        },
      });
    });
  };

  markRead = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { announcementId } = req.params;

      const result = await this.announcementService.markRead(announcementId, user.id);

      res.json({
        success: true,
        data: {
          announcementId,
          userId: user.id,
          readAt: result.readAt.toISOString(),
        },
      });
    });
  };
}
