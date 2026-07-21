import { Router } from 'express';

import { NotificationController } from '../../controllers/notificationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { communicationSchemas } from '../../schemas';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Lazy initialization to avoid EntityMetadataNotFoundError
let notificationController: NotificationController;
const getController = (): NotificationController => {
  if (!notificationController) {
    notificationController = new NotificationController();
  }
  return notificationController;
};

// ==================== NOTIFICATIONS ====================

/**
 * GET /api/v2/notifications
 * Get user notifications
 */
router.get('/', (req, res) => getController().listNotifications(req, res));

/**
 * POST /api/v2/notifications
 * Send a notification via in-app, discord, or email channel
 */
router.post('/', validateSchema(communicationSchemas.createNotification, 'body'), (req, res) =>
  getController().sendNotification(req, res)
);

/**
 * POST /api/v2/notifications/mark-read
 * Mark notifications as read
 */
router.post('/mark-read', validateSchema(communicationSchemas.markAsRead, 'body'), (req, res) =>
  getController().markAsRead(req, res)
);

/**
 * POST /api/v2/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/mark-all-read', (req, res) => getController().markAllAsRead(req, res));

/**
 * GET /api/v2/notifications/digest
 * Get notification digest for current user
 */
router.get('/digest', (req, res) => getController().getDigest(req, res));

/**
 * DELETE /api/v2/notifications/:notificationId
 * Delete notification
 */
router.delete('/:notificationId', validateSchema(communicationSchemas.notificationParam, 'params'), (req, res) =>
  getController().deleteNotification(req, res)
);

/**
 * GET /api/v2/notifications/preferences/user
 * Get notification preferences
 */
router.get('/preferences/user', (req, res) => getController().getPreferences(req, res));

/**
 * PUT /api/v2/notifications/preferences/user
 * Update notification preferences
 */
router.put('/preferences/user', (req, res) => getController().updatePreferences(req, res));

export { router };

