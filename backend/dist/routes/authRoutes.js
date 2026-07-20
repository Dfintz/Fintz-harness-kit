"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAuthRoutes = void 0;
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const security_1 = require("../middleware/security");
const schemas_1 = require("../schemas");
let authController;
const getController = () => {
    if (!authController) {
        authController = new authController_1.AuthController();
    }
    return authController;
};
let routesRegistered = false;
const setAuthRoutes = (app) => {
    if (routesRegistered) {
        return;
    }
    routesRegistered = true;
    const router = (0, express_1.Router)();
    router.post('/auth/login', (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.login, 'body'), (req, res) => getController().login(req, res));
    router.post('/auth/demo', (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.demoLogin, 'body'), (req, res) => getController().devLogin(req, res));
    router.options('/auth/discord/callback', security_1.corsConfig);
    router.get('/auth/discord/callback', (req, res) => {
        res.status(410).json({
            error: 'Discord callback moved to /api/v2/auth/discord/callback',
            action: 'Update Discord Developer Portal redirect URI and frontend to use v2 endpoint.',
        });
    });
    router.post('/auth/discord/callback', (req, res) => {
        res.status(410).json({
            error: 'Discord callback moved to /api/v2/auth/discord/callback',
            action: 'Update Discord Developer Portal redirect URI and frontend to use v2 endpoint.',
        });
    });
    router.options('/auth/azuread/callback', security_1.corsConfig);
    router.get('/auth/azuread/callback', (req, res) => {
        res.status(410).json({
            error: 'Azure AD callback moved to /api/v2/auth/azuread/callback',
            action: 'Update Entra ID redirect URI and frontend to use v2 endpoint.',
        });
    });
    router.post('/auth/azuread/callback', (req, res) => {
        res.status(410).json({
            error: 'Azure AD callback moved to /api/v2/auth/azuread/callback',
            action: 'Update Entra ID redirect URI and frontend to use v2 endpoint.',
        });
    });
    router.post('/auth/refresh', (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.refresh, 'body'), (req, res) => getController().refresh(req, res));
    router.post('/auth/logout', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.logout, 'body'), (req, res) => getController().logout(req, res));
    router.post('/auth/logout-all', auth_1.authenticateToken, (req, res) => getController().logoutAll(req, res));
    router.get('/auth/sessions', auth_1.authenticateToken, (req, res) => getController().getActiveSessions(req, res));
    app.use('/api', router);
};
exports.setAuthRoutes = setAuthRoutes;
//# sourceMappingURL=authRoutes.js.map