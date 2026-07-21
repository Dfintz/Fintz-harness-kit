import { Router } from 'express';

import { ComplianceController } from '../../controllers/complianceController';
import { OrganizationController } from '../../controllers/organizationController';
import { AdminControllerV2 } from '../../controllers/v2/adminController';
import { IntegrationStatusController } from '../../controllers/v2/integrationStatusController';
import { adminRateLimit, logAdminMutation, requireAdmin } from '../../middleware/adminAuth';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { twoFactorChallengeMiddleware } from '../../middleware/twoFactorChallenge';
import { adminSearchSchemas, complianceSchemas, integrationSchemas } from '../../schemas';
import { adminOperationSchemas } from '../../schemas/adminOperationSchemas';
import {
  paramSchemas as featureFlagParams,
  featureFlagSchemas,
} from '../../schemas/featureFlagSchemas';
import { legalHoldSchemas } from '../../schemas/legalHoldSchemas';
import { router as deadLetterRoutes } from '../admin/deadLetterRoutes';
import { router as incidentRoutes } from '../admin/incidentRoutes';
import { setupAdminShipRoutes } from '../adminShipRoutes';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let controller: AdminControllerV2;
const getController = () => {
  if (!controller) {
    controller = new AdminControllerV2();
  }
  return controller;
};

let orgController: OrganizationController;
const getOrgController = () => {
  if (!orgController) {
    orgController = new OrganizationController();
  }
  return orgController;
};

let complianceController: ComplianceController;
const getComplianceController = () => {
  if (!complianceController) {
    complianceController = new ComplianceController();
  }
  return complianceController;
};

let integrationStatusController: IntegrationStatusController;
const getIntegrationStatusController = () => {
  if (!integrationStatusController) {
    integrationStatusController = new IntegrationStatusController();
  }
  return integrationStatusController;
};

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);
router.use(adminRateLimit(200, 60000)); // 200 requests per minute

// ==================== INCIDENT RESPONSE ====================
/**
 * Data breach incident management routes
 */
router.use('/incidents', incidentRoutes);

// ==================== ROLE SYNC DEAD-LETTER QUEUE ====================
/**
 * Role-sync retry dead-letter queue (read + manual retry)
 */
router.use('/role-sync', deadLetterRoutes);

// ==================== COMPLIANCE ====================
/**
 * License export and data retention management
 */
router.get(
  '/compliance/licenses',
  validateSchema(complianceSchemas.licenseExport, 'query'),
  (req, res) => getComplianceController().exportLicenses(req, res)
);
router.get('/compliance/retention/config', (req, res) =>
  getComplianceController().getRetentionConfig(req, res)
);
router.post(
  '/compliance/retention/execute',
  logAdminMutation,
  validateSchema(adminOperationSchemas.retentionExecuteBody, 'body'),
  (req, res) => getComplianceController().executeRetention(req, res)
);

// ==================== INTEGRATIONS ====================
/**
 * Integration health monitoring for external services
 */
router.get('/integrations/health', (req, res) =>
  getIntegrationStatusController().getSystemHealth(req, res)
);
router.get(
  '/integrations/health/:name',
  validateSchema(integrationSchemas.integrationName, 'params'),
  (req, res) => getIntegrationStatusController().getIntegrationHealth(req, res)
);
router.post(
  '/integrations/health/refresh',
  logAdminMutation,
  validateSchema(adminOperationSchemas.integrationRefreshBody, 'body'),
  (req, res) => getIntegrationStatusController().refreshHealth(req, res)
);

// ==================== SHIP MANAGEMENT ====================
/**
 * Ship database CSV upload and delta management routes
 */
setupAdminShipRoutes(router);

// ==================== DASHBOARD ====================

/**
 * GET /api/v2/admin/dashboard
 * Main admin dashboard overview
 */
router.get('/dashboard', (req, res) => getController().getDashboard(req, res));

// ==================== METRICS ====================

/**
 * GET /api/v2/admin/metrics/system
 * System-wide metrics (obfuscated)
 */
router.get('/metrics/system', (req, res) => getController().getSystemMetrics(req, res));

/**
 * GET /api/v2/admin/metrics/user-actions
 * User action metrics (fully anonymized)
 */
router.get('/metrics/user-actions', (req, res) => getController().getUserActionMetrics(req, res));

/**
 * GET /api/v2/admin/metrics/timeseries
 * Time-series data for charts
 */
router.get('/metrics/timeseries', (req, res) => getController().getTimeSeriesMetrics(req, res));

// ==================== MODERATION ====================

/**
 * GET /api/v2/admin/moderation/analytics
 * Platform-wide moderation analytics (no tenant scoping)
 */
router.get('/moderation/analytics', (req, res) => getController().getModerationAnalytics(req, res));

// ==================== SECURITY LOGS ====================

/**
 * GET /api/v2/admin/security/logs
 * Recent security events (all user data obfuscated)
 */
router.get('/security/logs', (req, res) => getController().getSecurityLogs(req, res));

/**
 * GET /api/v2/admin/security/summary
 * Security log summary with aggregated statistics
 */
router.get('/security/summary', (req, res) => getController().getSecuritySummary(req, res));

/**
 * POST /api/v2/admin/security/search
 * Search security events by criteria
 */
router.post(
  '/security/search',
  validateSchema(adminSearchSchemas.securitySearch, 'body'),
  (req, res) => getController().searchSecurityEvents(req, res)
);

// ==================== FEATURE FLAGS ====================

/**
 * GET /api/v2/admin/feature-flags
 * Get all feature flags
 */
router.get('/feature-flags', (req, res) => getController().getFeatureFlags(req, res));

/**
 * GET /api/v2/admin/feature-flags/:id
 * Get specific feature flag
 */
router.get(
  '/feature-flags/:id',
  validateSchema(featureFlagParams.featureFlagId, 'params'),
  (req, res) => getController().getFeatureFlag(req, res)
);

/**
 * POST /api/v2/admin/feature-flags
 * Create new feature flag
 */
router.post(
  '/feature-flags',
  logAdminMutation,
  validateSchema(featureFlagSchemas.create, 'body'),
  (req, res) => getController().createFeatureFlag(req, res)
);

/**
 * PUT /api/v2/admin/feature-flags/:id
 * Update feature flag
 */
router.put(
  '/feature-flags/:id',
  logAdminMutation,
  validateSchema(featureFlagParams.featureFlagId, 'params'),
  validateSchema(featureFlagSchemas.update, 'body'),
  (req, res) => getController().updateFeatureFlag(req, res)
);

/**
 * PATCH /api/v2/admin/feature-flags/:id
 * Update feature flag (partial)
 */
router.patch(
  '/feature-flags/:id',
  logAdminMutation,
  validateSchema(featureFlagParams.featureFlagId, 'params'),
  validateSchema(featureFlagSchemas.update, 'body'),
  (req, res) => getController().updateFeatureFlag(req, res)
);

/**
 * DELETE /api/v2/admin/feature-flags/:id
 * Delete feature flag
 */
router.delete(
  '/feature-flags/:id',
  logAdminMutation,
  validateSchema(featureFlagParams.featureFlagId, 'params'),
  (req, res) => getController().deleteFeatureFlag(req, res)
);

// ==================== USER MANAGEMENT ====================

/**
 * POST /api/v2/admin/users/search
 * Search users (returns obfuscated data only)
 */
router.post('/users/search', validateSchema(adminSearchSchemas.userSearch, 'body'), (req, res) =>
  getController().searchUsers(req, res)
);

/**
 * POST /api/v2/admin/users/:userId/actions
 * Perform admin action on user
 */
router.post(
  '/users/:userId/actions',
  logAdminMutation,
  validateSchema(adminOperationSchemas.userActionBody, 'body'),
  (req, res) => getController().performUserAction(req, res)
);

// ==================== SHIP DATA FETCHER ====================

/**
 * GET /api/v2/admin/ship-data-fetcher/status
 * Get ship data fetcher status
 */
router.get('/ship-data-fetcher/status', (req, res) =>
  getController().getShipDataFetcherStatus(req, res)
);

/**
 * GET /api/v2/admin/ship-sync-status
 * Phase 6.1 — operational visibility alias for ship sync status.
 * Returns the same payload as /ship-data-fetcher/status.
 */
router.get('/ship-sync-status', (req, res) => getController().getShipDataFetcherStatus(req, res));

/**
 * POST /api/v2/admin/ship-data-fetcher/refresh
 * Manually trigger ship data refresh
 */
router.post('/ship-data-fetcher/refresh', logAdminMutation, (req, res) =>
  getController().refreshShipData(req, res)
);

/**
 * POST /api/v2/admin/ship-data-fetcher/import-csv
 * Import ship data from uploaded CSV content
 * Body: { csvContent: string, isVehicle?: boolean }
 */
router.post(
  '/ship-data-fetcher/import-csv',
  logAdminMutation,
  validateSchema(adminOperationSchemas.shipDataImportBody, 'body'),
  async (req, res) => {
    try {
      const { csvContent, isVehicle = false } = req.body;
      if (!csvContent || typeof csvContent !== 'string') {
        res.status(400).json({ error: 'csvContent is required (string)' });
        return;
      }
      const { ShipDataFetcher } = await import('../../jobs/shipDataFetcher');
      const result = await ShipDataFetcher.importFromCsvContent(csvContent, isVehicle);
      res.status(200).json({
        message: 'CSV import completed',
        processed: result.processed,
        total: result.total,
        errors: result.errors.slice(0, 20), // Limit error output
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to import CSV: ${msg}` });
    }
  }
);

// ==================== EXTERNAL CATALOG SYNC ====================

/**
 * POST /api/v2/admin/external-catalog-sync/preview
 * Dry-run SCMDB + SC Craft reconciliation with diff output.
 */
router.post(
  '/external-catalog-sync/preview',
  logAdminMutation,
  validateSchema(adminOperationSchemas.externalCatalogSyncBody, 'body'),
  (req, res) => getController().previewExternalCatalogSync(req, res)
);

/**
 * POST /api/v2/admin/external-catalog-sync/apply
 * Apply SCMDB + SC Craft reconciliation changes.
 */
router.post(
  '/external-catalog-sync/apply',
  logAdminMutation,
  validateSchema(adminOperationSchemas.externalCatalogSyncBody, 'body'),
  (req, res) => getController().applyExternalCatalogSync(req, res)
);

// ==================== ORGANIZATION DELETION REQUESTS ====================

// ==================== MONITORING ====================
/**
 * GET /api/v2/admin/monitoring/performance
 * Performance report with system health
 */
router.get('/monitoring/performance', (req, res) => getController().getPerformanceReport(req, res));

/**
 * GET /api/v2/admin/monitoring/performance/history
 * Historical performance reports
 */
router.get('/monitoring/performance/history', (req, res) =>
  getController().getPerformanceHistory(req, res)
);

/**
 * GET /api/v2/admin/monitoring/queries
 * Query analysis: stats, slow queries, index recommendations
 */
router.get('/monitoring/queries', (req, res) => getController().getQueryAnalysis(req, res));

/**
 * GET /api/v2/admin/monitoring/queries/tables
 * Database table statistics
 */
router.get('/monitoring/queries/tables', (req, res) => getController().getTableStats(req, res));

/**
 * GET /api/v2/admin/monitoring/tracing/stats
 * Distributed tracing statistics
 */
router.get('/monitoring/tracing/stats', (req, res) => getController().getTracingStats(req, res));

/**
 * GET /api/v2/admin/monitoring/tracing/:traceId
 * Get trace details by ID
 */
router.get('/monitoring/tracing/:traceId', (req, res) => getController().getTrace(req, res));

/**
 * GET /api/v2/admin/monitoring/anomalies
 * Active anomalies and history
 */
router.get('/monitoring/anomalies', (req, res) => getController().getAnomalies(req, res));

/**
 * POST /api/v2/admin/monitoring/anomalies/:id/acknowledge
 * Acknowledge an anomaly
 */
router.post(
  '/monitoring/anomalies/:id/acknowledge',
  logAdminMutation,
  validateSchema(adminOperationSchemas.anomalyAcknowledgeBody, 'body'),
  (req, res) => getController().acknowledgeAnomaly(req, res)
);

/**
 * GET /api/v2/admin/monitoring/scaling
 * Auto-scaling stats and recommendations
 */
router.get('/monitoring/scaling', (req, res) => getController().getScalingStatus(req, res));

// ==================== OPERATIONS OVERVIEW ====================

/**
 * GET /api/v2/admin/operations/overview
 * Aggregated operations monitoring: Discord bot commands, scheduled jobs, data fetchers
 */
router.get('/operations/overview', (req, res) => getController().getOperationsOverview(req, res));

/**
 * POST /api/v2/admin/operations/jobs/:jobId/trigger
 * Manually trigger a scheduled job
 */
router.post(
  '/operations/jobs/:jobId/trigger',
  logAdminMutation,
  validateSchema(adminOperationSchemas.jobIdParams, 'params'),
  (req, res) => getController().triggerJob(req, res)
);

/**
 * POST /api/v2/admin/operations/jobs/:jobId/enable
 * Enable a scheduled job
 */
router.post(
  '/operations/jobs/:jobId/enable',
  logAdminMutation,
  validateSchema(adminOperationSchemas.jobIdParams, 'params'),
  (req, res) => getController().enableJob(req, res)
);

/**
 * POST /api/v2/admin/operations/jobs/:jobId/disable
 * Disable a scheduled job
 */
router.post(
  '/operations/jobs/:jobId/disable',
  logAdminMutation,
  validateSchema(adminOperationSchemas.jobIdParams, 'params'),
  (req, res) => getController().disableJob(req, res)
);

// ==================== ORGANIZATION DELETION REQUESTS ====================

/**
 * GET /api/v2/admin/organizations/deletion-requests/pending
 * Get all pending organization deletion requests
 */
router.get('/organizations/deletion-requests/pending', (req, res) =>
  getOrgController().getPendingDeletionRequests(req, res)
);

/**
 * GET /api/v2/admin/organizations/deletion-requests/:requestId
 * Get a specific deletion request by ID
 */
router.get('/organizations/deletion-requests/:requestId', (req, res) =>
  getOrgController().getDeletionRequest(req, res)
);

/**
 * POST /api/v2/admin/organizations/deletion-requests/:requestId/approve
 * Approve a deletion request (requires 2FA if enabled)
 */
router.post(
  '/organizations/deletion-requests/:requestId/approve',
  validateSchema(adminOperationSchemas.deletionRequestParams, 'params'),
  twoFactorChallengeMiddleware('organization-delete'),
  logAdminMutation,
  validateSchema(adminOperationSchemas.deletionRequestApproveBody, 'body'),
  (req, res) => getOrgController().approveDeletionRequest(req, res)
);

/**
 * POST /api/v2/admin/organizations/deletion-requests/:requestId/reject
 * Reject a deletion request (requires 2FA if enabled)
 */
router.post(
  '/organizations/deletion-requests/:requestId/reject',
  validateSchema(adminOperationSchemas.deletionRequestParams, 'params'),
  twoFactorChallengeMiddleware('organization-delete'),
  logAdminMutation,
  validateSchema(adminOperationSchemas.deletionRequestRejectBody, 'body'),
  (req, res) => getOrgController().rejectDeletionRequest(req, res)
);

// ==================== LEGAL HOLDS ====================

/**
 * GET /api/v2/admin/legal-holds
 * List all legal holds with stats
 */
router.get('/legal-holds', (req, res) => getController().getLegalHolds(req, res));

/**
 * POST /api/v2/admin/legal-holds
 * Create a new legal hold on a user
 */
router.post(
  '/legal-holds',
  logAdminMutation,
  validateSchema(legalHoldSchemas.create, 'body'),
  (req, res) => getController().createLegalHold(req, res)
);

/**
 * POST /api/v2/admin/legal-holds/:id/release
 * Release an active legal hold
 */
router.post(
  '/legal-holds/:id/release',
  logAdminMutation,
  validateSchema(legalHoldSchemas.idParam, 'params'),
  validateSchema(legalHoldSchemas.release, 'body'),
  (req, res) => getController().releaseLegalHold(req, res)
);

export { router };
