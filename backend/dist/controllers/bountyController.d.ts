import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class BountyController extends BaseController {
    private bountyService;
    private claimService;
    private hunterProfileService;
    constructor();
    listBounties: (req: AuthRequest, res: Response) => Promise<void>;
    getBounty: (req: AuthRequest, res: Response) => Promise<void>;
    createBounty: (req: AuthRequest, res: Response) => Promise<void>;
    updateBounty: (req: AuthRequest, res: Response) => Promise<void>;
    deleteBounty: (req: AuthRequest, res: Response) => Promise<void>;
    claimBounty: (req: AuthRequest, res: Response) => Promise<void>;
    getBountyClaims: (req: AuthRequest, res: Response) => Promise<void>;
    updateClaim: (req: AuthRequest, res: Response) => Promise<void>;
    deleteClaim: (req: AuthRequest, res: Response) => Promise<void>;
    getPendingClaims: (req: AuthRequest, res: Response) => Promise<void>;
    getMyClaimsWithStats: (req: AuthRequest, res: Response) => Promise<void>;
    submitClaim: (req: AuthRequest, res: Response) => Promise<void>;
    submitEvidence: (req: AuthRequest, res: Response) => Promise<void>;
    getClaimEvidence: (req: AuthRequest, res: Response) => Promise<void>;
    deleteEvidence: (req: AuthRequest, res: Response) => Promise<void>;
    getHunterProfile: (req: AuthRequest, res: Response) => Promise<void>;
    getHunterLeaderboard: (req: AuthRequest, res: Response) => Promise<void>;
    getHunterHistory: (req: AuthRequest, res: Response) => Promise<void>;
    getHunterAnalytics: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=bountyController.d.ts.map