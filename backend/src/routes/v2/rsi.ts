import { Request, Response, Router } from 'express';

import { RsiVerificationController } from '../../controllers/rsiVerificationController';
import { authenticate, AuthRequest } from '../../middleware/auth';
import {
  rsiVerificationCompleteLimiter,
  rsiVerificationStartLimiter,
  rsiVerificationStatusLimiter,
} from '../../middleware/rsiRateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { rsiApiRateLimiter } from '../../middleware/security';
import { rsiVerificationSchemas } from '../../schemas/rsiVerificationSchemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let rsiController: RsiVerificationController;
const getController = (): RsiVerificationController => {
  if (!rsiController) {
    rsiController = new RsiVerificationController();
  }
  return rsiController;
};

// ==================== RSI VERIFICATION ====================

/**
 * POST /api/v2/rsi/verify/initiate
 * Start RSI handle verification process
 * Request body: { rsiHandle: string }
 */
router.post(
  '/verify/initiate',
  authenticate,
  rsiApiRateLimiter,
  rsiVerificationStartLimiter,
  validateSchema(rsiVerificationSchemas.initiateVerification, 'body'),
  (req: Request, res: Response) => getController().initiateVerification(req as AuthRequest, res)
);

/**
 * POST /api/v2/rsi/verify/complete
 * Complete RSI handle verification
 */
router.post(
  '/verify/complete',
  authenticate,
  rsiApiRateLimiter,
  rsiVerificationCompleteLimiter,
  (req: Request, res: Response) => getController().completeVerification(req as AuthRequest, res)
);

/**
 * GET /api/v2/rsi/verify/status
 * Check verification status
 */
router.get(
  '/verify/status',
  authenticate,
  rsiVerificationStatusLimiter,
  (req: Request, res: Response) => getController().getVerificationStatus(req as AuthRequest, res)
);

/**
 * DELETE /api/v2/rsi/verify
 * Remove RSI verification
 */
router.delete('/verify', authenticate, (req: Request, res: Response) =>
  getController().removeVerification(req as AuthRequest, res)
);

/**
 * GET /api/v2/rsi/profile/:handle
 * Get RSI profile data (public)
 */
router.get('/profile/:handle', rsiApiRateLimiter, (req: Request, res: Response) =>
  getController().lookupRsiUser(req, res)
);

// ==================== RSI ORG VERIFICATION ====================

/**
 * POST /api/v2/rsi/verify/organization/initiate
 * Generate a verification code that must be placed in the RSI org description
 * Request body: { orgId: string, rsiOrgSid: string }
 */
router.post(
  '/verify/organization/initiate',
  authenticate,
  rsiApiRateLimiter,
  rsiVerificationStartLimiter,
  validateSchema(rsiVerificationSchemas.initiateOrgVerification, 'body'),
  (req: Request, res: Response) =>
    getController().initiateOrganizationVerification(req as AuthRequest, res)
);

/**
 * POST /api/v2/rsi/verify/organization/complete
 * Confirm verification by checking the RSI org description for the code
 * Request body: { orgId: string }
 */
router.post(
  '/verify/organization/complete',
  authenticate,
  rsiApiRateLimiter,
  rsiVerificationCompleteLimiter,
  validateSchema(rsiVerificationSchemas.completeOrgVerification, 'body'),
  (req: Request, res: Response) =>
    getController().completeOrganizationVerification(req as AuthRequest, res)
);

/**
 * POST /api/v2/rsi/verify/organization
 * Verify organization ownership
 * Request body: { orgSid: string }
 */
router.post(
  '/verify/organization',
  authenticate,
  rsiApiRateLimiter,
  validateSchema(rsiVerificationSchemas.verifyOrganization, 'body'),
  (req: Request, res: Response) =>
    getController().verifyOrganizationOwnership(req as AuthRequest, res)
);

/**
 * GET /api/v2/rsi/organization/:sid
 * Lookup RSI organization (public)
 */
router.get('/organization/:sid', rsiApiRateLimiter, (req: Request, res: Response) =>
  getController().lookupRsiOrganization(req, res)
);

/**
 * GET /api/v2/rsi/user/:handle
 * Lookup RSI user profile (public)
 */
router.get('/user/:handle', rsiApiRateLimiter, (req: Request, res: Response) =>
  getController().lookupRsiUser(req, res)
);

/**
 * GET /api/v2/rsi/verify/analytics
 * Get verification analytics (admin only)
 */
router.get('/verify/analytics', authenticate, (req: Request, res: Response) =>
  getController().getAnalytics(req as AuthRequest, res)
);

/**
 * GET /api/v2/rsi/sync/status
 * Get the authenticated user's RSI verification status
 */
router.get('/sync/status', authenticate, rsiVerificationStatusLimiter, (req: Request, res: Response) =>
  getController().getVerificationStatus(req as AuthRequest, res)
);

export { router };
