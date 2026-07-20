"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const crewAssignmentController_1 = require("../../controllers/crewAssignmentController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let crewAssignmentController;
const getController = () => {
    if (!crewAssignmentController) {
        crewAssignmentController = new crewAssignmentController_1.CrewAssignmentController();
    }
    return crewAssignmentController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.create, 'body'), (req, res) => getController().createAssignment(req, res));
router.get('/', ...orgAuth, (req, res) => getController().getAssignments(req, res));
router.get('/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getAssignmentById(req, res));
router.post('/:id/crew', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.addMember, 'body'), (req, res) => getController().addCrewMember(req, res));
router.delete('/:id/crew/:userId', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.removeCrewParams, 'params'), (req, res) => getController().removeCrewMember(req, res));
router.put('/:id/status', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.crewSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
//# sourceMappingURL=crewAssignments.js.map