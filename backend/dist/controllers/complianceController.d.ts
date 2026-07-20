import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class ComplianceController extends BaseController {
    private readonly licenseExportService;
    constructor();
    exportLicenses: (req: AuthRequest, res: Response) => Promise<void>;
    getRetentionConfig: (req: AuthRequest, res: Response) => Promise<void>;
    executeRetention: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=complianceController.d.ts.map