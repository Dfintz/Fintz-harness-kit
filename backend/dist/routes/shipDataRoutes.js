"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setShipDataRoutes = void 0;
const express_1 = require("express");
const shipDataController_1 = require("../controllers/shipDataController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken];
let shipController;
const getController = () => {
    if (!shipController) {
        shipController = new shipDataController_1.ShipController();
    }
    return shipController;
};
const setShipDataRoutes = (app) => {
    router.get('/ships/stats', ...authStack, (req, res) => getController().getStats(req, res));
    router.get('/ships/manufacturers', ...authStack, (req, res) => getController().getManufacturers(req, res));
    router.get('/ships/roles', ...authStack, (req, res) => getController().getRoles(req, res));
    router.get('/ships/vehicles', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.vehicleQuery, 'query'), (req, res) => getController().getVehicles(req, res));
    router.get('/ships/spacecraft', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.spacecraftQuery, 'query'), (req, res) => getController().getSpacecraft(req, res));
    router.get('/ships/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.idParam, 'params'), (req, res) => getController().getShipById(req, res));
    router.get('/ships', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.listQuery, 'query'), (req, res) => getController().getAllShips(req, res));
    router.post('/ships', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.createShip), (req, res) => getController().createShip(req, res));
    router.put('/ships/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.updateShip), (req, res) => getController().updateShip(req, res));
    router.delete('/ships/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.shipDataSchemas.idParam, 'params'), (req, res) => getController().deleteShip(req, res));
    app.use('/api', router);
};
exports.setShipDataRoutes = setShipDataRoutes;
//# sourceMappingURL=shipDataRoutes.js.map