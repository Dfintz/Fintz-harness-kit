"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const twoFactorController_1 = require("../../controllers/twoFactorController");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let twoFactorController;
const getController = () => {
    if (!twoFactorController) {
        twoFactorController = new twoFactorController_1.TwoFactorController();
    }
    return twoFactorController;
};
router.get('/status', auth_1.authenticate, (req, res) => getController().getTwoFactorStatus(req, res));
router.post('/setup', auth_1.authenticate, (req, res) => getController().setupTwoFactor(req, res));
router.post('/verify', auth_1.authenticate, rateLimiting_1.twoFactorRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.twoFactorSchemas.verify, 'body'), (req, res) => getController().verifyAndEnableTwoFactor(req, res));
router.post('/disable', auth_1.authenticate, rateLimiting_1.twoFactorRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.twoFactorSchemas.disable, 'body'), (req, res) => getController().disableTwoFactor(req, res));
router.post('/verify-login', rateLimiting_1.twoFactorRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.twoFactorSchemas.verifyLogin, 'body'), (req, res) => getController().verifyTwoFactorLogin(req, res));
router.post('/backup-codes', auth_1.authenticate, (req, res) => getController().generateNewBackupCodes(req, res));
//# sourceMappingURL=2fa.js.map