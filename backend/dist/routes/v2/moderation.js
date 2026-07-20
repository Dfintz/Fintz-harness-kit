"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const moderationController_1 = require("../../controllers/v2/moderationController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const moderationSchemas_1 = require("../../schemas/moderationSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let moderationController;
const getController = () => {
    if (!moderationController) {
        moderationController = new moderationController_1.ModerationController();
    }
    return moderationController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/incidents', ...orgAuth, (0, schemaValidation_1.validateSchema)(moderationSchemas_1.moderationSchemas.searchQuery, 'query'), (req, res) => getController().searchIncidents(req, res));
router.post('/incidents', ...orgAuth, (0, schemaValidation_1.validateSchema)(moderationSchemas_1.moderationSchemas.createIncident, 'body'), (req, res) => getController().createIncident(req, res));
router.get('/incidents/:incidentId', ...orgAuth, (req, res) => getController().getIncident(req, res));
router.patch('/incidents/:incidentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(moderationSchemas_1.moderationSchemas.updateIncident, 'body'), (req, res) => getController().updateIncident(req, res));
router.post('/incidents/:incidentId/revoke', ...orgAuth, (0, schemaValidation_1.validateSchema)(moderationSchemas_1.moderationSchemas.revokeIncident, 'body'), (req, res) => getController().revokeIncident(req, res));
router.post('/incidents/:incidentId/share', ...orgAuth, (req, res) => getController().shareIncident(req, res));
router.post('/incidents/:incidentId/unshare', ...orgAuth, (req, res) => getController().unshareIncident(req, res));
router.get('/lookup/:discordId', ...orgAuth, (req, res) => getController().lookupUser(req, res));
router.get('/analytics', ...orgAuth, (req, res) => getController().getAnalytics(req, res));
router.get('/repeat-offenders', ...orgAuth, (req, res) => getController().getRepeatOffenders(req, res));
router.get('/statistics', ...orgAuth, (req, res) => getController().getStatistics(req, res));
router.get('/sharing/config', ...orgAuth, (req, res) => getController().getSharingConfig(req, res));
router.put('/sharing/config', ...orgAuth, (0, schemaValidation_1.validateSchema)(moderationSchemas_1.moderationSchemas.updateSharingConfig, 'body'), (req, res) => getController().updateSharingConfig(req, res));
//# sourceMappingURL=moderation.js.map