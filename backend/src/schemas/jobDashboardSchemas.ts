import Joi from 'joi';

/**
 * Joi validation schemas for Job Dashboard endpoints
 * Promotes jobs domain from Alpha → Production
 */
export const jobDashboardSchemas = {
  /**
   * GET /api/v2/admin/jobs/dashboard
   * Returns the full dashboard overview
   */
  getDashboardOverview: {
    // No body/params required; query may include optional filters
    query: Joi.object({
      includeDisabled: Joi.boolean().default(false),
    }).options({ allowUnknown: false }),
  },

  /**
   * GET /api/v2/admin/jobs/:jobId/status
   * Returns detailed status for a single job
   */
  getJobStatus: {
    params: Joi.object({
      jobId: Joi.string().trim().required(),
    }),
  },

  /**
   * GET /api/v2/admin/jobs/statuses
   * Returns statuses for all registered jobs
   */
  getAllJobStatuses: {
    query: Joi.object({
      category: Joi.string()
        .valid(
          'cleanup',
          'sync',
          'notification',
          'analytics',
          'maintenance',
          'security',
          'integration',
          'other'
        )
        .optional(),
    }).options({ allowUnknown: false }),
  },

  /**
   * GET /api/v2/admin/jobs/:jobId/history
   * Returns execution history for a specific job
   */
  getJobExecutionHistory: {
    params: Joi.object({
      jobId: Joi.string().trim().required(),
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(200).default(50),
    }).options({ allowUnknown: false }),
  },

  /**
   * GET /api/v2/admin/jobs/recent-executions
   * Returns recent executions across all jobs
   */
  getRecentExecutions: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(20),
    }).options({ allowUnknown: false }),
  },

  /**
   * GET /api/v2/admin/jobs/alerts
   * Returns all active alerts
   */
  getActiveAlerts: {
    // No parameters required
  },

  /**
   * GET /api/v2/admin/jobs/:jobId/alerts
   * Returns alerts for a specific job
   */
  getJobAlerts: {
    params: Joi.object({
      jobId: Joi.string().trim().required(),
    }),
  },

  /**
   * POST /api/v2/admin/jobs/alerts/:alertId/acknowledge
   * Acknowledges an alert
   */
  acknowledgeAlert: {
    params: Joi.object({
      alertId: Joi.string().trim().required(),
    }),
    body: Joi.object({
      acknowledgedBy: Joi.string().trim().max(100).optional(),
    }).options({ allowUnknown: false }),
  },

  /**
   * POST /api/v2/admin/jobs/alerts/:alertId/resolve
   * Resolves an alert
   */
  resolveAlert: {
    params: Joi.object({
      alertId: Joi.string().trim().required(),
    }),
  },

  /**
   * GET /api/v2/admin/jobs/:jobId/trends
   * Returns performance trends for a specific job
   */
  getJobPerformanceTrends: {
    params: Joi.object({
      jobId: Joi.string().trim().required(),
    }),
    query: Joi.object({
      periodMinutes: Joi.number().integer().min(1).max(1440).default(60),
    }).options({ allowUnknown: false }),
  },
};
