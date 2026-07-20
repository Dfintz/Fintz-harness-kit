import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class ActivityStarCommsController extends BaseController {
    private readonly orchestrationService;
    provisionFromActivity: (req: Request, res: Response) => Promise<void>;
    private requireUuid;
}
//# sourceMappingURL=activityStarCommsController.d.ts.map