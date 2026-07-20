"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOrganizationShipRoutes = void 0;
const express_1 = require("express");
const organizationShipController_1 = require("../controllers/organizationShipController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let controller;
const getController = () => {
    if (!controller) {
        controller = new organizationShipController_1.OrganizationShipController();
    }
    return controller;
};
const SHIP_WRITE_ROLES = ['founder', 'owner', 'admin'];
const authStack = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/organizations/:orgId/ships', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.organizationShipSchemas.query, 'query'), (req, res) => getController().getOrgShips(req, res));
router.get('/organizations/:orgId/ships/summary', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getFleetSummary(req, res));
router.get('/organizations/:orgId/ships/:shipId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getOrgShipById(req, res));
router.post('/organizations/:orgId/ships', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.organizationShipSchemas.createOrgShip, 'body'), (req, res) => getController().createOrgShip(req, res));
router.patch('/organizations/:orgId/ships/:shipId', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.organizationShipSchemas.updateOrgShip, 'body'), (req, res) => getController().updateOrgShip(req, res));
router.delete('/organizations/:orgId/ships/:shipId', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().deleteOrgShip(req, res));
router.post('/organizations/:orgId/ships/:shipId/captain', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.organizationShipSchemas.assignCaptain, 'body'), (req, res) => getController().assignCaptain(req, res));
router.post('/organizations/:orgId/ships/:shipId/crew', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.organizationShipSchemas.assignCrew, 'body'), (req, res) => getController().assignCrew(req, res));
router.post('/organizations/:orgId/ships/:shipId/crew/:userId', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().addCrewMember(req, res));
router.delete('/organizations/:orgId/ships/:shipId/crew/:userId', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().removeCrewMember(req, res));
router.get('/organizations/:orgId/ships/maintenance/due', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getShipsNeedingMaintenance(req, res));
router.get('/organizations/:orgId/ships/capital', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getCapitalShips(req, res));
router.get('/organizations/:orgId/ships/role/:role', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getShipsByRole(req, res));
router.get('/organizations/:orgId/ships/available', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().getAvailableShips(req, res));
router.post('/organizations/:orgId/ships/:shipId/loan', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().loanOrgShip(req, res));
router.post('/organizations/:orgId/ships/:shipId/return', ...authStack, (0, tenantContext_1.requireOrganizationRole)(SHIP_WRITE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.orgId, 'params'), (req, res) => getController().returnOrgShipLoan(req, res));
const setOrganizationShipRoutes = (app) => {
    app.use('/api', router);
    app.use('/api/v2', router);
};
exports.setOrganizationShipRoutes = setOrganizationShipRoutes;
//# sourceMappingURL=organizationShipRoutes.js.map