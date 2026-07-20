"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminControllerV2 = void 0;
const database_1 = require("../../config/database");
const ExternalCatalogRecord_1 = require("../../models/ExternalCatalogRecord");
const LegalHold_1 = require("../../models/LegalHold");
const AdminMetricsService_1 = require("../../services/admin/AdminMetricsService");
const AdminSecurityLogService_1 = require("../../services/admin/AdminSecurityLogService");
const AnomalyDetectionService_1 = require("../../services/admin/AnomalyDetectionService");
const DataObfuscationService_1 = require("../../services/admin/DataObfuscationService");
const FeatureFlagService_1 = require("../../services/admin/FeatureFlagService");
const ExternalCatalogSyncService_1 = require("../../services/external/ExternalCatalogSyncService");
const monitoring_1 = require("../../services/monitoring");
const GdprDataDeletionService_1 = require("../../services/user/GdprDataDeletionService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class AdminControllerV2 extends BaseController_1.BaseController {
    externalCatalogSyncService = new ExternalCatalogSyncService_1.ExternalCatalogSyncService();
    normalizeExternalCatalogSources(rawSources) {
        if (!Array.isArray(rawSources) || rawSources.length === 0) {
            return undefined;
        }
        const sources = new Set();
        for (const value of rawSources) {
            if (value === ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB || value === ExternalCatalogRecord_1.ExternalCatalogSource.SC_CRAFT) {
                sources.add(value);
            }
        }
        return sources.size > 0 ? [...sources.values()] : undefined;
    }
    async getDashboard(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const [systemMetrics, securitySummary, featureFlagStats] = [
                await AdminMetricsService_1.AdminMetricsService.getSystemMetrics(),
                AdminSecurityLogService_1.AdminSecurityLogService.getLogSummary('24h'),
                FeatureFlagService_1.FeatureFlagService.getStatistics(),
            ];
            return {
                metrics: systemMetrics,
                security: securitySummary,
                featureFlags: featureFlagStats,
                timestamp: new Date(),
            };
        });
    }
    async getSystemMetrics(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const data = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            return { success: true, data };
        });
    }
    async getUserActionMetrics(req, res) {
        await this.execute(req, res, async () => {
            const period = req.query.period || '24h';
            const data = await AdminMetricsService_1.AdminMetricsService.getUserActionMetrics(period);
            res.status(200).json(data);
        });
    }
    async getTimeSeriesMetrics(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const metric = req.query.metric;
            const days = Number.parseInt(req.query.days) || 7;
            if (!['users', 'activities', 'errors'].includes(metric)) {
                throw new apiErrors_1.ValidationError('Invalid or missing metric type');
            }
            const data = await AdminMetricsService_1.AdminMetricsService.getTimeSeriesMetrics(metric, days);
            return { success: true, data };
        });
    }
    async getModerationAnalytics(req, res) {
        await this.execute(req, res, async () => {
            const data = await AdminMetricsService_1.AdminMetricsService.getPlatformModerationAnalytics();
            res.status(200).json({ success: true, data });
        });
    }
    async getSecurityLogs(req, res) {
        await this.execute(req, res, async () => {
            const limit = Math.min(Number.parseInt(req.query.limit) || 100, 200);
            const data = AdminSecurityLogService_1.AdminSecurityLogService.getRecentEvents(limit);
            res.status(200).json(data);
        });
    }
    async getSecuritySummary(req, res) {
        await this.execute(req, res, async () => {
            const period = req.query.period || '24h';
            const data = AdminSecurityLogService_1.AdminSecurityLogService.getLogSummary(period);
            res.status(200).json(data);
        });
    }
    async searchSecurityEvents(req, res) {
        await this.execute(req, res, async () => {
            const { type, severity, userHash, organizationHash, startDate, endDate } = req.body;
            const data = AdminSecurityLogService_1.AdminSecurityLogService.searchEvents({
                type: type,
                severity: severity,
                userHash,
                organizationHash,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            });
            res.status(200).json(data);
        });
    }
    async getFeatureFlags(req, res) {
        await this.execute(req, res, async () => {
            const data = await FeatureFlagService_1.FeatureFlagService.getAllFlags();
            res.status(200).json(data);
        });
    }
    async getFeatureFlag(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const flag = await FeatureFlagService_1.FeatureFlagService.getFlag(req.params.id);
            if (!flag) {
                throw new apiErrors_1.NotFoundError('Feature flag', req.params.id);
            }
            return flag;
        });
    }
    async createFeatureFlag(req, res) {
        await this.execute(req, res, async () => {
            const { id, name, description, status, scope, percentage, targetOrganizations, targetUsers, metadata, } = req.body;
            if (!id || !name || !status || !scope) {
                res.status(400).json({ error: 'Missing required fields: id, name, status, scope' });
                return;
            }
            const adminUserId = req.user?.id || 'unknown-admin';
            const flag = await FeatureFlagService_1.FeatureFlagService.createFlag({
                id,
                name,
                description,
                status: status,
                scope: scope,
                percentage,
                targetOrganizations,
                targetUsers,
                metadata,
                createdBy: adminUserId,
            }, adminUserId);
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.FEATURE_FLAG_CHANGED, adminUserId, `Created feature flag: ${id}`, 'success', { resource: 'feature_flag', details: { flagId: id, action: 'create' } });
            res.status(200).json(flag);
        });
    }
    async updateFeatureFlag(req, res) {
        await this.execute(req, res, async () => {
            const adminUserId = req.user?.id || 'unknown-admin';
            const updates = req.body;
            const flag = await FeatureFlagService_1.FeatureFlagService.updateFlag(req.params.id, updates, adminUserId);
            if (!flag) {
                res.status(404).json({ error: 'Feature flag not found' });
                return;
            }
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.FEATURE_FLAG_CHANGED, adminUserId, `Updated feature flag: ${req.params.id}`, 'success', { resource: 'feature_flag', details: { flagId: req.params.id, action: 'update' } });
            res.status(200).json(flag);
        });
    }
    async deleteFeatureFlag(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const adminUserId = req.user?.id || 'unknown-admin';
            const deleted = await FeatureFlagService_1.FeatureFlagService.deleteFlag(req.params.id, adminUserId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Feature flag', req.params.id);
            }
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.FEATURE_FLAG_CHANGED, adminUserId, `Deleted feature flag: ${req.params.id}`, 'success', { resource: 'feature_flag', details: { flagId: req.params.id, action: 'delete' } });
            return { success: true, message: 'Feature flag deleted' };
        });
    }
    async searchUsers(req, res) {
        await this.execute(req, res, async () => {
            const mockUsers = [
                {
                    id: 'user-1',
                    email: 'user@example.com',
                    username: 'testuser',
                    role: 'member',
                    createdAt: new Date(),
                },
                {
                    id: 'user-2',
                    email: 'admin@example.com',
                    username: 'admin',
                    role: 'admin',
                    createdAt: new Date(),
                },
            ];
            const data = DataObfuscationService_1.DataObfuscationService.obfuscateArray(mockUsers);
            res.status(200).json(data);
        });
    }
    async performUserAction(req, res) {
        await this.execute(req, res, async () => {
            const { userId } = req.params;
            const { action, reason } = req.body;
            const adminUserId = req.user?.id || 'unknown-admin';
            const validActions = ['disable', 'enable', 'reset_password', 'change_role'];
            if (!validActions.includes(action)) {
                res.status(400).json({ error: 'Invalid action' });
                return;
            }
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, adminUserId, `Admin action on user: ${action}`, 'success', {
                resource: 'user',
                details: {
                    targetUserHash: DataObfuscationService_1.DataObfuscationService.hash(userId),
                    action,
                    reason,
                },
            });
            res.status(200).json({
                success: true,
                message: `Action ${action} performed successfully`,
                userHash: DataObfuscationService_1.DataObfuscationService.hash(userId),
            });
        });
    }
    async getShipDataFetcherStatus(req, res) {
        await this.execute(req, res, async () => {
            const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/shipDataFetcher')));
            const status = ShipDataFetcher.getLastFetchStatus();
            const isCurrentlyFetching = ShipDataFetcher.isCurrentlyFetching();
            res.status(200).json({
                lastFetch: status,
                isCurrentlyFetching,
                configuration: {
                    sheet1Configured: !!process.env.SHIP_DATA_SHEET_1,
                    sheet2Configured: !!process.env.SHIP_DATA_SHEET_2,
                },
            });
        });
    }
    async refreshShipData(req, res) {
        await this.execute(req, res, async () => {
            const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/shipDataFetcher')));
            if (ShipDataFetcher.isCurrentlyFetching()) {
                res.status(200).json({
                    success: false,
                    message: 'Ship data fetch is already in progress',
                });
                return;
            }
            const userId = req.user?.id;
            if (userId) {
                AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, userId, 'manual_refresh', 'success', {
                    resource: 'ship-data-fetcher',
                    details: {
                        action: 'manual_refresh',
                    },
                });
            }
            void ShipDataFetcher.forceRefresh();
            res.status(200).json({
                success: true,
                message: 'Ship data refresh triggered successfully',
            });
        });
    }
    async previewExternalCatalogSync(req, res) {
        await this.execute(req, res, async () => {
            const body = (req.body ?? {});
            const report = await this.externalCatalogSyncService.synchronize({
                dryRun: true,
                sources: this.normalizeExternalCatalogSources(body.sources),
                sampleSize: body.sampleSize,
            });
            res.status(200).json(report);
        });
    }
    async applyExternalCatalogSync(req, res) {
        await this.execute(req, res, async () => {
            const body = (req.body ?? {});
            const report = await this.externalCatalogSyncService.synchronize({
                dryRun: false,
                sources: this.normalizeExternalCatalogSources(body.sources),
                sampleSize: body.sampleSize,
            });
            const userId = req.user?.id;
            if (userId) {
                AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, userId, 'external_catalog_sync_apply', 'success', {
                    resource: 'external-catalog-sync',
                    details: {
                        sources: report.sources,
                        summary: report.summary,
                    },
                });
            }
            res.status(200).json(report);
        });
    }
    async getPerformanceReport(req, res) {
        await this.execute(req, res, async () => {
            const report = await monitoring_1.performanceMonitoringService.generateReport();
            const summary = await monitoring_1.performanceMonitoringService.getQuickSummary();
            res.status(200).json({ report, summary, timestamp: new Date() });
        });
    }
    async getPerformanceHistory(_req, res) {
        await this.execute(_req, res, async () => {
            const history = monitoring_1.performanceMonitoringService.getReportHistory();
            res.status(200).json({ history, count: history.length });
        });
    }
    async getQueryAnalysis(_req, res) {
        await this.execute(_req, res, async () => {
            const stats = monitoring_1.queryAnalyzerService.getQueryStats();
            const slowQueries = monitoring_1.queryAnalyzerService.analyzeSlowQueries();
            const indexRecommendations = monitoring_1.queryAnalyzerService.getIndexRecommendations();
            res.status(200).json({ stats, slowQueries, indexRecommendations, timestamp: new Date() });
        });
    }
    async getTableStats(_req, res) {
        await this.execute(_req, res, async () => {
            const tables = await monitoring_1.queryAnalyzerService.getTableStats();
            res.status(200).json({ tables });
        });
    }
    async getTracingStats(_req, res) {
        await this.execute(_req, res, async () => {
            const stats = monitoring_1.distributedTracingService.getStats();
            const config = monitoring_1.distributedTracingService.getSamplingConfig();
            res.status(200).json({ stats, samplingConfig: config, timestamp: new Date() });
        });
    }
    async getTrace(req, res) {
        await this.execute(req, res, async () => {
            const { traceId } = req.params;
            const summary = monitoring_1.distributedTracingService.getTraceSummary(traceId);
            if (!summary) {
                res.status(404).json({ error: 'Trace not found' });
                return;
            }
            const spans = monitoring_1.distributedTracingService.getTrace(traceId);
            res.status(200).json({ summary, spans });
        });
    }
    async getAnomalies(req, res) {
        await this.execute(req, res, async () => {
            const anomalyService = AnomalyDetectionService_1.AnomalyDetectionService.getInstance();
            const active = anomalyService.getActiveAnomalies();
            const limit = Math.min(Number.parseInt(req.query.limit) || 50, 200);
            const history = anomalyService.getAnomalyHistory(limit);
            const statistics = anomalyService.getStatistics();
            res.status(200).json({ active, history, statistics, timestamp: new Date() });
        });
    }
    async acknowledgeAnomaly(req, res) {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id ?? 'unknown';
            const anomalyService = AnomalyDetectionService_1.AnomalyDetectionService.getInstance();
            const acknowledged = anomalyService.acknowledgeAnomaly(id, userId);
            if (!acknowledged) {
                res.status(404).json({ error: 'Anomaly not found' });
                return;
            }
            res.status(200).json({ success: true });
        });
    }
    async getScalingStatus(_req, res) {
        await this.execute(_req, res, async () => {
            const stats = monitoring_1.autoScalingTriggerService.getStats();
            const config = monitoring_1.autoScalingTriggerService.getConfig();
            res.status(200).json({ stats, config, timestamp: new Date() });
        });
    }
    async getOperationsOverview(_req, res) {
        await this.execute(_req, res, async () => {
            const { AdminOperationsService } = await Promise.resolve().then(() => __importStar(require('../../services/admin/AdminOperationsService')));
            const data = await AdminOperationsService.getOverview();
            res.status(200).json({ success: true, data });
        });
    }
    async triggerJob(req, res) {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const { adminJobRegistry } = await Promise.resolve().then(() => __importStar(require('../../services/admin/AdminJobRegistry')));
            const job = adminJobRegistry.getJob(jobId);
            if (!job) {
                res.status(404).json({ error: `Job '${jobId}' not found` });
                return;
            }
            if (job.isRunning) {
                res.status(409).json({ error: `Job '${jobId}' is already running` });
                return;
            }
            const executionPromise = adminJobRegistry.triggerJob(jobId);
            const timeout = new Promise(resolve => setTimeout(() => resolve(null), 30_000));
            const result = await Promise.race([executionPromise, timeout]);
            if (result) {
                res.status(200).json({
                    success: true,
                    data: {
                        jobId,
                        execution: result,
                    },
                });
            }
            else {
                res.status(202).json({
                    success: true,
                    message: `Job '${jobId}' is running in the background`,
                    data: { jobId },
                });
            }
        });
    }
    async enableJob(req, res) {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const { adminJobRegistry } = await Promise.resolve().then(() => __importStar(require('../../services/admin/AdminJobRegistry')));
            const success = adminJobRegistry.enableJob(jobId);
            if (!success) {
                res.status(404).json({ error: `Job '${jobId}' not found` });
                return;
            }
            res.status(200).json({ success: true, data: { jobId, enabled: true } });
        });
    }
    async disableJob(req, res) {
        await this.execute(req, res, async () => {
            const { jobId } = req.params;
            const { adminJobRegistry } = await Promise.resolve().then(() => __importStar(require('../../services/admin/AdminJobRegistry')));
            const success = adminJobRegistry.disableJob(jobId);
            if (!success) {
                res.status(404).json({ error: `Job '${jobId}' not found` });
                return;
            }
            res.status(200).json({ success: true, data: { jobId, enabled: false } });
        });
    }
    static _deletionService;
    static getDeletionService() {
        if (!AdminControllerV2._deletionService) {
            AdminControllerV2._deletionService = new GdprDataDeletionService_1.GdprDataDeletionService();
        }
        return AdminControllerV2._deletionService;
    }
    async getLegalHolds(_req, res) {
        await this.execute(_req, res, async () => {
            const repo = database_1.AppDataSource.getRepository(LegalHold_1.LegalHold);
            const holds = await repo.find({ order: { createdAt: 'DESC' } });
            const now = new Date();
            const mappedHolds = holds.map(hold => ({
                id: hold.id,
                userId: hold.userId,
                reason: hold.reason,
                holdUntil: hold.holdUntil?.toISOString() ?? null,
                createdBy: hold.createdBy ?? null,
                isActive: hold.isActive,
                createdAt: hold.createdAt.toISOString(),
                updatedAt: hold.updatedAt.toISOString(),
            }));
            const active = holds.filter(h => h.isActive && (!h.holdUntil || h.holdUntil >= now));
            const expired = holds.filter(h => !h.isActive || (h.holdUntil && h.holdUntil < now));
            res.status(200).json({
                holds: mappedHolds,
                stats: {
                    total: holds.length,
                    active: active.length,
                    expired: expired.length,
                    pendingReBox: 0,
                },
            });
        });
    }
    async createLegalHold(req, res) {
        await this.execute(req, res, async () => {
            const { userId, reason, holdUntil } = req.body;
            await AdminControllerV2.getDeletionService().setLegalHold(userId, reason, holdUntil ? new Date(holdUntil) : undefined, req.user?.id);
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user?.id ?? 'unknown', `Legal hold created for user ${DataObfuscationService_1.DataObfuscationService.partialMask(userId, 'generic')}`, 'success', { resource: 'legal_hold' });
            res.status(201).json({ success: true, message: 'Legal hold created' });
        });
    }
    async releaseLegalHold(req, res) {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { reason } = req.body;
            const legalHoldId = String(id ?? '').trim();
            const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidV4Like.test(legalHoldId)) {
                res.status(400).json({ error: 'Invalid legal hold id format' });
                return;
            }
            const repo = database_1.AppDataSource.getRepository(LegalHold_1.LegalHold);
            const hold = await repo
                .createQueryBuilder('legalHold')
                .where('legalHold.id = :id', { id: legalHoldId })
                .andWhere('legalHold.isActive = :isActive', { isActive: true })
                .getOne();
            if (!hold) {
                res.status(404).json({ error: 'Active legal hold not found' });
                return;
            }
            hold.isActive = false;
            await repo.save(hold);
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user?.id ?? 'unknown', `Legal hold ${id} released: ${reason}`, 'success', { resource: 'legal_hold' });
            res.status(200).json({ success: true, message: 'Legal hold released' });
        });
    }
}
exports.AdminControllerV2 = AdminControllerV2;
//# sourceMappingURL=adminController.js.map