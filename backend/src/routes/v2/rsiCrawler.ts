import { Router } from 'express';

import { rsiCrawlerController } from '../../controllers/rsiCrawlerController';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/authorization';
import { validateSchema } from '../../middleware/schemaValidation';
import {
  getOrganizationMembersSchema,
  getOrganizationSchema,
  listOrganizationsSchema,
  orgSidSchema,
  refreshOrganizationSchema,
  userHandleSchema,
} from '../../schemas/rsiCrawlerSchemas';

const router = Router();

/**
 * @route GET /api/v2/rsi-crawler/organizations
 * @desc List all crawled organizations
 * @access Public
 */
router.get(
  '/organizations',
  validateSchema(listOrganizationsSchema, 'query'),
  rsiCrawlerController.listOrganizations
);

/**
 * @route GET /api/v2/rsi-crawler/organizations/:sid
 * @desc Get specific organization details
 * @access Public
 */
router.get(
  '/organizations/:sid',
  validateSchema(orgSidSchema, 'params'),
  validateSchema(getOrganizationSchema, 'query'),
  rsiCrawlerController.getOrganization
);

/**
 * @route GET /api/v2/rsi-crawler/organizations/:sid/members
 * @desc Get organization members
 * @access Public
 */
router.get(
  '/organizations/:sid/members',
  validateSchema(orgSidSchema, 'params'),
  validateSchema(getOrganizationMembersSchema, 'query'),
  rsiCrawlerController.getOrganizationMembers
);

/**
 * @route GET /api/v2/rsi-crawler/organizations/:sid/member-count-history
 * @desc Get member count change history for graphing
 * @access Public
 */
router.get(
  '/organizations/:sid/member-count-history',
  validateSchema(orgSidSchema, 'params'),
  rsiCrawlerController.getMemberCountHistory
);

/**
 * @route POST /api/v2/rsi-crawler/organizations/:sid/refresh
 * @desc Trigger a fresh crawl of organization data
 * @access Authenticated
 */
router.post(
  '/organizations/:sid/refresh',
  authenticate,
  validateSchema(orgSidSchema, 'params'),
  validateSchema(refreshOrganizationSchema, 'body'),
  rsiCrawlerController.refreshOrganization
);

/**
 * @route DELETE /api/v2/rsi-crawler/organizations/:sid
 * @desc Delete cached organization data
 * @access Authenticated
 */
router.delete(
  '/organizations/:sid',
  authenticate,
  requireAdmin,
  validateSchema(orgSidSchema, 'params'),
  rsiCrawlerController.deleteOrganization
);

/**
 * @route GET /api/v2/rsi-crawler/users/:handle/memberships
 * @desc Get user's organization memberships
 * @access Public
 */
router.get(
  '/users/:handle/memberships',
  validateSchema(userHandleSchema, 'params'),
  rsiCrawlerController.getUserMemberships
);

/**
 * @route GET /api/v2/rsi-crawler/stats
 * @desc Get crawler statistics
 * @access Public
 */
router.get('/stats', rsiCrawlerController.getStatistics);

/**
 * @route POST /api/v2/rsi-crawler/clear-cache
 * @desc Clear all in-memory cache
 * @access Authenticated
 */
router.post('/clear-cache', authenticate, requireAdmin, rsiCrawlerController.clearCache);

export { router };
