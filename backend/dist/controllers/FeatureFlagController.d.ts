import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class FeatureFlagController extends BaseController {
    evaluateFlag: (req: Request, res: Response) => Promise<void>;
    evaluateBatch: (req: Request, res: Response) => Promise<void>;
    getEnabledFlags: (req: Request, res: Response) => Promise<void>;
    getAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=FeatureFlagController.d.ts.map