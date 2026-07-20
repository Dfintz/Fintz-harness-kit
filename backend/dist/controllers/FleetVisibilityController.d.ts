import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class FleetVisibilityController extends BaseController {
    private readonly visibilityService;
    constructor();
    private getOrgContext;
    getRules: (req: AuthRequest, res: Response) => Promise<void>;
    createRule: (req: AuthRequest, res: Response) => Promise<void>;
    updateRule: (req: AuthRequest, res: Response) => Promise<void>;
    deleteRule: (req: AuthRequest, res: Response) => Promise<void>;
    checkAccess: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=FleetVisibilityController.d.ts.map