import { Router } from 'express';

import { ExportController } from '../../controllers/v2/exportController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { exportSchemas } from '../../schemas/exportSchemas';

const router = Router();

let exportController: ExportController;
const getController = () => {
  if (!exportController) {
    exportController = new ExportController();
  }
  return exportController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== DATA EXPORT ====================

/**
 * POST /api/v2/export
 * Create export job (GDPR data export)
 */
router.post('/', ...orgAuth, validateSchema(exportSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/export/jobs
 * Get export job history (static route before parameterized)
 */
router.get('/jobs', ...orgAuth, validateSchema(exportSchemas.query, 'query'), (req, res) =>
  getController().listJobs(req, res)
);

/**
 * GET /api/v2/export/attendance-correlation
 * Export correlated attendance and StarComms metrics as JSON or CSV
 */
router.get(
  '/attendance-correlation',
  ...orgAuth,
  validateSchema(exportSchemas.attendanceCorrelation, 'query'),
  (req, res) => getController().exportAttendanceCorrelation(req, res)
);

/**
 * GET /api/v2/export/:jobId
 * Get export job status
 */
router.get('/:jobId', ...orgAuth, (req, res) => getController().getById(req, res));

/**
 * GET /api/v2/export/:jobId/download
 * Download export file
 */
router.get('/:jobId/download', ...orgAuth, (req, res) => getController().download(req, res));

/**
 * DELETE /api/v2/export/:jobId
 * Delete export job
 */
router.delete('/:jobId', ...orgAuth, (req, res) => getController().delete(req, res));

export { router };

