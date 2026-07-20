"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const DashboardService_1 = require("../../services/dashboard/DashboardService");
const BaseController_1 = require("../BaseController");
class DashboardController extends BaseController_1.BaseController {
    dashboardService;
    constructor() {
        super();
        this.dashboardService = new DashboardService_1.DashboardService();
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { type, scope } = req.query;
            const { page, limit } = this.getPaginationParams(req);
            const { dashboards, total } = await this.dashboardService.listDashboards(organizationId, user.id, { type, scope });
            res.json({
                success: true,
                ...this.createPaginatedResponse(dashboards, total, page, limit),
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const dashboard = await this.dashboardService.createDashboard(organizationId, user.id, req.body);
            res.status(201).json({ success: true, data: dashboard });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId } = req.params;
            const dashboard = await this.dashboardService.getDashboard(dashboardId, organizationId);
            if (!dashboard) {
                res.status(404).json({ success: false, error: 'Dashboard not found' });
                return;
            }
            res.json({ success: true, data: dashboard });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId } = req.params;
            const dashboard = await this.dashboardService.updateDashboard(dashboardId, organizationId, req.body);
            res.json({ success: true, data: dashboard });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId } = req.params;
            await this.dashboardService.deleteDashboard(dashboardId, organizationId);
            res.json({ success: true, message: `Dashboard ${dashboardId} deleted` });
        });
    };
    addWidget = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId } = req.params;
            const widget = await this.dashboardService.addWidget(dashboardId, organizationId, req.body);
            res.status(201).json({ success: true, data: widget });
        });
    };
    updateWidget = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId, widgetId } = req.params;
            const widget = await this.dashboardService.updateWidget(dashboardId, widgetId, organizationId, req.body);
            res.json({ success: true, data: widget });
        });
    };
    deleteWidget = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId, widgetId } = req.params;
            await this.dashboardService.deleteWidget(dashboardId, widgetId, organizationId);
            res.json({ success: true, message: `Widget ${widgetId} deleted` });
        });
    };
    share = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { dashboardId } = req.params;
            const { userIds } = req.body;
            const dashboard = await this.dashboardService.shareDashboard(dashboardId, organizationId, userIds);
            res.json({ success: true, data: dashboard });
        });
    };
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboardController.js.map