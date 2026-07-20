import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class RateLimitController extends BaseController {
    getConfig: (req: AuthRequest, res: Response) => Promise<void>;
    updateConfig: (req: AuthRequest, res: Response) => Promise<void>;
    getUsage: (req: AuthRequest, res: Response) => Promise<void>;
    reset: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=rateLimitController.d.ts.map