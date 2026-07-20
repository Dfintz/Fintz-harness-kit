"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setWebAuthnRoutes = void 0;
const express_1 = require("express");
const webAuthnController_1 = require("../controllers/webAuthnController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
let webAuthnController;
const getController = () => {
    if (!webAuthnController) {
        webAuthnController = new webAuthnController_1.WebAuthnController();
    }
    return webAuthnController;
};
const setWebAuthnRoutes = (app) => {
    router.get('/auth/webauthn/supported', (req, res) => getController().checkSupport(req, res));
    router.get('/auth/webauthn/credentials', auth_1.authenticateToken, (req, res) => getController().getCredentials(req, res));
    router.post('/auth/webauthn/register/start', auth_1.authenticateToken, (req, res) => getController().startRegistration(req, res));
    router.post('/auth/webauthn/register/complete', auth_1.authenticateToken, (req, res) => getController().completeRegistration(req, res));
    router.patch('/auth/webauthn/credentials/:credentialId', auth_1.authenticateToken, (req, res) => getController().updateCredential(req, res));
    router.delete('/auth/webauthn/credentials/:credentialId', auth_1.authenticateToken, (req, res) => getController().removeCredential(req, res));
    app.use('/api', router);
};
exports.setWebAuthnRoutes = setWebAuthnRoutes;
//# sourceMappingURL=webAuthnRoutes.js.map