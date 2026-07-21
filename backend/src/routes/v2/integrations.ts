import { Router } from 'express';

import { IntegrationsV2Controller } from '../../controllers/v2/integrationsV2Controller';
import { StarCommsReadController } from '../../controllers/v2/starCommsReadController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { integrationsV2Schemas } from '../../schemas/integrationsV2Schemas';

const router = Router();
const integrationsController = new IntegrationsV2Controller();
const starCommsReadController = new StarCommsReadController();

router.use(authenticate);

// ==================== INTEGRATIONS ====================

/**
 * GET /api/v2/integrations
 * Get all integrations
 * Query: type, status
 */
router.get(
  '/',
  validateSchema(integrationsV2Schemas.listQuery, 'query'),
  integrationsController.listIntegrations
);

/**
 * POST /api/v2/integrations
 * Create integration
 * Request body: integration config
 */
router.post(
  '/',
  validateSchema(integrationsV2Schemas.createBody, 'body'),
  integrationsController.createIntegration
);

/**
 * GET /api/v2/integrations/available
 * Get available integration types
 */
router.get('/available', integrationsController.getAvailableIntegrationTypes);

/**
 * GET /api/v2/integrations/starcomms/:integrationId/status
 * Get StarComms integration status snapshot
 */
router.get(
  '/starcomms/:integrationId/status',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  starCommsReadController.getStatus
);

/**
 * GET /api/v2/integrations/starcomms/:integrationId/metrics
 * Get StarComms integration metrics window
 */
router.get(
  '/starcomms/:integrationId/metrics',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  validateSchema(integrationsV2Schemas.starCommsMetricsQuery, 'query'),
  starCommsReadController.getMetrics
);

/**
 * GET /api/v2/integrations/:integrationId
 * Get specific integration
 */
router.get(
  '/:integrationId',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  integrationsController.getIntegration
);

/**
 * PUT /api/v2/integrations/:integrationId
 * Update integration
 */
router.put(
  '/:integrationId',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  validateSchema(integrationsV2Schemas.updateBody, 'body'),
  integrationsController.updateIntegration
);

/**
 * DELETE /api/v2/integrations/:integrationId
 * Delete integration
 */
router.delete(
  '/:integrationId',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  integrationsController.deleteIntegration
);

/**
 * POST /api/v2/integrations/:integrationId/test
 * Test integration connection
 */
router.post(
  '/:integrationId/test',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  integrationsController.testConnection
);

/**
 * POST /api/v2/integrations/:integrationId/sync
 * Trigger integration sync
 */
router.post(
  '/:integrationId/sync',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  validateSchema(integrationsV2Schemas.syncBody, 'body'),
  integrationsController.syncIntegration
);

/**
 * GET /api/v2/integrations/:integrationId/logs
 * Get integration logs
 * Query: startDate, endDate
 */
router.get(
  '/:integrationId/logs',
  validateSchema(integrationsV2Schemas.integrationIdParam, 'params'),
  validateSchema(integrationsV2Schemas.logsQuery, 'query'),
  integrationsController.getLogs
);

export { router };
