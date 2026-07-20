"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMiningOperationRoutes = setMiningOperationRoutes;
const express_1 = require("express");
const miningOperationController_1 = require("../controllers/miningOperationController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
let miningOperationController;
const getController = () => {
    if (!miningOperationController) {
        miningOperationController = new miningOperationController_1.MiningOperationController();
    }
    return miningOperationController;
};
function setMiningOperationRoutes(app) {
    router.post('/mining-operations', (0, schemaValidation_1.validateSchema)(schemas_1.miningSchemas.createOperation, 'body'), (req, res) => getController().createMiningOperation(req, res));
    router.get('/mining-operations', (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.listQuery, 'query'), (req, res) => getController().getMiningOperations(req, res));
    router.get('/mining-operations/:id', (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.idParam, 'params'), (req, res) => getController().getMiningOperationById(req, res));
    router.post('/mining-operations/:id/crew', (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.addCrewBody, 'body'), (req, res) => getController().addCrewMember(req, res));
    router.post('/mining-operations/:id/resources', (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.updateResourcesBody, 'body'), (req, res) => getController().recordResources(req, res));
    router.put('/mining-operations/:id/status', (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.miningOperationQuerySchemas.updateStatusBody, 'body'), (req, res) => getController().updateStatus(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=miningOperationRoutes.js.map