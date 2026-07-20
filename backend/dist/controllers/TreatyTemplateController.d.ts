import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class TreatyTemplateController extends BaseController {
    private readonly templateService;
    constructor();
    private getOrgContext;
    list: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    instantiate: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=TreatyTemplateController.d.ts.map