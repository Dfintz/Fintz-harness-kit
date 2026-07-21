/**
 * Briefing Routes (API v2)
 *
 * Pre-mission briefing management endpoints supporting:
 * - Briefing creation and management
 * - Briefing element management
 * - Participant management
 * - Briefing versioning and status tracking
 *
 * All routes require authentication
 */

import { json } from 'body-parser';
import { Request, Response, Router } from 'express';

import { BriefingController } from '../../controllers/briefingController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { tenantContextMiddleware } from '../../middleware/tenantContext';
import { briefingSchemas, paramSchemas } from '../../schemas';

const router = Router();

// Apply authentication and tenant context to all briefing routes
router.use(authenticate);
router.use(tenantContextMiddleware);

// Lazy initialization to avoid EntityMetadataNotFoundError
let briefingController: BriefingController;
const getController = () => {
  if (!briefingController) {
    briefingController = new BriefingController();
  }
  return briefingController;
};

// ==================== BRIEFING CRUD ====================

/**
 * POST /api/v2/briefings
 * Create a new briefing
 * Request body: briefing creation data (title, mission info, etc.)
 */
router.post('/', validateSchema(briefingSchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createBriefing(req, res)
);

/**
 * GET /api/v2/briefings
 * Get all briefings
 * Query parameters: filters, sorting, pagination
 */
router.get('/', validateSchema(briefingSchemas.query, 'query'), (req: Request, res: Response) =>
  getController().getAllBriefings(req, res)
);

/**
 * GET /api/v2/briefings/mission/:missionId
 * Get all briefings for a specific mission
 * Requires: valid UUID for mission ID
 * Note: Must be defined before /:id to avoid path conflict
 */
router.get('/mission/:missionId', (req: Request, res: Response) =>
  getController().getBriefingsByMission(req, res)
);

/**
 * GET /api/v2/briefings/:id
 * Get a specific briefing by ID
 * Requires: valid UUID format
 */
router.get('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().getBriefing(req, res)
);

/**
 * PUT /api/v2/briefings/:id
 * Update a briefing
 * Request body: briefing update data
 * Requires: valid UUID for briefing ID
 */
router.put(
  '/:id',
  json({ limit: '12mb' }),
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(briefingSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateBriefing(req, res)
);

/**
 * DELETE /api/v2/briefings/:id
 * Delete a briefing
 * Requires: valid UUID for briefing ID
 */
router.delete('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().deleteBriefing(req, res)
);

// ==================== BRIEFING ELEMENTS ====================

/**
 * POST /api/v2/briefings/:id/elements
 * Add an element to a briefing (objectives, waypoints, tactics, etc.)
 * Request body: element data
 * Requires: valid UUID for briefing ID
 */
router.post(
  '/:id/elements',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(briefingSchemas.addElement, 'body'),
  (req: Request, res: Response) => getController().addElement(req, res)
);

/**
 * PUT /api/v2/briefings/:id/elements/:elementId
 * Update a briefing element
 * Request body: element update data
 * Requires: valid UUIDs for briefing and element
 */
router.put(
  '/:id/elements/:elementId',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(briefingSchemas.updateElement, 'body'),
  (req: Request, res: Response) => getController().updateElement(req, res)
);

/**
 * DELETE /api/v2/briefings/:id/elements/:elementId
 * Remove an element from a briefing
 * Requires: valid UUIDs for briefing and element
 */
router.delete(
  '/:id/elements/:elementId',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().deleteElement(req, res)
);

// ==================== PARTICIPANT MANAGEMENT ====================

/**
 * POST /api/v2/briefings/:id/participants
 * Add a participant to a briefing
 * Request body: participant data (user ID, role, etc.)
 * Requires: valid UUID for briefing ID
 */
router.post(
  '/:id/participants',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(briefingSchemas.addParticipant, 'body'),
  (req: Request, res: Response) => getController().addParticipant(req, res)
);

/**
 * DELETE /api/v2/briefings/:id/participants
 * Remove a participant from a briefing
 * Requires: valid UUID for briefing ID
 */
router.delete(
  '/:id/participants',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().removeParticipant(req, res)
);

// ==================== BRIEFING STATUS & VERSIONING ====================

/**
 * PUT /api/v2/briefings/:id/status
 * Update briefing status (draft, approved, active, completed, archived)
 * Request body: { status: string, reason?: string }
 * Requires: valid UUID for briefing ID
 */
router.put(
  '/:id/status',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(briefingSchemas.updateStatus, 'body'),
  (req: Request, res: Response) => getController().updateStatus(req, res)
);

/**
 * POST /api/v2/briefings/:id/version
 * Create a new version of a briefing
 * Preserves history and allows rollback
 * Requires: valid UUID for briefing ID
 */
router.post(
  '/:id/version',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().createVersion(req, res)
);

export { router };
