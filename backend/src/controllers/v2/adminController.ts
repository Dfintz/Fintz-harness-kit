import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ExternalCatalogSource } from '../../models/ExternalCatalogRecord';
import { LegalHold } from '../../models/LegalHold';
import { AdminMetricsService } from '../../services/admin/AdminMetricsService';
import {
    AdminSecurityLogService,
    SecurityEventType,
    SecuritySeverity,
} from '../../services/admin/AdminSecurityLogService';
import { AnomalyDetectionService } from '../../services/admin/AnomalyDetectionService';
import { DataObfuscationService } from '../../services/admin/DataObfuscationService';
import {
    FeatureFlagScope,
    FeatureFlagService,
    FeatureFlagStatus,
} from '../../services/admin/FeatureFlagService';
import { ExternalCatalogSyncService } from '../../services/external/ExternalCatalogSyncService';
import {
    autoScalingTriggerService,
    distributedTracingService,
    performanceMonitoringService,
    queryAnalyzerService,
} from '../../services/monitoring';
import { GdprDataDeletionService } from '../../services/user/GdprDataDeletionService';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

type AuthRequest = Request & { user?: { id?: string } };

/**
 * Admin Controller V2
 * Handles admin-specific operations with v2 API standards
 * All data is obfuscated/encrypted to protect user privacy
 *
 * Extends BaseController: each handler runs inside `execute()`, which centralizes
 * the catch path (standardized error envelope + logging) so the per-method
 * try/catch + headersSent boilerplate is removed. Success and 4xx responses are
 * written directly by each handler and preserved exactly.
 */
export class AdminControllerV2 extends BaseController {
  private readonly externalCatalogSyncService = new ExternalCatalogSyncService();

  private normalizeExternalCatalogSources(
    rawSources: unknown
  ): ExternalCatalogSource[] | undefined {
    if (!Array.isArray(rawSources) || rawSources.length === 0) {
      return undefined;
    }

    const sources = new Set<ExternalCatalogSource>();
    for (const value of rawSources) {
      if (value === ExternalCatalogSource.SCMDB || value === ExternalCatalogSource.SC_CRAFT) {
        sources.add(value);
      }
    }

    return sources.size > 0 ? [...sources.values()] : undefined;
  }

  /**
   * GET /api/v2/admin/dashboard
   * Main admin dashboard overview with system metrics
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const [systemMetrics, securitySummary, featureFlagStats] = [
        await AdminMetricsService.getSystemMetrics(),
        AdminSecurityLogService.getLogSummary('24h'),
        FeatureFlagService.getStatistics(),
      ];

      return {
        metrics: systemMetrics,
        security: securitySummary,
        featureFlags: featureFlagStats,
        timestamp: new Date(),
      };
    });
  }

  /**
   * GET /api/v2/admin/metrics/system
   * System-wide metrics (obfuscated for privacy)
   */
  async getSystemMetrics(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const data = await AdminMetricsService.getSystemMetrics();
      return { success: true, data };
    });
  }

  /**
   * GET /api/v2/admin/metrics/user-actions
   * User action metrics (fully anonymized)
   */
  async getUserActionMetrics(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
      const data = await AdminMetricsService.getUserActionMetrics(period);
      res.status(200).json(data);
    });
  }

  /**
   * GET /api/v2/admin/metrics/timeseries
   * Time-series data for charts
   */
  async getTimeSeriesMetrics(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const metric = req.query.metric as 'users' | 'activities' | 'errors';
      const days = Number.parseInt(req.query.days as string) || 7;

      if (!['users', 'activities', 'errors'].includes(metric)) {
        throw new ValidationError('Invalid or missing metric type');
      }

      const data = await AdminMetricsService.getTimeSeriesMetrics(metric, days);
      return { success: true, data };
    });
  }

  /**
   * GET /api/v2/admin/moderation/analytics
   * Platform-wide moderation analytics (no tenant scoping)
   */
  async getModerationAnalytics(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const data = await AdminMetricsService.getPlatformModerationAnalytics();
      res.status(200).json({ success: true, data });
    });
  }

  /**
   * GET /api/v2/admin/security/logs
   * Recent security events (all user data obfuscated)
   */
  async getSecurityLogs(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 100, 200);
      const data = AdminSecurityLogService.getRecentEvents(limit);
      res.status(200).json(data);
    });
  }

  /**
   * GET /api/v2/admin/security/summary
   * Security log summary with aggregated statistics
   */
  async getSecuritySummary(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
      const data = AdminSecurityLogService.getLogSummary(period);
      res.status(200).json(data);
    });
  }

  /**
   * POST /api/v2/admin/security/search
   * Search security events by criteria
   */
  async searchSecurityEvents(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { type, severity, userHash, organizationHash, startDate, endDate } = req.body;

      const data = AdminSecurityLogService.searchEvents({
        type: type as SecurityEventType,
        severity: severity as SecuritySeverity,
        userHash,
        organizationHash,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      res.status(200).json(data);
    });
  }

  // ==================== FEATURE FLAG ENDPOINTS ====================

  /**
   * GET /api/v2/admin/feature-flags
   * Get all feature flags
   */
  async getFeatureFlags(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const data = await FeatureFlagService.getAllFlags();
      res.status(200).json(data);
    });
  }

  /**
   * GET /api/v2/admin/feature-flags/:id
   * Get specific feature flag
   */
  async getFeatureFlag(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const flag = await FeatureFlagService.getFlag(req.params.id);

      if (!flag) {
        throw new NotFoundError('Feature flag', req.params.id);
      }

      return flag;
    });
  }

  /**
   * POST /api/v2/admin/feature-flags
   * Create new feature flag
   */
  async createFeatureFlag(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const {
        id,
        name,
        description,
        status,
        scope,
        percentage,
        targetOrganizations,
        targetUsers,
        metadata,
      } = req.body;

      if (!id || !name || !status || !scope) {
        res.status(400).json({ error: 'Missing required fields: id, name, status, scope' });
        return;
      }

      const adminUserId = (req as AuthRequest).user?.id || 'unknown-admin';

      const flag = await FeatureFlagService.createFlag(
        {
          id,
          name,
          description,
          status: status as FeatureFlagStatus,
          scope: scope as FeatureFlagScope,
          percentage,
          targetOrganizations,
          targetUsers,
          metadata,
          createdBy: adminUserId,
        },
        adminUserId
      );

      AdminSecurityLogService.logEvent(
        SecurityEventType.FEATURE_FLAG_CHANGED,
        adminUserId,
        `Created feature flag: ${id}`,
        'success',
        { resource: 'feature_flag', details: { flagId: id, action: 'create' } }
      );

      res.status(200).json(flag);
    });
  }

  /**
   * PUT /api/v2/admin/feature-flags/:id
   * Update feature flag
   */
  async updateFeatureFlag(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const adminUserId = (req as AuthRequest).user?.id || 'unknown-admin';
      const updates = req.body;

      const flag = await FeatureFlagService.updateFlag(req.params.id, updates, adminUserId);

      if (!flag) {
        res.status(404).json({ error: 'Feature flag not found' });
        return;
      }

      AdminSecurityLogService.logEvent(
        SecurityEventType.FEATURE_FLAG_CHANGED,
        adminUserId,
        `Updated feature flag: ${req.params.id}`,
        'success',
        { resource: 'feature_flag', details: { flagId: req.params.id, action: 'update' } }
      );

      res.status(200).json(flag);
    });
  }

  /**
   * DELETE /api/v2/admin/feature-flags/:id
   * Delete feature flag
   */
  async deleteFeatureFlag(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const adminUserId = (req as AuthRequest).user?.id || 'unknown-admin';

      const deleted = await FeatureFlagService.deleteFlag(req.params.id, adminUserId);

      if (!deleted) {
        throw new NotFoundError('Feature flag', req.params.id);
      }

      AdminSecurityLogService.logEvent(
        SecurityEventType.FEATURE_FLAG_CHANGED,
        adminUserId,
        `Deleted feature flag: ${req.params.id}`,
        'success',
        { resource: 'feature_flag', details: { flagId: req.params.id, action: 'delete' } }
      );

      return { success: true, message: 'Feature flag deleted' };
    });
  }

  // ==================== USER MANAGEMENT ENDPOINTS ====================

  /**
   * POST /api/v2/admin/users/search
   * Search users (emails masked, usernames and IDs visible)
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
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

      const data = DataObfuscationService.obfuscateArray(mockUsers);
      res.status(200).json(data);
    });
  }

  /**
   * POST /api/v2/admin/users/:userId/actions
   * Perform admin action on user (ban, warn, suspend, etc.)
   */
  async performUserAction(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { userId } = req.params;
      const { action, reason } = req.body;
      const adminUserId = (req as AuthRequest).user?.id || 'unknown-admin';

      const validActions = ['disable', 'enable', 'reset_password', 'change_role'];
      if (!validActions.includes(action)) {
        res.status(400).json({ error: 'Invalid action' });
        return;
      }

      AdminSecurityLogService.logEvent(
        SecurityEventType.ADMIN_ACTION,
        adminUserId,
        `Admin action on user: ${action}`,
        'success',
        {
          resource: 'user',
          details: {
            targetUserHash: DataObfuscationService.hash(userId),
            action,
            reason,
          },
        }
      );

      res.status(200).json({
        success: true,
        message: `Action ${action} performed successfully`,
        userHash: DataObfuscationService.hash(userId),
      });
    });
  }

  // ==================== SHIP DATA FETCHER ENDPOINTS ====================

  /**
   * GET /api/v2/admin/ship-data-fetcher/status
   * Get ship data fetcher status
   */
  async getShipDataFetcherStatus(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { ShipDataFetcher } = await import('../../jobs/shipDataFetcher');

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

  /**
   * POST /api/v2/admin/ship-data-fetcher/refresh
   * Manually trigger ship data refresh
   */
  async refreshShipData(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { ShipDataFetcher } = await import('../../jobs/shipDataFetcher');

      if (ShipDataFetcher.isCurrentlyFetching()) {
        res.status(200).json({
          success: false,
          message: 'Ship data fetch is already in progress',
        });
        return;
      }

      const userId = (req as AuthRequest).user?.id;
      if (userId) {
        AdminSecurityLogService.logEvent(
          SecurityEventType.ADMIN_ACTION,
          userId,
          'manual_refresh',
          'success',
          {
            resource: 'ship-data-fetcher',
            details: {
              action: 'manual_refresh',
            },
          }
        );
      }

      void ShipDataFetcher.forceRefresh();

      res.status(200).json({
        success: true,
        message: 'Ship data refresh triggered successfully',
      });
    });
  }

  /**
   * POST /api/v2/admin/external-catalog-sync/preview
   * Runs SCMDB/SC Craft reconciliation in dry-run mode and returns a diff report.
   */
  async previewExternalCatalogSync(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const body = (req.body ?? {}) as {
        sources?: ExternalCatalogSource[];
        sampleSize?: number;
      };

      const report = await this.externalCatalogSyncService.synchronize({
        dryRun: true,
        sources: this.normalizeExternalCatalogSources(body.sources),
        sampleSize: body.sampleSize,
      });

      res.status(200).json(report);
    });
  }

  /**
   * POST /api/v2/admin/external-catalog-sync/apply
   * Applies SCMDB/SC Craft reconciliation changes after review.
   */
  async applyExternalCatalogSync(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const body = (req.body ?? {}) as {
        sources?: ExternalCatalogSource[];
        sampleSize?: number;
      };

      const report = await this.externalCatalogSyncService.synchronize({
        dryRun: false,
        sources: this.normalizeExternalCatalogSources(body.sources),
        sampleSize: body.sampleSize,
      });

      const userId = (req as AuthRequest).user?.id;
      if (userId) {
        AdminSecurityLogService.logEvent(
          SecurityEventType.ADMIN_ACTION,
          userId,
          'external_catalog_sync_apply',
          'success',
          {
            resource: 'external-catalog-sync',
            details: {
              sources: report.sources,
              summary: report.summary,
            },
          }
        );
      }

      res.status(200).json(report);
    });
  }

  // ==================== MONITORING ====================

  /**
   * GET /api/v2/admin/monitoring/performance
   * Performance report with system health
   */
  async getPerformanceReport(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const report = await performanceMonitoringService.generateReport();
      const summary = await performanceMonitoringService.getQuickSummary();
      res.status(200).json({ report, summary, timestamp: new Date() });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/performance/history
   * Historical performance reports
   */
  async getPerformanceHistory(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const history = performanceMonitoringService.getReportHistory();
      res.status(200).json({ history, count: history.length });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/queries
   * Query analysis: stats, slow queries, index recommendations
   */
  async getQueryAnalysis(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const stats = queryAnalyzerService.getQueryStats();
      const slowQueries = queryAnalyzerService.analyzeSlowQueries();
      const indexRecommendations = queryAnalyzerService.getIndexRecommendations();
      res.status(200).json({ stats, slowQueries, indexRecommendations, timestamp: new Date() });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/queries/tables
   * Database table statistics
   */
  async getTableStats(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const tables = await queryAnalyzerService.getTableStats();
      res.status(200).json({ tables });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/tracing/stats
   * Distributed tracing statistics
   */
  async getTracingStats(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const stats = distributedTracingService.getStats();
      const config = distributedTracingService.getSamplingConfig();
      res.status(200).json({ stats, samplingConfig: config, timestamp: new Date() });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/tracing/:traceId
   * Get trace details by ID
   */
  async getTrace(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { traceId } = req.params;
      const summary = distributedTracingService.getTraceSummary(traceId);
      if (!summary) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }
      const spans = distributedTracingService.getTrace(traceId);
      res.status(200).json({ summary, spans });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/anomalies
   * Active anomalies and history
   */
  async getAnomalies(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const anomalyService = AnomalyDetectionService.getInstance();
      const active = anomalyService.getActiveAnomalies();
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 50, 200);
      const history = anomalyService.getAnomalyHistory(limit);
      const statistics = anomalyService.getStatistics();
      res.status(200).json({ active, history, statistics, timestamp: new Date() });
    });
  }

  /**
   * POST /api/v2/admin/monitoring/anomalies/:id/acknowledge
   * Acknowledge an anomaly
   */
  async acknowledgeAnomaly(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = (req as AuthRequest).user?.id ?? 'unknown';
      const anomalyService = AnomalyDetectionService.getInstance();
      const acknowledged = anomalyService.acknowledgeAnomaly(id, userId);
      if (!acknowledged) {
        res.status(404).json({ error: 'Anomaly not found' });
        return;
      }
      res.status(200).json({ success: true });
    });
  }

  /**
   * GET /api/v2/admin/monitoring/scaling
   * Auto-scaling stats and recommendations
   */
  async getScalingStatus(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const stats = autoScalingTriggerService.getStats();
      const config = autoScalingTriggerService.getConfig();
      res.status(200).json({ stats, config, timestamp: new Date() });
    });
  }

  // ==================== OPERATIONS OVERVIEW ====================

  /**
   * GET /api/v2/admin/operations/overview
   * Aggregated overview of Discord bot commands, scheduled jobs, and data fetchers
   */
  async getOperationsOverview(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const { AdminOperationsService } =
        await import('../../services/admin/AdminOperationsService');
      const data = await AdminOperationsService.getOverview();

      res.status(200).json({ success: true, data });
    });
  }

  /**
   * POST /api/v2/admin/operations/jobs/:jobId/trigger
   * Manually trigger a scheduled job
   */
  async triggerJob(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const { adminJobRegistry } = await import('../../services/admin/AdminJobRegistry');

      const job = adminJobRegistry.getJob(jobId);
      if (!job) {
        res.status(404).json({ error: `Job '${jobId}' not found` });
        return;
      }

      if (job.isRunning) {
        res.status(409).json({ error: `Job '${jobId}' is already running` });
        return;
      }

      // Fire and forget — the job may take a while
      const executionPromise = adminJobRegistry.triggerJob(jobId);

      // Wait up to 30s for the result; if it takes longer, return accepted
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 30_000));
      const result = await Promise.race([executionPromise, timeout]);

      if (result) {
        res.status(200).json({
          success: true,
          data: {
            jobId,
            execution: result,
          },
        });
      } else {
        res.status(202).json({
          success: true,
          message: `Job '${jobId}' is running in the background`,
          data: { jobId },
        });
      }
    });
  }

  /**
   * POST /api/v2/admin/operations/jobs/:jobId/enable
   * Enable a scheduled job
   */
  async enableJob(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const { adminJobRegistry } = await import('../../services/admin/AdminJobRegistry');

      const success = adminJobRegistry.enableJob(jobId);
      if (!success) {
        res.status(404).json({ error: `Job '${jobId}' not found` });
        return;
      }

      res.status(200).json({ success: true, data: { jobId, enabled: true } });
    });
  }

  /**
   * POST /api/v2/admin/operations/jobs/:jobId/disable
   * Disable a scheduled job
   */
  async disableJob(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const { adminJobRegistry } = await import('../../services/admin/AdminJobRegistry');

      const success = adminJobRegistry.disableJob(jobId);
      if (!success) {
        res.status(404).json({ error: `Job '${jobId}' not found` });
        return;
      }

      res.status(200).json({ success: true, data: { jobId, enabled: false } });
    });
  }

  // ==================== LEGAL HOLDS ====================

  private static _deletionService: GdprDataDeletionService;
  private static getDeletionService(): GdprDataDeletionService {
    if (!AdminControllerV2._deletionService) {
      AdminControllerV2._deletionService = new GdprDataDeletionService();
    }
    return AdminControllerV2._deletionService;
  }

  /**
   * GET /api/v2/admin/legal-holds
   * List all legal holds with stats
   */
  async getLegalHolds(_req: Request, res: Response): Promise<void> {
    await this.execute(_req, res, async () => {
      const repo = AppDataSource.getRepository(LegalHold);
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

  /**
   * POST /api/v2/admin/legal-holds
   * Create a new legal hold on a user (validated by Joi schema)
   */
  async createLegalHold(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { userId, reason, holdUntil } = req.body;

      await AdminControllerV2.getDeletionService().setLegalHold(
        userId,
        reason,
        holdUntil ? new Date(holdUntil) : undefined,
        req.user?.id
      );

      AdminSecurityLogService.logEvent(
        SecurityEventType.ADMIN_ACTION,
        req.user?.id ?? 'unknown',
        `Legal hold created for user ${DataObfuscationService.partialMask(userId, 'generic')}`,
        'success',
        { resource: 'legal_hold' }
      );

      res.status(201).json({ success: true, message: 'Legal hold created' });
    });
  }

  /**
   * POST /api/v2/admin/legal-holds/:id/release
   * Release an active legal hold (validated by Joi schema)
   */
  async releaseLegalHold(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { reason } = req.body;

      const legalHoldId = String(id ?? '').trim();
      const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidV4Like.test(legalHoldId)) {
        res.status(400).json({ error: 'Invalid legal hold id format' });
        return;
      }

      const repo = AppDataSource.getRepository(LegalHold);
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

      AdminSecurityLogService.logEvent(
        SecurityEventType.ADMIN_ACTION,
        req.user?.id ?? 'unknown',
        `Legal hold ${id} released: ${reason}`,
        'success',
        { resource: 'legal_hold' }
      );

      res.status(200).json({ success: true, message: 'Legal hold released' });
    });
  }
}
