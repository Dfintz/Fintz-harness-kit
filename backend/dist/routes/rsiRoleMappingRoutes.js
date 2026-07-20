"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRsiRoleMappingRoutes = void 0;
const express_1 = require("express");
const rsiRoleMappingController_1 = require("../controllers/rsiRoleMappingController");
const auth_1 = require("../middleware/auth");
const botOrUserAuth_1 = require("../middleware/botOrUserAuth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const rsiRoleMappingSchemas_1 = require("../schemas/rsiRoleMappingSchemas");
const router = (0, express_1.Router)();
let roleMappingController;
const getController = () => {
    if (!roleMappingController) {
        roleMappingController = new rsiRoleMappingController_1.RsiRoleMappingController();
    }
    return roleMappingController;
};
const setRsiRoleMappingRoutes = (app) => {
    router.get('/rsi-role-mappings/templates', auth_1.authenticateToken, (req, res) => getController().getTemplates(req, res));
    router.get('/rsi-role-mappings/templates/:templateName', auth_1.authenticateToken, (req, res) => getController().getTemplateDetails(req, res));
    router.get('/organizations/:organizationId/rsi-role-mappings', botOrUserAuth_1.botOrUserAuth, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.listMappingsQuery, 'query'), (req, res) => getController().getMappings(req, res));
    router.get('/organizations/:organizationId/rsi-role-mappings/summary', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (req, res) => getController().getSummary(req, res));
    router.get('/organizations/:organizationId/rsi-role-mappings/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (req, res) => getController().getMapping(req, res));
    router.post('/organizations/:organizationId/rsi-role-mappings', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.createMapping, 'body'), (req, res) => getController().createMapping(req, res));
    router.post('/organizations/:organizationId/rsi-role-mappings/apply-template', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.applyTemplate, 'body'), (req, res) => getController().applyTemplate(req, res));
    router.post('/organizations/:organizationId/rsi-role-mappings/bulk', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.bulkUpsert, 'body'), (req, res) => getController().bulkUpsert(req, res));
    router.post('/organizations/:organizationId/rsi-role-mappings/clone', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.cloneMappings, 'body'), (req, res) => getController().cloneMappings(req, res));
    router.put('/organizations/:organizationId/rsi-role-mappings/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.updateMapping, 'body'), (req, res) => getController().updateMapping(req, res));
    router.delete('/organizations/:organizationId/rsi-role-mappings/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (req, res) => getController().deleteMapping(req, res));
    router.delete('/organizations/:organizationId/rsi-role-mappings', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.organizationIdParam, 'params'), (req, res) => getController().deleteAllMappings(req, res));
    app.use('/api', router);
};
exports.setRsiRoleMappingRoutes = setRsiRoleMappingRoutes;
//# sourceMappingURL=rsiRoleMappingRoutes.js.map