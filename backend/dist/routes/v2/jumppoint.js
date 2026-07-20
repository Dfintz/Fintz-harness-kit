"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const jumpPointController_1 = require("../../controllers/v2/jumpPointController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const jumpPointSchemas_1 = require("../../schemas/jumpPointSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let jumpPointController;
const getController = () => {
    if (!jumpPointController) {
        jumpPointController = new jumpPointController_1.JumpPointController();
    }
    return jumpPointController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:jumpPointId', ...orgAuth, (req, res) => getController().getById(req, res));
router.put('/:jumpPointId', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:jumpPointId', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.delete, 'body'), (req, res) => getController().delete(req, res));
router.post('/:jumpPointId/activate', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.activate, 'body'), (req, res) => getController().activate(req, res));
router.post('/:jumpPointId/deactivate', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.deactivate, 'body'), (req, res) => getController().deactivate(req, res));
router.get('/:jumpPointId/status', ...orgAuth, (req, res) => getController().getStatus(req, res));
router.get('/:jumpPointId/traffic', ...orgAuth, (req, res) => getController().getTraffic(req, res));
router.post('/link', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.linkByCode, 'body'), (req, res) => getController().linkByCode(req, res));
router.post('/:jumpPointId/ban', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.ban, 'body'), (req, res) => getController().banUser(req, res));
router.post('/:jumpPointId/unban', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.unban, 'body'), (req, res) => getController().unbanUser(req, res));
router.get('/:jumpPointId/bans', ...orgAuth, (req, res) => getController().listBans(req, res));
router.get('/:jumpPointId/analytics', ...orgAuth, (0, schemaValidation_1.validateSchema)(jumpPointSchemas_1.jumpPointSchemas.analyticsQuery, 'query'), (req, res) => getController().getAnalyticsHistory(req, res));
router.get('/:jumpPointId/messages', ...orgAuth, (req, res) => getController().getMessages(req, res));
router.post('/:jumpPointId/regenerate-code', ...orgAuth, (req, res) => getController().regenerateInviteCode(req, res));
router.get('/stats/system', ...orgAuth, (req, res) => getController().getSystemStats(req, res));
//# sourceMappingURL=jumppoint.js.map