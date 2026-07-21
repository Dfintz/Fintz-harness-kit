import { Router } from 'express';

import { BountyController } from '../controllers/bountyController';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { paramSchemas } from '../schemas';
import { bountySchemas, claimSchemas, evidenceSchemas } from '../schemas/bountySchemas';

const router = Router();

// Lazy initialization to avoid potential circular dependency issues
let bountyController: BountyController;
const getController = () => {
  if (!bountyController) {
    bountyController = new BountyController();
  }
  return bountyController;
};

// ==================== PUBLIC BOUNTY VIEWING (NO AUTH) ====================
// Public users can browse bounties without authentication

// List public bounties (no auth required)
router.get('/public', validateSchema(bountySchemas.query, 'query'), (req, res) =>
  getController().listBounties(req, res)
);

// View specific public bounty (no auth required)
router.get('/public/:id', validateSchema(paramSchemas.id, 'params'), (req, res) =>
  getController().getBounty(req, res)
);

// ==================== AUTHENTICATED BOUNTY OPERATIONS ====================
// Authenticated users can view all bounties and their own claims

// Get pending claims for current user (must be before /:id routes)
router.get(
  '/claims/pending',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  (req, res) => getController().getPendingClaims(req, res)
);

// Get my claims with stats (authenticated, org-scoped)
router.get(
  '/claims/my-claims',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  (req, res) => getController().getMyClaimsWithStats(req, res)
);

// ==================== HUNTER PROFILE OPERATIONS ====================
// Hunter profile, leaderboard, history, and analytics (org-scoped)

// Get hunter profile (authenticated, org-scoped)
router.get(
  '/hunter/profile',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  (req, res) => getController().getHunterProfile(req, res)
);

// Get hunter leaderboard (authenticated, org-scoped)
router.get(
  '/hunter/leaderboard',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  (req, res) => getController().getHunterLeaderboard(req, res)
);

// Get hunter bounty history (authenticated, org-scoped)
router.get(
  '/hunter/history',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  (req, res) => getController().getHunterHistory(req, res)
);

// Get hunter analytics summary (authenticated, org-scoped)
router.get(
  '/hunter/analytics',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  (req, res) => getController().getHunterAnalytics(req, res)
);

// List all bounties with filters (authenticated, no org required)
router.get('/', authenticate, validateSchema(bountySchemas.query, 'query'), (req, res) =>
  getController().listBounties(req, res)
);

// Get specific bounty (authenticated, no org required)
router.get('/:id', authenticate, validateSchema(paramSchemas.id, 'params'), (req, res) =>
  getController().getBounty(req, res)
);

// Claim a bounty (authenticated, no org required)
router.post(
  '/:id/claim',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(bountySchemas.claim, 'body'),
  (req, res) => getController().claimBounty(req, res)
);

// ==================== ORGANIZATION-SCOPED OPERATIONS ====================
// These operations require organization membership

// Create new bounty (requires org context)
router.post(
  '/',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(bountySchemas.create, 'body'),
  (req, res) => getController().createBounty(req, res)
);

// Update bounty (requires org context)
router.patch(
  '/:id',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(bountySchemas.update, 'body'),
  (req, res) => getController().updateBounty(req, res)
);

// Delete bounty (requires org context)
router.delete(
  '/:id',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(paramSchemas.id, 'params'),
  (req, res) => getController().deleteBounty(req, res)
);

// Get all claims for a bounty (authenticated, no org required)
router.get('/:id/claims', authenticate, validateSchema(paramSchemas.id, 'params'), (req, res) =>
  getController().getBountyClaims(req, res)
);

// Update a claim (approve/reject) - requires org context
router.patch(
  '/:bountyId/claims/:claimId',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(paramSchemas.id, 'params'),
  (req, res) => getController().updateClaim(req, res)
);

// Delete/abandon a claim (authenticated, no org required)
router.delete(
  '/:bountyId/claims/:claimId',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  (req, res) => getController().deleteClaim(req, res)
);

// Submit a claim for review (authenticated, no org required)
router.post(
  '/:bountyId/claims/:claimId/submit',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(claimSchemas.submit, 'body'),
  (req, res) => getController().submitClaim(req, res)
);

// ==================== EVIDENCE OPERATIONS ====================

// Submit evidence for a claim (authenticated, no org required)
router.post(
  '/:bountyId/claims/:claimId/evidence',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(evidenceSchemas.submit, 'body'),
  (req, res) => getController().submitEvidence(req, res)
);

// Get evidence for a claim (authenticated, no org required)
router.get(
  '/:bountyId/claims/:claimId/evidence',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  (req, res) => getController().getClaimEvidence(req, res)
);

// Delete evidence (authenticated, no org required)
router.delete(
  '/:bountyId/claims/:claimId/evidence/:evidenceId',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  (req, res) => getController().deleteEvidence(req, res)
);

export { router };
// eslint-disable-next-line import/no-default-export
export default router;
