import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ReportController extends BaseController {
    private readonly analyticsService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    generate: (req: AuthRequest, res: Response) => Promise<void>;
    download: (req: AuthRequest, res: Response) => Promise<void>;
    schedule: (req: AuthRequest, res: Response) => Promise<void>;
    getTemplates: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=reportController.d.ts.map