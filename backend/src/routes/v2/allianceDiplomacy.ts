/**
 * Alliance Diplomacy Routes (API v2)
 *
 * Alliance diplomacy management endpoints supporting:
 * - Diplomacy relationship proposals and management
 * - Incident reporting and resolution
 * - Diplomatic status updates
 *
 * All routes require authentication
 */

import { Response, Router } from 'express';

import { AllianceDiplomacyController } from '../../controllers/allianceDiplomacyController';
import { AuthRequest } from '../../middleware/auth';
import { botOrUserAuth } from '../../middleware/botOrUserAuth';
import { validateSchema } from '../../middleware/schemaValidation';
import { diplomacySchemas, paramSchemas } from '../../schemas';

const router = Router();

// Routes accept either a JWT-authenticated user request or a Discord-bot
// internal call (BOT_INTERNAL_SECRET + X-Discord-Guild-Id). See botOrUserAuth.
const orgAuth = [botOrUserAuth];

// Lazy initialization to avoid EntityMetadataNotFoundError
let allianceDiplomacyController: AllianceDiplomacyController;
const getController = (): AllianceDiplomacyController => {
  if (!allianceDiplomacyController) {
    allianceDiplomacyController = new AllianceDiplomacyController();
  }
  return allianceDiplomacyController;
};

// ==================== DIPLOMACY RELATIONS ====================

/**
 * POST /api/v2/alliance-diplomacy
 * Propose a new diplomacy relationship
 * Request body: diplomacy proposal data
 */
router.post(
  '/',
  ...orgAuth,
  validateSchema(diplomacySchemas.proposal, 'body'),
  (req: AuthRequest, res: Response) => getController().proposeDiplomacy(req, res)
);

/**
 * GET /api/v2/alliance-diplomacy
 * Get all diplomacy relations
 * Returns: list of diplomacy relationships
 */
router.get('/', ...orgAuth, (req: AuthRequest, res: Response) =>
  getController().getDiplomacyRelations(req, res)
);

/**
 * GET /api/v2/alliance-diplomacy/:id
 * Get specific diplomacy relation by ID
 * Requires: valid UUID format
 */
router.get(
  '/:id',
  ...orgAuth,
  validateSchema(paramSchemas.id, 'params'),
  (req: AuthRequest, res: Response) => getController().getDiplomacyById(req, res)
);

// ==================== DIPLOMACY LIFECYCLE ====================

/**
 * POST /api/v2/alliance-diplomacy/:id/approve
 * Approve a proposed diplomacy relationship
 * Requires: valid UUID for relation ID
 */
router.post(
  '/:id/approve',
  ...orgAuth,
  validateSchema(paramSchemas.id, 'params'),
  (req: AuthRequest, res: Response) => getController().approveDiplomacy(req, res)
);

/**
 * POST /api/v2/alliance-diplomacy/:id/suspend
 * Suspend an active diplomacy relationship
 * Requires: valid UUID for relation ID
 */
router.post(
  '/:id/suspend',
  ...orgAuth,
  validateSchema(paramSchemas.id, 'params'),
  (req: AuthRequest, res: Response) => getController().suspendDiplomacy(req, res)
);

/**
 * POST /api/v2/alliance-diplomacy/:id/terminate
 * Terminate a diplomacy relationship
 * Requires: valid UUID for relation ID
 */
router.post(
  '/:id/terminate',
  ...orgAuth,
  validateSchema(paramSchemas.id, 'params'),
  (req: AuthRequest, res: Response) => getController().terminateDiplomacy(req, res)
);

// ==================== INCIDENT MANAGEMENT ====================

/**
 * POST /api/v2/alliance-diplomacy/:id/incidents
 * Report an incident in a diplomacy relationship
 * Request body: incident data (details, severity, etc.)
 */
router.post(
  '/:id/incidents',
  ...orgAuth,
  validateSchema(diplomacySchemas.incident, 'body'),
  (req: AuthRequest, res: Response) => getController().reportIncident(req, res)
);

/**
 * PUT /api/v2/alliance-diplomacy/:id/incidents/:incidentId/resolve
 * Resolve a reported incident
 * Request body: resolution data
 */
router.put(
  '/:id/incidents/:incidentId/resolve',
  ...orgAuth,
  validateSchema(diplomacySchemas.resolution, 'body'),
  (req: AuthRequest, res: Response) => getController().resolveIncident(req, res)
);

export { router };
