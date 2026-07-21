import { Router } from 'express';

import { GdprController } from '../controllers/gdprController';
import { authenticate } from '../middleware/auth';
import { createCustomUserRateLimiter } from '../middleware/rateLimiting';
import { twoFactorChallengeMiddleware } from '../middleware/twoFactorChallenge';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let gdprController: GdprController;
const getController = () => {
    if (!gdprController) {
        gdprController = new GdprController();
    }
    return gdprController;
};

// Rate limiters for GDPR endpoints
const exportRateLimiter = createCustomUserRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour per user
    message: 'Too many export requests. Please try again later.'
});

/**
 * GDPR Routes
 * All routes require authentication
 */

// Consent management
router.post('/consent', authenticate, (req, res) => getController().recordConsent(req, res));
router.get('/consent', authenticate, (req, res) => getController().getUserConsents(req, res));
router.get('/consent/:consentType', authenticate, (req, res) => getController().checkConsent(req, res));

// Data portability (right to data access)
// Legacy immediate export endpoint (deprecated)
router.get('/export', authenticate, (req, res) => getController().exportUserData(req, res));

// New queue-based export endpoints with rate limiting
router.post('/export-request', authenticate, exportRateLimiter, (req, res) => getController().requestDataExport(req, res));
router.get('/export-requests', authenticate, (req, res) => getController().getUserExportRequests(req, res));
router.get('/export-request/:requestId', authenticate, (req, res) => getController().getExportRequestStatus(req, res));
router.get('/export-request/:requestId/download', authenticate, (req, res) => getController().downloadExportFile(req, res));

// Right to be forgotten
router.delete('/delete-account', authenticate, (req, res) => getController().requestDataDeletion(req, res));
router.post('/cancel-deletion', 
    authenticate, 
    twoFactorChallengeMiddleware('gdpr-data-deletion'),
    (req, res) => getController().cancelDeletionRequest(req, res)
);
router.get('/deletion-status', authenticate, (req, res) => getController().getDeletionStatus(req, res));

// Organization deletion email verification
router.post('/verify-deletion-email', (req, res) => getController().verifyDeletionEmail(req, res));
router.post('/resend-deletion-confirmation', authenticate, (req, res) => getController().resendDeletionConfirmation(req, res));

// Admin endpoints
router.get('/statistics', authenticate, (req, res) => getController().getConsentStatistics(req, res));
router.get('/dashboard', authenticate, (req, res) => getController().getComplianceDashboard(req, res));

export { router };
