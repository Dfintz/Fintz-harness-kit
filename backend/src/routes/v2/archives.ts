import { Router } from 'express';

import { ArchiveController } from '../../controllers/v2/archiveController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { archiveSchemas } from '../../schemas/archiveSchemas';

const router = Router();

// ==================== ARCHIVES & HISTORICAL DATA ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

let controller: ArchiveController;
function getController(): ArchiveController {
  if (!controller) {
    controller = new ArchiveController();
  }
  return controller;
}

// Static routes BEFORE parameterized routes
router.get('/statistics', ...orgAuth, (req, res) => getController().getStatistics(req, res));
router.post('/bulk', ...orgAuth, validateSchema(archiveSchemas.bulk, 'body'), (req, res) =>
  getController().bulkArchive(req, res)
);
router.get('/search', ...orgAuth, validateSchema(archiveSchemas.search, 'query'), (req, res) =>
  getController().search(req, res)
);

// Collection routes
router.get('/', ...orgAuth, validateSchema(archiveSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);
router.post('/', ...orgAuth, validateSchema(archiveSchemas.create, 'body'), (req, res) =>
  getController().archive(req, res)
);

// Parameterized routes
router.get('/:archiveId', ...orgAuth, validateSchema(archiveSchemas.param, 'params'), (req, res) =>
  getController().getById(req, res)
);
router.post(
  '/:archiveId/restore',
  ...orgAuth,
  validateSchema(archiveSchemas.param, 'params'),
  (req, res) => getController().restore(req, res)
);
router.delete(
  '/:archiveId',
  ...orgAuth,
  validateSchema(archiveSchemas.param, 'params'),
  (req, res) => getController().delete(req, res)
);

export { router };
