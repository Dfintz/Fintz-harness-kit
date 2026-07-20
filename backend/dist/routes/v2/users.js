"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const userShipController_1 = require("../../controllers/userShipController");
const permissionsController_1 = require("../../controllers/v2/permissionsController");
const userController_1 = require("../../controllers/v2/userController");
const auth_1 = require("../../middleware/auth");
const fileValidation_1 = require("../../middleware/fileValidation");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const relationshipValidation_1 = require("../../middleware/relationshipValidation");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const UserShipService_1 = require("../../services/ship/UserShipService");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new userController_1.UserControllerV2();
const shipController = new userShipController_1.UserShipController();
const permissionsController = new permissionsController_1.PermissionsControllerV2();
const userShipService = new UserShipService_1.UserShipService();
router.get('/users/me', auth_1.authenticate, controller.getCurrentUser.bind(controller));
router.put('/users/me', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userSchemas.updateCurrentUser, 'body'), controller.updateCurrentUser.bind(controller));
router.patch('/users/me', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userSchemas.updateCurrentUser, 'body'), controller.updateCurrentUser.bind(controller));
router.get('/users/me/preferences', auth_1.authenticate, controller.getPreferences.bind(controller));
router.put('/users/me/preferences', auth_1.authenticate, controller.updatePreferences.bind(controller));
router.get('/users/me/organizations', auth_1.authenticate, controller.getUserOrganizations.bind(controller));
router.put('/users/me/active-organization', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userSchemas.switchActiveOrganization, 'body'), controller.switchActiveOrganization.bind(controller));
router.get('/users/me/activity', auth_1.authenticate, controller.getUserActivity.bind(controller));
router.get('/users/me/ships', auth_1.authenticate, controller.getUserShips.bind(controller));
router.get('/users/:userId/ships/summary', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), async (req, res) => {
    try {
        const paramId = req.params.userId;
        const authUserId = req.user?.id;
        const userId = paramId && paramId !== 'me' ? paramId : authUserId;
        if (!userId) {
            res
                .status(401)
                .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID required' } });
            return;
        }
        if (userId !== authUserId) {
            res
                .status(403)
                .json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
            return;
        }
        const summary = await userShipService.getUserShipSummary('', userId);
        res.success(summary);
    }
    catch (error) {
        logger_1.logger.error('User ship summary failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            path: req.path,
        });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve ship summary' },
        });
    }
});
router.get('/users/:userId/ships/insurance/expiring', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => shipController.getShipsNeedingInsurance(req, res));
router.get('/users/:userId/ships/:shipId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userShipParam, 'params'), (req, res) => shipController.getUserShipById(req, res));
router.post('/users/:userId/ships', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.createShip, 'body'), rateLimiting_1.shipCreationRateLimiter, (req, res) => shipController.createUserShip(req, res));
router.post('/users/:userId/ships/import', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userIdParam, 'params'), rateLimiting_1.shipCreationRateLimiter, (req, res) => shipController.bulkImportUserShips(req, res));
router.patch('/users/:userId/ships/:shipId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userShipParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.updateShip, 'body'), rateLimiting_1.shipWriteRateLimiter, (req, res) => shipController.updateUserShip(req, res));
router.delete('/users/:userId/ships/:shipId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userShipParam, 'params'), rateLimiting_1.shipWriteRateLimiter, (req, res) => shipController.deleteUserShip(req, res));
router.post('/users/me/password', auth_1.authenticate, controller.changePassword.bind(controller));
router.get('/users/me/statistics', auth_1.authenticate, controller.getUserStatistics.bind(controller));
router.get('/users/community/browse', auth_1.authenticate, rateLimiting_1.publicEndpointRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.userSchemas.browseCommunityMembers, 'query'), controller.browseCommunityMembers.bind(controller));
router.get('/users/:id', auth_1.authenticate, controller.getUserById.bind(controller));
router.get('/users/:id/ships', auth_1.authenticate, controller.getUserShipsById.bind(controller));
router.get('/users/me/activity/timeline', auth_1.authenticate, controller.getActivityTimeline.bind(controller));
router.get('/users/me/activity/heatmap', auth_1.authenticate, controller.getActivityHeatmap.bind(controller));
router.get('/users/:id/activity/timeline', auth_1.authenticate, controller.getUserActivityTimeline.bind(controller));
router.get('/users/:id/activity/heatmap', auth_1.authenticate, controller.getUserActivityHeatmap.bind(controller));
router.get('/users/:id/activity/stats', auth_1.authenticate, controller.getUserActivityStatsById.bind(controller));
router.patch('/users/:id/role', auth_1.authenticate, controller.updateUserRole.bind(controller));
router.get('/users/search', auth_1.authenticate, controller.searchUsers.bind(controller));
router.post('/users/:id/deactivate', auth_1.authenticate, controller.deactivateUser.bind(controller));
router.get('/users/me/notifications', auth_1.authenticate, controller.getUserNotifications.bind(controller));
router.patch('/users/me/notifications/:id', auth_1.authenticate, controller.markNotificationRead.bind(controller));
router.post('/users/me/notifications/read-all', auth_1.authenticate, controller.markAllNotificationsRead.bind(controller));
router.delete('/users/me/notifications/:id', auth_1.authenticate, controller.deleteNotification.bind(controller));
router.get('/users/me/notification-settings', auth_1.authenticate, controller.getNotificationSettings.bind(controller));
router.patch('/users/me/avatar', auth_1.authenticate, rateLimiting_1.avatarUploadRateLimiter, fileValidation_1.imageUploadConfig.single('avatar'), controller.updateAvatar.bind(controller));
router.post('/users/me/avatar/reset', auth_1.authenticate, controller.resetAvatar.bind(controller));
router.get('/users/:id/public-profile', auth_1.authenticate, controller.getPublicProfile.bind(controller));
router.get('/users/me/linked-accounts', auth_1.authenticate, controller.getLinkedAccounts.bind(controller));
router.delete('/users/me/linked-accounts/:provider', auth_1.authenticate, controller.unlinkAccount.bind(controller));
router.get('/users/me/sessions', auth_1.authenticate, controller.getSessions.bind(controller));
router.delete('/users/me/sessions/:sessionId', auth_1.authenticate, (0, relationshipValidation_1.validateUUID)('sessionId'), controller.revokeSession.bind(controller));
router.get('/users/me/trusted-devices', auth_1.authenticate, controller.getTrustedDevices.bind(controller));
router.delete('/users/me/trusted-devices/:deviceId', auth_1.authenticate, (0, relationshipValidation_1.validateUUID)('deviceId'), controller.revokeTrustedDevice.bind(controller));
router.get('/users/me/access-logs', auth_1.authenticate, controller.getAccessLogs.bind(controller));
router.get('/users/me/privacy-settings', auth_1.authenticate, controller.getPrivacySettings.bind(controller));
router.patch('/users/me/privacy-settings', auth_1.authenticate, controller.updatePrivacySettings.bind(controller));
router.get('/users/me/export-data', auth_1.authenticate, controller.exportData.bind(controller));
router.post('/users/me/delete-account', auth_1.authenticate, controller.requestAccountDeletion.bind(controller));
router.get('/users/me/badges', auth_1.authenticate, controller.getBadges.bind(controller));
router.get('/users/:userId/permissions', auth_1.authenticate, permissionsController.getUserPermissions.bind(permissionsController));
router.post('/auth/forgot-password', controller.requestPasswordReset.bind(controller));
router.get('/auth/reset-password/:token', controller.verifyResetToken.bind(controller));
router.post('/auth/reset-password', controller.resetPassword.bind(controller));
router.get('/users', auth_1.authenticate, controller.listUsers.bind(controller));
router.post('/users', auth_1.authenticate, controller.createUser.bind(controller));
router.patch('/users/:id', auth_1.authenticate, controller.updateUserAdmin.bind(controller));
router.delete('/users/:id', auth_1.authenticate, controller.deleteUser.bind(controller));
router.post('/users/search/advanced', auth_1.authenticate, controller.advancedSearch.bind(controller));
router.get('/users/suggestions/username/:partial', auth_1.authenticate, controller.getUsernameSuggestions.bind(controller));
router.get('/users/:id/similar', auth_1.authenticate, controller.getSimilarUsers.bind(controller));
router.post('/users/:id/social/friend-request', auth_1.authenticate, controller.sendFriendRequest.bind(controller));
//# sourceMappingURL=users.js.map