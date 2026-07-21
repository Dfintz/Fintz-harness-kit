import { Router } from 'express';

import { AnnouncementController } from '../../controllers/v2/announcementController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { announcementSchemas } from '../../schemas/announcementSchemas';

const router = Router();

let announcementController: AnnouncementController;
const getController = () => {
  if (!announcementController) {
    announcementController = new AnnouncementController();
  }
  return announcementController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== ANNOUNCEMENTS ====================

/**
 * GET /api/v2/announcements
 * Get all announcements
 * Query: status, targetType, createdBy, page, limit
 */
router.get('/', ...orgAuth, validateSchema(announcementSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);

/**
 * POST /api/v2/announcements
 * Create announcement
 */
router.post('/', ...orgAuth, validateSchema(announcementSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/announcements/:announcementId
 * Get specific announcement
 */
router.get('/:announcementId', ...orgAuth, (req, res) => getController().getById(req, res));

/**
 * PUT /api/v2/announcements/:announcementId
 * Update announcement
 */
router.put(
  '/:announcementId',
  ...orgAuth,
  validateSchema(announcementSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

/**
 * DELETE /api/v2/announcements/:announcementId
 * Delete announcement
 */
router.delete('/:announcementId', ...orgAuth, (req, res) => getController().delete(req, res));

/**
 * POST /api/v2/announcements/:announcementId/publish
 * Publish/send announcement to Discord channel
 */
router.post(
  '/:announcementId/publish',
  ...orgAuth,
  validateSchema(announcementSchemas.send, 'body'),
  (req, res) => getController().publish(req, res)
);

/**
 * POST /api/v2/announcements/:announcementId/pin
 * Pin announcement
 */
router.post('/:announcementId/pin', ...orgAuth, (req, res) => getController().pin(req, res));

/**
 * POST /api/v2/announcements/:announcementId/read
 * Mark announcement as read
 */
router.post('/:announcementId/read', ...orgAuth, (req, res) => getController().markRead(req, res));

export { router };
