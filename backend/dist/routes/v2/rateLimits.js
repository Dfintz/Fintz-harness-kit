"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const rateLimitController_1 = require("../../controllers/v2/rateLimitController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const rateLimitSchemas_1 = require("../../schemas/rateLimitSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let rateLimitController;
const getController = () => {
    if (!rateLimitController) {
        rateLimitController = new rateLimitController_1.RateLimitController();
    }
    return rateLimitController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/config', ...orgAuth, (req, res) => getController().getConfig(req, res));
router.put('/config', ...orgAuth, (0, schemaValidation_1.validateSchema)(rateLimitSchemas_1.rateLimitSchemas.updateConfig, 'body'), (req, res) => getController().updateConfig(req, res));
router.get('/usage', ...orgAuth, (req, res) => getController().getUsage(req, res));
router.post('/reset', ...orgAuth, (0, schemaValidation_1.validateSchema)(rateLimitSchemas_1.rateLimitSchemas.reset, 'body'), (req, res) => getController().reset(req, res));
//# sourceMappingURL=rateLimits.js.map