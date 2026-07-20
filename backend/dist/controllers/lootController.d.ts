import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class LootController extends BaseController {
    private readonly lootService;
    private readonly ocrService;
    constructor();
    listPools: (req: AuthRequest, res: Response) => Promise<void>;
    getPool: (req: AuthRequest, res: Response) => Promise<void>;
    createPool: (req: AuthRequest, res: Response) => Promise<void>;
    updatePool: (req: AuthRequest, res: Response) => Promise<void>;
    lockPool: (req: AuthRequest, res: Response) => Promise<void>;
    cancelPool: (req: AuthRequest, res: Response) => Promise<void>;
    distributePool: (req: AuthRequest, res: Response) => Promise<void>;
    retryDistribution: (req: AuthRequest, res: Response) => Promise<void>;
    getEligibleParticipants: (req: AuthRequest, res: Response) => Promise<void>;
    addItem: (req: AuthRequest, res: Response) => Promise<void>;
    addItemsBulk: (req: AuthRequest, res: Response) => Promise<void>;
    updateItem: (req: AuthRequest, res: Response) => Promise<void>;
    removeItem: (req: AuthRequest, res: Response) => Promise<void>;
    assignItem: (req: AuthRequest, res: Response) => Promise<void>;
    claimItem: (req: AuthRequest, res: Response) => Promise<void>;
    withdrawClaim: (req: AuthRequest, res: Response) => Promise<void>;
    scanImage: (req: AuthRequest, res: Response) => Promise<void>;
    scanImageForPool: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=lootController.d.ts.map