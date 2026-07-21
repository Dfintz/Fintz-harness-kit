import { Router } from 'express';

import { PublicDirectoryController } from '../controllers/publicDirectoryController';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/authorization';
import {
  generalRateLimiter,
  organizationUpdateRateLimiter,
  publicEndpointRateLimiter,
} from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { paramSchemas, publicDirectorySchemas } from '../schemas';

const router = Router();

let publicDirectoryController: PublicDirectoryController;
const getPublicDirectoryController = () => {
  if (!publicDirectoryController) {
    publicDirectoryController = new PublicDirectoryController();
  }
  return publicDirectoryController;
};

/**
 * Public Directory Routes
 *
 * Provides endpoints for the public organization directory.
 * Most routes are public (no auth required) for browsing.
 */

// ==================== PUBLIC ROUTES (NO AUTH) ====================

/**
 * Get public organization directory
 * GET /api/directory
 * Supports filtering by focus, activity level, recruiting status, etc.
 */
router.get(
  '/directory',
  generalRateLimiter,
  validateSchema(publicDirectorySchemas.directoryQuery, 'query'),
  (req, res) => getPublicDirectoryController().getDirectory(req, res)
);

/**
 * Get directory statistics
 * GET /api/directory/stats
 * Returns aggregate stats about public organizations
 */
router.get('/directory/stats', publicEndpointRateLimiter, (req, res) =>
  getPublicDirectoryController().getDirectoryStats(req, res)
);

/**
 * Get available filter options
 * GET /api/directory/options
 * Returns valid values for filters (focus areas, activity levels)
 */
router.get('/directory/options', generalRateLimiter, (req, res) =>
  getPublicDirectoryController().getFilterOptions(req, res)
);

// ==================== PUBLIC FEDERATION ROUTES (NO AUTH) ====================

/**
 * Get public federations/alliances directory
 * GET /api/directory/federations
 * Phase 2: Supports advanced filtering with sort options
 */
router.get(
  '/directory/federations',
  generalRateLimiter,
  validateSchema(publicDirectorySchemas.federationQuery, 'query'),
  (req, res) => getPublicDirectoryController().getPublicFederations(req, res)
);

/**
 * Get public federation statistics
 * GET /api/directory/federations/stats
 * Returns aggregate stats about public federations
 */
router.get('/directory/federations/stats', publicEndpointRateLimiter, (req, res) =>
  getPublicDirectoryController().getPublicFederationStats(req, res)
);

/**
 * Get SEO metadata for a federation
 * GET /api/directory/federations/:federationId/seo
 * No authentication required
 */
router.get('/directory/federations/:federationId/seo', generalRateLimiter, (req, res) =>
  getPublicDirectoryController().getFederationSeoMeta(req, res)
);

/**
 * Get a specific public federation
 * GET /api/directory/federations/:federationId
 * Returns public federation if it has opted in
 */
router.get('/directory/federations/:federationId', generalRateLimiter, (req, res) =>
  getPublicDirectoryController().getPublicFederation(req, res)
);

/**
 * Get SEO metadata for directory homepage
 * GET /api/directory/seo
 * No authentication required
 */
router.get('/directory/seo', publicEndpointRateLimiter, (req, res) =>
  getPublicDirectoryController().getDirectorySeoMeta(req, res)
);

/**
 * Get SEO metadata for a specific organization
 * GET /api/directory/:organizationId/seo
 * No authentication required
 */
router.get('/directory/:organizationId/seo', generalRateLimiter, (req, res) =>
  getPublicDirectoryController().getOrganizationSeoMeta(req, res)
);

/**
 * Get a specific public organization profile
 * GET /api/directory/:identifier
 * Accepts either organization UUID or URL slug
 * Returns public profile if organization has opted in
 */
router.get(
  '/directory/:identifier',
  generalRateLimiter,
  validateSchema(paramSchemas.identifier, 'params'),
  (req, res) => getPublicDirectoryController().getPublicProfile(req, res)
);

/**
 * Get sitemap XML
 * GET /api/sitemap.xml
 * No authentication required
 */
router.get('/sitemap.xml', generalRateLimiter, (req, res) =>
  getPublicDirectoryController().getSitemap(req, res)
);

// ==================== AUTHENTICATED ROUTES ====================

/**
 * Get own organization's public profile (for editing)
 * GET /api/organizations/:id/public-profile
 */
router.get(
  '/organizations/:id/public-profile',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getPublicDirectoryController().getOwnProfile(req, res)
);

/**
 * Update organization's public profile
 * PATCH /api/organizations/:id/public-profile
 */
router.patch(
  '/organizations/:id/public-profile',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(publicDirectorySchemas.updateProfile, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicDirectoryController().updateOwnProfile(req, res)
);

/**
 * Sync public profile from RSI organization page
 * POST /api/organizations/:id/public-profile/sync-rsi
 */
router.post(
  '/organizations/:id/public-profile/sync-rsi',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicDirectoryController().syncFromRsi(req, res)
);

// ==================== ADMIN ROUTES ====================

/**
 * Set organization verification status
 * PATCH /api/admin/directory/:organizationId/verify
 */
router.patch(
  '/admin/directory/:organizationId/verify',
  authenticateToken,
  requireAdmin,
  validateSchema(publicDirectorySchemas.setVerification, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicDirectoryController().setVerificationStatus(req, res)
);

export { router };
// eslint-disable-next-line import/no-default-export
export default router;

/**
 * Route Summary:
 *
 * PUBLIC ORGANIZATION ROUTES (5):
 * - GET  /api/directory - List public organizations with filtering
 * - GET  /api/directory/stats - Get directory statistics
 * - GET  /api/directory/options - Get filter options
 * - GET  /api/directory/:organizationId - Get specific public profile
 * - GET  /api/directory/:organizationId/seo - Get organization SEO metadata
 *
 * PUBLIC FEDERATION ROUTES (4):
 * - GET  /api/directory/federations - List public federations/alliances
 * - GET  /api/directory/federations/stats - Get federation statistics
 * - GET  /api/directory/federations/:federationId - Get specific public federation
 * - GET  /api/directory/federations/:federationId/seo - Get federation SEO metadata
 *
 * SEO ROUTES (2):
 * - GET  /api/directory/seo - Get directory homepage SEO metadata
 * - GET  /api/sitemap.xml - Get XML sitemap
 *
 * AUTHENTICATED ROUTES (2):
 * - GET   /api/organizations/:id/public-profile - Get own profile for editing
 * - PATCH /api/organizations/:id/public-profile - Update own profile
 *
 * ADMIN ROUTES (1):
 * - PATCH /api/admin/directory/:organizationId/verify - Set verification status
 *
 * TOTAL: 14 endpoints (Phase 4: +4 SEO endpoints)
 */
