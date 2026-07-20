import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class MemberAuditController extends BaseController {
    private auditService;
    private getService;
    listFlags: (req: AuthRequest, res: Response) => Promise<void>;
    getFlagById: (req: AuthRequest, res: Response) => Promise<void>;
    createManualFlag: (req: AuthRequest, res: Response) => Promise<void>;
    resolveFlag: (req: AuthRequest, res: Response) => Promise<void>;
    getUserFlagStats: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=MemberAuditController.d.ts.map