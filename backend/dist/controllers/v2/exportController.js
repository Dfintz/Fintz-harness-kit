"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportController = void 0;
const CrossSystemAnalyticsService_1 = require("../../services/analytics/CrossSystemAnalyticsService");
const ExportRequestService_1 = require("../../services/user/ExportRequestService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class ExportController extends BaseController_1.BaseController {
    exportService;
    analyticsService;
    constructor() {
        super();
        this.exportService = new ExportRequestService_1.ExportRequestService();
        this.analyticsService = new CrossSystemAnalyticsService_1.CrossSystemAnalyticsService();
    }
    create = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const user = this.getAuthUser(authReq);
            const { format } = authReq.body;
            const exportRequest = await this.exportService.createExportRequest(user.id, authReq.ip, authReq.headers['user-agent'], { format });
            return {
                success: true,
                data: exportRequest,
            };
        }, 201);
    };
    getById = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const { jobId } = authReq.params;
            const exportRequest = await this.exportService.getExportRequest(jobId);
            if (!exportRequest) {
                throw new apiErrors_1.NotFoundError('Export job', jobId);
            }
            return {
                success: true,
                data: exportRequest,
            };
        });
    };
    download = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const { jobId } = authReq.params;
            const { token } = authReq.query;
            if (!token) {
                throw new apiErrors_1.ValidationError('Download token is required');
            }
            const exportRequest = await this.exportService.verifyDownloadToken(jobId, token);
            if (!exportRequest) {
                throw new apiErrors_1.ForbiddenError('Invalid or expired download token');
            }
            return {
                success: true,
                data: exportRequest,
            };
        });
    };
    listJobs = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const user = this.getAuthUser(authReq);
            const { limit } = authReq.query;
            const limitNum = Math.min(Number.parseInt(limit) || 10, 200);
            const jobs = await this.exportService.getUserExportRequests(user.id, limitNum);
            return {
                success: true,
                data: jobs,
                pagination: {
                    total: jobs.length,
                    count: jobs.length,
                    page: 1,
                    pageSize: limitNum,
                    hasMore: false,
                    totalPages: 1,
                },
            };
        });
    };
    delete = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const { jobId } = authReq.params;
            const exportRequest = await this.exportService.getExportRequest(jobId);
            if (!exportRequest) {
                throw new apiErrors_1.NotFoundError('Export job', jobId);
            }
            await this.exportService.deleteExportRequest(jobId);
            return {
                success: true,
                data: {
                    id: jobId,
                    deleted: true,
                },
            };
        });
    };
    exportAttendanceCorrelation = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                res.status(400).json({ success: false, error: 'Organization context required' });
                return;
            }
            const activityId = typeof req.query.activityId === 'string' ? req.query.activityId : undefined;
            const startDate = typeof req.query.startDate === 'string' ? new Date(req.query.startDate) : undefined;
            const endDate = typeof req.query.endDate === 'string' ? new Date(req.query.endDate) : undefined;
            const format = typeof req.query.format === 'string' ? req.query.format : 'json';
            const report = await this.analyticsService.getAttendanceCorrelationReport(organizationId, {
                activityId,
                startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
                endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
            });
            if (format === 'csv') {
                res
                    .status(200)
                    .type('text/csv; charset=utf-8')
                    .send(this.analyticsService.formatAttendanceCorrelationCsv(report));
                return;
            }
            res.json({ success: true, data: report });
        });
    };
}
exports.ExportController = ExportController;
//# sourceMappingURL=exportController.js.map