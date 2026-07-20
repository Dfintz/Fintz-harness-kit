import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ArchiveController extends BaseController {
    private readonly archiveService;
    private readonly resourceArchiveService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    archive: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    restore: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    getStatistics: (req: AuthRequest, res: Response) => Promise<void>;
    bulkArchive: (req: AuthRequest, res: Response) => Promise<void>;
    search: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=archiveController.d.ts.map