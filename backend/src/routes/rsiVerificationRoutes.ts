/**
 * RSI Verification Routes
 *
 * Routes for RSI account ownership verification
 * Uses the Sentry Wild Knight Squadron API (https://sentry.wildknightsquadron.com/api.html)
 */

import { Router } from 'express';

import { RsiVerificationController } from '../controllers/rsiVerificationController';
import { authenticateToken } from '../middleware/auth';
import {
  rsiVerificationCompleteLimiter,
  rsiVerificationStartLimiter,
  rsiVerificationStatusLimiter,
} from '../middleware/rsiRateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { rsiApiRateLimiter } from '../middleware/security';
import { rsiVerificationSchemas } from '../schemas/rsiVerificationSchemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let rsiController: RsiVerificationController;
const getController = (): RsiVerificationController => {
  if (!rsiController) {
    rsiController = new RsiVerificationController();
  }
  return rsiController;
};

export const setRsiVerificationRoutes = (app: Router): void => {
  // ==================== PUBLIC LOOKUP ROUTES ====================
  // These don't require authentication but are rate-limited

  /**
   * Lookup RSI user profile
   * GET /api/rsi/user/:handle
   * Public endpoint to lookup RSI user data
   */
  router.get('/rsi/user/:handle', rsiApiRateLimiter, (req, res) =>
    getController().lookupRsiUser(req, res)
  );

  /**
   * Lookup RSI organization
   * GET /api/rsi/organization/:sid
   * Public endpoint to lookup RSI organization data
   */
  router.get('/rsi/organization/:sid', rsiApiRateLimiter, (req, res) =>
    getController().lookupRsiOrganization(req, res)
  );

  // ==================== AUTHENTICATED VERIFICATION ROUTES ====================
  // These require authentication

  /**
   * Get RSI verification status
   * GET /api/rsi/verify/status
   * Returns the current RSI verification status for the authenticated user
   * Rate limited: 30 requests per minute per user
   */
  router.get('/rsi/verify/status', authenticateToken, rsiVerificationStatusLimiter, (req, res) =>
    getController().getVerificationStatus(req, res)
  );

  /**
   * Initiate RSI handle verification
   * POST /api/rsi/verify/initiate
   * Generates a verification code that the user must add to their RSI bio
   * Rate limited: 3 requests per hour per user + 30 per minute per IP
   */
  router.post(
    '/rsi/verify/initiate',
    authenticateToken,
    rsiApiRateLimiter,
    rsiVerificationStartLimiter,
    validateSchema(rsiVerificationSchemas.initiateVerification, 'body'),
    (req, res) => getController().initiateVerification(req, res)
  );

  /**
   * Complete RSI handle verification
   * POST /api/rsi/verify/complete
   * Checks if the verification code is present in the user's RSI bio
   * Rate limited: 10 requests per 10 minutes per user + 30 per minute per IP
   */
  router.post(
    '/rsi/verify/complete',
    authenticateToken,
    rsiApiRateLimiter,
    rsiVerificationCompleteLimiter,
    (req, res) => getController().completeVerification(req, res)
  );

  /**
   * Remove RSI verification
   * DELETE /api/rsi/verify
   * Removes the RSI handle verification from the user's account
   */
  router.delete('/rsi/verify', authenticateToken, rsiApiRateLimiter, (req, res) =>
    getController().removeVerification(req, res)
  );

  /**
   * Initiate RSI organization verification
   * POST /api/rsi/verify/organization/initiate
   * Generates a verification code that must be added to the RSI organization description
   * Rate limited: 3 requests per hour per user + 30 per minute per IP
   */
  router.post(
    '/rsi/verify/organization/initiate',
    authenticateToken,
    rsiApiRateLimiter,
    rsiVerificationStartLimiter,
    validateSchema(rsiVerificationSchemas.initiateOrgVerification, 'body'),
    (req, res) => getController().initiateOrganizationVerification(req, res)
  );

  /**
   * Complete RSI organization verification
   * POST /api/rsi/verify/organization/complete
   * Checks if the verification code is present in the organization's RSI description
   * Rate limited: 10 requests per 10 minutes per user + 30 per minute per IP
   */
  router.post(
    '/rsi/verify/organization/complete',
    authenticateToken,
    rsiApiRateLimiter,
    rsiVerificationCompleteLimiter,
    validateSchema(rsiVerificationSchemas.completeOrgVerification, 'body'),
    (req, res) => getController().completeOrganizationVerification(req, res)
  );

  /**
   * Verify RSI organization by rank (no code required)
   * POST /api/rsi/verify/organization/rank
   * Verifies the org if the user holds 5-star rank, Founder, or Officer role on RSI
   * Rate limited: 10 requests per 10 minutes per user + 30 per minute per IP
   */
  router.post(
    '/rsi/verify/organization/rank',
    authenticateToken,
    rsiApiRateLimiter,
    rsiVerificationCompleteLimiter,
    validateSchema(rsiVerificationSchemas.verifyOrgByRank, 'body'),
    (req, res) => getController().verifyOrganizationByRank(req, res)
  );

  /**
   * Verify organization ownership
   * POST /api/rsi/verify/organization
   * Checks if the authenticated user is an owner/admin of the specified RSI organization
   */
  router.post(
    '/rsi/verify/organization',
    authenticateToken,
    rsiApiRateLimiter,
    validateSchema(rsiVerificationSchemas.verifyOrganization, 'body'),
    (req, res) => getController().verifyOrganizationOwnership(req, res)
  );

  /**
   * Get verification analytics (admin only)
   * GET /api/rsi/verify/analytics
   * Returns verification metrics for the last 24 hours
   */
  router.get('/rsi/verify/analytics', authenticateToken, (req, res) =>
    getController().getAnalytics(req, res)
  );

  app.use('/api', router);
};
