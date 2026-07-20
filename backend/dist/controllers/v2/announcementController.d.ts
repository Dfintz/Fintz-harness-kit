import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class AnnouncementController extends BaseController {
    private readonly announcementService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    publish: (req: AuthRequest, res: Response) => Promise<void>;
    pin: (req: AuthRequest, res: Response) => Promise<void>;
    markRead: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=announcementController.d.ts.map