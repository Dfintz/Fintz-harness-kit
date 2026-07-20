"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const configController_1 = require("../../controllers/v2/configController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const configSchemas_1 = require("../../schemas/configSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let configController;
const getController = () => {
    if (!configController) {
        configController = new configController_1.ConfigController();
    }
    return configController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/export', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.exportQuery, 'query'), (req, res) => getController().exportConfig(req, res));
router.get('/schema', ...orgAuth, (req, res) => getController().getSchema(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.query, 'query'), (req, res) => getController().getAll(req, res));
router.put('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.updateAll, 'body'), (req, res) => getController().updateAll(req, res));
router.post('/import', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.importConfig, 'body'), (req, res) => getController().importConfig(req, res));
router.get('/:key', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.param, 'params'), (req, res) => getController().getByKey(req, res));
router.put('/:key', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.updateKey, 'body'), (req, res) => getController().updateByKey(req, res));
router.delete('/:key', ...orgAuth, (0, schemaValidation_1.validateSchema)(configSchemas_1.configSchemas.param, 'params'), (req, res) => getController().deleteByKey(req, res));
//# sourceMappingURL=config.js.map