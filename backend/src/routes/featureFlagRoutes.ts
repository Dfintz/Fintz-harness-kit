/**
 * Feature Flag Routes
 * Public API endpoints for client-side feature flag evaluation
 */

import { Router } from 'express';

import { FeatureFlagController } from '../controllers/FeatureFlagController';
import { requireAdmin } from '../middleware/adminAuth';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { featureFlagSchemas, paramSchemas } from '../schemas/featureFlagSchemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let featureFlagController: FeatureFlagController;
const getController = () => {
    if (!featureFlagController) {
        featureFlagController = new FeatureFlagController();
    }
    return featureFlagController;
};

// ==================== PUBLIC AUTHENTICATED ROUTES ====================

/**
 * GET /api/feature-flags/evaluate/:flagId
 * Evaluate a single feature flag
 */
router.get(
    '/evaluate/:flagId',
    authenticate,
    validateSchema(paramSchemas.flagId, 'params'),
    (req, res) => getController().evaluateFlag(req, res)
);

/**
 * POST /api/feature-flags/evaluate-batch
 * Evaluate multiple feature flags at once
 */
router.post(
    '/evaluate-batch',
    authenticate,
    validateSchema(featureFlagSchemas.evaluateBatch, 'body'),
    (req, res) => getController().evaluateBatch(req, res)
);

/**
 * GET /api/feature-flags/enabled
 * Get all enabled feature flags for current user
 */
router.get('/enabled', authenticate, (req, res) => 
    getController().getEnabledFlags(req, res)
);

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/feature-flags/:id/analytics
 * Get analytics for a specific feature flag (admin only)
 */
router.get(
    '/:id/analytics',
    authenticate,
    requireAdmin,
    validateSchema(paramSchemas.featureFlagId, 'params'),
    validateSchema(featureFlagSchemas.analyticsQuery, 'query'),
    (req, res) => getController().getAnalytics(req, res)
);

export { router };
