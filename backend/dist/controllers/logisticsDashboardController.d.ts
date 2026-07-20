import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class LogisticsDashboardController extends BaseController {
    private dashboardService;
    constructor();
    getDashboardMetrics: (req: Request, res: Response) => Promise<void>;
    getCategoryBreakdown: (req: Request, res: Response) => Promise<void>;
    getAlertSummary: (req: Request, res: Response) => Promise<void>;
    getOperationsSummary: (req: Request, res: Response) => Promise<void>;
    getSupplierPerformance: (req: Request, res: Response) => Promise<void>;
    getConsumptionReport: (req: Request, res: Response) => Promise<void>;
    getStockValueTrend: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=logisticsDashboardController.d.ts.map