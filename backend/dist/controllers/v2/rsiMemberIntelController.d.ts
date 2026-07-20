import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class RsiMemberIntelController extends BaseController {
    private readonly intelService;
    constructor();
    listMembers: (req: AuthRequest, res: Response) => Promise<void>;
    getMemberCard: (req: AuthRequest, res: Response) => Promise<void>;
    enrichMember: (req: AuthRequest, res: Response) => Promise<void>;
    enrichAll: (req: AuthRequest, res: Response) => Promise<void>;
    runAudit: (req: AuthRequest, res: Response) => Promise<void>;
    validateRoles: (req: AuthRequest, res: Response) => Promise<void>;
    suggestLinkCandidates: (req: AuthRequest, res: Response) => Promise<void>;
    manualLink: (req: AuthRequest, res: Response) => Promise<void>;
    unlinkMember: (req: AuthRequest, res: Response) => Promise<void>;
    clearCache: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=rsiMemberIntelController.d.ts.map