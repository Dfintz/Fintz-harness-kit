import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class MiningOperationController extends BaseController {
    private readonly miningService;
    constructor();
    createMiningOperation: (req: Request, res: Response) => Promise<void>;
    getMiningOperations: (req: Request, res: Response) => Promise<void>;
    getMiningOperationById: (req: Request, res: Response) => Promise<void>;
    addCrewMember: (req: Request, res: Response) => Promise<void>;
    recordResources: (req: Request, res: Response) => Promise<void>;
    updateStatus: (req: Request, res: Response) => Promise<void>;
    updateMiningOperation: (req: Request, res: Response) => Promise<void>;
    deleteMiningOperation: (req: Request, res: Response) => Promise<void>;
    getRegolithSummary: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=miningOperationController.d.ts.map