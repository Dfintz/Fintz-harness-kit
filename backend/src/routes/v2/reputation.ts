/**
 * Reputation Routes (API v2)
 *
 * User reputation management endpoints supporting:
 * - User reputation scores and rankings
 * - Reputation updates and tracking
 * - Top reputation leaderboards
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { ReputationController } from '../../controllers/reputationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { paramSchemas, reputationSchemas } from '../../schemas';

const router = Router();

// Apply authentication to all reputation routes
router.use(authenticate);

// Lazy initialization to avoid EntityMetadataNotFoundError
let reputationController: ReputationController;
const getController = () => {
  if (!reputationController) {
    reputationController = new ReputationController();
  }
  return reputationController;
};

/**
 * GET /api/v2/reputation/fleet/:fleetId
 * Get aggregated fleet reputation score (F-2)
 * Query: organizationId (required)
 */
router.get('/fleet/:fleetId', (req: Request, res: Response) =>
  getController().getFleetReputation(req, res)
);

/**
 * GET /api/v2/reputation/:userId/unified
 * Get unified/combined trust score aggregating LFG, Trade, Activity, and Job reputations
 * Requires: valid UUID for user ID
 * Optional query: organizationId
 */
router.get(
  '/:userId/unified',
  validateSchema(paramSchemas.userId, 'params'),
  (req: Request, res: Response) => getController().getUnifiedReputation(req, res)
);

/**
 * GET /api/v2/reputation/:userId
 * Get reputation score and details for a specific user
 * Requires: valid UUID for user ID
 */
router.get(
  '/:userId',
  validateSchema(paramSchemas.userId, 'params'),
  (req: Request, res: Response) => getController().getUserReputation(req, res)
);

/**
 * PUT /api/v2/reputation/:userId
 * Update user reputation score
 * Request body: reputation update data
 */
router.put(
  '/:userId',
  validateSchema(reputationSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateReputation(req, res)
);

/**
 * GET /api/v2/reputation/top
 * Get top reputation users (leaderboard)
 * Query parameters: limit, offset, period
 */
router.get('/top', (req: Request, res: Response) => getController().getTopReputation(req, res));

export { router };
