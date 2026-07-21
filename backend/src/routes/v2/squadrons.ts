/**
 * Squadron Routes (API v2)
 *
 * User group/squadron management endpoints supporting:
 * - Squadron member roster management
 * - Membership operations (add, remove, bulk operations)
 * - Role management within squads
 * - Squadron analytics and statistics
 *
 * All routes require authentication and organization context
 */

import { Request, Response, Router } from 'express';

import { SquadronController } from '../../controllers/squadronController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { paramSchemas, squadronSchemas } from '../../schemas';

const router = Router();

// Apply authentication middleware
router.use(authenticate);
router.use(tenantContextMiddleware);
router.use(requireTenantContext);

// Lazy initialization to avoid EntityMetadataNotFoundError
let squadronController: SquadronController;
const getController = () => {
  if (!squadronController) {
    squadronController = new SquadronController();
  }
  return squadronController;
};

// ==================== SQUADRON ROSTER QUERIES ====================

/**
 * GET /api/v2/squadrons/:squadronId/members
 * Get members of a specific squadron
 * Query parameters: filters, sorting, pagination
 */
router.get(
  '/:squadronId/members',
  validateSchema(paramSchemas.squadronId, 'params'),
  validateSchema(squadronSchemas.query, 'query'),
  (req: Request, res: Response) => getController().getSquadronMembers(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/roster
 * Get complete squadron roster with detailed member info
 * Query parameters: filters, sorting, pagination
 */
router.get(
  '/:squadronId/roster',
  validateSchema(paramSchemas.squadronId, 'params'),
  validateSchema(squadronSchemas.query, 'query'),
  (req: Request, res: Response) => getController().getSquadronRoster(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/members/:memberId
 * Get a specific squadron member by ID
 * Requires: valid UUIDs for squadron and member
 */
router.get(
  '/:squadronId/members/:memberId',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getSquadronMemberById(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/members/:userId/check
 * Check if user is a member of a squadron
 * Returns: boolean status
 */
router.get(
  '/:squadronId/members/:userId/check',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().checkMembership(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/members/:userId
 * Get membership details for a specific user in a squadron
 * Requires: valid UUIDs for squadron and user
 */
router.get(
  '/:squadronId/members/:userId',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getMembership(req, res)
);

/**
 * GET /api/v2/users/:userId/squadrons
 * Get all squadrons that a user is a member of
 * Requires: valid UUID for user ID
 */
router.get(
  '/users/:userId/squadrons',
  validateSchema(paramSchemas.userId, 'params'),
  (req: Request, res: Response) => getController().getUserSquadrons(req, res)
);

// ==================== MEMBERSHIP MANAGEMENT ====================

/**
 * POST /api/v2/squadrons/:squadronId/members
 * Add a single member to a squadron
 * Request body: { userId, role, joinDate? }
 */
router.post(
  '/:squadronId/members',
  validateSchema(paramSchemas.squadronId, 'params'),
  validateSchema(squadronSchemas.singleMember, 'body'),
  (req: Request, res: Response) => getController().addMember(req, res)
);

/**
 * POST /api/v2/squadrons/:squadronId/members/bulk
 * Add multiple members to a squadron at once
 * Request body: array of member data
 */
router.post(
  '/:squadronId/members/bulk',
  validateSchema(paramSchemas.squadronId, 'params'),
  validateSchema(squadronSchemas.bulkAddMembers, 'body'),
  (req: Request, res: Response) => getController().bulkAddMembers(req, res)
);

/**
 * PATCH /api/v2/squadrons/members/:userId/role
 * Update a member's role within a squadron
 * Request body: { role: string }
 */
router.patch(
  '/:squadronId/members/:userId/role',
  validateSchema(paramSchemas.squadronId, 'params'),
  validateSchema(squadronSchemas.updateRole, 'body'),
  (req: Request, res: Response) => getController().updateRole(req, res)
);

/**
 * DELETE /api/v2/squadrons/:squadronId/members/:userId
 * Remove a member from a squadron
 * Requires: valid UUIDs for squadron and user
 */
router.delete(
  '/:squadronId/members/:userId',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().removeMember(req, res)
);

// ==================== BULK OPERATIONS ====================

/**
 * PATCH /api/v2/squadrons/members/bulk
 * Update multiple members at once
 * Request body: array of member updates
 */
router.patch(
  '/members/bulk',
  validateSchema(squadronSchemas.bulkUpdateMembers, 'body'),
  (req: Request, res: Response) => getController().bulkUpdateMembers(req, res)
);

/**
 * DELETE /api/v2/squadrons/members/bulk
 * Delete multiple members at once
 * Request body: array of member IDs to delete
 */
router.delete(
  '/members/bulk',
  validateSchema(squadronSchemas.bulkDeleteMembers, 'body'),
  (req: Request, res: Response) => getController().bulkDeleteMembers(req, res)
);

/**
 * PATCH /api/v2/squadrons/members/bulk/status
 * Update status for multiple members at once
 * Request body: array of { memberId, status }
 */
router.patch(
  '/members/bulk/status',
  validateSchema(squadronSchemas.bulkUpdateStatus, 'body'),
  (req: Request, res: Response) => getController().bulkUpdateStatus(req, res)
);

// ==================== ANALYTICS & STATISTICS ====================

/**
 * GET /api/v2/squadrons/:squadronId/count
 * Get total member count for a squadron
 * Requires: valid UUID for squadron ID
 */
router.get(
  '/:squadronId/count',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getSquadronMemberCount(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/count/active
 * Get count of active members in a squadron
 * Requires: valid UUID for squadron ID
 */
router.get(
  '/:squadronId/count/active',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getActiveCount(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/stats/roles
 * Get member statistics by role
 * Returns: breakdown of members by role
 */
router.get(
  '/:squadronId/stats/roles',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getMembersByRole(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/stats/ships
 * Get member statistics by ship type
 * Returns: breakdown of members by ship type
 */
router.get(
  '/:squadronId/stats/ships',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getMembersByShipType(req, res)
);

/**
 * GET /api/v2/squadrons/:squadronId/stats
 * Get comprehensive squadron statistics
 * Returns: detailed stats (members, activity, trends, etc.)
 */
router.get(
  '/:squadronId/stats',
  validateSchema(paramSchemas.squadronId, 'params'),
  (req: Request, res: Response) => getController().getSquadronStatistics(req, res)
);

/**
 * GET /api/v2/users/:userId/squadrons/count
 * Get the number of squadrons a user belongs to
 * Requires: valid UUID for user ID
 */
router.get(
  '/users/:userId/squadrons/count',
  validateSchema(paramSchemas.userId, 'params'),
  (req: Request, res: Response) => getController().getUserSquadronCount(req, res)
);

export { router };
