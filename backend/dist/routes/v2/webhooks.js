"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const webhookController_1 = require("../../controllers/webhookController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const webhookSchemas_1 = require("../../schemas/webhookSchemas");
const router = (0, express_1.Router)();
exports.router = router;
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let webhookController;
const getController = () => {
    if (!webhookController) {
        webhookController = new webhookController_1.WebhookController();
    }
    return webhookController;
};
router.get('/event-types', ...orgAuth, (req, res) => getController().getEventTypes(req, res));
router.get('/statistics', ...orgAuth, (req, res) => getController().getStatistics(req, res));
router.get('/batch/config', ...orgAuth, (req, res) => getController().getBatchConfig(req, res));
router.get('/', ...orgAuth, (req, res) => getController().getWebhooks(req, res));
router.get('/:id', ...orgAuth, (req, res) => getController().getWebhook(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.create), (req, res) => getController().createWebhook(req, res));
router.put('/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.update), (req, res) => getController().updateWebhook(req, res));
router.delete('/:id', ...orgAuth, (req, res) => getController().deleteWebhook(req, res));
router.post('/test/:id', ...orgAuth, (req, res) => getController().testWebhook(req, res));
//# sourceMappingURL=webhooks.js.map