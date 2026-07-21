import { Router } from 'express';

import { ModerationController } from '../../controllers/v2/moderationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { moderationSchemas } from '../../schemas/moderationSchemas';

const router = Router();

let moderationController: ModerationController;
const getController = () => {
  if (!moderationController) {
    moderationController = new ModerationController();
  }
  return moderationController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== INCIDENTS CRUD ====================

/**
 * GET /api/v2/moderation/incidents
 * Search / list moderation incidents (paginated, filtered)
 */
router.get(
  '/incidents',
  ...orgAuth,
  validateSchema(moderationSchemas.searchQuery, 'query'),
  (req, res) => getController().searchIncidents(req, res)
);

/**
 * POST /api/v2/moderation/incidents
 * Create a new moderation incident
 */
router.post(
  '/incidents',
  ...orgAuth,
  validateSchema(moderationSchemas.createIncident, 'body'),
  (req, res) => getController().createIncident(req, res)
);

/**
 * GET /api/v2/moderation/incidents/:incidentId
 * Get a specific incident
 */
router.get('/incidents/:incidentId', ...orgAuth, (req, res) =>
  getController().getIncident(req, res)
);

/**
 * PATCH /api/v2/moderation/incidents/:incidentId
 * Update an incident
 */
router.patch(
  '/incidents/:incidentId',
  ...orgAuth,
  validateSchema(moderationSchemas.updateIncident, 'body'),
  (req, res) => getController().updateIncident(req, res)
);

/**
 * POST /api/v2/moderation/incidents/:incidentId/revoke
 * Revoke an active incident
 */
router.post(
  '/incidents/:incidentId/revoke',
  ...orgAuth,
  validateSchema(moderationSchemas.revokeIncident, 'body'),
  (req, res) => getController().revokeIncident(req, res)
);

/**
 * POST /api/v2/moderation/incidents/:incidentId/share
 * Share an incident with allies
 */
router.post('/incidents/:incidentId/share', ...orgAuth, (req, res) =>
  getController().shareIncident(req, res)
);

/**
 * POST /api/v2/moderation/incidents/:incidentId/unshare
 * Remove incident from sharing
 */
router.post('/incidents/:incidentId/unshare', ...orgAuth, (req, res) =>
  getController().unshareIncident(req, res)
);

// ==================== LOOKUP ====================

/**
 * GET /api/v2/moderation/lookup/:discordId
 * Look up a user's moderation history
 * Query: includeShared (boolean, default true)
 */
router.get('/lookup/:discordId', ...orgAuth, (req, res) => getController().lookupUser(req, res));

// ==================== ANALYTICS ====================

/**
 * GET /api/v2/moderation/analytics
 * Get full moderation analytics dashboard data
 */
router.get('/analytics', ...orgAuth, (req, res) => getController().getAnalytics(req, res));

/**
 * GET /api/v2/moderation/repeat-offenders
 * Get repeat offender list
 */
router.get('/repeat-offenders', ...orgAuth, (req, res) =>
  getController().getRepeatOffenders(req, res)
);

/**
 * GET /api/v2/moderation/statistics
 * Get quick statistics summary
 */
router.get('/statistics', ...orgAuth, (req, res) => getController().getStatistics(req, res));

// ==================== SHARING CONFIG ====================

/**
 * GET /api/v2/moderation/sharing/config
 * Get sharing configuration
 */
router.get('/sharing/config', ...orgAuth, (req, res) => getController().getSharingConfig(req, res));

/**
 * PUT /api/v2/moderation/sharing/config
 * Update sharing configuration
 */
router.put(
  '/sharing/config',
  ...orgAuth,
  validateSchema(moderationSchemas.updateSharingConfig, 'body'),
  (req, res) => getController().updateSharingConfig(req, res)
);

export { router };
