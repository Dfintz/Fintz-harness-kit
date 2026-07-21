/**
 * Mining Operations Routes (API v2)
 *
 * Mining operation management endpoints supporting:
 * - Mining operation CRUD operations
 * - Crew member management
 * - Resource tracking and recording
 * - Operation status management
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { MiningOperationController } from '../../controllers/miningOperationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { miningSchemas, paramSchemas } from '../../schemas';

const router = Router();

// Apply authentication to all mining operation routes
router.use(authenticate);

// Lazy initialization to avoid EntityMetadataNotFoundError
let miningOperationController: MiningOperationController;
const getController = () => {
  if (!miningOperationController) {
    miningOperationController = new MiningOperationController();
  }
  return miningOperationController;
};

// ==================== MINING OPERATIONS CRUD ====================

/**
 * POST /api/v2/mining-operations
 * Create a new mining operation
 * Request body: mining operation creation data
 * Requires schema validation
 */
router.post(
  '/',
  validateSchema(miningSchemas.createOperation, 'body'),
  (req: Request, res: Response) => getController().createMiningOperation(req, res)
);

/**
 * GET /api/v2/mining-operations
 * Get all mining operations for the authenticated user
 * Returns: paginated list of mining operations
 */
router.get('/', (req: Request, res: Response) => getController().getMiningOperations(req, res));

/**
 * GET /api/v2/mining-operations/regolith/:location
 * Get regolith mining data summary for a location
 */
router.get('/regolith/:location', (req: Request, res: Response) =>
  getController().getRegolithSummary(req, res)
);

/**
 * GET /api/v2/mining-operations/:id
 * Get a specific mining operation by ID
 * Requires: valid UUID format
 */
router.get('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().getMiningOperationById(req, res)
);

/**
 * PUT /api/v2/mining-operations/:id
 * Update a mining operation
 * Request body: updated fields
 */
router.put(
  '/:id',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(miningSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateMiningOperation(req, res)
);

/**
 * DELETE /api/v2/mining-operations/:id
 * Delete a mining operation
 */
router.delete('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().deleteMiningOperation(req, res)
);

// ==================== CREW MANAGEMENT ====================

/**
 * POST /api/v2/mining-operations/:id/crew
 * Add a crew member to a mining operation
 * Request body: crew member data (user ID, role, etc.)
 * Requires: valid UUID for operation ID and crew validation
 */
router.post(
  '/:id/crew',
  validateSchema(miningSchemas.addCrewMember, 'body'),
  (req: Request, res: Response) => getController().addCrewMember(req, res)
);

// ==================== RESOURCE TRACKING ====================

/**
 * POST /api/v2/mining-operations/:id/resources
 * Record resources collected in a mining operation
 * Request body: resource amounts and types collected
 * Requires: valid UUID and resource data validation
 */
router.post(
  '/:id/resources',
  validateSchema(miningSchemas.updateResources, 'body'),
  (req: Request, res: Response) => getController().recordResources(req, res)
);

// ==================== STATUS MANAGEMENT ====================

/**
 * PUT /api/v2/mining-operations/:id/status
 * Update the status of a mining operation
 * Request body: { status: string, reason?: string }
 * Requires: valid UUID and status update validation
 */
router.put(
  '/:id/status',
  validateSchema(miningSchemas.updateStatus, 'body'),
  (req: Request, res: Response) => getController().updateStatus(req, res)
);

export { router };
