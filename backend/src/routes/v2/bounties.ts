/**
 * Bounty Routes (API v2)
 *
 * Bounty management endpoints supporting:
 * - Bounty creation and management
 * - Claim submission and evidence tracking
 * - Public bounty browsing
 * - Organization-scoped operations
 *
 * Routes may require authentication and/or organization context
 */

import { Request, Response, Router } from 'express';

import { BountyController } from '../../controllers/bountyController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { paramSchemas } from '../../schemas';
import { bountySchemas, claimSchemas, evidenceSchemas } from '../../schemas/bountySchemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let bountyController: BountyController;
const getController = () => {
  if (!bountyController) {
    bountyController = new BountyController();
  }
  return bountyController;
};

// ==================== PUBLIC BOUNTY OPERATIONS ====================

/**
 * GET /api/v2/bounties/public
 * List public bounties without authentication
 * Query parameters: filters for status, type, reward range, etc.
 */
router.get('/public', validateSchema(bountySchemas.query, 'query'), (req: Request, res: Response) =>
  getController().listBounties(req, res)
);

/**
 * GET /api/v2/bounties/public/:id
 * Get a specific public bounty without authentication
 * Requires: valid UUID format
 */
router.get(
  '/public/:id',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().getBounty(req, res)
);

// ==================== AUTHENTICATED BOUNTY OPERATIONS ====================

// All following routes require authentication
router.use(authenticate);

/**
 * GET /api/v2/bounties/claims/pending
 * Get pending bounty claims for the authenticated user
 */
router.get(
  '/claims/pending',
  tenantContextMiddleware,
  requireTenantContext,
  (req: Request, res: Response) => getController().getPendingClaims(req, res)
);

/**
 * GET /api/v2/bounties/claims/my-claims
 * Get all claims submitted by the authenticated user with statistics
 * Query parameters: status filter
 */
router.get(
  '/claims/my-claims',
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(claimSchemas.query, 'query'),
  (req: Request, res: Response) => getController().getMyClaimsWithStats(req, res)
);

// ==================== HUNTER PROFILE OPERATIONS ====================

// Hunter profile routes need tenant context to resolve currentOrganizationId
router.use('/hunter', tenantContextMiddleware);

/**
 * GET /api/v2/bounties/hunter/profile
 * Get or create hunter profile for the current user
 */
router.get('/hunter/profile', (req: Request, res: Response) =>
  getController().getHunterProfile(req, res)
);

/**
 * GET /api/v2/bounties/hunter/leaderboard
 * Get hunter leaderboard
 * Query parameters: sortBy, limit
 */
router.get('/hunter/leaderboard', (req: Request, res: Response) =>
  getController().getHunterLeaderboard(req, res)
);

/**
 * GET /api/v2/bounties/hunter/history
 * Get hunt history for the current user
 * Query parameters: page, limit
 */
router.get('/hunter/history', (req: Request, res: Response) =>
  getController().getHunterHistory(req, res)
);

/**
 * GET /api/v2/bounties/hunter/analytics
 * Get hunter analytics summary
 */
router.get('/hunter/analytics', (req: Request, res: Response) =>
  getController().getHunterAnalytics(req, res)
);

/**
 * GET /api/v2/bounties
 * List all bounties with optional filters
 * Query parameters: filters, sorting, pagination
 * Requires tenantContext to populate currentOrganizationId
 */
router.get(
  '/',
  tenantContextMiddleware,
  validateSchema(bountySchemas.query, 'query'),
  (req: Request, res: Response) => getController().listBounties(req, res)
);

/**
 * GET /api/v2/bounties/:id
 * Get a specific bounty by ID
 * Requires: valid UUID format
 */
router.get('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().getBounty(req, res)
);

/**
 * POST /api/v2/bounties/:id/claim
 * Claim a bounty
 * Request body: claim submission data
 * Requires: valid UUID for bounty ID
 */
router.post(
  '/:id/claim',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(bountySchemas.claim, 'body'),
  (req: Request, res: Response) => getController().claimBounty(req, res)
);

/**
 * GET /api/v2/bounties/:id/claims
 * Get all claims for a specific bounty
 * Requires: valid UUID for bounty ID
 */
router.get(
  '/:id/claims',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().getBountyClaims(req, res)
);

// ==================== ORGANIZATION-SCOPED OPERATIONS ====================

// All following routes require organization context
router.use(tenantContextMiddleware);
router.use(requireTenantContext);

/**
 * POST /api/v2/bounties
 * Create a new bounty (requires organization membership)
 * Request body: bounty creation data
 */
router.post('/', validateSchema(bountySchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createBounty(req, res)
);

/**
 * PATCH /api/v2/bounties/:id
 * Update an existing bounty (requires organization membership)
 * Request body: bounty update data
 * Requires: valid UUID for bounty ID
 */
router.patch(
  '/:id',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(bountySchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateBounty(req, res)
);

/**
 * DELETE /api/v2/bounties/:id
 * Delete a bounty (requires organization membership)
 * Requires: valid UUID for bounty ID
 */
router.delete('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().deleteBounty(req, res)
);

/**
 * PATCH /api/v2/bounties/:bountyId/claims/:claimId
 * Update a claim (approve/reject) - requires organization membership
 * Request body: claim update data
 */
router.patch(
  '/:bountyId/claims/:claimId',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().updateClaim(req, res)
);

/**
 * DELETE /api/v2/bounties/:bountyId/claims/:claimId
 * Delete/abandon a bounty claim
 * Requires: valid UUIDs for bounty and claim
 */
router.delete(
  '/:bountyId/claims/:claimId',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().deleteClaim(req, res)
);

/**
 * POST /api/v2/bounties/:bountyId/claims/:claimId/submit
 * Submit a claim for review
 * Request body: submission data (notes, summary, etc.)
 */
router.post(
  '/:bountyId/claims/:claimId/submit',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(claimSchemas.submit, 'body'),
  (req: Request, res: Response) => getController().submitClaim(req, res)
);

/**
 * POST /api/v2/bounties/:bountyId/claims/:claimId/evidence
 * Submit evidence for a bounty claim
 * Request body: evidence data (files, links, descriptions, etc.)
 */
router.post(
  '/:bountyId/claims/:claimId/evidence',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(evidenceSchemas.submit, 'body'),
  (req: Request, res: Response) => getController().submitEvidence(req, res)
);

/**
 * GET /api/v2/bounties/:bountyId/claims/:claimId/evidence
 * Get evidence submitted for a bounty claim
 * Requires: valid UUIDs for bounty and claim
 */
router.get(
  '/:bountyId/claims/:claimId/evidence',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().getClaimEvidence(req, res)
);

/**
 * DELETE /api/v2/bounties/:bountyId/claims/:claimId/evidence/:evidenceId
 * Delete evidence from a bounty claim
 * Requires: valid UUIDs for bounty, claim, and evidence
 */
router.delete(
  '/:bountyId/claims/:claimId/evidence/:evidenceId',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().deleteEvidence(req, res)
);

export { router };
