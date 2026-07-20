import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class AllianceDiplomacyController extends BaseController {
    private readonly diplomacyService;
    constructor();
    private getOrgContext;
    proposeDiplomacy: (req: AuthRequest, res: Response) => Promise<void>;
    getDiplomacyRelations: (req: AuthRequest, res: Response) => Promise<void>;
    getDiplomacyById: (req: AuthRequest, res: Response) => Promise<void>;
    approveDiplomacy: (req: AuthRequest, res: Response) => Promise<void>;
    suspendDiplomacy: (req: AuthRequest, res: Response) => Promise<void>;
    terminateDiplomacy: (req: AuthRequest, res: Response) => Promise<void>;
    reportIncident: (req: AuthRequest, res: Response) => Promise<void>;
    resolveIncident: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=allianceDiplomacyController.d.ts.map