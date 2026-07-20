"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setReputationRoutes = setReputationRoutes;
const express_1 = require("express");
const reputationController_1 = require("../controllers/reputationController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken];
let reputationController;
const getController = () => {
    if (!reputationController) {
        reputationController = new reputationController_1.ReputationController();
    }
    return reputationController;
};
function setReputationRoutes(app) {
    router.get('/reputation/:userId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getUserReputation(req, res));
    router.put('/reputation/:userId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.reputationSchemas.update, 'body'), (req, res) => getController().updateReputation(req, res));
    router.get('/reputation/top', ...authStack, (req, res) => getController().getTopReputation(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=reputationRoutes.js.map