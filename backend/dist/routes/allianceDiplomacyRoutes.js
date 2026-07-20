"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAllianceDiplomacyRoutes = setAllianceDiplomacyRoutes;
const express_1 = require("express");
const allianceDiplomacyController_1 = require("../controllers/allianceDiplomacyController");
const botOrUserAuth_1 = require("../middleware/botOrUserAuth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const orgAuth = [botOrUserAuth_1.botOrUserAuth];
let allianceDiplomacyController;
const getController = () => {
    if (!allianceDiplomacyController) {
        allianceDiplomacyController = new allianceDiplomacyController_1.AllianceDiplomacyController();
    }
    return allianceDiplomacyController;
};
function setAllianceDiplomacyRoutes(app) {
    router.post('/alliance-diplomacy', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.diplomacySchemas.proposal, 'body'), (req, res) => getController().proposeDiplomacy(req, res));
    router.get('/alliance-diplomacy', ...orgAuth, (req, res) => getController().getDiplomacyRelations(req, res));
    router.get('/alliance-diplomacy/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getDiplomacyById(req, res));
    router.post('/alliance-diplomacy/:id/approve', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().approveDiplomacy(req, res));
    router.post('/alliance-diplomacy/:id/suspend', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().suspendDiplomacy(req, res));
    router.post('/alliance-diplomacy/:id/terminate', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().terminateDiplomacy(req, res));
    router.post('/alliance-diplomacy/:id/incidents', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.diplomacySchemas.incident, 'body'), (req, res) => getController().reportIncident(req, res));
    router.put('/alliance-diplomacy/:id/incidents/:incidentId/resolve', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.diplomacySchemas.resolution, 'body'), (req, res) => getController().resolveIncident(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=allianceDiplomacyRoutes.js.map