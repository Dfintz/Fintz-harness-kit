"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsDashboardController = void 0;
const LogisticsDashboardService_1 = require("../services/trade/logistics/LogisticsDashboardService");
const BaseController_1 = require("./BaseController");
class LogisticsDashboardController extends BaseController_1.BaseController {
    dashboardService = new LogisticsDashboardService_1.LogisticsDashboardService();
    constructor() {
        super();
    }
    getDashboardMetrics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getDashboardMetrics(fleetId);
        });
    };
    getCategoryBreakdown = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getCategoryBreakdown(fleetId);
        });
    };
    getAlertSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getAlertSummary(fleetId);
        });
    };
    getOperationsSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getOperationsSummary(fleetId);
        });
    };
    getSupplierPerformance = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.dashboardService.getSupplierPerformance(fleetId);
        });
    };
    getConsumptionReport = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            const days = parseInt(req.query.days) || 30;
            return this.dashboardService.getConsumptionReport(fleetId, days);
        });
    };
    getStockValueTrend = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            const days = parseInt(req.query.days) || 30;
            return this.dashboardService.getStockValueTrend(fleetId, days);
        });
    };
}
exports.LogisticsDashboardController = LogisticsDashboardController;
//# sourceMappingURL=logisticsDashboardController.js.map