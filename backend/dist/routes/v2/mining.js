"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const miningOperationController_1 = require("../../controllers/miningOperationController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
let miningOperationController;
const getController = () => {
    if (!miningOperationController) {
        miningOperationController = new miningOperationController_1.MiningOperationController();
    }
    return miningOperationController;
};
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.miningSchemas.createOperation, 'body'), (req, res) => getController().createMiningOperation(req, res));
router.get('/', (req, res) => getController().getMiningOperations(req, res));
router.get('/regolith/:location', (req, res) => getController().getRegolithSummary(req, res));
router.get('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getMiningOperationById(req, res));
router.put('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.miningSchemas.update, 'body'), (req, res) => getController().updateMiningOperation(req, res));
router.delete('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteMiningOperation(req, res));
router.post('/:id/crew', (0, schemaValidation_1.validateSchema)(schemas_1.miningSchemas.addCrewMember, 'body'), (req, res) => getController().addCrewMember(req, res));
router.post('/:id/resources', (0, schemaValidation_1.validateSchema)(schemas_1.miningSchemas.updateResources, 'body'), (req, res) => getController().recordResources(req, res));
router.put('/:id/status', (0, schemaValidation_1.validateSchema)(schemas_1.miningSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
//# sourceMappingURL=mining.js.map