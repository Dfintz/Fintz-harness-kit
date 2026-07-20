"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCargoManifestRoutes = setCargoManifestRoutes;
const express_1 = require("express");
const cargoManifestController_1 = require("../controllers/cargoManifestController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let cargoManifestController;
const getCargoManifestController = () => {
    if (!cargoManifestController) {
        cargoManifestController = new cargoManifestController_1.CargoManifestController();
    }
    return cargoManifestController;
};
function setCargoManifestRoutes(app) {
    router.post('/cargo-manifests', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.cargoSchemas.create, 'body'), (req, res) => getCargoManifestController().createManifest(req, res));
    router.get('/cargo-manifests', ...authStack, (req, res) => getCargoManifestController().getManifests(req, res));
    router.get('/cargo-manifests/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getCargoManifestController().getManifestById(req, res));
    router.post('/cargo-manifests/:id/cargo', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.cargoSchemas.addItem, 'body'), (req, res) => getCargoManifestController().addCargoItem(req, res));
    router.put('/cargo-manifests/:id/status', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.cargoSchemas.updateStatus, 'body'), (req, res) => getCargoManifestController().updateStatus(req, res));
    router.put('/cargo-manifests/:id/sharing', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.cargoSchemas.updateSharing, 'body'), (req, res) => getCargoManifestController().updateSharing(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=cargoManifestRoutes.js.map