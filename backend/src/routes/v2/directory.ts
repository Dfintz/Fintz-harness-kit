/**
 * API v2 - Directory Routes
 * Public directory endpoints for organizations and federations
 * All routes are public (no authentication required)
 */

import { Router } from 'express';

import { DirectoryControllerV2 } from '../../controllers/v2/directoryController';
import { generalRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { directoryV2QuerySchemas, paramSchemas } from '../../schemas';

const router = Router();
const controller = new DirectoryControllerV2();

// ==================== PUBLIC ORGANIZATION ROUTES ====================

/**
 * GET /api/v2/directory/organizations
 * List public organizations with filtering and pagination
 * Query params:
 *   - page (number): Page number (default: 1)
 *   - limit (number): Items per page (default: 20, max: 100)
 *   - sortBy (string): Sort field (memberCount, createdAt, updatedAt, activityLevel)
 *   - sortOrder (string): ASC or DESC
 *   - primaryFocus (string): Filter by primary focus
 *   - primaryFocuses (string): Comma-separated focus areas
 *   - activityLevel (string): Filter by activity level
 *   - activityLevels (string): Comma-separated activity levels
 *   - isRecruiting (boolean): Filter by recruiting status
 *   - isVerified (boolean): Filter by verification status
 *   - minMemberCount (number): Minimum member count
 *   - maxMemberCount (number): Maximum member count
 *   - languages (string): Comma-separated language codes
 *   - timezone (string): Timezone filter
 *   - search (string): Search term
 */
router.get(
  '/directory/organizations',
  validateSchema(directoryV2QuerySchemas.listOrganizationsQuery, 'query'),
  generalRateLimiter,
  controller.listOrganizations.bind(controller)
);

/**
 * GET /api/v2/directory/organizations/stats
 * Get directory statistics
 */
router.get(
  '/directory/organizations/stats',
  validateSchema(directoryV2QuerySchemas.statsQuery, 'query'),
  generalRateLimiter,
  controller.getOrganizationStats.bind(controller)
);

/**
 * GET /api/v2/directory/organizations/:organizationId
 * Get a specific public organization profile
 */
router.get(
  '/directory/organizations/:organizationId',
  validateSchema(directoryV2QuerySchemas.organizationIdParam, 'params'),
  generalRateLimiter,
  controller.getOrganization.bind(controller)
);

/**
 * GET /api/v2/directory/organizations/:organizationId/federations
 * Get public federations that the organization belongs to
 */
router.get(
  '/directory/organizations/:organizationId/federations',
  validateSchema(directoryV2QuerySchemas.organizationIdParam, 'params'),
  generalRateLimiter,
  controller.getOrganizationFederations.bind(controller)
);

/**
 * GET /api/v2/directory/organizations/:organizationId/seo
 * Get SEO metadata for a specific organization
 */
router.get(
  '/directory/organizations/:organizationId/seo',
  validateSchema(directoryV2QuerySchemas.organizationIdParam, 'params'),
  validateSchema(directoryV2QuerySchemas.seoMetaQuery, 'query'),
  generalRateLimiter,
  controller.getOrganizationSeoMeta.bind(controller)
);

// ==================== PUBLIC FEDERATION ROUTES ====================

/**
 * GET /api/v2/directory/federations
 * List public federations/alliances with filtering and pagination
 * Query params:
 *   - page (number): Page number (default: 1)
 *   - limit (number): Items per page (default: 20, max: 100)
 *   - sortBy (string): Sort field (memberCount, createdAt, name)
 *   - sortOrder (string): ASC or DESC
 *   - name (string): Filter by name (partial match)
 *   - tags (string): Comma-separated tags
 *   - minMembers (number): Minimum member count
 *   - maxMembers (number): Maximum member count
 */
router.get(
  '/directory/federations',
  validateSchema(directoryV2QuerySchemas.listFederationsQuery, 'query'),
  generalRateLimiter,
  controller.listFederations.bind(controller)
);

/**
 * GET /api/v2/directory/federations/stats
 * Get public federation statistics
 */
router.get(
  '/directory/federations/stats',
  validateSchema(directoryV2QuerySchemas.federationStatsQuery, 'query'),
  generalRateLimiter,
  controller.getFederationStats.bind(controller)
);

/**
 * GET /api/v2/directory/federations/:federationId
 * Get a specific public federation
 */
router.get(
  '/directory/federations/:federationId',
  validateSchema(paramSchemas.federationId, 'params'),
  generalRateLimiter,
  controller.getFederation.bind(controller)
);

/**
 * GET /api/v2/directory/federations/:federationId/seo
 * Get SEO metadata for a federation
 */
router.get(
  '/directory/federations/:federationId/seo',
  validateSchema(paramSchemas.federationId, 'params'),
  validateSchema(directoryV2QuerySchemas.seoMetaQuery, 'query'),
  generalRateLimiter,
  controller.getFederationSeoMeta.bind(controller)
);

// ==================== SEO ROUTES ====================

/**
 * GET /api/v2/directory/seo
 * Get SEO metadata for directory homepage
 */
router.get(
  '/directory/seo',
  validateSchema(directoryV2QuerySchemas.seoMetaQuery, 'query'),
  generalRateLimiter,
  controller.getDirectorySeoMeta.bind(controller)
);

/**
 * GET /api/v2/directory/seo/html
 * Render crawler-targeted HTML with route-specific SEO metadata.
 */
router.get(
  '/directory/seo/html',
  validateSchema(directoryV2QuerySchemas.seoHtmlQuery, 'query'),
  generalRateLimiter,
  controller.renderSeoHtml.bind(controller)
);

/**
 * GET /api/v2/sitemap.xml
 * Return XML sitemap for public routes.
 */
router.get('/sitemap.xml', generalRateLimiter, controller.getSitemap.bind(controller));

export { router };
// eslint-disable-next-line import/no-default-export
export default router;
