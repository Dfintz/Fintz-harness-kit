/**
 * GDPR Routes (API v2)
 *
 * Comprehensive GDPR compliance endpoints supporting:
 * - Consent management (recording and checking user consent)
 * - Data portability (exporting user data)
 * - Right to be forgotten (account deletion)
 * - Data access and compliance reporting
 *
 * All routes require authentication unless otherwise specified
 */

import { Request, Response, Router } from 'express';

import { GdprController } from '../../controllers/gdprController';
import { requireAdmin } from '../../middleware/adminAuth';
import { authenticate } from '../../middleware/auth';
import { createCustomUserRateLimiter } from '../../middleware/rateLimiting';
import { twoFactorChallengeMiddleware } from '../../middleware/twoFactorChallenge';

const router = Router();

// Rate limiters for GDPR endpoints
const exportRateLimiter = createCustomUserRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per user
  message: 'Too many export requests. Please try again later.',
});

// Lazy initialization to avoid EntityMetadataNotFoundError
let gdprController: GdprController;
const getController = () => {
  if (!gdprController) {
    gdprController = new GdprController();
  }
  return gdprController;
};

// ==================== CONSENT MANAGEMENT ====================

/**
 * POST /api/v2/gdpr/consent
 * Record user consent for specific data processing
 * Request body: { consentType: string, granted: boolean }
 */
router.post('/consent', authenticate, (req: Request, res: Response) =>
  getController().recordConsent(req, res)
);

/**
 * GET /api/v2/gdpr/consent
 * Retrieve all consents for the current user
 */
router.get('/consent', authenticate, (req: Request, res: Response) =>
  getController().getUserConsents(req, res)
);

/**
 * GET /api/v2/gdpr/consent/:consentType
 * Check consent status for a specific consent type
 */
router.get('/consent/:consentType', authenticate, (req: Request, res: Response) =>
  getController().checkConsent(req, res)
);

/**
 * GET /api/v2/gdpr/consent/:consentType/version
 * Check consent version status — whether user needs to re-consent
 */
router.get('/consent/:consentType/version', authenticate, (req: Request, res: Response) =>
  getController().checkConsentVersion(req, res)
);

// ==================== DATA PORTABILITY (RIGHT TO DATA ACCESS) ====================

/**
 * GET /api/v2/gdpr/export
 * Legacy endpoint - immediate export of user data
 * DEPRECATED: Use /export-request instead for async processing
 */
router.get('/export', authenticate, (req: Request, res: Response) =>
  getController().exportUserData(req, res)
);

/**
 * POST /api/v2/gdpr/export-request
 * Request data export (async, queue-based)
 * Creates an export request that is processed asynchronously
 * Rate limited to 5 requests per hour per user
 */
router.post('/export-request', authenticate, exportRateLimiter, (req: Request, res: Response) =>
  getController().requestDataExport(req, res)
);

/**
 * GET /api/v2/gdpr/export-requests
 * Get all export requests for the current user
 * Returns list of past and pending export requests
 */
router.get('/export-requests', authenticate, (req: Request, res: Response) =>
  getController().getUserExportRequests(req, res)
);

/**
 * GET /api/v2/gdpr/export-request/:requestId
 * Check status of a specific export request
 * Returns: status (pending/processing/completed/failed), progress, eta
 */
router.get('/export-request/:requestId', authenticate, (req: Request, res: Response) =>
  getController().getExportRequestStatus(req, res)
);

/**
 * GET /api/v2/gdpr/export-request/:requestId/download
 * Download exported data file
 * Only available once export is completed
 */
router.get('/export-request/:requestId/download', authenticate, (req: Request, res: Response) =>
  getController().downloadExportFile(req, res)
);

// ==================== RIGHT TO BE FORGOTTEN ====================

/**
 * DELETE /api/v2/gdpr/delete-account
 * Request account deletion (right to be forgotten)
 * Initiates a deletion request that may require additional verification
 */
router.delete('/delete-account', authenticate, (req: Request, res: Response) =>
  getController().requestDataDeletion(req, res)
);

/**
 * POST /api/v2/gdpr/cancel-deletion
 * Cancel a pending account deletion request
 * Requires 2FA challenge for security
 */
router.post(
  '/cancel-deletion',
  authenticate,
  twoFactorChallengeMiddleware('gdpr-data-deletion'),
  (req: Request, res: Response) => getController().cancelDeletionRequest(req, res)
);

/**
 * GET /api/v2/gdpr/deletion-status
 * Get status of account deletion request
 * Returns: status (pending/scheduled/completed), scheduled date if applicable
 */
router.get('/deletion-status', authenticate, (req: Request, res: Response) =>
  getController().getDeletionStatus(req, res)
);

// ==================== ORGANIZATION DELETION ====================

/**
 * POST /api/v2/gdpr/verify-deletion-email
 * Verify organization deletion email token
 * Public endpoint (no auth required) - uses email token for identification
 */
router.post('/verify-deletion-email', (req: Request, res: Response) =>
  getController().verifyDeletionEmail(req, res)
);

/**
 * POST /api/v2/gdpr/resend-deletion-confirmation
 * Resend organization deletion confirmation email
 */
router.post('/resend-deletion-confirmation', authenticate, (req: Request, res: Response) =>
  getController().resendDeletionConfirmation(req, res)
);

// ==================== ADMIN/COMPLIANCE ENDPOINTS ====================

/**
 * GET /api/v2/gdpr/admin/requests
 * Get all GDPR requests across all users (admin only)
 * Returns: combined export + deletion requests with summary counts
 */
router.get('/admin/requests', authenticate, requireAdmin, (req: Request, res: Response) =>
  getController().getAdminGdprRequests(req, res)
);

/**
 * GET /api/v2/gdpr/statistics
 * Get compliance statistics (admin only)
 * Returns: consent statistics, deletion request counts, export request metrics
 */
router.get('/statistics', authenticate, requireAdmin, (req: Request, res: Response) =>
  getController().getConsentStatistics(req, res)
);

/**
 * GET /api/v2/gdpr/dashboard
 * Get compliance dashboard data (admin only)
 * Returns: system-wide GDPR compliance information and metrics
 */
router.get('/dashboard', authenticate, requireAdmin, (req: Request, res: Response) =>
  getController().getComplianceDashboard(req, res)
);

export { router };
