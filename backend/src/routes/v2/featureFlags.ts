/**
 * Feature Flags Routes (API v2)
 *
 * Feature flag evaluation endpoints supporting:
 * - Feature flag evaluation (single and batch)
 * - Enabled flags for current user
 * - Analytics and metrics (admin only)
 *
 * Most routes require authentication
 */

import { Request, Response, Router } from 'express';

import { FeatureFlagController } from '../../controllers/FeatureFlagController';
import { requireAdmin } from '../../middleware/adminAuth';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { featureFlagSchemas, paramSchemas } from '../../schemas/featureFlagSchemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let featureFlagController: FeatureFlagController;
const getController = () => {
  if (!featureFlagController) {
    featureFlagController = new FeatureFlagController();
  }
  return featureFlagController;
};

// ==================== FEATURE FLAG EVALUATION ====================

/**
 * GET /api/v2/feature-flags/evaluate/:flagId
 * Evaluate a single feature flag for the authenticated user
 * Requires: authentication and valid flag ID
 */
router.get(
  '/evaluate/:flagId',
  authenticate,
  validateSchema(paramSchemas.flagId, 'params'),
  (req: Request, res: Response) => getController().evaluateFlag(req, res)
);

/**
 * POST /api/v2/feature-flags/evaluate-batch
 * Evaluate multiple feature flags at once
 * Request body: { flagIds: string[] }
 * Returns: map of flagId -> evaluation result
 * Requires: authentication
 */
router.post(
  '/evaluate-batch',
  authenticate,
  validateSchema(featureFlagSchemas.evaluateBatch, 'body'),
  (req: Request, res: Response) => getController().evaluateBatch(req, res)
);

/**
 * GET /api/v2/feature-flags/enabled
 * Get all enabled feature flags for the authenticated user
 * Returns: list of flag IDs that are enabled for user
 * Requires: authentication
 */
router.get('/enabled', authenticate, (req: Request, res: Response) =>
  getController().getEnabledFlags(req, res)
);

// ==================== ADMIN ANALYTICS ====================

/**
 * GET /api/v2/feature-flags/:id/analytics
 * Get analytics and usage metrics for a specific feature flag
 * Query parameters: dateRange, aggregation method, etc.
 * Requires: authentication and admin role
 */
router.get(
  '/:id/analytics',
  authenticate,
  requireAdmin,
  validateSchema(paramSchemas.featureFlagId, 'params'),
  validateSchema(featureFlagSchemas.analyticsQuery, 'query'),
  (req: Request, res: Response) => getController().getAnalytics(req, res)
);

export { router };
