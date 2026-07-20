import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class TreasuryController extends BaseController {
    private readonly treasuryService;
    private readonly duesService;
    private readonly commissaryService;
    constructor();
    getBalance: (req: AuthRequest, res: Response) => Promise<void>;
    getTransactions: (req: AuthRequest, res: Response) => Promise<void>;
    earnCredits: (req: AuthRequest, res: Response) => Promise<void>;
    spendCredits: (req: AuthRequest, res: Response) => Promise<void>;
    transferCredits: (req: AuthRequest, res: Response) => Promise<void>;
    getStatistics: (req: AuthRequest, res: Response) => Promise<void>;
    getLeaderboard: (req: AuthRequest, res: Response) => Promise<void>;
    listDues: (req: AuthRequest, res: Response) => Promise<void>;
    createDues: (req: AuthRequest, res: Response) => Promise<void>;
    updateDues: (req: AuthRequest, res: Response) => Promise<void>;
    deleteDues: (req: AuthRequest, res: Response) => Promise<void>;
    listCommissaryItems: (req: AuthRequest, res: Response) => Promise<void>;
    createCommissaryItem: (req: AuthRequest, res: Response) => Promise<void>;
    updateCommissaryItem: (req: AuthRequest, res: Response) => Promise<void>;
    deleteCommissaryItem: (req: AuthRequest, res: Response) => Promise<void>;
    purchaseItem: (req: AuthRequest, res: Response) => Promise<void>;
    getPurchaseHistory: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=treasuryController.d.ts.map