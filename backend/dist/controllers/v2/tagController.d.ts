import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class TagController extends BaseController {
    private readonly tagService;
    constructor();
    listTags: (req: AuthRequest, res: Response) => Promise<void>;
    getTag: (req: AuthRequest, res: Response) => Promise<void>;
    createTag: (req: AuthRequest, res: Response) => Promise<void>;
    updateTag: (req: AuthRequest, res: Response) => Promise<void>;
    deleteTag: (req: AuthRequest, res: Response) => Promise<void>;
    applyTag: (req: AuthRequest, res: Response) => Promise<void>;
    removeTag: (req: AuthRequest, res: Response) => Promise<void>;
    getPopularTags: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=tagController.d.ts.map