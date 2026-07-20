import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class DashboardController extends BaseController {
    private readonly dashboardService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    addWidget: (req: AuthRequest, res: Response) => Promise<void>;
    updateWidget: (req: AuthRequest, res: Response) => Promise<void>;
    deleteWidget: (req: AuthRequest, res: Response) => Promise<void>;
    share: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=dashboardController.d.ts.map