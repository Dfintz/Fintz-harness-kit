/**
 * API v2 - Users Routes
 * User management endpoints with standardized responses
 */

import { Router } from 'express';

import { UserShipController } from '../../controllers/userShipController';
import { PermissionsControllerV2 } from '../../controllers/v2/permissionsController';
import { UserControllerV2 } from '../../controllers/v2/userController';
import { AuthRequest, authenticate } from '../../middleware/auth';
import { imageUploadConfig } from '../../middleware/fileValidation';
import {
  avatarUploadRateLimiter,
  publicEndpointRateLimiter,
  shipCreationRateLimiter,
  shipWriteRateLimiter,
} from '../../middleware/rateLimiting';
import { validateUUID } from '../../middleware/relationshipValidation';
import { validateSchema } from '../../middleware/schemaValidation';
import { paramSchemas, userSchemas, userShipQuerySchemas } from '../../schemas';
import { UserShipService } from '../../services/ship/UserShipService';
import { logger } from '../../utils/logger';

const router = Router();
const controller = new UserControllerV2();
const shipController = new UserShipController();
const permissionsController = new PermissionsControllerV2();
const userShipService = new UserShipService();

// Current user profile
router.get('/users/me', authenticate, controller.getCurrentUser.bind(controller));

router.put(
  '/users/me',
  authenticate,
  validateSchema(userSchemas.updateCurrentUser, 'body'),
  controller.updateCurrentUser.bind(controller)
);
router.patch(
  '/users/me',
  authenticate,
  validateSchema(userSchemas.updateCurrentUser, 'body'),
  controller.updateCurrentUser.bind(controller)
);

// User preferences
router.get('/users/me/preferences', authenticate, controller.getPreferences.bind(controller));

router.put('/users/me/preferences', authenticate, controller.updatePreferences.bind(controller));

// User organizations
router.get(
  '/users/me/organizations',
  authenticate,
  controller.getUserOrganizations.bind(controller)
);

// Switch active organization
router.put(
  '/users/me/active-organization',
  authenticate,
  validateSchema(userSchemas.switchActiveOrganization, 'body'),
  controller.switchActiveOrganization.bind(controller)
);

// User activity summary
router.get('/users/me/activity', authenticate, controller.getUserActivity.bind(controller));

// User ships
router.get('/users/me/ships', authenticate, controller.getUserShips.bind(controller));

// User ship CRUD (V2 — uses res.success() for consistent ApiResponse envelope)
// Static path segments MUST come before :shipId to avoid Express matching them as params
router.get(
  '/users/:userId/ships/summary',
  authenticate,
  validateSchema(paramSchemas.userId, 'params'),
  async (req, res) => {
    try {
      const paramId = req.params.userId;
      const authUserId = (req as AuthRequest).user?.id;
      const userId = paramId && paramId !== 'me' ? paramId : authUserId;

      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID required' } });
        return;
      }

      // Authorization: users can only view their own ship summary
      if (userId !== authUserId) {
        res
          .status(403)
          .json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }

      const summary = await userShipService.getUserShipSummary('', userId);
      res.success(summary);
    } catch (error: unknown) {
      logger.error('User ship summary failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve ship summary' },
      });
    }
  }
);
router.get(
  '/users/:userId/ships/insurance/expiring',
  authenticate,
  validateSchema(paramSchemas.userId, 'params'),
  (req, res) => shipController.getShipsNeedingInsurance(req, res)
);
router.get(
  '/users/:userId/ships/:shipId',
  authenticate,
  validateSchema(userShipQuerySchemas.userShipParam, 'params'),
  (req, res) => shipController.getUserShipById(req, res)
);
router.post(
  '/users/:userId/ships',
  authenticate,
  validateSchema(userShipQuerySchemas.userIdParam, 'params'),
  validateSchema(userShipQuerySchemas.createShip, 'body'),
  shipCreationRateLimiter,
  (req, res) => shipController.createUserShip(req, res)
);
router.post(
  '/users/:userId/ships/import',
  authenticate,
  validateSchema(userShipQuerySchemas.userIdParam, 'params'),
  shipCreationRateLimiter,
  (req, res) => shipController.bulkImportUserShips(req, res)
);
router.patch(
  '/users/:userId/ships/:shipId',
  authenticate,
  validateSchema(userShipQuerySchemas.userShipParam, 'params'),
  validateSchema(userShipQuerySchemas.updateShip, 'body'),
  shipWriteRateLimiter,
  (req, res) => shipController.updateUserShip(req, res)
);
router.delete(
  '/users/:userId/ships/:shipId',
  authenticate,
  validateSchema(userShipQuerySchemas.userShipParam, 'params'),
  shipWriteRateLimiter,
  (req, res) => shipController.deleteUserShip(req, res)
);

// Change password
router.post('/users/me/password', authenticate, controller.changePassword.bind(controller));

// User statistics
router.get('/users/me/statistics', authenticate, controller.getUserStatistics.bind(controller));

// Community members directory browse (must be before /:id catch-all)
router.get(
  '/users/community/browse',
  authenticate,
  publicEndpointRateLimiter,
  validateSchema(userSchemas.browseCommunityMembers, 'query'),
  controller.browseCommunityMembers.bind(controller)
);

// Public user profile (by ID)
router.get('/users/:id', authenticate, controller.getUserById.bind(controller));

// User ships by ID (public ships only, or all ships if own profile)
router.get('/users/:id/ships', authenticate, controller.getUserShipsById.bind(controller));

// User activity tracking
router.get(
  '/users/me/activity/timeline',
  authenticate,
  controller.getActivityTimeline.bind(controller)
);

router.get(
  '/users/me/activity/heatmap',
  authenticate,
  controller.getActivityHeatmap.bind(controller)
);

router.get(
  '/users/:id/activity/timeline',
  authenticate,
  controller.getUserActivityTimeline.bind(controller)
);

router.get(
  '/users/:id/activity/heatmap',
  authenticate,
  controller.getUserActivityHeatmap.bind(controller)
);

// User activity stats by ID
router.get(
  '/users/:id/activity/stats',
  authenticate,
  controller.getUserActivityStatsById.bind(controller)
);

// User role and admin management
router.patch('/users/:id/role', authenticate, controller.updateUserRole.bind(controller));

router.get('/users/search', authenticate, controller.searchUsers.bind(controller));

router.post('/users/:id/deactivate', authenticate, controller.deactivateUser.bind(controller));

// User notifications
router.get(
  '/users/me/notifications',
  authenticate,
  controller.getUserNotifications.bind(controller)
);

router.patch(
  '/users/me/notifications/:id',
  authenticate,
  controller.markNotificationRead.bind(controller)
);

router.post(
  '/users/me/notifications/read-all',
  authenticate,
  controller.markAllNotificationsRead.bind(controller)
);

router.delete(
  '/users/me/notifications/:id',
  authenticate,
  controller.deleteNotification.bind(controller)
);

router.get(
  '/users/me/notification-settings',
  authenticate,
  controller.getNotificationSettings.bind(controller)
);

// User avatar (multipart file upload or JSON URL)
router.patch(
  '/users/me/avatar',
  authenticate,
  avatarUploadRateLimiter,
  imageUploadConfig.single('avatar'),
  controller.updateAvatar.bind(controller)
);

// Reset avatar to Discord or RSI profile picture
router.post('/users/me/avatar/reset', authenticate, controller.resetAvatar.bind(controller));

// Public profile
router.get('/users/:id/public-profile', authenticate, controller.getPublicProfile.bind(controller));

// Linked accounts
router.get(
  '/users/me/linked-accounts',
  authenticate,
  controller.getLinkedAccounts.bind(controller)
);

// Unlink an OAuth provider
router.delete(
  '/users/me/linked-accounts/:provider',
  authenticate,
  controller.unlinkAccount.bind(controller)
);

// User sessions
router.get('/users/me/sessions', authenticate, controller.getSessions.bind(controller));

router.delete(
  '/users/me/sessions/:sessionId',
  authenticate,
  validateUUID('sessionId'),
  controller.revokeSession.bind(controller)
);

// Trusted devices
router.get(
  '/users/me/trusted-devices',
  authenticate,
  controller.getTrustedDevices.bind(controller)
);

router.delete(
  '/users/me/trusted-devices/:deviceId',
  authenticate,
  validateUUID('deviceId'),
  controller.revokeTrustedDevice.bind(controller)
);

// Access logs
router.get('/users/me/access-logs', authenticate, controller.getAccessLogs.bind(controller));

// Privacy settings
router.get(
  '/users/me/privacy-settings',
  authenticate,
  controller.getPrivacySettings.bind(controller)
);

router.patch(
  '/users/me/privacy-settings',
  authenticate,
  controller.updatePrivacySettings.bind(controller)
);

// GDPR exports and deletion
router.get('/users/me/export-data', authenticate, controller.exportData.bind(controller));

router.post(
  '/users/me/delete-account',
  authenticate,
  controller.requestAccountDeletion.bind(controller)
);

// User badges
router.get('/users/me/badges', authenticate, controller.getBadges.bind(controller));

// User permissions (this route is also in permissions.ts but needed here for REST consistency)
router.get(
  '/users/:userId/permissions',
  authenticate,
  permissionsController.getUserPermissions.bind(permissionsController)
);

// Password reset endpoints (public - no auth required)
router.post('/auth/forgot-password', controller.requestPasswordReset.bind(controller));

router.get('/auth/reset-password/:token', controller.verifyResetToken.bind(controller));

router.post('/auth/reset-password', controller.resetPassword.bind(controller));

// Admin user management endpoints
router.get('/users', authenticate, controller.listUsers.bind(controller));

router.post('/users', authenticate, controller.createUser.bind(controller));

router.patch('/users/:id', authenticate, controller.updateUserAdmin.bind(controller));

router.delete('/users/:id', authenticate, controller.deleteUser.bind(controller));

// Advanced search
router.post('/users/search/advanced', authenticate, controller.advancedSearch.bind(controller));

// Username suggestions
router.get(
  '/users/suggestions/username/:partial',
  authenticate,
  controller.getUsernameSuggestions.bind(controller)
);

// Similar users
router.get('/users/:id/similar', authenticate, controller.getSimilarUsers.bind(controller));

// Social features
router.post(
  '/users/:id/social/friend-request',
  authenticate,
  controller.sendFriendRequest.bind(controller)
);

export { router };
