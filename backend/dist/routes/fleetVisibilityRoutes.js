"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFleetVisibilityRoutes = setFleetVisibilityRoutes;
const express_1 = require("express");
const FleetVisibilityController_1 = require("../controllers/FleetVisibilityController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const fleetVisibilitySchemas_1 = require("../schemas/fleetVisibilitySchemas");
const router = (0, express_1.Router)();
const authMiddleware = [auth_1.authenticateToken, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let controller;
const getController = () => {
    if (!controller) {
        controller = new FleetVisibilityController_1.FleetVisibilityController();
    }
    return controller;
};
function setFleetVisibilityRoutes(app) {
    router.get('/fleets/:id/visibility-rules', ...authMiddleware, (req, res) => getController().getRules(req, res));
    router.post('/fleets/:id/visibility-rules', ...authMiddleware, (0, schemaValidation_1.validateSchema)(fleetVisibilitySchemas_1.fleetVisibilitySchemas.createRule, 'body'), (req, res) => getController().createRule(req, res));
    router.put('/fleets/:id/visibility-rules/:ruleId', ...authMiddleware, (0, schemaValidation_1.validateSchema)(fleetVisibilitySchemas_1.fleetVisibilitySchemas.updateRule, 'body'), (req, res) => getController().updateRule(req, res));
    router.delete('/fleets/:id/visibility-rules/:ruleId', ...authMiddleware, (req, res) => getController().deleteRule(req, res));
    router.post('/fleets/:id/check-access', ...authMiddleware, (0, schemaValidation_1.validateSchema)(fleetVisibilitySchemas_1.fleetVisibilitySchemas.checkAccess, 'body'), (req, res) => getController().checkAccess(req, res));
    app.use('/api/v2', router);
}
//# sourceMappingURL=fleetVisibilityRoutes.js.map