import { Router } from 'express';

import { ImportController } from '../../controllers/v2/importController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { importSchemas } from '../../schemas/importSchemas';

const router = Router();

let importController: ImportController;
const getController = () => {
  if (!importController) {
    importController = new ImportController();
  }
  return importController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];
const authOnly = [authenticate];

// ==================== DATA IMPORT ====================

/**
 * POST /api/v2/import
 * Import data (SCStats JSON write path)
 */
router.post('/', ...orgAuth, validateSchema(importSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * POST /api/v2/import/validate
 * Validate import data without importing:
 * - source=scstats_json
 * - source=scstats_csv (guidance only)
 * - source=generic_csv (header/preview validation)
 */
router.post('/validate', ...authOnly, validateSchema(importSchemas.validate, 'body'), (req, res) =>
  getController().validate(req, res)
);

/**
 * GET /api/v2/import/jobs
 * Get import job history (static route before parameterized)
 */
router.get('/jobs', ...orgAuth, validateSchema(importSchemas.query, 'query'), (req, res) =>
  getController().listJobs(req, res)
);

/**
 * GET /api/v2/import/:jobId
 * Get import job status
 */
router.get('/:jobId', ...orgAuth, (req, res) => getController().getById(req, res));

/**
 * POST /api/v2/import/:jobId/cancel
 * Cancel import job (deletes imported data)
 */
router.post('/:jobId/cancel', ...orgAuth, (req, res) => getController().cancel(req, res));

export { router };
