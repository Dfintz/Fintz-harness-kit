/**
 * Webhooks Routes (API v2)
 *
 * Webhook management endpoints supporting:
 * - Webhook CRUD operations
 * - Event type discovery
 * - Batch configuration
 * - Webhook testing and statistics
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { WebhookController } from '../../controllers/webhookController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { webhookSchemas } from '../../schemas/webhookSchemas';

const router = Router();

// Auth + tenant context chain: authenticate, resolve current org, require org context
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// Lazy initialization to avoid EntityMetadataNotFoundError
let webhookController: WebhookController;
const getController = () => {
  if (!webhookController) {
    webhookController = new WebhookController();
  }
  return webhookController;
};

// ==================== WEBHOOK DISCOVERY ====================

/**
 * GET /api/v2/webhooks/event-types
 * Get available event types for webhooks
 * Returns: list of subscribable event types
 */
router.get('/event-types', ...orgAuth, (req: Request, res: Response) =>
  getController().getEventTypes(req, res)
);

/**
 * GET /api/v2/webhooks/statistics
 * Get webhook statistics for the organization
 * Returns: delivery counts, success rates, etc.
 */
router.get('/statistics', ...orgAuth, (req: Request, res: Response) =>
  getController().getStatistics(req, res)
);

// ==================== BATCH CONFIGURATION ====================

/**
 * GET /api/v2/webhooks/batch/config
 * Get batch webhook configuration
 * Returns: current batch settings and limits
 */
router.get('/batch/config', ...orgAuth, (req: Request, res: Response) =>
  getController().getBatchConfig(req, res)
);

// ==================== WEBHOOK MANAGEMENT ====================

/**
 * GET /api/v2/webhooks
 * List all webhooks for the user's organization
 */
router.get('/', ...orgAuth, (req: Request, res: Response) => getController().getWebhooks(req, res));

/**
 * GET /api/v2/webhooks/:id
 * Get a specific webhook by ID
 */
router.get('/:id', ...orgAuth, (req: Request, res: Response) =>
  getController().getWebhook(req, res)
);

/**
 * POST /api/v2/webhooks
 * Create a new webhook
 */
router.post('/', ...orgAuth, validateSchema(webhookSchemas.create), (req: Request, res: Response) =>
  getController().createWebhook(req, res)
);

/**
 * PUT /api/v2/webhooks/:id
 * Update a webhook
 */
router.put(
  '/:id',
  ...orgAuth,
  validateSchema(webhookSchemas.update),
  (req: Request, res: Response) => getController().updateWebhook(req, res)
);

/**
 * DELETE /api/v2/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', ...orgAuth, (req: Request, res: Response) =>
  getController().deleteWebhook(req, res)
);

/**
 * POST /api/v2/webhooks/test/:id
 * Test a webhook by sending a test event
 * Requires: valid UUID for webhook ID
 */
router.post('/test/:id', ...orgAuth, (req: Request, res: Response) =>
  getController().testWebhook(req, res)
);

export { router };
