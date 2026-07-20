import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ImportController extends BaseController {
    private readonly importService;
    private readonly genericCsvPreviewService;
    constructor();
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    listJobs: (req: AuthRequest, res: Response) => Promise<void>;
    cancel: (req: AuthRequest, res: Response) => Promise<void>;
    validate: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=importController.d.ts.map