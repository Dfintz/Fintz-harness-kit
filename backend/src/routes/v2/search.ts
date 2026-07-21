import { Request, Response, Router } from 'express';
import Joi from 'joi';

import { globalSearchController } from '../../controllers/globalSearchController';
import { opportunitySearchController } from '../../controllers/opportunitySearchController';
import { ActivityControllerV2 } from '../../controllers/v2/activityController';
import { generalRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { globalSearchSchemas } from '../../schemas/globalSearchSchemas';
import { opportunitySearchSchemas } from '../../schemas/opportunitySearchSchemas';

const router = Router();

// ==================== SEARCH & DISCOVERY ====================

/**
 * GET /api/v2/search/opportunities
 * Unified search across jobs and activities
 * Sprint 19-G: Unified Opportunity Pool
 */
router.get(
  '/opportunities',
  generalRateLimiter,
  validateSchema(opportunitySearchSchemas.searchQuery, 'query'),
  (req: Request, res: Response) => opportunitySearchController.searchOpportunities(req, res)
);

/**
 * GET /api/v2/search/activities/:id
 * Public activity detail — only returns activities with visibility: 'public'
 */
const activityController = new ActivityControllerV2();
router.get(
  '/activities/:id',
  generalRateLimiter,
  validateSchema(Joi.object({ id: Joi.string().uuid().required() }), 'params'),
  (req: Request, res: Response) => activityController.getPublicActivityById(req, res)
);

/**
 * GET /api/v2/search/global
 * Global search across organizations, federations, and users
 */
router.get(
  '/global',
  generalRateLimiter,
  validateSchema(globalSearchSchemas.searchQuery, 'query'),
  (req: Request, res: Response) => globalSearchController.search(req, res)
);

/**
 * GET /api/v2/search/users
 * Search for users
 * Query: q, limit, offset
 */
router.get('/users', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * GET /api/v2/search/organizations
 * Search for organizations
 * Query: q, limit, offset
 */
router.get('/organizations', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * GET /api/v2/search/fleets
 * Search for fleets
 * Query: q, limit, offset
 */
router.get('/fleets', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * GET /api/v2/search/activities
 * Search for activities
 * Query: q, type, limit, offset
 */
router.get('/activities', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * GET /api/v2/search/suggestions
 * Get search suggestions
 * Query: q
 */
router.get('/suggestions', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * GET /api/v2/search/trending
 * Get trending entities
 * Query: type, period
 */
router.get('/trending', (req: Request, res: Response) => {
  res.success([]);
});

export { router };
