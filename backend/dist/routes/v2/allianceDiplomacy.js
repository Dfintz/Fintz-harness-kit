"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const allianceDiplomacyController_1 = require("../../controllers/allianceDiplomacyController");
const botOrUserAuth_1 = require("../../middleware/botOrUserAuth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
const orgAuth = [botOrUserAuth_1.botOrUserAuth];
let allianceDiplomacyController;
const getController = () => {
    if (!allianceDiplomacyController) {
        allianceDiplomacyController = new allianceDiplomacyController_1.AllianceDiplomacyController();
    }
    return allianceDiplomacyController;
};
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.diplomacySchemas.proposal, 'body'), (req, res) => getController().proposeDiplomacy(req, res));
router.get('/', ...orgAuth, (req, res) => getController().getDiplomacyRelations(req, res));
router.get('/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getDiplomacyById(req, res));
router.post('/:id/approve', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().approveDiplomacy(req, res));
router.post('/:id/suspend', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().suspendDiplomacy(req, res));
router.post('/:id/terminate', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().terminateDiplomacy(req, res));
router.post('/:id/incidents', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.diplomacySchemas.incident, 'body'), (req, res) => getController().reportIncident(req, res));
router.put('/:id/incidents/:incidentId/resolve', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.diplomacySchemas.resolution, 'body'), (req, res) => getController().resolveIncident(req, res));
//# sourceMappingURL=allianceDiplomacy.js.map