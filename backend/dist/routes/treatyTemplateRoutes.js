"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTreatyTemplateRoutes = setTreatyTemplateRoutes;
const express_1 = require("express");
const TreatyTemplateController_1 = require("../controllers/TreatyTemplateController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const treatyTemplateSchemas_1 = require("../schemas/treatyTemplateSchemas");
const router = (0, express_1.Router)();
const authMiddleware = [auth_1.authenticateToken, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let controller;
const getController = () => {
    if (!controller) {
        controller = new TreatyTemplateController_1.TreatyTemplateController();
    }
    return controller;
};
function setTreatyTemplateRoutes(app) {
    router.get('/treaty-templates', ...authMiddleware, (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.listQuery, 'query'), (req, res) => getController().list(req, res));
    router.post('/treaty-templates', ...authMiddleware, (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.create, 'body'), (req, res) => getController().create(req, res));
    router.post('/treaty-templates/instantiate', ...authMiddleware, (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.instantiate, 'body'), (req, res) => getController().instantiate(req, res));
    router.get('/treaty-templates/:id', ...authMiddleware, (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.param, 'params'), (req, res) => getController().getById(req, res));
    router.put('/treaty-templates/:id', ...authMiddleware, (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.update, 'body'), (req, res) => getController().update(req, res));
    router.delete('/treaty-templates/:id', ...authMiddleware, (0, schemaValidation_1.validateSchema)(treatyTemplateSchemas_1.treatyTemplateSchemas.param, 'params'), (req, res) => getController().delete(req, res));
    app.use('/api/v2', router);
}
//# sourceMappingURL=treatyTemplateRoutes.js.map