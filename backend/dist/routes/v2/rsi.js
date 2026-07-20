"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const rsiVerificationController_1 = require("../../controllers/rsiVerificationController");
const auth_1 = require("../../middleware/auth");
const rsiRateLimiting_1 = require("../../middleware/rsiRateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const security_1 = require("../../middleware/security");
const rsiVerificationSchemas_1 = require("../../schemas/rsiVerificationSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let rsiController;
const getController = () => {
    if (!rsiController) {
        rsiController = new rsiVerificationController_1.RsiVerificationController();
    }
    return rsiController;
};
router.post('/verify/initiate', auth_1.authenticate, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationStartLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.initiateVerification, 'body'), (req, res) => getController().initiateVerification(req, res));
router.post('/verify/complete', auth_1.authenticate, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationCompleteLimiter, (req, res) => getController().completeVerification(req, res));
router.get('/verify/status', auth_1.authenticate, rsiRateLimiting_1.rsiVerificationStatusLimiter, (req, res) => getController().getVerificationStatus(req, res));
router.delete('/verify', auth_1.authenticate, (req, res) => getController().removeVerification(req, res));
router.get('/profile/:handle', security_1.rsiApiRateLimiter, (req, res) => getController().lookupRsiUser(req, res));
router.post('/verify/organization/initiate', auth_1.authenticate, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationStartLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.initiateOrgVerification, 'body'), (req, res) => getController().initiateOrganizationVerification(req, res));
router.post('/verify/organization/complete', auth_1.authenticate, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationCompleteLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.completeOrgVerification, 'body'), (req, res) => getController().completeOrganizationVerification(req, res));
router.post('/verify/organization', auth_1.authenticate, security_1.rsiApiRateLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.verifyOrganization, 'body'), (req, res) => getController().verifyOrganizationOwnership(req, res));
router.get('/organization/:sid', security_1.rsiApiRateLimiter, (req, res) => getController().lookupRsiOrganization(req, res));
router.get('/user/:handle', security_1.rsiApiRateLimiter, (req, res) => getController().lookupRsiUser(req, res));
router.get('/verify/analytics', auth_1.authenticate, (req, res) => getController().getAnalytics(req, res));
router.get('/sync/status', auth_1.authenticate, rsiRateLimiting_1.rsiVerificationStatusLimiter, (req, res) => getController().getVerificationStatus(req, res));
//# sourceMappingURL=rsi.js.map