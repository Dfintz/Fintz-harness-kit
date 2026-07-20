"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const rsiRoleMappingController_1 = require("../../controllers/rsiRoleMappingController");
const botOrUserAuth_1 = require("../../middleware/botOrUserAuth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const rsiRoleMappingSchemas_1 = require("../../schemas/rsiRoleMappingSchemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(botOrUserAuth_1.botOrUserAuth);
let roleMappingController;
const getController = () => {
    if (!roleMappingController) {
        roleMappingController = new rsiRoleMappingController_1.RsiRoleMappingController();
    }
    return roleMappingController;
};
router.get('/templates', (req, res) => getController().getTemplates(req, res));
router.get('/templates/:templateName', (req, res) => getController().getTemplateDetails(req, res));
router.get('/:organizationId', (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.listMappingsQuery, 'query'), (req, res) => getController().getMappings(req, res));
router.get('/:organizationId/discovered-ranks', (req, res) => getController().getDiscoveredRanks(req, res));
router.get('/:organizationId/preview', (req, res) => getController().getSyncPreview(req, res));
router.get('/:organizationId/summary', (req, res) => getController().getSummary(req, res));
router.get('/:organizationId/:id', (req, res) => getController().getMapping(req, res));
router.post('/:organizationId', (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.createMapping, 'body'), (req, res) => getController().createMapping(req, res));
router.put('/:organizationId/:id', (0, schemaValidation_1.validateSchema)(rsiRoleMappingSchemas_1.rsiRoleMappingSchemas.updateMapping, 'body'), (req, res) => getController().updateMapping(req, res));
router.delete('/:organizationId/:id', (req, res) => getController().deleteMapping(req, res));
//# sourceMappingURL=rsiRoleMapping.js.map