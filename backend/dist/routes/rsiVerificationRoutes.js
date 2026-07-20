"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRsiVerificationRoutes = void 0;
const express_1 = require("express");
const rsiVerificationController_1 = require("../controllers/rsiVerificationController");
const auth_1 = require("../middleware/auth");
const rsiRateLimiting_1 = require("../middleware/rsiRateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const security_1 = require("../middleware/security");
const rsiVerificationSchemas_1 = require("../schemas/rsiVerificationSchemas");
const router = (0, express_1.Router)();
let rsiController;
const getController = () => {
    if (!rsiController) {
        rsiController = new rsiVerificationController_1.RsiVerificationController();
    }
    return rsiController;
};
const setRsiVerificationRoutes = (app) => {
    router.get('/rsi/user/:handle', security_1.rsiApiRateLimiter, (req, res) => getController().lookupRsiUser(req, res));
    router.get('/rsi/organization/:sid', security_1.rsiApiRateLimiter, (req, res) => getController().lookupRsiOrganization(req, res));
    router.get('/rsi/verify/status', auth_1.authenticateToken, rsiRateLimiting_1.rsiVerificationStatusLimiter, (req, res) => getController().getVerificationStatus(req, res));
    router.post('/rsi/verify/initiate', auth_1.authenticateToken, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationStartLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.initiateVerification, 'body'), (req, res) => getController().initiateVerification(req, res));
    router.post('/rsi/verify/complete', auth_1.authenticateToken, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationCompleteLimiter, (req, res) => getController().completeVerification(req, res));
    router.delete('/rsi/verify', auth_1.authenticateToken, security_1.rsiApiRateLimiter, (req, res) => getController().removeVerification(req, res));
    router.post('/rsi/verify/organization/initiate', auth_1.authenticateToken, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationStartLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.initiateOrgVerification, 'body'), (req, res) => getController().initiateOrganizationVerification(req, res));
    router.post('/rsi/verify/organization/complete', auth_1.authenticateToken, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationCompleteLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.completeOrgVerification, 'body'), (req, res) => getController().completeOrganizationVerification(req, res));
    router.post('/rsi/verify/organization/rank', auth_1.authenticateToken, security_1.rsiApiRateLimiter, rsiRateLimiting_1.rsiVerificationCompleteLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.verifyOrgByRank, 'body'), (req, res) => getController().verifyOrganizationByRank(req, res));
    router.post('/rsi/verify/organization', auth_1.authenticateToken, security_1.rsiApiRateLimiter, (0, schemaValidation_1.validateSchema)(rsiVerificationSchemas_1.rsiVerificationSchemas.verifyOrganization, 'body'), (req, res) => getController().verifyOrganizationOwnership(req, res));
    router.get('/rsi/verify/analytics', auth_1.authenticateToken, (req, res) => getController().getAnalytics(req, res));
    app.use('/api', router);
};
exports.setRsiVerificationRoutes = setRsiVerificationRoutes;
//# sourceMappingURL=rsiVerificationRoutes.js.map