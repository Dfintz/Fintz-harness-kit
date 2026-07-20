"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const ReportSchedulerJob_1 = require("../../jobs/ReportSchedulerJob");
const OrganizationAnalytics_1 = require("../../models/OrganizationAnalytics");
const OrganizationAnalyticsService_1 = require("../../services/organization/OrganizationAnalyticsService");
const BaseController_1 = require("../BaseController");
class ReportController extends BaseController_1.BaseController {
    analyticsService;
    constructor() {
        super();
        this.analyticsService = new OrganizationAnalyticsService_1.OrganizationAnalyticsService();
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const period = req.query.period ?? 'DAILY';
            const dashboard = await this.analyticsService.getDashboard(organizationId, OrganizationAnalytics_1.AnalyticsPeriod[period.toUpperCase()] ||
                OrganizationAnalytics_1.AnalyticsPeriod.DAILY);
            res.json({
                success: true,
                data: [dashboard],
                meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { type, parameters } = req.body;
            const period = OrganizationAnalytics_1.AnalyticsPeriod[(type ?? parameters?.period ?? 'DAILY').toUpperCase()] ?? OrganizationAnalytics_1.AnalyticsPeriod.DAILY;
            const startDate = parameters?.startDate ? new Date(parameters.startDate) : undefined;
            const endDate = parameters?.endDate ? new Date(parameters.endDate) : undefined;
            const analytics = await this.analyticsService.generateAnalytics(organizationId, period, startDate, endDate);
            res.status(201).json({
                success: true,
                data: {
                    id: analytics.id,
                    organizationId,
                    createdBy: userId,
                    period: analytics.period,
                    periodStart: analytics.periodStart,
                    periodEnd: analytics.periodEnd,
                    healthScore: analytics.overallHealthScore,
                    status: 'completed',
                    createdAt: analytics.createdAt,
                },
            });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { reportId } = req.params;
            const result = await this.analyticsService.getAnalyticsByPeriod(organizationId, reportId);
            res.json({
                success: true,
                data: {
                    id: result.data.id,
                    organizationId,
                    period: result.period,
                    memberStats: result.data.memberStats,
                    activityMetrics: result.data.activityMetrics,
                    engagementMetrics: result.data.engagementMetrics,
                    growthMetrics: result.data.growthMetrics,
                    healthScore: result.data.overallHealthScore,
                    alerts: result.data.alerts,
                    recommendations: result.data.recommendations,
                },
            });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { reportId } = req.params;
            const period = OrganizationAnalytics_1.AnalyticsPeriod[reportId.toUpperCase()] ||
                OrganizationAnalytics_1.AnalyticsPeriod.DAILY;
            const analytics = await this.analyticsService.generateAnalytics(organizationId, period);
            res.json({
                success: true,
                data: {
                    id: analytics.id,
                    organizationId,
                    period: analytics.period,
                    healthScore: analytics.overallHealthScore,
                    updatedAt: new Date().toISOString(),
                },
            });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const _organizationId = this.getOrganizationId(req);
            const { reportId } = req.params;
            res.json({
                success: true,
                message: `Report ${reportId} deleted`,
            });
        });
    };
    generate = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { format, dateRange } = req.body;
            const startDate = dateRange?.startDate ? new Date(dateRange.startDate) : undefined;
            const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : undefined;
            const analytics = await this.analyticsService.generateAnalytics(organizationId, OrganizationAnalytics_1.AnalyticsPeriod.DAILY, startDate, endDate);
            res.json({
                success: true,
                data: {
                    reportId: analytics.id,
                    organizationId,
                    format: format ?? 'json',
                    status: 'completed',
                    healthScore: analytics.overallHealthScore,
                    periodStart: analytics.periodStart,
                    periodEnd: analytics.periodEnd,
                    generatedAt: analytics.createdAt,
                },
            });
        });
    };
    download = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const format = req.query.format === 'csv' ? 'csv' : 'json';
            const period = OrganizationAnalytics_1.AnalyticsPeriod[(req.query.period ?? 'WEEKLY').toUpperCase()] ?? OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY;
            const exported = await this.analyticsService.exportAnalytics(organizationId, period, format);
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="report-${organizationId}-${Date.now()}.csv"`);
                res.send(exported);
            }
            else {
                res.json({
                    success: true,
                    data: exported,
                });
            }
        });
    };
    schedule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { schedule, recipients, format, timezone } = req.body;
            await ReportSchedulerJob_1.ReportSchedulerJobClass.saveSchedule({
                organizationId,
                schedule,
                recipients,
                format: format ?? 'pdf',
                timezone: timezone ?? 'UTC',
                createdBy: user.id,
                createdAt: new Date().toISOString(),
            });
            res.json({
                success: true,
                data: {
                    organizationId,
                    schedule,
                    recipients,
                    format: format ?? 'pdf',
                    timezone: timezone ?? 'UTC',
                    status: 'scheduled',
                    message: 'Report schedule saved — reports will be generated automatically',
                },
            });
        });
    };
    getTemplates = async (req, res) => {
        await this.execute(req, res, async () => {
            const _organizationId = this.getOrganizationId(req);
            res.json({
                success: true,
                data: [
                    {
                        id: 'daily',
                        name: 'Daily Analytics',
                        period: OrganizationAnalytics_1.AnalyticsPeriod.DAILY,
                        description: 'Daily organization analytics snapshot',
                    },
                    {
                        id: 'weekly',
                        name: 'Weekly Analytics',
                        period: OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY,
                        description: 'Weekly organization analytics with trend comparison',
                    },
                    {
                        id: 'monthly',
                        name: 'Monthly Analytics',
                        period: OrganizationAnalytics_1.AnalyticsPeriod.MONTHLY,
                        description: 'Monthly comprehensive analytics report',
                    },
                    {
                        id: 'quarterly',
                        name: 'Quarterly Review',
                        period: OrganizationAnalytics_1.AnalyticsPeriod.QUARTERLY,
                        description: 'Quarterly performance review with growth metrics',
                    },
                    {
                        id: 'yearly',
                        name: 'Annual Report',
                        period: OrganizationAnalytics_1.AnalyticsPeriod.YEARLY,
                        description: 'Full-year analytics with historical comparison',
                    },
                ],
            });
        });
    };
}
exports.ReportController = ReportController;
//# sourceMappingURL=reportController.js.map