import { Router } from 'express';

import { JumpPointController } from '../../controllers/v2/jumpPointController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { jumpPointSchemas } from '../../schemas/jumpPointSchemas';

const router = Router();

let jumpPointController: JumpPointController;
const getController = () => {
  if (!jumpPointController) {
    jumpPointController = new JumpPointController();
  }
  return jumpPointController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== JUMP POINTS (Discord Channel Bridging) ====================
// Based on tunnels.gg — connects Discord channels between different orgs/servers

/**
 * GET /api/v2/jumppoints
 * List jump points
 */
router.get('/', ...orgAuth, validateSchema(jumpPointSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);

/**
 * POST /api/v2/jumppoints
 * Create new jump point
 */
router.post('/', ...orgAuth, validateSchema(jumpPointSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/jumppoints/:jumpPointId
 * Get jump point details
 */
router.get('/:jumpPointId', ...orgAuth, (req, res) => getController().getById(req, res));

/**
 * PUT /api/v2/jumppoints/:jumpPointId
 * Update jump point configuration
 */
router.put(
  '/:jumpPointId',
  ...orgAuth,
  validateSchema(jumpPointSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

/**
 * DELETE /api/v2/jumppoints/:jumpPointId
 * Delete jump point
 */
router.delete(
  '/:jumpPointId',
  ...orgAuth,
  validateSchema(jumpPointSchemas.delete, 'body'),
  (req, res) => getController().delete(req, res)
);

/**
 * POST /api/v2/jumppoints/:jumpPointId/activate
 * Activate (connect to) jump point
 */
router.post(
  '/:jumpPointId/activate',
  ...orgAuth,
  validateSchema(jumpPointSchemas.activate, 'body'),
  (req, res) => getController().activate(req, res)
);

/**
 * POST /api/v2/jumppoints/:jumpPointId/deactivate
 * Deactivate (disconnect from) jump point
 */
router.post(
  '/:jumpPointId/deactivate',
  ...orgAuth,
  validateSchema(jumpPointSchemas.deactivate, 'body'),
  (req, res) => getController().deactivate(req, res)
);

/**
 * GET /api/v2/jumppoints/:jumpPointId/status
 * Get jump point status and configuration
 */
router.get('/:jumpPointId/status', ...orgAuth, (req, res) => getController().getStatus(req, res));

/**
 * GET /api/v2/jumppoints/:jumpPointId/traffic
 * Get jump point traffic analytics
 */
router.get('/:jumpPointId/traffic', ...orgAuth, (req, res) => getController().getTraffic(req, res));

// ==================== CODE-BASED LINKING ====================

/**
 * POST /api/v2/jumppoints/link
 * Connect to a jump point using an invite code
 */
router.post('/link', ...orgAuth, validateSchema(jumpPointSchemas.linkByCode, 'body'), (req, res) =>
  getController().linkByCode(req, res)
);

// ==================== MODERATION ====================

/**
 * POST /api/v2/jumppoints/:jumpPointId/ban
 * Ban a user from a jump point
 */
router.post(
  '/:jumpPointId/ban',
  ...orgAuth,
  validateSchema(jumpPointSchemas.ban, 'body'),
  (req, res) => getController().banUser(req, res)
);

/**
 * POST /api/v2/jumppoints/:jumpPointId/unban
 * Unban a user from a jump point
 */
router.post(
  '/:jumpPointId/unban',
  ...orgAuth,
  validateSchema(jumpPointSchemas.unban, 'body'),
  (req, res) => getController().unbanUser(req, res)
);

/**
 * GET /api/v2/jumppoints/:jumpPointId/bans
 * List all bans for a jump point
 */
router.get('/:jumpPointId/bans', ...orgAuth, (req, res) => getController().listBans(req, res));

// ==================== ANALYTICS (PERSISTED) ====================

/**
 * GET /api/v2/jumppoints/:jumpPointId/analytics
 * Get persisted analytics history for a jump point
 */
router.get(
  '/:jumpPointId/analytics',
  ...orgAuth,
  validateSchema(jumpPointSchemas.analyticsQuery, 'query'),
  (req, res) => getController().getAnalyticsHistory(req, res)
);

// ==================== MESSAGE HISTORY ====================

/**
 * GET /api/v2/jumppoints/:jumpPointId/messages
 * Get message history for a jump point
 */
router.get('/:jumpPointId/messages', ...orgAuth, (req, res) =>
  getController().getMessages(req, res)
);

// ==================== INVITE CODE ====================

/**
 * POST /api/v2/jumppoints/:jumpPointId/regenerate-code
 * Regenerate the invite code for a jump point
 */
router.post('/:jumpPointId/regenerate-code', ...orgAuth, (req, res) =>
  getController().regenerateInviteCode(req, res)
);

// ==================== SYSTEM STATS ====================

/**
 * GET /api/v2/jumppoints/stats
 * Get system-wide tunnel statistics
 */
router.get('/stats/system', ...orgAuth, (req, res) => getController().getSystemStats(req, res));

export { router };
