import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class ExternalIntegrationController extends BaseController {
    private readonly integrationService;
    private readonly fleetService;
    constructor();
    protected getOrganizationId(req: Request | AuthRequest): string;
    private verifyIntegrationOwnership;
    createIntegration: (req: Request, res: Response) => Promise<void>;
    getIntegrations: (req: Request, res: Response) => Promise<void>;
    getIntegration: (req: Request, res: Response) => Promise<void>;
    updateIntegration: (req: Request, res: Response) => Promise<void>;
    deleteIntegration: (req: Request, res: Response) => Promise<void>;
    testConnection: (req: Request, res: Response) => Promise<void>;
    syncInventory: (req: Request, res: Response) => Promise<void>;
    sendWebhook: (req: Request, res: Response) => Promise<void>;
    private sanitizeIntegrationUrls;
    private requireUuid;
}
//# sourceMappingURL=externalIntegrationController.d.ts.map