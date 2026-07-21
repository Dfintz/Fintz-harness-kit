import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { CommentService } from '../../services/comment/CommentService';
import { ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

/** Validated request body shapes (Joi-validated before controller entry) */
interface CreateCommentBody {
  content: string;
  resourceType: string;
  resourceId: string;
}
interface UpdateCommentBody {
  content: string;
}
interface ReplyBody {
  content: string;
}

export class CommentController extends BaseController {
  private readonly commentService: CommentService;

  constructor() {
    super();
    this.commentService = new CommentService();
  }

  listComments = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { resourceType, resourceId, page, limit, sortOrder } = req.query;
      const result = await this.commentService.listComments(organizationId, {
        resourceType: resourceType as string,
        resourceId: resourceId as string,
        page: page ? Number.parseInt(page as string, 10) : undefined,
        limit: limit ? Math.min(Number.parseInt(limit as string, 10), 200) : undefined,
        sortOrder: sortOrder as 'ASC' | 'DESC' | undefined,
      });

      res.json({
        success: true,
        data: result.data,
        meta: { total: result.total },
      });
    });
  };

  getComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const comment = await this.commentService.getComment(organizationId, req.params.commentId);
      if (!comment) {
        res.status(404).json({ success: false, error: 'Comment not found' });
        return;
      }
      res.json({ success: true, data: comment });
    });
  };

  createComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      const body = req.body as CreateCommentBody;
      const comment = await this.commentService.createComment(
        organizationId,
        userId,
        req.user?.username,
        body
      );
      res.status(201).json({ success: true, data: comment });
    });
  };

  updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      const { content } = req.body as UpdateCommentBody;
      const comment = await this.commentService.updateComment(
        organizationId,
        userId,
        req.params.commentId,
        content
      );
      res.json({ success: true, data: comment });
    });
  };

  deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      await this.commentService.deleteComment(organizationId, userId, req.params.commentId);
      res.json({ success: true, message: 'Comment deleted' });
    });
  };

  replyToComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }
      const { content } = req.body as ReplyBody;
      const reply = await this.commentService.replyToComment(
        organizationId,
        userId,
        req.user?.username,
        req.params.commentId,
        content
      );
      res.status(201).json({ success: true, data: reply });
    });
  };

  likeComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      await this.commentService.likeComment(organizationId, userId, req.params.commentId);
      res.json({ success: true, message: 'Comment liked' });
    });
  };

  unlikeComment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        throw new ValidationError('Organization context required');
      }

      await this.commentService.unlikeComment(organizationId, userId, req.params.commentId);
      res.json({ success: true, message: 'Comment unliked' });
    });
  };

  getReplies = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const replies = await this.commentService.getReplies(organizationId, req.params.commentId);
      res.json({ success: true, data: replies });
    });
  };
}
