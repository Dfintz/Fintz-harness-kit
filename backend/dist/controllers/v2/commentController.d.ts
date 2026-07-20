import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class CommentController extends BaseController {
    private readonly commentService;
    constructor();
    listComments: (req: AuthRequest, res: Response) => Promise<void>;
    getComment: (req: AuthRequest, res: Response) => Promise<void>;
    createComment: (req: AuthRequest, res: Response) => Promise<void>;
    updateComment: (req: AuthRequest, res: Response) => Promise<void>;
    deleteComment: (req: AuthRequest, res: Response) => Promise<void>;
    replyToComment: (req: AuthRequest, res: Response) => Promise<void>;
    likeComment: (req: AuthRequest, res: Response) => Promise<void>;
    unlikeComment: (req: AuthRequest, res: Response) => Promise<void>;
    getReplies: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=commentController.d.ts.map