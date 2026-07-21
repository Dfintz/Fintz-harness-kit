import { Router } from 'express';

import { WebhookController } from '../controllers/webhookController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { webhookSchemas } from '../schemas/webhookSchemas';

// Lazy initialization to avoid EntityMetadataNotFoundError
let webhookController: WebhookController;
const getController = () => {
  if (!webhookController) {
    webhookController = new WebhookController();
  }
  return webhookController;
};

const router = Router();

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the app root
// via `app.use(router)`, so a router-level `router.use(authenticateToken)` would run on
// every request that falls through to it (the broadest possible leak). Spreading
// `authStack` onto each route keeps enforcement scoped to this router's own `/webhooks*`
// paths.
const authStack = [authenticateToken] as const;

/**
 * Set up webhook routes
 * All routes require authentication and appropriate permissions
 */
export function setWebhookRoutes(app: Router) {
  // ========================================
  // WEBHOOK MANAGEMENT
  // ========================================

  /**
   * Get available event types
   * GET /api/webhooks/event-types
   */
  router.get('/webhooks/event-types', ...authStack, (req, res) =>
    getController().getEventTypes(req, res)
  );

  /**
   * Get webhook statistics for the organization
   * GET /api/webhooks/statistics
   */
  router.get('/webhooks/statistics', ...authStack, (req, res) =>
    getController().getStatistics(req, res)
  );

  // ========================================
  // BATCH MANAGEMENT
  // ========================================

  /**
   * Get batch configuration
   * GET /api/webhooks/batch/config
   */
  router.get('/webhooks/batch/config', ...authStack, (req, res) =>
    getController().getBatchConfig(req, res)
  );

  /**
   * Configure batch settings
   * PUT /api/webhooks/batch/config
   */
  router.put(
    '/webhooks/batch/config',
    ...authStack,
    validateSchema(webhookSchemas.batchConfig, 'body'),
    (req, res) => getController().configureBatch(req, res)
  );

  /**
   * Queue an event for batch delivery
   * POST /api/webhooks/batch/queue
   */
  router.post(
    '/webhooks/batch/queue',
    ...authStack,
    validateSchema(webhookSchemas.triggerEvent, 'body'),
    (req, res) => getController().queueEventForBatch(req, res)
  );

  /**
   * Get pending batches
   * GET /api/webhooks/batch/pending
   */
  router.get('/webhooks/batch/pending', ...authStack, (req, res) =>
    getController().getPendingBatches(req, res)
  );

  /**
   * Flush pending batches
   * POST /api/webhooks/batch/flush
   */
  router.post(
    '/webhooks/batch/flush',
    ...authStack,
    validateSchema(webhookSchemas.batchFlush, 'body'),
    (req, res) => getController().flushBatches(req, res)
  );

  /**
   * Cancel pending batches
   * DELETE /api/webhooks/batch/pending
   */
  router.delete('/webhooks/batch/pending', ...authStack, (req, res) =>
    getController().cancelPendingBatches(req, res)
  );

  // ========================================
  // WEBHOOK CRUD
  // ========================================

  /**
   * Validate webhook configuration before creating
   * POST /api/webhooks/validate
   */
  router.post(
    '/webhooks/validate',
    ...authStack,
    validateSchema(webhookSchemas.create, 'body'),
    (req, res) => getController().validateWebhook(req, res)
  );

  /**
   * Trigger a test event
   * POST /api/webhooks/trigger-event
   */
  router.post(
    '/webhooks/trigger-event',
    ...authStack,
    validateSchema(webhookSchemas.triggerEvent, 'body'),
    (req, res) => getController().triggerEvent(req, res)
  );

  /**
   * Create a new webhook
   * POST /api/webhooks
   */
  router.post(
    '/webhooks',
    ...authStack,
    validateSchema(webhookSchemas.create, 'body'),
    (req, res) => getController().createWebhook(req, res)
  );

  /**
   * Get all webhooks for the organization
   * GET /api/webhooks
   */
  router.get('/webhooks', ...authStack, (req, res) => getController().getWebhooks(req, res));

  /**
   * Get a specific webhook
   * GET /api/webhooks/:id
   */
  router.get(
    '/webhooks/:id',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    (req, res) => getController().getWebhook(req, res)
  );

  /**
   * Update a webhook
   * PATCH /api/webhooks/:id
   */
  router.patch(
    '/webhooks/:id',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    validateSchema(webhookSchemas.update, 'body'),
    (req, res) => getController().updateWebhook(req, res)
  );

  /**
   * Delete a webhook
   * DELETE /api/webhooks/:id
   */
  router.delete(
    '/webhooks/:id',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    (req, res) => getController().deleteWebhook(req, res)
  );

  /**
   * Test a webhook (basic test)
   * POST /api/webhooks/:id/test
   */
  router.post(
    '/webhooks/:id/test',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    (req, res) => getController().testWebhook(req, res)
  );

  /**
   * Test a webhook with custom payload
   * POST /api/webhooks/:id/test-custom
   */
  router.post(
    '/webhooks/:id/test-custom',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    validateSchema(webhookSchemas.testCustom, 'body'),
    (req, res) => getController().testWebhookCustom(req, res)
  );

  /**
   * Get test payload preview
   * POST /api/webhooks/:id/preview
   */
  router.post(
    '/webhooks/:id/preview',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    validateSchema(webhookSchemas.payloadPreview, 'body'),
    (req, res) => getController().getPayloadPreview(req, res)
  );

  /**
   * Get webhook delivery history
   * GET /api/webhooks/:id/deliveries
   */
  router.get(
    '/webhooks/:id/deliveries',
    ...authStack,
    validateSchema(webhookSchemas.param, 'params'),
    validateSchema(webhookSchemas.deliveryQuery, 'query'),
    (req, res) => getController().getDeliveryHistory(req, res)
  );

  // Register routes with app
  app.use(router);
}
