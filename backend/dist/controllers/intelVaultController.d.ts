import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class IntelVaultController extends BaseController {
    private intelVaultService;
    private intelOfficerService;
    constructor();
    checkAccess: (req: AuthRequest, res: Response) => Promise<void>;
    createEntry: (req: AuthRequest, res: Response) => Promise<void>;
    getEntries: (req: AuthRequest, res: Response) => Promise<void>;
    getEntry: (req: AuthRequest, res: Response) => Promise<void>;
    updateEntry: (req: AuthRequest, res: Response) => Promise<void>;
    deleteEntry: (req: AuthRequest, res: Response) => Promise<void>;
    getAuditLogs: (req: AuthRequest, res: Response) => Promise<void>;
    appointOfficer: (req: AuthRequest, res: Response) => Promise<void>;
    getOfficers: (req: AuthRequest, res: Response) => Promise<void>;
    getOfficer: (req: AuthRequest, res: Response) => Promise<void>;
    updateOfficer: (req: AuthRequest, res: Response) => Promise<void>;
    removeOfficer: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=intelVaultController.d.ts.map