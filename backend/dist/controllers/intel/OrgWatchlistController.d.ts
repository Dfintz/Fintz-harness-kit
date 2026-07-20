import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class OrgWatchlistController extends BaseController {
    private watchlistService;
    private getService;
    listEntries: (req: AuthRequest, res: Response) => Promise<void>;
    getEntryById: (req: AuthRequest, res: Response) => Promise<void>;
    createEntry: (req: AuthRequest, res: Response) => Promise<void>;
    updateEntry: (req: AuthRequest, res: Response) => Promise<void>;
    deleteEntry: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=OrgWatchlistController.d.ts.map