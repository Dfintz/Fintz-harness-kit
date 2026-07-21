import { Router } from 'express';

import { AchievementController } from '../../controllers/v2/achievementController';
import { authenticate } from '../../middleware/auth';
import { validateUUID } from '../../middleware/relationshipValidation';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { OrganizationSettings } from '../../models/Organization';
import { achievementSchemas } from '../../schemas/achievementSchemas';
import { OrganizationSettingsService } from '../../services/organization/OrganizationSettingsService';
import { logger } from '../../utils/logger';

const router = Router();

let achievementController: AchievementController;
const getController = () => {
  if (!achievementController) {
    achievementController = new AchievementController();
  }
  return achievementController;
};

const settingsService = new OrganizationSettingsService();
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/achievements/user/:userId
 * Public endpoint: Get all displayed badges for a user (no org context needed)
 * Must be defined BEFORE the org-gated middleware below.
 */
router.get('/user/:userId', authenticate, validateUUID('userId'), (req, res) =>
  getController().getPublicUserItems(req, res)
);

// Gate all remaining title/badge routes behind the per-org enableTitlesBadges setting
router.use(...orgAuth, async (req, res, next) => {
  try {
    const organizationId = req.tenantContext?.organizationId;
    if (!organizationId) {
      res
        .status(400)
        .json({ error: { code: 'MISSING_ORG', message: 'Organization context required' } });
      return;
    }
    const settings: OrganizationSettings | null =
      await settingsService.getEffectiveSettings(organizationId);
    if (!settings?.enableTitlesBadges) {
      res.status(404).json({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'Titles & Badges are not enabled for this organization',
        },
      });
      return;
    }
    next();
  } catch (err) {
    logger.error('Failed to check titles & badges setting', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify feature availability' },
    });
  }
});

// ==================== CUSTOM TITLES & BADGES ====================

/**
 * GET /api/v2/achievements/user/:userId/org
 * Get user titles & badges for a specific org (org-gated)
 */
router.get('/user/:userId/org', (req, res) => getController().getUserItems(req, res));

/**
 * GET /api/v2/achievements
 * Get all titles & badges
 * Query: category, rarity, type, page, limit
 */
router.get('/', validateSchema(achievementSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);

/**
 * POST /api/v2/achievements
 * Create title or badge
 */
router.post('/', validateSchema(achievementSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/achievements/:achievementId
 * Get specific title or badge
 */
router.get('/:achievementId', validateSchema(achievementSchemas.param, 'params'), (req, res) =>
  getController().getById(req, res)
);

/**
 * PUT /api/v2/achievements/:achievementId
 * Update title or badge
 */
router.put(
  '/:achievementId',
  validateSchema(achievementSchemas.param, 'params'),
  validateSchema(achievementSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

/**
 * DELETE /api/v2/achievements/:achievementId
 * Delete title or badge
 */
router.delete('/:achievementId', validateSchema(achievementSchemas.param, 'params'), (req, res) =>
  getController().delete(req, res)
);

/**
 * POST /api/v2/achievements/:achievementId/award
 * Award title or badge to user
 */
router.post(
  '/:achievementId/award',
  validateSchema(achievementSchemas.param, 'params'),
  validateSchema(achievementSchemas.award, 'body'),
  (req, res) => getController().award(req, res)
);

/**
 * GET /api/v2/achievements/:achievementId/recipients
 * List all users who have been awarded this title or badge
 */
router.get(
  '/:achievementId/recipients',
  validateSchema(achievementSchemas.param, 'params'),
  (req, res) => getController().getRecipients(req, res)
);

/**
 * POST /api/v2/achievements/:achievementId/revoke
 * Revoke title or badge from user
 */
router.post(
  '/:achievementId/revoke',
  validateSchema(achievementSchemas.param, 'params'),
  validateSchema(achievementSchemas.revoke, 'body'),
  (req, res) => getController().revoke(req, res)
);

/**
 * PATCH /api/v2/achievements/display/:userAchievementId
 * Toggle display visibility for a user's title/badge
 */
router.patch(
  '/display/:userAchievementId',
  validateSchema(achievementSchemas.displayParam, 'params'),
  validateSchema(achievementSchemas.toggleDisplay, 'body'),
  (req, res) => getController().toggleDisplay(req, res)
);

export { router };
