import { Router } from 'express';

import { ConfigController } from '../../controllers/v2/configController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { configSchemas } from '../../schemas/configSchemas';

const router = Router();

let configController: ConfigController;
const getController = () => {
  if (!configController) {
    configController = new ConfigController();
  }
  return configController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== CONFIGURATION MANAGEMENT ====================

/**
 * GET /api/v2/config/export
 * Export configuration (must be before /:key)
 * Query: scope, format
 */
router.get('/export', ...orgAuth, validateSchema(configSchemas.exportQuery, 'query'), (req, res) =>
  getController().exportConfig(req, res)
);

/**
 * GET /api/v2/config/schema
 * Get configuration schema (must be before /:key)
 */
router.get('/schema', ...orgAuth, (req, res) => getController().getSchema(req, res));

/**
 * GET /api/v2/config
 * Get all configuration settings
 * Query: scope (global, org, user)
 */
router.get('/', ...orgAuth, validateSchema(configSchemas.query, 'query'), (req, res) =>
  getController().getAll(req, res)
);

/**
 * PUT /api/v2/config
 * Update configuration settings
 * Request body: configuration key-value pairs
 */
router.put('/', ...orgAuth, validateSchema(configSchemas.updateAll, 'body'), (req, res) =>
  getController().updateAll(req, res)
);

/**
 * POST /api/v2/config/import
 * Import configuration
 * Request body: configuration data
 */
router.post('/import', ...orgAuth, validateSchema(configSchemas.importConfig, 'body'), (req, res) =>
  getController().importConfig(req, res)
);

/**
 * GET /api/v2/config/:key
 * Get specific configuration value
 */
router.get('/:key', ...orgAuth, validateSchema(configSchemas.param, 'params'), (req, res) =>
  getController().getByKey(req, res)
);

/**
 * PUT /api/v2/config/:key
 * Update specific configuration value
 */
router.put(
  '/:key',
  ...orgAuth,
  validateSchema(configSchemas.param, 'params'),
  validateSchema(configSchemas.updateKey, 'body'),
  (req, res) => getController().updateByKey(req, res)
);

/**
 * DELETE /api/v2/config/:key
 * Reset configuration to default
 */
router.delete('/:key', ...orgAuth, validateSchema(configSchemas.param, 'params'), (req, res) =>
  getController().deleteByKey(req, res)
);

export { router };
