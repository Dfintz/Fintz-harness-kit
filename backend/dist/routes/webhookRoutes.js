"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setWebhookRoutes = setWebhookRoutes;
const express_1 = require("express");
const webhookController_1 = require("../controllers/webhookController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const webhookSchemas_1 = require("../schemas/webhookSchemas");
let webhookController;
const getController = () => {
    if (!webhookController) {
        webhookController = new webhookController_1.WebhookController();
    }
    return webhookController;
};
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken];
function setWebhookRoutes(app) {
    router.get('/webhooks/event-types', ...authStack, (req, res) => getController().getEventTypes(req, res));
    router.get('/webhooks/statistics', ...authStack, (req, res) => getController().getStatistics(req, res));
    router.get('/webhooks/batch/config', ...authStack, (req, res) => getController().getBatchConfig(req, res));
    router.put('/webhooks/batch/config', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.batchConfig, 'body'), (req, res) => getController().configureBatch(req, res));
    router.post('/webhooks/batch/queue', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.triggerEvent, 'body'), (req, res) => getController().queueEventForBatch(req, res));
    router.get('/webhooks/batch/pending', ...authStack, (req, res) => getController().getPendingBatches(req, res));
    router.post('/webhooks/batch/flush', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.batchFlush, 'body'), (req, res) => getController().flushBatches(req, res));
    router.delete('/webhooks/batch/pending', ...authStack, (req, res) => getController().cancelPendingBatches(req, res));
    router.post('/webhooks/validate', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.create, 'body'), (req, res) => getController().validateWebhook(req, res));
    router.post('/webhooks/trigger-event', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.triggerEvent, 'body'), (req, res) => getController().triggerEvent(req, res));
    router.post('/webhooks', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.create, 'body'), (req, res) => getController().createWebhook(req, res));
    router.get('/webhooks', ...authStack, (req, res) => getController().getWebhooks(req, res));
    router.get('/webhooks/:id', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (req, res) => getController().getWebhook(req, res));
    router.patch('/webhooks/:id', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.update, 'body'), (req, res) => getController().updateWebhook(req, res));
    router.delete('/webhooks/:id', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (req, res) => getController().deleteWebhook(req, res));
    router.post('/webhooks/:id/test', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (req, res) => getController().testWebhook(req, res));
    router.post('/webhooks/:id/test-custom', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.testCustom, 'body'), (req, res) => getController().testWebhookCustom(req, res));
    router.post('/webhooks/:id/preview', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.payloadPreview, 'body'), (req, res) => getController().getPayloadPreview(req, res));
    router.get('/webhooks/:id/deliveries', ...authStack, (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(webhookSchemas_1.webhookSchemas.deliveryQuery, 'query'), (req, res) => getController().getDeliveryHistory(req, res));
    app.use(router);
}
//# sourceMappingURL=webhookRoutes.js.map