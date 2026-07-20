import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class RsiVerificationController extends BaseController {
    private readonly rsiVerificationService;
    constructor();
    initiateVerification: (req: AuthRequest, res: Response) => Promise<void>;
    completeVerification: (req: AuthRequest, res: Response) => Promise<void>;
    getVerificationStatus: (req: AuthRequest, res: Response) => Promise<void>;
    removeVerification: (req: AuthRequest, res: Response) => Promise<void>;
    initiateOrganizationVerification: (req: AuthRequest, res: Response) => Promise<void>;
    completeOrganizationVerification: (req: AuthRequest, res: Response) => Promise<void>;
    verifyOrganizationByRank: (req: AuthRequest, res: Response) => Promise<void>;
    verifyOrganizationOwnership: (req: AuthRequest, res: Response) => Promise<void>;
    lookupRsiUser: (req: Request, res: Response) => Promise<void>;
    lookupRsiOrganization: (req: Request, res: Response) => Promise<void>;
    getAnalytics: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=rsiVerificationController.d.ts.map