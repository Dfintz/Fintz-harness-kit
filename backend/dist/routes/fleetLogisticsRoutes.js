"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFleetLogisticsRoutes = setFleetLogisticsRoutes;
const express_1 = require("express");
const fleetLogisticsController_1 = require("../controllers/fleetLogisticsController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const statusSchemas_1 = require("../schemas/statusSchemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken];
let fleetLogisticsController;
const getController = () => {
    if (!fleetLogisticsController) {
        fleetLogisticsController = new fleetLogisticsController_1.FleetLogisticsController();
    }
    return fleetLogisticsController;
};
function setFleetLogisticsRoutes(app) {
    router.post('/fleet-logistics', ...authStack, (req, res) => getController().createLogistics(req, res));
    router.get('/fleet-logistics', ...authStack, (req, res) => getController().getLogistics(req, res));
    router.get('/fleet-logistics/:id', ...authStack, (req, res) => getController().getLogisticsById(req, res));
    router.put('/fleet-logistics/:id', ...authStack, (req, res) => getController().updateLogistics(req, res));
    router.put('/fleet-logistics/:id/status', ...authStack, (0, schemaValidation_1.validateSchema)(statusSchemas_1.logisticsStatusSchema, 'body'), (req, res) => getController().updateStatus(req, res));
    router.get('/fleet-logistics/:id/fuel-requirements', ...authStack, (req, res) => getController().calculateFuelRequirements(req, res));
    router.get('/fleet-logistics/:id/cargo-capacity', ...authStack, (req, res) => getController().calculateCargoCapacity(req, res));
    router.get('/fleet-logistics/:id/jump-range', ...authStack, (req, res) => getController().calculateJumpRange(req, res));
    router.delete('/fleet-logistics/:id', ...authStack, (req, res) => getController().deleteLogistics(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=fleetLogisticsRoutes.js.map