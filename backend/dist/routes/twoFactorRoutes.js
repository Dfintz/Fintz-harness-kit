"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTwoFactorRoutes = void 0;
const express_1 = require("express");
const twoFactorController_1 = require("../controllers/twoFactorController");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let twoFactorController;
const getController = () => {
    if (!twoFactorController) {
        twoFactorController = new twoFactorController_1.TwoFactorController();
    }
    return twoFactorController;
};
const setTwoFactorRoutes = (app) => {
    router.get('/auth/2fa/status', auth_1.authenticateToken, (req, res) => getController().getTwoFactorStatus(req, res));
    router.post('/auth/2fa/setup', auth_1.authenticateToken, (req, res) => getController().setupTwoFactor(req, res));
    router.post('/auth/2fa/verify', auth_1.authenticateToken, rateLimiting_1.twoFactorRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.twoFactorSchemas.verify, 'body'), (req, res) => getController().verifyAndEnableTwoFactor(req, res));
    router.post('/auth/2fa/disable', auth_1.authenticateToken, rateLimiting_1.twoFactorRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.twoFactorSchemas.disable, 'body'), (req, res) => getController().disableTwoFactor(req, res));
    router.post('/auth/2fa/verify-login', rateLimiting_1.twoFactorRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.twoFactorSchemas.verifyLogin, 'body'), (req, res) => getController().verifyTwoFactorLogin(req, res));
    router.post('/auth/2fa/backup-codes', auth_1.authenticateToken, (req, res) => getController().generateNewBackupCodes(req, res));
    app.use('/api', router);
};
exports.setTwoFactorRoutes = setTwoFactorRoutes;
//# sourceMappingURL=twoFactorRoutes.js.map