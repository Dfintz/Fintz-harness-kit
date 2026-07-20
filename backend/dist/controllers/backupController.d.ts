import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class BackupController extends BaseController {
    private readonly backupService;
    constructor();
    getStatus: (req: AuthRequest, res: Response) => Promise<void>;
    createBackup: (req: AuthRequest, res: Response) => Promise<void>;
    listBackups: (req: AuthRequest, res: Response) => Promise<void>;
    downloadBackup: (req: AuthRequest, res: Response) => Promise<void>;
    restoreBackup: (req: AuthRequest, res: Response) => Promise<void>;
    deleteBackup: (req: AuthRequest, res: Response) => Promise<void>;
    configureSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    getSchedule: (req: AuthRequest, res: Response) => Promise<void>;
    updateSchedule: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=backupController.d.ts.map