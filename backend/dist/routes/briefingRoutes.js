"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBriefingRoutes = void 0;
const express_1 = require("express");
const briefingController_1 = require("../controllers/briefingController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken, tenantContext_1.tenantContextMiddleware];
let briefingController;
const getController = () => {
    if (!briefingController) {
        briefingController = new briefingController_1.BriefingController();
    }
    return briefingController;
};
const setBriefingRoutes = (app) => {
    router.post('/briefings', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.create, 'body'), (req, res) => getController().createBriefing(req, res));
    router.get('/briefings', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.query, 'query'), (req, res) => getController().getAllBriefings(req, res));
    router.get('/briefings/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBriefing(req, res));
    router.get('/briefings/mission/:missionId', ...authStack, (req, res) => getController().getBriefingsByMission(req, res));
    router.put('/briefings/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.update, 'body'), (req, res) => getController().updateBriefing(req, res));
    router.delete('/briefings/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteBriefing(req, res));
    router.post('/briefings/:id/elements', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.addElement, 'body'), (req, res) => getController().addElement(req, res));
    router.put('/briefings/:id/elements/:elementId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.updateElement, 'body'), (req, res) => getController().updateElement(req, res));
    router.delete('/briefings/:id/elements/:elementId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteElement(req, res));
    router.post('/briefings/:id/participants', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.addParticipant, 'body'), (req, res) => getController().addParticipant(req, res));
    router.delete('/briefings/:id/participants', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().removeParticipant(req, res));
    router.put('/briefings/:id/status', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
    router.post('/briefings/:id/version', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().createVersion(req, res));
    router.post('/briefings/:id/post-to-discord', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.briefingSchemas.postToDiscord, 'body'), (req, res) => getController().postToDiscord(req, res));
    app.use('/api/v2', router);
};
exports.setBriefingRoutes = setBriefingRoutes;
//# sourceMappingURL=briefingRoutes.js.map