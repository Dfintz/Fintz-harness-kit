import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class RsiRoleMappingController extends BaseController {
    private readonly roleMappingService;
    constructor();
    getMappings: (req: AuthRequest, res: Response) => Promise<void>;
    getDiscoveredRanks: (req: AuthRequest, res: Response) => Promise<void>;
    getSyncPreview: (req: AuthRequest, res: Response) => Promise<void>;
    getMapping: (req: AuthRequest, res: Response) => Promise<void>;
    createMapping: (req: AuthRequest, res: Response) => Promise<void>;
    updateMapping: (req: AuthRequest, res: Response) => Promise<void>;
    deleteMapping: (req: AuthRequest, res: Response) => Promise<void>;
    getTemplates: (req: AuthRequest, res: Response) => Promise<void>;
    getTemplateDetails: (req: AuthRequest, res: Response) => Promise<void>;
    applyTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    bulkUpsert: (req: AuthRequest, res: Response) => Promise<void>;
    cloneMappings: (req: AuthRequest, res: Response) => Promise<void>;
    getSummary: (req: AuthRequest, res: Response) => Promise<void>;
    deleteAllMappings: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=rsiRoleMappingController.d.ts.map