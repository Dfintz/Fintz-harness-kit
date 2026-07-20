import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class IntegrationStatusController extends BaseController {
    private readonly integrationStatusService;
    constructor();
    getSystemHealth: (req: AuthRequest, res: Response) => Promise<void>;
    getIntegrationHealth: (req: AuthRequest, res: Response) => Promise<void>;
    refreshHealth: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=integrationStatusController.d.ts.map