import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class JobApplicationController extends BaseController {
    private readonly appService;
    private readonly jobService;
    private readonly permissionService;
    private readonly federationService;
    private getAuthenticatedUserId;
    applyToJob: (req: AuthRequest, res: Response) => Promise<void>;
    reviewApplication: (req: AuthRequest, res: Response) => Promise<void>;
    withdrawApplication: (req: AuthRequest, res: Response) => Promise<void>;
    getApplicationsForJob: (req: AuthRequest, res: Response) => Promise<void>;
    getMyApplication: (req: AuthRequest, res: Response) => Promise<void>;
    getMyApplications: (req: AuthRequest, res: Response) => Promise<void>;
    getWaitlist: (req: AuthRequest, res: Response) => Promise<void>;
    private requireListingAccess;
}
//# sourceMappingURL=jobApplicationController.d.ts.map