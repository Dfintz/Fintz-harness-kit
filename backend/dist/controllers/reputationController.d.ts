import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class ReputationController extends BaseController {
    private readonly reputationService;
    private readonly fleetReputationService;
    constructor();
    getUserReputation: (req: Request, res: Response) => Promise<void>;
    updateReputation: (req: Request, res: Response) => Promise<void>;
    getTopReputation: (req: Request, res: Response) => Promise<void>;
    getUnifiedReputation: (req: Request, res: Response) => Promise<void>;
    getFleetReputation: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=reputationController.d.ts.map