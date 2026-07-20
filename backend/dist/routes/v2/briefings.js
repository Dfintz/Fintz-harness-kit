"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const body_parser_1 = require("body-parser");
const express_1 = require("express");
const briefingController_1 = require("../../controllers/briefingController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.use(tenantContext_1.tenantContextMiddleware);
let briefingController;
const getController = () => {
    if (!briefingController) {
        briefingController = new briefingController_1.BriefingController();
    }
    return briefingController;
};
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.create, 'body'), (req, res) => getController().createBriefing(req, res));
router.get('/', (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.query, 'query'), (req, res) => getController().getAllBriefings(req, res));
router.get('/mission/:missionId', (req, res) => getController().getBriefingsByMission(req, res));
router.get('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBriefing(req, res));
router.put('/:id', (0, body_parser_1.json)({ limit: '12mb' }), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.update, 'body'), (req, res) => getController().updateBriefing(req, res));
router.delete('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteBriefing(req, res));
router.post('/:id/elements', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.addElement, 'body'), (req, res) => getController().addElement(req, res));
router.put('/:id/elements/:elementId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.updateElement, 'body'), (req, res) => getController().updateElement(req, res));
router.delete('/:id/elements/:elementId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteElement(req, res));
router.post('/:id/participants', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.addParticipant, 'body'), (req, res) => getController().addParticipant(req, res));
router.delete('/:id/participants', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().removeParticipant(req, res));
router.put('/:id/status', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
router.post('/:id/version', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().createVersion(req, res));
//# sourceMappingURL=briefings.js.map