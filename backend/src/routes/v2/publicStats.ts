/**
 * Public Stats Routes (v2)
 *
 * Public endpoints that do not require authentication.
 * Rate-limited to prevent abuse.
 */

import { Router } from 'express';

import { PublicStatsController } from '../../controllers/v2/publicStatsController';
import { generalRateLimiter } from '../../middleware/rateLimiting';

const router = Router();
const controller = new PublicStatsController();

// GET /api/v2/public/stats — Platform-wide statistics for landing page
router.get('/public/stats', generalRateLimiter, (req, res) => controller.getPublicStats(req, res));

export { router };
