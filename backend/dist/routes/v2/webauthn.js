"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const webAuthnController_1 = require("../../controllers/webAuthnController");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const router = (0, express_1.Router)();
exports.router = router;
let webAuthnController;
const getController = () => {
    if (!webAuthnController) {
        webAuthnController = new webAuthnController_1.WebAuthnController();
    }
    return webAuthnController;
};
router.get('/supported', (req, res) => getController().checkSupport(req, res));
router.get('/credentials', auth_1.authenticate, (req, res) => getController().getCredentials(req, res));
router.post('/register/start', auth_1.authenticate, rateLimiting_1.authenticationRateLimiter, (req, res) => getController().startRegistration(req, res));
router.post('/register/complete', auth_1.authenticate, rateLimiting_1.authenticationRateLimiter, (req, res) => getController().completeRegistration(req, res));
router.patch('/credentials/:credentialId', auth_1.authenticate, (req, res) => getController().updateCredential(req, res));
router.delete('/credentials/:credentialId', auth_1.authenticate, (req, res) => getController().removeCredential(req, res));
router.post('/authenticate/options', rateLimiting_1.authenticationRateLimiter, (req, res) => getController().getAuthenticationOptions(req, res));
router.post('/authenticate/verify', rateLimiting_1.authenticationRateLimiter, (req, res) => getController().verifyAuthentication(req, res));
router.post('/step-up/options', auth_1.authenticate, (req, res) => getController().getStepUpOptions(req, res));
router.post('/step-up/verify', auth_1.authenticate, (req, res) => getController().verifyStepUp(req, res));
router.get('/mobile-authenticate', rateLimiting_1.authenticationRateLimiter, (req, res) => getController().mobileAuthenticate(req, res));
//# sourceMappingURL=webauthn.js.map