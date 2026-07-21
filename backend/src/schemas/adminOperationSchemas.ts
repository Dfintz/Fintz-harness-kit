import Joi from 'joi';

/**
 * Validation schemas for admin routes missing request validation.
 * Applied to POST/PUT endpoints in backend/src/routes/v2/admin.ts
 */

export const adminOperationSchemas = {
  /**
   * POST /api/v2/admin/compliance/retention/execute
   */
  retentionExecuteBody: Joi.object({
    dryRun: Joi.boolean().default(false),
    categories: Joi.array().items(Joi.string().max(100)).optional(),
    olderThanDays: Joi.number().integer().min(1).max(3650).optional(),
  }).optional(),

  /**
   * POST /api/v2/admin/integrations/health/refresh
   */
  integrationRefreshBody: Joi.object({
    services: Joi.array().items(Joi.string().max(100)).optional(),
  }).optional(),

  /**
   * POST /api/v2/admin/users/:userId/actions
   */
  userActionBody: Joi.object({
    action: Joi.string()
      .valid('suspend', 'unsuspend', 'warn', 'ban', 'unban', 'reset-password', 'force-logout')
      .required(),
    reason: Joi.string().max(500).optional(),
    duration: Joi.number().integer().min(1).optional(),
  }),

  /**
   * POST /api/v2/admin/ship-data-fetcher/import-csv
   */
  shipDataImportBody: Joi.object({
    csvContent: Joi.string().max(10_000_000).required(),
    isVehicle: Joi.boolean().default(false),
  }),

  /**
   * POST /api/v2/admin/external-catalog-sync/preview
   * POST /api/v2/admin/external-catalog-sync/apply
   */
  externalCatalogSyncBody: Joi.object({
    sources: Joi.array().items(Joi.string().valid('scmdb', 'sc-craft')).min(1).max(2).optional(),
    sampleSize: Joi.number().integer().min(1).max(100).default(25),
  }).optional(),

  /**
   * Params for deletion request routes
   */
  deletionRequestParams: Joi.object({
    requestId: Joi.string().uuid().required(),
  }),

  /**
   * POST /api/v2/admin/organizations/deletion-requests/:requestId/approve
   */
  deletionRequestApproveBody: Joi.object({
    reason: Joi.string().max(500).optional(),
  }).optional(),

  /**
   * POST /api/v2/admin/organizations/deletion-requests/:requestId/reject
   */
  deletionRequestRejectBody: Joi.object({
    reason: Joi.string().max(500).required(),
  }),

  /**
   * POST /api/v2/admin/monitoring/anomalies/:id/acknowledge
   */
  anomalyAcknowledgeBody: Joi.object({
    notes: Joi.string().max(1000).optional(),
  }).optional(),

  /**
   * Params for anomaly acknowledge
   */
  anomalyParams: Joi.object({
    id: Joi.string().required(),
  }),

  /**
   * Params for job operations (trigger, enable, disable)
   */
  jobIdParams: Joi.object({
    jobId: Joi.string().max(100).required(),
  }),
};
