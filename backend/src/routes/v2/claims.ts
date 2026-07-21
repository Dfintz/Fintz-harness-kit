import { Request, Response, Router } from 'express';

const router = Router();

// ==================== CLAIMS ====================

/**
 * GET /api/v2/claims
 * List claims
 * Query: status, type, sort, page
 */
router.get('/', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * POST /api/v2/claims
 * Create new claim
 * Request body: claim data
 */
router.post('/', (req: Request, res: Response) => {
  res.success({});
});

/**
 * GET /api/v2/claims/:claimId
 * Get claim details
 */
router.get('/:claimId', (req: Request, res: Response) => {
  res.success({});
});

/**
 * PUT /api/v2/claims/:claimId
 * Update claim
 */
router.put('/:claimId', (req: Request, res: Response) => {
  res.success({});
});

/**
 * DELETE /api/v2/claims/:claimId
 * Delete claim
 */
router.delete('/:claimId', (req: Request, res: Response) => {
  res.success({});
});

/**
 * POST /api/v2/claims/:claimId/submit-evidence
 * Submit evidence for claim
 * Request body: { files: array, description: string }
 */
router.post('/:claimId/submit-evidence', (req: Request, res: Response) => {
  res.success({});
});

/**
 * GET /api/v2/claims/:claimId/evidence
 * Get claim evidence
 */
router.get('/:claimId/evidence', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * POST /api/v2/claims/:claimId/approve
 * Approve claim
 */
router.post('/:claimId/approve', (req: Request, res: Response) => {
  res.success({});
});

/**
 * POST /api/v2/claims/:claimId/reject
 * Reject claim
 * Request body: { reason: string }
 */
router.post('/:claimId/reject', (req: Request, res: Response) => {
  res.success({});
});

export { router };
