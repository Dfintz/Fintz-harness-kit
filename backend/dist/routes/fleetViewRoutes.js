"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFleetViewRoutes = void 0;
const express_1 = require("express");
const fleetViewController_1 = require("../controllers/fleetViewController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const fleetViewSchemas_1 = require("../schemas/fleetViewSchemas");
const router = (0, express_1.Router)();
let controller;
const getController = () => {
    if (!controller) {
        controller = new fleetViewController_1.FleetViewController();
    }
    return controller;
};
const setFleetViewRoutes = (app) => {
    router.get('/fleet/export/user', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(fleetViewSchemas_1.fleetViewSchemas.exportQuery, 'query'), (req, res) => getController().exportUserFleet(req, res));
    router.get('/fleet/export/org/:organizationId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(fleetViewSchemas_1.fleetViewSchemas.exportOrgQuery, 'query'), (req, res) => getController().exportOrgFleet(req, res));
    router.post('/fleet/import/user', auth_1.authenticateToken, getController().uploadMiddleware, (0, schemaValidation_1.validateSchema)(fleetViewSchemas_1.fleetViewSchemas.importFile, 'body'), (req, res) => getController().importUserFleet(req, res));
    router.post('/fleet/import/org/:organizationId', auth_1.authenticateToken, getController().uploadMiddleware, (0, schemaValidation_1.validateSchema)(fleetViewSchemas_1.fleetViewSchemas.importFile, 'body'), (req, res) => getController().importOrgFleet(req, res));
    router.post('/fleet/validate', auth_1.authenticateToken, getController().uploadMiddleware, (req, res) => getController().validateSchema(req, res));
    app.use('/api', router);
    app.use('/api/v2', router);
};
exports.setFleetViewRoutes = setFleetViewRoutes;
//# sourceMappingURL=fleetViewRoutes.js.map