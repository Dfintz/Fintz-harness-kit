"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const reputationController_1 = require("../../controllers/reputationController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
let reputationController;
const getController = () => {
    if (!reputationController) {
        reputationController = new reputationController_1.ReputationController();
    }
    return reputationController;
};
router.get('/fleet/:fleetId', (req, res) => getController().getFleetReputation(req, res));
router.get('/:userId/unified', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().getUnifiedReputation(req, res));
router.get('/:userId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().getUserReputation(req, res));
router.put('/:userId', (0, schemaValidation_1.validateSchema)(schemas_1.reputationSchemas.update, 'body'), (req, res) => getController().updateReputation(req, res));
router.get('/top', (req, res) => getController().getTopReputation(req, res));
//# sourceMappingURL=reputation.js.map