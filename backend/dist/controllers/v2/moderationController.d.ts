import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ModerationController extends BaseController {
    private readonly incidentService;
    private readonly analyticsService;
    private readonly sharingService;
    constructor();
    searchIncidents: (req: AuthRequest, res: Response) => Promise<void>;
    getIncident: (req: AuthRequest, res: Response) => Promise<void>;
    createIncident: (req: AuthRequest, res: Response) => Promise<void>;
    updateIncident: (req: AuthRequest, res: Response) => Promise<void>;
    revokeIncident: (req: AuthRequest, res: Response) => Promise<void>;
    shareIncident: (req: AuthRequest, res: Response) => Promise<void>;
    unshareIncident: (req: AuthRequest, res: Response) => Promise<void>;
    lookupUser: (req: AuthRequest, res: Response) => Promise<void>;
    getAnalytics: (req: AuthRequest, res: Response) => Promise<void>;
    getRepeatOffenders: (req: AuthRequest, res: Response) => Promise<void>;
    getStatistics: (req: AuthRequest, res: Response) => Promise<void>;
    getSharingConfig: (req: AuthRequest, res: Response) => Promise<void>;
    updateSharingConfig: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=moderationController.d.ts.map