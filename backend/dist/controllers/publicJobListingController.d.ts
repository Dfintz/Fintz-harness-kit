import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class PublicJobListingController extends BaseController {
    private readonly jobService;
    private readonly federationService;
    private readonly permissionService;
    private verifyJobPermission;
    private getJobAndVerifyPermission;
    getJobListings: (req: AuthRequest, res: Response) => Promise<void>;
    getJobListing: (req: AuthRequest, res: Response) => Promise<void>;
    getJobStats: (req: AuthRequest, res: Response) => Promise<void>;
    getFilterOptions: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationJobCount: (req: AuthRequest, res: Response) => Promise<void>;
    getAllianceJobCount: (req: AuthRequest, res: Response) => Promise<void>;
    createOrganizationJob: (req: AuthRequest, res: Response) => Promise<void>;
    createAllianceJob: (req: AuthRequest, res: Response) => Promise<void>;
    createUserJob: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationJobs: (req: AuthRequest, res: Response) => Promise<void>;
    updateJobListing: (req: AuthRequest, res: Response) => Promise<void>;
    deleteJobListing: (req: AuthRequest, res: Response) => Promise<void>;
    assignCrewRole: (req: AuthRequest, res: Response) => Promise<void>;
    unassignCrewRole: (req: AuthRequest, res: Response) => Promise<void>;
    cancelJobListing: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=publicJobListingController.d.ts.map