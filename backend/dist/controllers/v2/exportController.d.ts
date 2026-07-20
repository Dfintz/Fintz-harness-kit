import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ExportController extends BaseController {
    private readonly exportService;
    private readonly analyticsService;
    constructor();
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    download: (req: AuthRequest, res: Response) => Promise<void>;
    listJobs: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    exportAttendanceCorrelation: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=exportController.d.ts.map