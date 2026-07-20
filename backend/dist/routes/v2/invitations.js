"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const invitationController_1 = require("../../controllers/invitationController");
const auth_1 = require("../../middleware/auth");
const botOrUserAuth_1 = require("../../middleware/botOrUserAuth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let invitationController;
const getController = () => {
    if (!invitationController) {
        invitationController = new invitationController_1.InvitationController();
    }
    return invitationController;
};
router.get('/users/me/invitations', botOrUserAuth_1.botOrUserAuth, (req, res) => getController().getMyInvitations(req, res));
router.post('/invitations/:token/accept', auth_1.authenticate, (req, res) => getController().acceptInvitation(req, res));
router.post('/invitations/:token/decline', auth_1.authenticate, (req, res) => getController().declineInvitation(req, res));
router.post('/invitations/code/:code/accept', botOrUserAuth_1.botOrUserAuth, (req, res) => getController().acceptInvitationByCode(req, res));
router.post('/invitations/code/:code/decline', botOrUserAuth_1.botOrUserAuth, (req, res) => getController().declineInvitationByCode(req, res));
router.post('/organizations/:orgId/invitations', auth_1.authenticate, rateLimiting_1.organizationInvitationRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.invitationSchemas.send, 'body'), (req, res) => getController().sendInvitation(req, res));
router.get('/organizations/:orgId/invitations', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.invitationSchemas.listQuery, 'query'), (req, res) => getController().getInvitations(req, res));
router.patch('/organizations/:orgId/invitations/:id/approve', auth_1.authenticate, (req, res) => getController().approveInvitation(req, res));
router.patch('/organizations/:orgId/invitations/:id/reject', auth_1.authenticate, (req, res) => getController().rejectInvitation(req, res));
//# sourceMappingURL=invitations.js.map