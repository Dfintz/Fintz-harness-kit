import { Request, Response } from 'express';

import { LogisticsDashboardService } from '../services/trade/logistics/LogisticsDashboardService';

import { BaseController } from './BaseController';

/**
 * Controller for logistics dashboards and reports
 * Extends BaseController for standardized error handling
 */
export class LogisticsDashboardController extends BaseController {
    private dashboardService = new LogisticsDashboardService();

    constructor() {
        super();
    }

    /**
     * Get comprehensive dashboard metrics
     * GET /api/logistics/dashboard/:fleetId
     */
    public getDashboardMetrics = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getDashboardMetrics(fleetId);
        });
    };

    /**
     * Get category breakdown
     * GET /api/logistics/dashboard/:fleetId/categories
     */
    public getCategoryBreakdown = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getCategoryBreakdown(fleetId);
        });
    };

    /**
     * Get alert summary
     * GET /api/logistics/dashboard/:fleetId/alert-summary
     */
    public getAlertSummary = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getAlertSummary(fleetId);
        });
    };

    /**
     * Get operations summary
     * GET /api/logistics/dashboard/:fleetId/operations
     */
    public getOperationsSummary = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getOperationsSummary(fleetId);
        });
    };

    /**
     * Get supplier performance report
     * GET /api/logistics/dashboard/:fleetId/supplier-performance
     */
    public getSupplierPerformance = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getSupplierPerformance(fleetId);
        });
    };

    /**
     * Get consumption report
     * GET /api/logistics/dashboard/:fleetId/consumption
     */
    public getConsumptionReport = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            const days = parseInt(req.query.days as string) || 30;
            return this.dashboardService.getConsumptionReport(fleetId, days);
        });
    };

    /**
     * Get stock value trend
     * GET /api/logistics/dashboard/:fleetId/stock-value-trend
     */
    public getStockValueTrend = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            const days = parseInt(req.query.days as string) || 30;
            return this.dashboardService.getStockValueTrend(fleetId, days);
        });
    };
}
