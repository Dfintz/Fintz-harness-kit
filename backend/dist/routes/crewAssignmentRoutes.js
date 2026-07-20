"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCrewAssignmentRoutes = setCrewAssignmentRoutes;
const express_1 = require("express");
const crewAssignmentController_1 = require("../controllers/crewAssignmentController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken];
let crewAssignmentController;
const getController = () => {
    if (!crewAssignmentController) {
        crewAssignmentController = new crewAssignmentController_1.CrewAssignmentController();
    }
    return crewAssignmentController;
};
function setCrewAssignmentRoutes(app) {
    router.post('/crew-assignments', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.create, 'body'), (req, res) => getController().createAssignment(req, res));
    router.get('/crew-assignments', ...authStack, (req, res) => getController().getAssignments(req, res));
    router.get('/crew-assignments/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getAssignmentById(req, res));
    router.post('/crew-assignments/:id/crew', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.addMember, 'body'), (req, res) => getController().addCrewMember(req, res));
    router.delete('/crew-assignments/:id/crew/:userId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.removeMember, 'body'), (req, res) => getController().removeCrewMember(req, res));
    router.put('/crew-assignments/:id/status', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().updateStatus(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=crewAssignmentRoutes.js.map