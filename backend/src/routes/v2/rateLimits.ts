import { Router } from 'express';

import { RateLimitController } from '../../controllers/v2/rateLimitController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { rateLimitSchemas } from '../../schemas/rateLimitSchemas';

const router = Router();

let rateLimitController: RateLimitController;
const getController = () => {
  if (!rateLimitController) {
    rateLimitController = new RateLimitController();
  }
  return rateLimitController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== RATE LIMITING CONFIGURATION ====================

/**
 * GET /api/v2/rate-limits/config
 * Get current rate limit configuration
 */
router.get('/config', ...orgAuth, (req, res) => getController().getConfig(req, res));

/**
 * PUT /api/v2/rate-limits/config
 * Update rate limit configuration
 */
router.put(
  '/config',
  ...orgAuth,
  validateSchema(rateLimitSchemas.updateConfig, 'body'),
  (req, res) => getController().updateConfig(req, res)
);

/**
 * GET /api/v2/rate-limits/usage
 * Get user's rate limit usage
 */
router.get('/usage', ...orgAuth, (req, res) => getController().getUsage(req, res));

/**
 * POST /api/v2/rate-limits/reset
 * Reset rate limit for user (admin only)
 */
router.post('/reset', ...orgAuth, validateSchema(rateLimitSchemas.reset, 'body'), (req, res) =>
  getController().reset(req, res)
);

export { router };
