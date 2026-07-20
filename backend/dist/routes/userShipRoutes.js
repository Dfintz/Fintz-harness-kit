"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserShipRoutes = void 0;
const express_1 = require("express");
const userShipController_1 = require("../controllers/userShipController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let controller;
const getController = () => {
    if (!controller) {
        controller = new userShipController_1.UserShipController();
    }
    return controller;
};
router.get('/users/:userId/ships', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.listQuery, 'query'), (req, res) => getController().getUserShips(req, res));
router.get('/users/:userId/ships/summary', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().getUserShipSummary(req, res));
router.get('/users/:userId/ships/:shipId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userShipParam, 'params'), (req, res) => getController().getUserShipById(req, res));
router.post('/users/:userId/ships', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.createShip, 'body'), (req, res) => getController().createUserShip(req, res));
router.post('/users/:userId/ships/import', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userIdParam, 'params'), (req, res) => getController().bulkImportUserShips(req, res));
router.patch('/users/:userId/ships/:shipId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userShipParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.updateShip, 'body'), (req, res) => getController().updateUserShip(req, res));
router.delete('/users/:userId/ships/:shipId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userShipParam, 'params'), (req, res) => getController().deleteUserShip(req, res));
router.delete('/users/:userId/ships', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.userShipQuerySchemas.userIdParam, 'params'), (req, res) => getController().clearAllUserShips(req, res));
router.get('/users/:userId/ships/insurance/expiring', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().getShipsNeedingInsurance(req, res));
router.post('/users/:userId/ships/:shipId/loan', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.userShipSchemas.loanShip, 'body'), (req, res) => getController().loanShip(req, res));
router.post('/users/:userId/ships/:shipId/return', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().returnLoanedShip(req, res));
router.get('/organizations/:orgId/available-user-ships', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getOrgAvailableShips(req, res));
const setUserShipRoutes = (app) => {
    app.use('/api', router);
    app.use('/api/v2', router);
};
exports.setUserShipRoutes = setUserShipRoutes;
//# sourceMappingURL=userShipRoutes.js.map