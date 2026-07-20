"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const gdprController_1 = require("../controllers/gdprController");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const twoFactorChallenge_1 = require("../middleware/twoFactorChallenge");
const router = (0, express_1.Router)();
exports.router = router;
let gdprController;
const getController = () => {
    if (!gdprController) {
        gdprController = new gdprController_1.GdprController();
    }
    return gdprController;
};
const exportRateLimiter = (0, rateLimiting_1.createCustomUserRateLimiter)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many export requests. Please try again later.'
});
router.post('/consent', auth_1.authenticate, (req, res) => getController().recordConsent(req, res));
router.get('/consent', auth_1.authenticate, (req, res) => getController().getUserConsents(req, res));
router.get('/consent/:consentType', auth_1.authenticate, (req, res) => getController().checkConsent(req, res));
router.get('/export', auth_1.authenticate, (req, res) => getController().exportUserData(req, res));
router.post('/export-request', auth_1.authenticate, exportRateLimiter, (req, res) => getController().requestDataExport(req, res));
router.get('/export-requests', auth_1.authenticate, (req, res) => getController().getUserExportRequests(req, res));
router.get('/export-request/:requestId', auth_1.authenticate, (req, res) => getController().getExportRequestStatus(req, res));
router.get('/export-request/:requestId/download', auth_1.authenticate, (req, res) => getController().downloadExportFile(req, res));
router.delete('/delete-account', auth_1.authenticate, (req, res) => getController().requestDataDeletion(req, res));
router.post('/cancel-deletion', auth_1.authenticate, (0, twoFactorChallenge_1.twoFactorChallengeMiddleware)('gdpr-data-deletion'), (req, res) => getController().cancelDeletionRequest(req, res));
router.get('/deletion-status', auth_1.authenticate, (req, res) => getController().getDeletionStatus(req, res));
router.post('/verify-deletion-email', (req, res) => getController().verifyDeletionEmail(req, res));
router.post('/resend-deletion-confirmation', auth_1.authenticate, (req, res) => getController().resendDeletionConfirmation(req, res));
router.get('/statistics', auth_1.authenticate, (req, res) => getController().getConsentStatistics(req, res));
router.get('/dashboard', auth_1.authenticate, (req, res) => getController().getComplianceDashboard(req, res));
//# sourceMappingURL=gdprRoutes.js.map