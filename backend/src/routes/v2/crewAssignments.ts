/**
 * Crew Assignment Routes (API v2)
 *
 * Crew assignment management endpoints supporting:
 * - Crew assignment CRUD operations
 * - Crew member management within assignments
 * - Assignment status tracking
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { CrewAssignmentController } from '../../controllers/crewAssignmentController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { crewSchemas, paramSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let crewAssignmentController: CrewAssignmentController;
const getController = (): CrewAssignmentController => {
  if (!crewAssignmentController) {
    crewAssignmentController = new CrewAssignmentController();
  }
  return crewAssignmentController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== ASSIGNMENT CRUD ====================

/**
 * POST /api/v2/crew-assignments
 * Create a new crew assignment
 * Request body: assignment configuration data
 */
router.post(
  '/',
  ...orgAuth,
  validateSchema(crewSchemas.create, 'body'),
  (req: Request, res: Response) => getController().createAssignment(req, res)
);

/**
 * GET /api/v2/crew-assignments
 * Get all crew assignments
 * Returns: list of crew assignments
 */
router.get('/', ...orgAuth, (req: Request, res: Response) =>
  getController().getAssignments(req, res)
);

/**
 * GET /api/v2/crew-assignments/:id
 * Get a specific crew assignment by ID
 * Requires: valid UUID format
 */
router.get(
  '/:id',
  ...orgAuth,
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().getAssignmentById(req, res)
);

// ==================== CREW MEMBER MANAGEMENT ====================

/**
 * POST /api/v2/crew-assignments/:id/crew
 * Add a crew member to an assignment
 * Request body: crew member data
 * Requires: valid UUID for assignment ID
 */
router.post(
  '/:id/crew',
  ...orgAuth,
  validateSchema(crewSchemas.addMember, 'body'),
  (req: Request, res: Response) => getController().addCrewMember(req, res)
);

/**
 * DELETE /api/v2/crew-assignments/:id/crew/:userId
 * Remove a crew member from an assignment
 * Requires: valid UUIDs for assignment and user
 */
router.delete(
  '/:id/crew/:userId',
  ...orgAuth,
  validateSchema(crewSchemas.removeCrewParams, 'params'),
  (req: Request, res: Response) => getController().removeCrewMember(req, res)
);

// ==================== STATUS MANAGEMENT ====================

/**
 * PUT /api/v2/crew-assignments/:id/status
 * Update assignment status
 * Request body: status update data
 * Requires: valid UUID for assignment ID
 */
router.put(
  '/:id/status',
  ...orgAuth,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(crewSchemas.updateStatus, 'body'),
  (req: Request, res: Response) => getController().updateStatus(req, res)
);

export { router };
