"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const squadronController_1 = require("../../controllers/squadronController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.use(tenantContext_1.tenantContextMiddleware);
router.use(tenantContext_1.requireTenantContext);
let squadronController;
const getController = () => {
    if (!squadronController) {
        squadronController = new squadronController_1.SquadronController();
    }
    return squadronController;
};
router.get('/:squadronId/members', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.query, 'query'), (req, res) => getController().getSquadronMembers(req, res));
router.get('/:squadronId/roster', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.query, 'query'), (req, res) => getController().getSquadronRoster(req, res));
router.get('/:squadronId/members/:memberId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getSquadronMemberById(req, res));
router.get('/:squadronId/members/:userId/check', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().checkMembership(req, res));
router.get('/:squadronId/members/:userId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getMembership(req, res));
router.get('/users/:userId/squadrons', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().getUserSquadrons(req, res));
router.post('/:squadronId/members', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.singleMember, 'body'), (req, res) => getController().addMember(req, res));
router.post('/:squadronId/members/bulk', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkAddMembers, 'body'), (req, res) => getController().bulkAddMembers(req, res));
router.patch('/:squadronId/members/:userId/role', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.updateRole, 'body'), (req, res) => getController().updateRole(req, res));
router.delete('/:squadronId/members/:userId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().removeMember(req, res));
router.patch('/members/bulk', (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkUpdateMembers, 'body'), (req, res) => getController().bulkUpdateMembers(req, res));
router.delete('/members/bulk', (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkDeleteMembers, 'body'), (req, res) => getController().bulkDeleteMembers(req, res));
router.patch('/members/bulk/status', (0, schemaValidation_1.validateSchema)(schemas_1.squadronSchemas.bulkUpdateStatus, 'body'), (req, res) => getController().bulkUpdateStatus(req, res));
router.get('/:squadronId/count', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getSquadronMemberCount(req, res));
router.get('/:squadronId/count/active', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getActiveCount(req, res));
router.get('/:squadronId/stats/roles', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getMembersByRole(req, res));
router.get('/:squadronId/stats/ships', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getMembersByShipType(req, res));
router.get('/:squadronId/stats', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.squadronId, 'params'), (req, res) => getController().getSquadronStatistics(req, res));
router.get('/users/:userId/squadrons/count', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (req, res) => getController().getUserSquadronCount(req, res));
//# sourceMappingURL=squadrons.js.map