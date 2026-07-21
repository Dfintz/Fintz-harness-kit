import { Router } from 'express';

import { ReportController } from '../../controllers/v2/reportController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { reportSchemas } from '../../schemas/reportSchemas';

const router = Router();

let reportController: ReportController;
const getController = () => {
  if (!reportController) {
    reportController = new ReportController();
  }
  return reportController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== ADVANCED REPORTING ====================

/**
 * GET /api/v2/reports/templates
 * Get report templates (must be before /:reportId)
 */
router.get('/templates', ...orgAuth, (req, res) => getController().getTemplates(req, res));

/**
 * GET /api/v2/reports
 * Get all reports
 * Query: type, status
 */
router.get('/', ...orgAuth, validateSchema(reportSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);

/**
 * POST /api/v2/reports
 * Create report
 * Request body: report configuration
 */
router.post('/', ...orgAuth, validateSchema(reportSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/reports/:reportId
 * Get specific report
 */
router.get('/:reportId', ...orgAuth, validateSchema(reportSchemas.param, 'params'), (req, res) =>
  getController().getById(req, res)
);

/**
 * PUT /api/v2/reports/:reportId
 * Update report
 */
router.put(
  '/:reportId',
  ...orgAuth,
  validateSchema(reportSchemas.param, 'params'),
  validateSchema(reportSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

/**
 * DELETE /api/v2/reports/:reportId
 * Delete report
 */
router.delete('/:reportId', ...orgAuth, validateSchema(reportSchemas.param, 'params'), (req, res) =>
  getController().delete(req, res)
);

/**
 * POST /api/v2/reports/:reportId/generate
 * Generate report
 */
router.post(
  '/:reportId/generate',
  ...orgAuth,
  validateSchema(reportSchemas.param, 'params'),
  validateSchema(reportSchemas.generate, 'body'),
  (req, res) => getController().generate(req, res)
);

/**
 * GET /api/v2/reports/:reportId/download
 * Download report
 * Query: format (pdf, csv, xlsx)
 */
router.get(
  '/:reportId/download',
  ...orgAuth,
  validateSchema(reportSchemas.param, 'params'),
  validateSchema(reportSchemas.downloadQuery, 'query'),
  (req, res) => getController().download(req, res)
);

/**
 * POST /api/v2/reports/:reportId/schedule
 * Schedule report generation
 * Request body: { schedule: string, recipients: string[] }
 */
router.post(
  '/:reportId/schedule',
  ...orgAuth,
  validateSchema(reportSchemas.param, 'params'),
  validateSchema(reportSchemas.schedule, 'body'),
  (req, res) => getController().schedule(req, res)
);

export { router };
