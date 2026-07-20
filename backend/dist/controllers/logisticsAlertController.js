"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsAlertController = void 0;
const LogisticsAlertService_1 = require("../services/trade/logistics/LogisticsAlertService");
const apiErrors_1 = require("../utils/apiErrors");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class LogisticsAlertController extends BaseController_1.BaseController {
    alertService = new LogisticsAlertService_1.LogisticsAlertService();
    constructor() {
        super();
    }
    createAlert = async (req, res) => {
        await this.execute(req, res, async () => {
            const dto = req.body;
            const alert = await this.alertService.createAlert(dto);
            res.status(201).json(alert);
        });
    };
    getAlerts = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const filters = {
                fleetId: req.query.fleetId,
                inventoryItemId: req.query.inventoryItemId,
                type: req.query.type,
                severity: req.query.severity,
                status: req.query.status,
                unacknowledgedOnly: (0, queryUtils_1.parseBooleanQuery)(req.query.unacknowledgedOnly),
                activeOnly: (0, queryUtils_1.parseBooleanQuery)(req.query.activeOnly)
            };
            return this.alertService.getAlerts(filters);
        });
    };
    getAlert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const alert = await this.alertService.getAlertById(id);
            if (!alert) {
                throw new apiErrors_1.NotFoundError('Alert');
            }
            return alert;
        });
    };
    updateAlert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const dto = req.body;
            return this.alertService.updateAlert(id, dto);
        });
    };
    acknowledgeAlert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const { userId } = req.body;
            return this.alertService.acknowledgeAlert(id, userId);
        });
    };
    resolveAlert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const { userId, notes } = req.body;
            return this.alertService.resolveAlert(id, userId, notes);
        });
    };
    dismissAlert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            return this.alertService.dismissAlert(id);
        });
    };
    deleteAlert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            await this.alertService.deleteAlert(id);
            return { message: 'Alert deleted successfully' };
        });
    };
    getAlertStatistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.alertService.getAlertStatistics(fleetId);
        });
    };
    checkInventoryAndGenerateAlerts = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.body;
            const alerts = await this.alertService.checkInventoryAndGenerateAlerts(fleetId);
            return {
                message: 'Inventory check completed',
                alertsGenerated: alerts.length,
                alerts
            };
        });
    };
    autoResolveAlerts = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const resolvedCount = await this.alertService.autoResolveAlerts();
            return {
                message: 'Auto-resolve completed',
                resolvedCount
            };
        });
    };
}
exports.LogisticsAlertController = LogisticsAlertController;
//# sourceMappingURL=logisticsAlertController.js.map