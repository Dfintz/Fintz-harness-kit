"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const activityTemplateController_1 = require("../../controllers/v2/activityTemplateController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.use(tenantContext_1.tenantContextMiddleware);
let controller;
const getController = () => {
    if (!controller) {
        controller = new activityTemplateController_1.ActivityTemplateControllerV2();
    }
    return controller;
};
router.get('/categories', (req, res) => getController().getCategories(req, res));
router.get('/', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.query, 'query'), (req, res) => getController().listTemplates(req, res));
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.create, 'body'), (req, res) => getController().createTemplate(req, res));
router.get('/:templateId', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.param, 'params'), (req, res) => getController().getTemplate(req, res));
router.put('/:templateId', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.update, 'body'), (req, res) => getController().updateTemplate(req, res));
router.delete('/:templateId', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.param, 'params'), (req, res) => getController().deleteTemplate(req, res));
router.post('/:templateId/clone', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.param, 'params'), (req, res) => getController().cloneTemplate(req, res));
router.post('/:templateId/apply', (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.activityTemplateSchemas.apply, 'body'), (req, res) => getController().applyTemplate(req, res));
//# sourceMappingURL=templates.js.map