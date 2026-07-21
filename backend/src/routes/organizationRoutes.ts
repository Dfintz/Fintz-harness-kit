import { Application, Router } from 'express';

import { OrganizationController } from '../controllers/organizationController';
import { authenticateToken } from '../middleware/auth';
import {
  generalRateLimiter,
  hierarchyOperationsRateLimiter,
  organizationCreationRateLimiter,
  organizationUpdateRateLimiter,
  permissionOperationsRateLimiter,
} from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { twoFactorChallengeMiddleware } from '../middleware/twoFactorChallenge';
import { organizationQuerySchemas, organizationSchemas, paramSchemas } from '../schemas';

const router = Router();

let organizationController: OrganizationController;
const getOrganizationController = () => {
  if (!organizationController) {
    organizationController = new OrganizationController();
  }
  return organizationController;
};

/**
 * Organization Routes
 * Comprehensive API endpoints for organization management with hierarchy, permissions, and activity logging
 */

// ==================== PUBLIC ROUTES (NO AUTH) ====================

// Get organizations (public list)
router.get(
  '/organizations',
  validateSchema(organizationQuerySchemas.listQuery, 'query'),
  generalRateLimiter,
  (req, res) => getOrganizationController().listOrganizations(req, res)
);

// Search organizations (public)
router.get(
  '/organizations/search',
  validateSchema(organizationQuerySchemas.searchQuery, 'query'),
  generalRateLimiter,
  (req, res) => getOrganizationController().searchOrganizations(req, res)
);

// Get specific organization (public view)
router.get(
  '/organizations/:id',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationQuerySchemas.getQuery, 'query'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getOrganization(req, res)
);

// ==================== AUTHENTICATED ROUTES ====================

// Create organization (requires auth)
router.post(
  '/organizations',
  authenticateToken,
  validateSchema(organizationSchemas.create, 'body'),
  organizationCreationRateLimiter,
  (req, res) => getOrganizationController().createOrganization(req, res)
);

// Update organization (requires auth + permission)
router.patch(
  '/organizations/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.update, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().updateOrganization(req, res)
);

// Rename organization (requires auth + permission)
router.patch(
  '/organizations/:id/rename',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.rename, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().renameOrganization(req, res)
);

// Sync organization name from RSI (requires auth + permission + RSI SID linked)
router.post(
  '/organizations/:id/sync-name-from-rsi',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().syncNameFromRsi(req, res)
);

// Get deletion preview (requires auth)
router.get(
  '/organizations/:id/deletion-preview',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getDeletionPreview(req, res)
);

// Get latest deletion request for organization (requires auth)
router.get(
  '/organizations/:id/deletion-requests/latest',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getLatestDeletionRequest(req, res)
);

// Delete organization (requires auth + owner + 2FA if enabled)
router.delete(
  '/organizations/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  twoFactorChallengeMiddleware('organization-delete'),
  hierarchyOperationsRateLimiter,
  (req, res) => getOrganizationController().deleteOrganization(req, res)
);

// ==================== HIERARCHY ROUTES ====================

// Create sub-organization (requires auth + permission)
router.post(
  '/organizations/:id/sub-organizations',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.createSubOrg, 'body'),
  hierarchyOperationsRateLimiter,
  (req, res) => getOrganizationController().createSubOrganization(req, res)
);

// Move organization (requires auth + permission)
router.patch(
  '/organizations/:id/move',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.moveHierarchy, 'body'),
  hierarchyOperationsRateLimiter,
  (req, res) => getOrganizationController().moveOrganization(req, res)
);

// Detach organization (requires auth + owner)
router.post(
  '/organizations/:id/detach',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  hierarchyOperationsRateLimiter,
  (req, res) => getOrganizationController().detachOrganization(req, res)
);

// Get organization tree (requires auth for security)
router.get(
  '/organizations/:id/tree',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getOrganizationTree(req, res)
);

// Get ancestors (public/auth)
router.get(
  '/organizations/:id/ancestors',
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getAncestors(req, res)
);

// Get descendants (public/auth)
router.get(
  '/organizations/:id/descendants',
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getDescendants(req, res)
);

// Get siblings (public/auth)
router.get(
  '/organizations/:id/siblings',
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getSiblings(req, res)
);

// Validate hierarchy (requires auth)
router.get(
  '/organizations/:id/validate',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  validateSchema(organizationSchemas.move, 'body'),
  (req, res) => getOrganizationController().validateHierarchy(req, res)
);

// Get hierarchy stats (public/auth)
router.get(
  '/organizations/:id/hierarchy/stats',
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getHierarchyStats(req, res)
);

// ==================== MEMBER ROUTES ====================

// Add member (requires auth + permission)
router.post(
  '/organizations/:id/members',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.addMember, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().addMember(req, res)
);

// Remove member (requires auth + permission)
router.delete(
  '/organizations/:id/members/:userId',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().removeMember(req, res)
);

// Update member role (requires auth + permission)
router.patch(
  '/organizations/:id/members/:userId/role',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().updateMemberRole(req, res)
);

// Transfer member (requires auth + permission)
router.post(
  '/organizations/:id/members/:userId/transfer',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().transferMember(req, res)
);

// ==================== PERMISSION ROUTES ====================

// Grant permission (requires auth + permission management)
router.post(
  '/organizations/:id/permissions',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationSchemas.grantPermission, 'body'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().grantPermission(req, res)
);

// Revoke permission (requires auth + permission management)
router.delete(
  '/organizations/:id/permissions/:permissionId',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().revokePermission(req, res)
);

// Update permission (requires auth + permission management)
router.patch(
  '/organizations/:id/permissions/:permissionId',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().updatePermission(req, res)
);

// List permissions (requires auth)
router.get(
  '/organizations/:id/permissions',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().listPermissions(req, res)
);

// Check permission (requires auth)
router.post(
  '/organizations/:id/permissions/check',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().checkPermission(req, res)
);

// Apply permission template (requires auth + permission management)
router.post(
  '/organizations/:id/permissions/template',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().applyPermissionTemplate(req, res)
);

// Get permission stats (requires auth)
router.get(
  '/organizations/:id/permissions/stats',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getPermissionStats(req, res)
);

// ==================== ACTIVITY LOG ROUTES ====================

// Get organization activity (requires auth)
router.get(
  '/organizations/:id/activity',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getActivity(req, res)
);

// Get activity stats (requires auth)
router.get(
  '/organizations/:id/activity/stats',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getActivityStats(req, res)
);

// ==================== SETTINGS ROUTES ====================

// Update settings (requires auth + permission)
router.patch(
  '/organizations/:id/settings',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().updateSettings(req, res)
);

// ==================== ANALYTICS ROUTES ====================

// Get analytics dashboard (requires auth)
router.get(
  '/organizations/:id/analytics/dashboard',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getAnalyticsDashboard(req, res)
);

// Get member statistics (requires auth)
router.get(
  '/organizations/:id/analytics/members',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getMemberStatistics(req, res)
);

// Get activity metrics (requires auth)
router.get(
  '/organizations/:id/analytics/activity',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getActivityMetrics(req, res)
);

// Get growth trends (requires auth)
router.get(
  '/organizations/:id/analytics/growth',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getGrowthTrends(req, res)
);

// Export analytics (requires auth, rate limited)
router.get(
  '/organizations/:id/analytics/export',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter, // More restrictive rate limit for exports
  (req, res) => getOrganizationController().exportAnalytics(req, res)
);

// ==================== TEMPLATE ROUTES ====================

// Search marketplace (public)
router.get('/organizations/templates/marketplace', generalRateLimiter, (req, res) =>
  getOrganizationController().searchMarketplace(req, res)
);

// Get popular templates (public)
router.get('/organizations/templates/popular', generalRateLimiter, (req, res) =>
  getOrganizationController().getPopularTemplates(req, res)
);

// Get top rated templates (public)
router.get('/organizations/templates/top-rated', generalRateLimiter, (req, res) =>
  getOrganizationController().getTopRatedTemplates(req, res)
);

// Import template (requires auth)
router.post(
  '/organizations/templates/import',
  authenticateToken,
  organizationCreationRateLimiter,
  (req, res) => getOrganizationController().importTemplate(req, res)
);

// Create template (requires auth)
router.post(
  '/organizations/templates',
  authenticateToken,
  organizationCreationRateLimiter,
  (req, res) => getOrganizationController().createTemplate(req, res)
);

// List templates (requires auth)
router.get('/organizations/templates', authenticateToken, generalRateLimiter, (req, res) =>
  getOrganizationController().listTemplates(req, res)
);

// Get template (public view)
router.get(
  '/organizations/templates/:id',
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getTemplate(req, res)
);

// Update template (requires auth + ownership)
router.put(
  '/organizations/templates/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().updateTemplate(req, res)
);

// Delete template (requires auth + ownership)
router.delete(
  '/organizations/templates/:id',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  hierarchyOperationsRateLimiter,
  (req, res) => getOrganizationController().deleteTemplate(req, res)
);

// Apply template (requires auth + permission)
router.post(
  '/organizations/templates/:id/apply',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  hierarchyOperationsRateLimiter,
  (req, res) => getOrganizationController().applyTemplate(req, res)
);

// Fork template (requires auth)
router.post(
  '/organizations/templates/:id/fork',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationCreationRateLimiter,
  (req, res) => getOrganizationController().forkTemplate(req, res)
);

// Rate template (requires auth)
router.post(
  '/organizations/templates/:id/rate',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().rateTemplate(req, res)
);

// Export template (requires auth)
router.get(
  '/organizations/templates/:id/export',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().exportTemplate(req, res)
);

// ==================== BULK OPERATIONS ROUTES ====================

// Bulk add members (requires auth + permission)
router.post(
  '/organizations/:id/bulk/add-members',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter, // Restrictive rate limit
  (req, res) => getOrganizationController().bulkAddMembers(req, res)
);

// Bulk remove members (requires auth + permission)
router.post(
  '/organizations/:id/bulk/remove-members',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().bulkRemoveMembers(req, res)
);

// Bulk update roles (requires auth + permission)
router.post(
  '/organizations/:id/bulk/update-roles',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().bulkUpdateRoles(req, res)
);

// Bulk grant permissions (requires auth + permission)
router.post(
  '/organizations/:id/bulk/grant-permissions',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().bulkGrantPermissions(req, res)
);

// Bulk revoke permissions (requires auth + permission)
router.post(
  '/organizations/:id/bulk/revoke-permissions',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().bulkRevokePermissions(req, res)
);

// Import members from CSV (requires auth + permission)
router.post(
  '/organizations/:id/bulk/import',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter, // Very restrictive for imports
  (req, res) => getOrganizationController().importMembers(req, res)
);

// Export members to CSV (requires auth)
router.get(
  '/organizations/:id/bulk/export',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  permissionOperationsRateLimiter,
  (req, res) => getOrganizationController().exportMembers(req, res)
);

// Get bulk operation stats (requires auth)
router.get(
  '/organizations/:id/bulk/stats',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getBulkStats(req, res)
);

// ==================== DISCORD INTEGRATION ROUTES ====================

// Connect Discord guild to organization
router.post(
  '/organizations/:id/discord/connect',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().connectDiscordGuild(req, res)
);

// Disconnect Discord guild from organization
router.delete(
  '/organizations/:id/discord/disconnect/:guildId',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getOrganizationController().disconnectDiscordGuild(req, res)
);

// Get Discord guilds for organization
router.get(
  '/organizations/:id/discord/guilds',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getOrganizationController().getDiscordGuilds(req, res)
);

// Legacy export for backwards compatibility
export function setOrganizationRoutes(app: Application) {
  app.use('/api/v2', router);
  app.use('/api', router);
}

// eslint-disable-next-line import/no-default-export
export default router;

/**
 * Route Summary:
 *
 * PUBLIC ROUTES (3):
 * - GET  /api/organizations - List organizations
 * - GET  /api/organizations/search - Search organizations
 * - GET  /api/organizations/:id - Get organization
 *
 * ORGANIZATION CRUD (4):
 * - POST   /api/organizations - Create organization
 * - PATCH  /api/organizations/:id - Update organization
 * - GET    /api/organizations/:id/deletion-preview - Get deletion preview
 * - DELETE /api/organizations/:id - Delete organization
 *
 * HIERARCHY (9):
 * - POST  /api/organizations/:id/sub-organizations - Create sub-org
 * - PATCH /api/organizations/:id/move - Move organization
 * - POST  /api/organizations/:id/detach - Detach from parent
 * - GET   /api/organizations/:id/tree - Get full tree
 * - GET   /api/organizations/:id/ancestors - Get ancestors
 * - GET   /api/organizations/:id/descendants - Get descendants
 * - GET   /api/organizations/:id/siblings - Get siblings
 * - GET   /api/organizations/:id/validate - Validate hierarchy
 * - GET   /api/organizations/:id/hierarchy/stats - Get hierarchy stats
 *
 * MEMBERS (4):
 * - POST   /api/organizations/:id/members - Add member
 * - DELETE /api/organizations/:id/members/:userId - Remove member
 * - PATCH  /api/organizations/:id/members/:userId/role - Update role
 * - POST   /api/organizations/:id/members/:userId/transfer - Transfer member
 *
 * PERMISSIONS (7):
 * - POST   /api/organizations/:id/permissions - Grant permission
 * - DELETE /api/organizations/:id/permissions/:permissionId - Revoke permission
 * - PATCH  /api/organizations/:id/permissions/:permissionId - Update permission
 * - GET    /api/organizations/:id/permissions - List permissions
 * - POST   /api/organizations/:id/permissions/check - Check permission
 * - POST   /api/organizations/:id/permissions/template - Apply template
 * - GET    /api/organizations/:id/permissions/stats - Get permission stats
 *
 * ACTIVITY LOGS (2):
 * - GET /api/organizations/:id/activity - Get activity log
 * - GET /api/organizations/:id/activity/stats - Get activity stats
 *
 * SETTINGS (1):
 * - PATCH /api/organizations/:id/settings - Update settings
 *
 * ANALYTICS (5):
 * - GET /api/organizations/:id/analytics/dashboard - Get analytics dashboard
 * - GET /api/organizations/:id/analytics/members - Get member statistics
 * - GET /api/organizations/:id/analytics/activity - Get activity metrics
 * - GET /api/organizations/:id/analytics/growth - Get growth trends
 * - GET /api/organizations/:id/analytics/export - Export analytics
 *
 * TEMPLATES (11):
 * - GET    /api/organizations/templates/marketplace - Search marketplace
 * - GET    /api/organizations/templates/popular - Get popular templates
 * - GET    /api/organizations/templates/top-rated - Get top rated templates
 * - POST   /api/organizations/templates/import - Import template
 * - POST   /api/organizations/templates - Create template
 * - GET    /api/organizations/templates - List templates
 * - GET    /api/organizations/templates/:id - Get template
 * - PUT    /api/organizations/templates/:id - Update template
 * - DELETE /api/organizations/templates/:id - Delete template
 * - POST   /api/organizations/templates/:id/apply - Apply template
 * - POST   /api/organizations/templates/:id/fork - Fork template
 * - POST   /api/organizations/templates/:id/rate - Rate template
 * - GET    /api/organizations/templates/:id/export - Export template
 *
 * BULK OPERATIONS (8):
 * - POST /api/organizations/:id/bulk/add-members - Bulk add members
 * - POST /api/organizations/:id/bulk/remove-members - Bulk remove members
 * - POST /api/organizations/:id/bulk/update-roles - Bulk update roles
 * - POST /api/organizations/:id/bulk/grant-permissions - Bulk grant permissions
 * - POST /api/organizations/:id/bulk/revoke-permissions - Bulk revoke permissions
 * - POST /api/organizations/:id/bulk/import - Import members from CSV
 * - GET  /api/organizations/:id/bulk/export - Export members to CSV
 * - GET  /api/organizations/:id/bulk/stats - Get bulk operation stats
 *
 * PREVIOUS TOTAL: 29 endpoints
 * NEW ENDPOINTS: 24 endpoints
 * GRAND TOTAL: 53 endpoints
 */
