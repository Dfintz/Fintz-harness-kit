import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
type AuthRequest = Request & {
    user?: {
        id?: string;
    };
};
export declare class AdminControllerV2 extends BaseController {
    private readonly externalCatalogSyncService;
    private normalizeExternalCatalogSources;
    getDashboard(req: Request, res: Response): Promise<void>;
    getSystemMetrics(req: Request, res: Response): Promise<void>;
    getUserActionMetrics(req: Request, res: Response): Promise<void>;
    getTimeSeriesMetrics(req: Request, res: Response): Promise<void>;
    getModerationAnalytics(req: Request, res: Response): Promise<void>;
    getSecurityLogs(req: Request, res: Response): Promise<void>;
    getSecuritySummary(req: Request, res: Response): Promise<void>;
    searchSecurityEvents(req: Request, res: Response): Promise<void>;
    getFeatureFlags(req: Request, res: Response): Promise<void>;
    getFeatureFlag(req: Request, res: Response): Promise<void>;
    createFeatureFlag(req: Request, res: Response): Promise<void>;
    updateFeatureFlag(req: Request, res: Response): Promise<void>;
    deleteFeatureFlag(req: Request, res: Response): Promise<void>;
    searchUsers(req: Request, res: Response): Promise<void>;
    performUserAction(req: Request, res: Response): Promise<void>;
    getShipDataFetcherStatus(req: Request, res: Response): Promise<void>;
    refreshShipData(req: Request, res: Response): Promise<void>;
    previewExternalCatalogSync(req: Request, res: Response): Promise<void>;
    applyExternalCatalogSync(req: Request, res: Response): Promise<void>;
    getPerformanceReport(req: Request, res: Response): Promise<void>;
    getPerformanceHistory(_req: Request, res: Response): Promise<void>;
    getQueryAnalysis(_req: Request, res: Response): Promise<void>;
    getTableStats(_req: Request, res: Response): Promise<void>;
    getTracingStats(_req: Request, res: Response): Promise<void>;
    getTrace(req: Request, res: Response): Promise<void>;
    getAnomalies(req: Request, res: Response): Promise<void>;
    acknowledgeAnomaly(req: Request, res: Response): Promise<void>;
    getScalingStatus(_req: Request, res: Response): Promise<void>;
    getOperationsOverview(_req: Request, res: Response): Promise<void>;
    triggerJob(req: Request, res: Response): Promise<void>;
    enableJob(req: Request, res: Response): Promise<void>;
    disableJob(req: Request, res: Response): Promise<void>;
    private static _deletionService;
    private static getDeletionService;
    getLegalHolds(_req: Request, res: Response): Promise<void>;
    createLegalHold(req: AuthRequest, res: Response): Promise<void>;
    releaseLegalHold(req: AuthRequest, res: Response): Promise<void>;
}
export {};
//# sourceMappingURL=adminController.d.ts.map