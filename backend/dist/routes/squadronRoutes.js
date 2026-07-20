"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSquadronRoutes = void 0;
const express_1 = require("express");
const squadronController_1 = require("../controllers/squadronController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let controller;
const getController = () => {
    if (!controller) {
        controller = new squadronController_1.SquadronController();
    }
    return controller;
};
const authStack = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/squadrons/:squadronId/members', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.membersQuery, 'query'), (req, res) => getController().getSquadronMembers(req, res));
router.get('/squadrons/:squadronId/roster', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.rosterQuery, 'query'), (req, res) => getController().getSquadronRoster(req, res));
router.get('/squadrons/:squadronId/members/:memberId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.memberIdParam, 'params'), (req, res) => getController().getSquadronMemberById(req, res));
router.get('/users/:userId/squadrons', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.userIdParam, 'params'), (req, res) => getController().getUserSquadrons(req, res));
router.get('/squadrons/:squadronId/members/:userId/check', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (req, res) => getController().checkMembership(req, res));
router.get('/squadrons/:squadronId/members/:userId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (req, res) => getController().getMembership(req, res));
router.post('/squadrons/:squadronId/members', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.addMemberBody, 'body'), (req, res) => getController().addMember(req, res));
router.post('/squadrons/:squadronId/members/bulk', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkAddMembers, 'body'), (req, res) => getController().bulkAddMembers(req, res));
router.patch('/squadrons/members/bulk', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkUpdateMembers, 'body'), (req, res) => getController().bulkUpdateMembers(req, res));
router.delete('/squadrons/members/bulk', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkDeleteMembers, 'body'), (req, res) => getController().bulkDeleteMembers(req, res));
router.patch('/squadrons/members/bulk/status', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkUpdateStatus, 'body'), (req, res) => getController().bulkUpdateStatus(req, res));
router.patch('/squadrons/:squadronId/members/:userId/role', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.updateRoleBody, 'body'), (req, res) => getController().updateRole(req, res));
router.delete('/squadrons/:squadronId/members/:userId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (req, res) => getController().removeMember(req, res));
router.get('/squadrons/:squadronId/count', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.countQuery, 'query'), (req, res) => getController().getSquadronMemberCount(req, res));
router.get('/squadrons/:squadronId/count/active', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.activeCountQuery, 'query'), (req, res) => getController().getActiveCount(req, res));
router.get('/squadrons/:squadronId/stats/roles', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.roleStatsQuery, 'query'), (req, res) => getController().getMembersByRole(req, res));
router.get('/squadrons/:squadronId/stats/ships', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.shipStatsQuery, 'query'), (req, res) => getController().getMembersByShipType(req, res));
router.get('/squadrons/:squadronId/stats', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.squadronIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.statsQuery, 'query'), (req, res) => getController().getSquadronStatistics(req, res));
router.get('/users/:userId/squadrons/count', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.userIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronQuerySchemas.userSquadronCountQuery, 'query'), (req, res) => getController().getUserSquadronCount(req, res));
const setSquadronRoutes = (app) => {
    app.use('/api', router);
};
exports.setSquadronRoutes = setSquadronRoutes;
//# sourceMappingURL=squadronRoutes.js.map