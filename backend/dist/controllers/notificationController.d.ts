import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class NotificationController extends BaseController {
    private readonly notificationService;
    private readonly digestService;
    private readonly preferencesService;
    constructor();
    sendNotification: (req: AuthRequest, res: Response) => Promise<void>;
    listNotifications: (req: AuthRequest, res: Response) => Promise<void>;
    markAsRead: (req: AuthRequest, res: Response) => Promise<void>;
    markAllAsRead: (req: AuthRequest, res: Response) => Promise<void>;
    deleteNotification: (req: AuthRequest, res: Response) => Promise<void>;
    getPreferences: (req: AuthRequest, res: Response) => Promise<void>;
    updatePreferences: (req: AuthRequest, res: Response) => Promise<void>;
    getDigest: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=notificationController.d.ts.map