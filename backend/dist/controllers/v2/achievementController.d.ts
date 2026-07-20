import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class AchievementController extends BaseController {
    private readonly titleBadgeService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    award: (req: AuthRequest, res: Response) => Promise<void>;
    revoke: (req: AuthRequest, res: Response) => Promise<void>;
    getUserItems: (req: AuthRequest, res: Response) => Promise<void>;
    getPublicUserItems: (req: AuthRequest, res: Response) => Promise<void>;
    getRecipients: (req: AuthRequest, res: Response) => Promise<void>;
    toggleDisplay: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=achievementController.d.ts.map