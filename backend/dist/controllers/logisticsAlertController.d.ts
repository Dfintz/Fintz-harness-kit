import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class LogisticsAlertController extends BaseController {
    private alertService;
    constructor();
    createAlert: (req: Request, res: Response) => Promise<void>;
    getAlerts: (req: Request, res: Response) => Promise<void>;
    getAlert: (req: Request, res: Response) => Promise<void>;
    updateAlert: (req: Request, res: Response) => Promise<void>;
    acknowledgeAlert: (req: Request, res: Response) => Promise<void>;
    resolveAlert: (req: Request, res: Response) => Promise<void>;
    dismissAlert: (req: Request, res: Response) => Promise<void>;
    deleteAlert: (req: Request, res: Response) => Promise<void>;
    getAlertStatistics: (req: Request, res: Response) => Promise<void>;
    checkInventoryAndGenerateAlerts: (req: Request, res: Response) => Promise<void>;
    autoResolveAlerts: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=logisticsAlertController.d.ts.map