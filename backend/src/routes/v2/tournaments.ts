/**
 * Tournaments Routes (API v2)
 *
 * Tournament management endpoints supporting:
 * - Tournament CRUD operations
 * - Participant registration and management
 * - Tournament lifecycle management (start, progress, completion)
 * - Match management and results
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { TournamentController } from '../../controllers/tournamentController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { paramSchemas, tournamentSchemas } from '../../schemas';

const router = Router();

// Apply authentication to all tournament routes
router.use(authenticate);

// Lazy initialization to avoid EntityMetadataNotFoundError
let tournamentController: TournamentController;
const getController = () => {
  if (!tournamentController) {
    tournamentController = new TournamentController();
  }
  return tournamentController;
};

// ==================== TOURNAMENT CRUD ====================

/**
 * POST /api/v2/tournaments
 * Create a new tournament
 * Request body: tournament creation data (name, description, rules, etc.)
 * Requires schema validation
 */
router.post('/', validateSchema(tournamentSchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createTournament(req, res)
);

/**
 * GET /api/v2/tournaments
 * Get all tournaments
 * Returns: list of tournaments with basic info
 * Can include filters for status, date range, etc.
 */
router.get('/', (req: Request, res: Response) => getController().getTournaments(req, res));

/**
 * GET /api/v2/tournaments/:id
 * Get a specific tournament by ID
 * Returns: detailed tournament info including bracket, matches, participants
 * Requires: valid UUID format
 */
router.get('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().getTournamentById(req, res)
);

// ==================== PARTICIPANT MANAGEMENT ====================

/**
 * POST /api/v2/tournaments/:id/register
 * Register a participant/team in a tournament
 * Request body: participant registration data
 * Requires: valid UUID for tournament ID and registration validation
 */
router.post(
  '/:id/register',
  validateSchema(tournamentSchemas.register, 'body'),
  (req: Request, res: Response) => getController().registerParticipant(req, res)
);

// ==================== TOURNAMENT LIFECYCLE ====================

/**
 * POST /api/v2/tournaments/:id/start
 * Start a tournament (generate bracket, begin matches)
 * Changes tournament status from "scheduled" to "in_progress"
 * Requires: valid UUID and tournament must be ready to start
 */
router.post(
  '/:id/start',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().startTournament(req, res)
);

// ==================== MATCH MANAGEMENT ====================

/**
 * PUT /api/v2/tournaments/:id/matches/:matchId
 * Update a match result/status
 * Request body: match result data (winner, scores, etc.)
 * Requires: valid UUIDs for both tournament and match
 */
router.put(
  '/:id/matches/:matchId',
  validateSchema(tournamentSchemas.updateMatch, 'body'),
  (req: Request, res: Response) => getController().updateMatch(req, res)
);

export { router };
