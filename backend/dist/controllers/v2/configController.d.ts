import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ConfigController extends BaseController {
    private readonly settingsService;
    constructor();
    getAll: (req: AuthRequest, res: Response) => Promise<void>;
    updateAll: (req: AuthRequest, res: Response) => Promise<void>;
    getByKey: (req: AuthRequest, res: Response) => Promise<void>;
    updateByKey: (req: AuthRequest, res: Response) => Promise<void>;
    deleteByKey: (req: AuthRequest, res: Response) => Promise<void>;
    importConfig: (req: AuthRequest, res: Response) => Promise<void>;
    exportConfig: (req: AuthRequest, res: Response) => Promise<void>;
    getSchema: (_req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=configController.d.ts.map