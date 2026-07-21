/**
 * API v2 - Organizations Routes
 * Organization-scoped endpoints with standardized responses
 */

import { Router } from 'express';

import { OrganizationController } from '../../controllers/organizationController';
import { OrganizationControllerV2 } from '../../controllers/v2/organizationController';
import { OrgTrustScoreController } from '../../controllers/v2/orgTrustScoreController';
import { authenticate } from '../../middleware/auth';
import { generalRateLimiter, organizationUpdateRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { organizationSchemas, paramSchemas } from '../../schemas';

const router = Router();
const controller = new OrganizationControllerV2();
const legacyController = new OrganizationController();
const trustScoreController = new OrgTrustScoreController();

// Organization CRUD operations
router.get('/organizations', controller.listOrganizations.bind(controller));

router.get('/organizations/:id', authenticate, controller.getOrganization.bind(controller));

router.post('/organizations', authenticate, controller.createOrganization.bind(controller));

router.patch('/organizations/:id', authenticate, controller.updateOrganization.bind(controller));

// Rename organization (display name only, tag/id is immutable)
router.patch(
  '/organizations/:id/rename',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.rename, 'body'),
  organizationUpdateRateLimiter,
  legacyController.renameOrganization
);

// Sync organization name from RSI
router.post(
  '/organizations/:id/sync-name-from-rsi',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  legacyController.syncNameFromRsi
);

router.delete('/organizations/:id', authenticate, controller.deleteOrganization.bind(controller));

// Member management
router.get('/organizations/:id/members', authenticate, controller.getMembers.bind(controller));

router.post('/organizations/:id/members', authenticate, controller.addMember.bind(controller));

router.delete(
  '/organizations/:id/members/:userId',
  authenticate,
  controller.removeMember.bind(controller)
);

// Leave organization (self-removal)
router.post(
  '/organizations/:id/leave',
  authenticate,
  controller.leaveOrganization.bind(controller)
);

// Organization dashboard and overview
router.get(
  '/organizations/:orgId/dashboard',
  authenticate,
  controller.getDashboard.bind(controller)
);

router.get('/organizations/:orgId/overview', authenticate, controller.getOverview.bind(controller));

// Activity feed
router.get('/organizations/:orgId/feed', authenticate, controller.getFeed.bind(controller));

// Activity trends
router.get(
  '/organizations/:orgId/activity-trends',
  authenticate,
  controller.getActivityTrends.bind(controller)
);

// Organization insights and analytics
router.get('/organizations/:orgId/insights', authenticate, controller.getInsights.bind(controller));

// Online members
router.get(
  '/organizations/:orgId/members/online',
  authenticate,
  controller.getOnlineMembers.bind(controller)
);

// Member ships - view all ships from organization members
router.get(
  '/organizations/:orgId/members/ships',
  authenticate,
  controller.getOrganizationMemberShips.bind(controller)
);

// Ship classification - org leaders can hide/show member ships
router.patch(
  '/organizations/:orgId/members/ships/:shipId/classify',
  authenticate,
  controller.classifyMemberShip.bind(controller)
);

router.patch(
  '/organizations/:orgId/members/ships/:shipId/declassify',
  authenticate,
  controller.declassifyMemberShip.bind(controller)
);

// Alliance management
router.get(
  '/organizations/:orgId/alliances',
  authenticate,
  controller.getAlliances.bind(controller)
);

router.get(
  '/organizations/:orgId/alliance-statistics',
  authenticate,
  controller.getAllianceStatistics.bind(controller)
);

router.get(
  '/organizations/:orgId/shared-activities',
  authenticate,
  controller.getSharedActivities.bind(controller)
);

// Trading route management
router.get(
  '/organizations/:orgId/trading/stats',
  authenticate,
  controller.getTradingStats.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/profit-summary',
  authenticate,
  controller.getTradingProfitSummary.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/recommendations',
  authenticate,
  controller.getTradingRecommendations.bind(controller)
);

// Additional member management endpoints
router.get(
  '/organizations/:id/members/:userId',
  authenticate,
  controller.getMemberDetails.bind(controller)
);

router.patch(
  '/organizations/:id/members/:userId/role',
  authenticate,
  validateSchema(organizationSchemas.updateMemberRole),
  controller.updateMemberRole.bind(controller)
);

router.patch(
  '/organizations/:id/members/:userId/title',
  authenticate,
  controller.updateMemberTitle.bind(controller)
);

router.post(
  '/organizations/:id/members/:userId/transfer',
  authenticate,
  controller.transferMember.bind(controller)
);

router.get(
  '/organizations/:id/members/search',
  authenticate,
  controller.searchMembers.bind(controller)
);

router.get(
  '/organizations/:id/members/stats',
  authenticate,
  controller.getMemberStats.bind(controller)
);

router.get(
  '/organizations/:id/members/by-role/:role',
  authenticate,
  controller.getMembersByRole.bind(controller)
);

// Organization permissions
router.post(
  '/organizations/:id/permissions',
  authenticate,
  controller.grantPermission.bind(controller)
);

router.delete(
  '/organizations/:id/permissions/:permissionId',
  authenticate,
  controller.revokePermission.bind(controller)
);

router.get(
  '/organizations/:id/permissions',
  authenticate,
  controller.listPermissions.bind(controller)
);

router.post(
  '/organizations/:id/permissions/check',
  authenticate,
  controller.checkPermission.bind(controller)
);

// Organization settings
router.get('/organizations/:id/settings', authenticate, controller.getSettings.bind(controller));

router.patch(
  '/organizations/:id/settings',
  authenticate,
  controller.updateSettings.bind(controller)
);

// Organization invitations — handled by invitationRoutes (invitations.ts)
// Do NOT add invitation routes here; they are registered in invitations.ts
// with proper Joi validation and the InvitationController.

// Organization hierarchy
router.get(
  '/organizations/:orgId/parent',
  authenticate,
  controller.getParentOrganization.bind(controller)
);

router.get(
  '/organizations/:orgId/children',
  authenticate,
  controller.getChildOrganizations.bind(controller)
);

router.post(
  '/organizations/:orgId/hierarchy',
  authenticate,
  controller.updateHierarchy.bind(controller)
);

// Aggregator endpoints
router.post(
  '/organizations/:orgId/members/onboard',
  authenticate,
  validateSchema(organizationSchemas.onboardMember),
  controller.onboardMember.bind(controller)
);

router.post(
  '/organizations/:orgId/members/:memberId/offboard',
  authenticate,
  validateSchema(organizationSchemas.offboardMember),
  controller.offboardMemberFull.bind(controller)
);

router.post(
  '/organizations/:orgId/members/bulk-invite',
  authenticate,
  validateSchema(organizationSchemas.bulkInvite),
  controller.bulkInviteMembers.bind(controller)
);

// Organization trust score (public, no auth required for profile viewing)
router.get(
  '/organizations/:id/trust-score',
  trustScoreController.getTrustScore.bind(trustScoreController)
);

// ==================== DISCORD GUILD MANAGEMENT (V2) ====================
// Delegates to V1 OrganizationController methods for shared logic
const orgControllerV1 = new OrganizationController();

router.get(
  '/organizations/:id/discord/guilds',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => orgControllerV1.getDiscordGuilds(req, res)
);
router.post(
  '/organizations/:id/discord/connect',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => orgControllerV1.connectDiscordGuild(req, res)
);
router.delete(
  '/organizations/:id/discord/disconnect/:guildId',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => orgControllerV1.disconnectDiscordGuild(req, res)
);

export { router };

