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
exports.router = void 0;
const express_1 = require("express");
const complianceController_1 = require("../../controllers/complianceController");
const organizationController_1 = require("../../controllers/organizationController");
const adminController_1 = require("../../controllers/v2/adminController");
const integrationStatusController_1 = require("../../controllers/v2/integrationStatusController");
const adminAuth_1 = require("../../middleware/adminAuth");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const twoFactorChallenge_1 = require("../../middleware/twoFactorChallenge");
const schemas_1 = require("../../schemas");
const adminOperationSchemas_1 = require("../../schemas/adminOperationSchemas");
const featureFlagSchemas_1 = require("../../schemas/featureFlagSchemas");
const legalHoldSchemas_1 = require("../../schemas/legalHoldSchemas");
const deadLetterRoutes_1 = require("../admin/deadLetterRoutes");
const incidentRoutes_1 = require("../admin/incidentRoutes");
const adminShipRoutes_1 = require("../adminShipRoutes");
const router = (0, express_1.Router)();
exports.router = router;
let controller;
const getController = () => {
    if (!controller) {
        controller = new adminController_1.AdminControllerV2();
    }
    return controller;
};
let orgController;
const getOrgController = () => {
    if (!orgController) {
        orgController = new organizationController_1.OrganizationController();
    }
    return orgController;
};
let complianceController;
const getComplianceController = () => {
    if (!complianceController) {
        complianceController = new complianceController_1.ComplianceController();
    }
    return complianceController;
};
let integrationStatusController;
const getIntegrationStatusController = () => {
    if (!integrationStatusController) {
        integrationStatusController = new integrationStatusController_1.IntegrationStatusController();
    }
    return integrationStatusController;
};
router.use(auth_1.authenticate);
router.use(adminAuth_1.requireAdmin);
router.use(rateLimiting_1.adminRateLimiter);
router.use('/incidents', incidentRoutes_1.router);
router.use('/role-sync', deadLetterRoutes_1.router);
router.get('/compliance/licenses', (0, schemaValidation_1.validateSchema)(schemas_1.complianceSchemas.licenseExport, 'query'), (req, res) => getComplianceController().exportLicenses(req, res));
router.get('/compliance/retention/config', (req, res) => getComplianceController().getRetentionConfig(req, res));
router.post('/compliance/retention/execute', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.retentionExecuteBody, 'body'), (req, res) => getComplianceController().executeRetention(req, res));
router.get('/integrations/health', (req, res) => getIntegrationStatusController().getSystemHealth(req, res));
router.get('/integrations/health/:name', (0, schemaValidation_1.validateSchema)(schemas_1.integrationSchemas.integrationName, 'params'), (req, res) => getIntegrationStatusController().getIntegrationHealth(req, res));
router.post('/integrations/health/refresh', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.integrationRefreshBody, 'body'), (req, res) => getIntegrationStatusController().refreshHealth(req, res));
(0, adminShipRoutes_1.setupAdminShipRoutes)(router);
router.get('/dashboard', (req, res) => getController().getDashboard(req, res));
router.get('/metrics/system', (req, res) => getController().getSystemMetrics(req, res));
router.get('/metrics/user-actions', (req, res) => getController().getUserActionMetrics(req, res));
router.get('/metrics/timeseries', (req, res) => getController().getTimeSeriesMetrics(req, res));
router.get('/moderation/analytics', (req, res) => getController().getModerationAnalytics(req, res));
router.get('/security/logs', (req, res) => getController().getSecurityLogs(req, res));
router.get('/security/summary', (req, res) => getController().getSecuritySummary(req, res));
router.post('/security/search', (0, schemaValidation_1.validateSchema)(schemas_1.adminSearchSchemas.securitySearch, 'body'), (req, res) => getController().searchSecurityEvents(req, res));
router.get('/feature-flags', (req, res) => getController().getFeatureFlags(req, res));
router.get('/feature-flags/:id', (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.paramSchemas.featureFlagId, 'params'), (req, res) => getController().getFeatureFlag(req, res));
router.post('/feature-flags', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.featureFlagSchemas.create, 'body'), (req, res) => getController().createFeatureFlag(req, res));
router.put('/feature-flags/:id', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.paramSchemas.featureFlagId, 'params'), (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.featureFlagSchemas.update, 'body'), (req, res) => getController().updateFeatureFlag(req, res));
router.patch('/feature-flags/:id', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.paramSchemas.featureFlagId, 'params'), (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.featureFlagSchemas.update, 'body'), (req, res) => getController().updateFeatureFlag(req, res));
router.delete('/feature-flags/:id', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.paramSchemas.featureFlagId, 'params'), (req, res) => getController().deleteFeatureFlag(req, res));
router.post('/users/search', (0, schemaValidation_1.validateSchema)(schemas_1.adminSearchSchemas.userSearch, 'body'), (req, res) => getController().searchUsers(req, res));
router.post('/users/:userId/actions', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.userActionBody, 'body'), (req, res) => getController().performUserAction(req, res));
router.get('/ship-data-fetcher/status', (req, res) => getController().getShipDataFetcherStatus(req, res));
router.get('/ship-sync-status', (req, res) => getController().getShipDataFetcherStatus(req, res));
router.post('/ship-data-fetcher/refresh', adminAuth_1.logAdminMutation, (req, res) => getController().refreshShipData(req, res));
router.post('/ship-data-fetcher/import-csv', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.shipDataImportBody, 'body'), async (req, res) => {
    try {
        const { csvContent, isVehicle = false } = req.body;
        if (!csvContent || typeof csvContent !== 'string') {
            res.status(400).json({ error: 'csvContent is required (string)' });
            return;
        }
        const { ShipDataFetcher } = await Promise.resolve().then(() => __importStar(require('../../jobs/shipDataFetcher')));
        const result = await ShipDataFetcher.importFromCsvContent(csvContent, isVehicle);
        res.status(200).json({
            message: 'CSV import completed',
            processed: result.processed,
            total: result.total,
            errors: result.errors.slice(0, 20),
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: `Failed to import CSV: ${msg}` });
    }
});
router.post('/external-catalog-sync/preview', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.externalCatalogSyncBody, 'body'), (req, res) => getController().previewExternalCatalogSync(req, res));
router.post('/external-catalog-sync/apply', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.externalCatalogSyncBody, 'body'), (req, res) => getController().applyExternalCatalogSync(req, res));
router.get('/monitoring/performance', (req, res) => getController().getPerformanceReport(req, res));
router.get('/monitoring/performance/history', (req, res) => getController().getPerformanceHistory(req, res));
router.get('/monitoring/queries', (req, res) => getController().getQueryAnalysis(req, res));
router.get('/monitoring/queries/tables', (req, res) => getController().getTableStats(req, res));
router.get('/monitoring/tracing/stats', (req, res) => getController().getTracingStats(req, res));
router.get('/monitoring/tracing/:traceId', (req, res) => getController().getTrace(req, res));
router.get('/monitoring/anomalies', (req, res) => getController().getAnomalies(req, res));
router.post('/monitoring/anomalies/:id/acknowledge', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.anomalyAcknowledgeBody, 'body'), (req, res) => getController().acknowledgeAnomaly(req, res));
router.get('/monitoring/scaling', (req, res) => getController().getScalingStatus(req, res));
router.get('/operations/overview', (req, res) => getController().getOperationsOverview(req, res));
router.post('/operations/jobs/:jobId/trigger', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.jobIdParams, 'params'), (req, res) => getController().triggerJob(req, res));
router.post('/operations/jobs/:jobId/enable', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.jobIdParams, 'params'), (req, res) => getController().enableJob(req, res));
router.post('/operations/jobs/:jobId/disable', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.jobIdParams, 'params'), (req, res) => getController().disableJob(req, res));
router.get('/organizations/deletion-requests/pending', (req, res) => getOrgController().getPendingDeletionRequests(req, res));
router.get('/organizations/deletion-requests/:requestId', (req, res) => getOrgController().getDeletionRequest(req, res));
router.post('/organizations/deletion-requests/:requestId/approve', (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.deletionRequestParams, 'params'), (0, twoFactorChallenge_1.twoFactorChallengeMiddleware)('organization-delete'), adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.deletionRequestApproveBody, 'body'), (req, res) => getOrgController().approveDeletionRequest(req, res));
router.post('/organizations/deletion-requests/:requestId/reject', (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.deletionRequestParams, 'params'), (0, twoFactorChallenge_1.twoFactorChallengeMiddleware)('organization-delete'), adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminOperationSchemas_1.adminOperationSchemas.deletionRequestRejectBody, 'body'), (req, res) => getOrgController().rejectDeletionRequest(req, res));
router.get('/legal-holds', (req, res) => getController().getLegalHolds(req, res));
router.post('/legal-holds', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(legalHoldSchemas_1.legalHoldSchemas.create, 'body'), (req, res) => getController().createLegalHold(req, res));
router.post('/legal-holds/:id/release', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(legalHoldSchemas_1.legalHoldSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(legalHoldSchemas_1.legalHoldSchemas.release, 'body'), (req, res) => getController().releaseLegalHold(req, res));
//# sourceMappingURL=admin.js.map