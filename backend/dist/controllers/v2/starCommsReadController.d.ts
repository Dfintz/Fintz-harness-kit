import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class StarCommsReadController extends BaseController {
    private readonly integrationService;
    private readonly accessService;
    private readonly starCommsAdapter;
    getStatus: (req: Request, res: Response) => Promise<void>;
    getMetrics: (req: Request, res: Response) => Promise<void>;
    private verifyStarCommsIntegration;
    private getOrganizationIdFromRequest;
    private requireUuid;
}
//# sourceMappingURL=starCommsReadController.d.ts.map