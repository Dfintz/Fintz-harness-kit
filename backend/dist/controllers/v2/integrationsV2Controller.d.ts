import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class IntegrationsV2Controller extends BaseController {
    private readonly integrationService;
    private readonly fleetService;
    listIntegrations: (req: Request, res: Response) => Promise<void>;
    createIntegration: (req: Request, res: Response) => Promise<void>;
    getIntegration: (req: Request, res: Response) => Promise<void>;
    updateIntegration: (req: Request, res: Response) => Promise<void>;
    deleteIntegration: (req: Request, res: Response) => Promise<void>;
    testConnection: (req: Request, res: Response) => Promise<void>;
    syncIntegration: (req: Request, res: Response) => Promise<void>;
    getLogs: (req: Request, res: Response) => Promise<void>;
    getAvailableIntegrationTypes: (_req: Request, res: Response) => Promise<void>;
    private verifyIntegrationOwnership;
    private getOrganizationIdFromRequest;
    private getUserId;
    private requireUuid;
}
//# sourceMappingURL=integrationsV2Controller.d.ts.map