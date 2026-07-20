import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class OrgApplicationController extends BaseController {
    private readonly service;
    private readonly permissionService;
    private verifyReviewPermission;
    getApplicationMode: (req: AuthRequest, res: Response) => Promise<void>;
    submitApplication: (req: AuthRequest, res: Response) => Promise<void>;
    getApplications: (req: AuthRequest, res: Response) => Promise<void>;
    getMyApplications: (req: AuthRequest, res: Response) => Promise<void>;
    reviewApplication: (req: AuthRequest, res: Response) => Promise<void>;
    withdrawApplication: (req: AuthRequest, res: Response) => Promise<void>;
    checkActiveApplication: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=orgApplicationController.d.ts.map