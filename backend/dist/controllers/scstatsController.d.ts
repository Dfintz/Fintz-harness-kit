import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
declare class SCStatsController extends BaseController {
    private readonly importService;
    private readonly csvImportService;
    private readonly logImportService;
    private readonly orgAnalyticsService;
    private readonly directoryService;
    constructor();
    importSCStats(req: AuthRequest, res: Response): Promise<void>;
    getSCStats(req: AuthRequest, res: Response): Promise<void>;
    deleteSCStats(req: AuthRequest, res: Response): Promise<void>;
    getOrgAnalytics(req: AuthRequest, res: Response): Promise<void>;
    getPublicOrgAnalytics(req: Request, res: Response): Promise<void>;
    importCsvData(req: AuthRequest, res: Response): Promise<void>;
    importLogData(req: AuthRequest, res: Response): Promise<void>;
    getCsvData(req: AuthRequest, res: Response): Promise<void>;
    deleteCsvData(req: AuthRequest, res: Response): Promise<void>;
}
export declare const scstatsController: SCStatsController;
export {};
//# sourceMappingURL=scstatsController.d.ts.map