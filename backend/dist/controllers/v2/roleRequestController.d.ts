import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class RoleRequestController extends BaseController {
    private readonly roleRequestService;
    constructor();
    listPending: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    approve: (req: AuthRequest, res: Response) => Promise<void>;
    reject: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=roleRequestController.d.ts.map