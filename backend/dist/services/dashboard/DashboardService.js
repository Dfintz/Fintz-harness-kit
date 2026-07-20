"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const database_1 = require("../../config/database");
const Dashboard_1 = require("../../models/Dashboard");
const DashboardWidget_1 = require("../../models/DashboardWidget");
const apiErrors_1 = require("../../utils/apiErrors");
class DashboardService {
    dashboardRepo = database_1.AppDataSource.getRepository(Dashboard_1.Dashboard);
    widgetRepo = database_1.AppDataSource.getRepository(DashboardWidget_1.DashboardWidget);
    async listDashboards(organizationId, userId, filters) {
        const qb = this.dashboardRepo
            .createQueryBuilder('dashboard')
            .leftJoinAndSelect('dashboard.widgets', 'widget')
            .where('dashboard.organizationId = :organizationId', { organizationId })
            .orderBy('dashboard.createdAt', 'DESC');
        if (filters?.type) {
            qb.andWhere('dashboard.type = :type', { type: filters.type });
        }
        if (filters?.scope === 'mine') {
            qb.andWhere('dashboard.createdBy = :userId', { userId });
        }
        const [dashboards, total] = await qb.getManyAndCount();
        return { dashboards, total };
    }
    async getDashboard(dashboardId, organizationId) {
        return this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
            relations: ['widgets'],
        });
    }
    async createDashboard(organizationId, userId, data) {
        const dashboard = this.dashboardRepo.create({
            ...data,
            organizationId,
            createdBy: userId,
        });
        return this.dashboardRepo.save(dashboard);
    }
    async updateDashboard(dashboardId, organizationId, data) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
        });
        if (!dashboard) {
            throw new apiErrors_1.NotFoundError('Dashboard');
        }
        Object.assign(dashboard, data);
        return this.dashboardRepo.save(dashboard);
    }
    async deleteDashboard(dashboardId, organizationId) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
        });
        if (!dashboard) {
            throw new apiErrors_1.NotFoundError('Dashboard');
        }
        await this.dashboardRepo.remove(dashboard);
    }
    async addWidget(dashboardId, organizationId, data) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
        });
        if (!dashboard) {
            throw new apiErrors_1.NotFoundError('Dashboard');
        }
        const widget = this.widgetRepo.create({ ...data, dashboardId });
        return this.widgetRepo.save(widget);
    }
    async updateWidget(dashboardId, widgetId, organizationId, data) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
        });
        if (!dashboard) {
            throw new apiErrors_1.NotFoundError('Dashboard');
        }
        const widget = await this.widgetRepo.findOne({ where: { id: widgetId, dashboardId } });
        if (!widget) {
            throw new apiErrors_1.NotFoundError('Widget');
        }
        Object.assign(widget, data);
        return this.widgetRepo.save(widget);
    }
    async deleteWidget(dashboardId, widgetId, organizationId) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
        });
        if (!dashboard) {
            throw new apiErrors_1.NotFoundError('Dashboard');
        }
        const widget = await this.widgetRepo.findOne({ where: { id: widgetId, dashboardId } });
        if (!widget) {
            throw new apiErrors_1.NotFoundError('Widget');
        }
        await this.widgetRepo.remove(widget);
    }
    async shareDashboard(dashboardId, organizationId, userIds) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { id: dashboardId, organizationId },
        });
        if (!dashboard) {
            throw new apiErrors_1.NotFoundError('Dashboard');
        }
        const existing = dashboard.sharedWithUsers ?? [];
        const merged = [...new Set([...existing, ...userIds])];
        dashboard.sharedWithUsers = merged;
        return this.dashboardRepo.save(dashboard);
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=DashboardService.js.map