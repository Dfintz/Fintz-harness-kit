import { Router } from 'express';

import { DashboardController } from '../../controllers/v2/dashboardController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { dashboardSchemas } from '../../schemas/dashboardSchemas';

const router = Router();

// ==================== DASHBOARDS ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

let controller: DashboardController;
function getController(): DashboardController {
  if (!controller) {
    controller = new DashboardController();
  }
  return controller;
}

// Collection routes
router.get('/', ...orgAuth, validateSchema(dashboardSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);
router.post('/', ...orgAuth, validateSchema(dashboardSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

// Parameterized routes
router.get(
  '/:dashboardId',
  ...orgAuth,
  validateSchema(dashboardSchemas.param, 'params'),
  (req, res) => getController().getById(req, res)
);
router.put(
  '/:dashboardId',
  ...orgAuth,
  validateSchema(dashboardSchemas.param, 'params'),
  validateSchema(dashboardSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);
router.delete(
  '/:dashboardId',
  ...orgAuth,
  validateSchema(dashboardSchemas.param, 'params'),
  (req, res) => getController().delete(req, res)
);

// Widget routes (nested under dashboard)
router.post(
  '/:dashboardId/widgets',
  ...orgAuth,
  validateSchema(dashboardSchemas.param, 'params'),
  validateSchema(dashboardSchemas.addWidget, 'body'),
  (req, res) => getController().addWidget(req, res)
);
router.put(
  '/:dashboardId/widgets/:widgetId',
  ...orgAuth,
  validateSchema(dashboardSchemas.widgetParam, 'params'),
  validateSchema(dashboardSchemas.updateWidget, 'body'),
  (req, res) => getController().updateWidget(req, res)
);
router.delete(
  '/:dashboardId/widgets/:widgetId',
  ...orgAuth,
  validateSchema(dashboardSchemas.widgetParam, 'params'),
  (req, res) => getController().deleteWidget(req, res)
);

// Share route
router.post(
  '/:dashboardId/share',
  ...orgAuth,
  validateSchema(dashboardSchemas.param, 'params'),
  validateSchema(dashboardSchemas.share, 'body'),
  (req, res) => getController().share(req, res)
);

export { router };
