/**
 * Matchmaking Routes (API v2)
 *
 * Game session matchmaking endpoints supporting:
 * - Preference management for session matching
 * - Session discovery and matching
 * - Session joining and tracking
 * - Matchmaking analytics and statistics
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { matchmakingController } from '../../controllers/matchmakingController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { matchmakingQuerySchemas } from '../../schemas';
import { socialSchemas } from '../../schemas/socialSchemas';

const router = Router();

// Apply authentication to all matchmaking routes
router.use(authenticate);

// ==================== PREFERENCES ====================

/**
 * GET /api/v2/matchmaking/enums
 * Get enum values for matchmaking preferences
 * Returns: available game modes, difficulty levels, playstyles, etc.
 * Public reference data
 */
router.get('/enums', (req: Request, res: Response) => matchmakingController.getEnums(req, res));

/**
 * GET /api/v2/matchmaking/preferences
 * Get current user's matchmaking preferences
 * Returns: preferred game modes, difficulty, playstyles, etc.
 */
router.get('/preferences', (req: Request, res: Response) =>
  matchmakingController.getPreferences(req, res)
);

/**
 * POST /api/v2/matchmaking/preferences
 * Set or update matchmaking preferences
 * Request body: preference data (modes, difficulty, playstyle, etc.)
 * Returns: updated preferences
 */
router.post(
  '/preferences',
  validateSchema(socialSchemas.setPreferences, 'body'),
  (req: Request, res: Response) => matchmakingController.setPreferences(req, res)
);

// ==================== SESSION MATCHING ====================

/**
 * GET /api/v2/matchmaking/find
 * Find matching game sessions based on user preferences
 * Query parameters: mode, difficulty, playstyle filters
 * Returns: list of available sessions that match preferences
 */
router.get(
  '/find',
  validateSchema(matchmakingQuerySchemas.findMatchesQuery, 'query'),
  (req: Request, res: Response) => matchmakingController.findMatches(req, res)
);

/**
 * POST /api/v2/matchmaking/track
 * Track user joining a session
 * Request body: { sessionId, joinedAt?, etc. }
 * Records when user joins a session for analytics
 */
router.post(
  '/track',
  validateSchema(matchmakingQuerySchemas.joinSoloQueueBody, 'body'),
  (req: Request, res: Response) => matchmakingController.trackJoin(req, res)
);

// ==================== ANALYTICS ====================

/**
 * GET /api/v2/matchmaking/analytics
 * Get user's matchmaking analytics and statistics
 * Returns: session history, success rate, average playtime, etc.
 */
router.get('/analytics', (req: Request, res: Response) =>
  matchmakingController.getAnalytics(req, res)
);

export { router };
