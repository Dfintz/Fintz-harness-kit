"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const contactRequestController_1 = require("../controllers/contactRequestController");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let contactRequestController;
const getContactRequestController = () => {
    if (!contactRequestController) {
        contactRequestController = new contactRequestController_1.ContactRequestController();
    }
    return contactRequestController;
};
router.post('/directory/contact', auth_1.authenticateToken, rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.submitContactRequest, 'body'), (req, res) => getContactRequestController().submitContactRequest(req, res));
router.get('/directory/contact/options', rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getContactOptions(req, res));
router.get('/inbox/sent', auth_1.authenticateToken, rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getSentMessages(req, res));
router.get('/inbox/unread-count', auth_1.authenticateToken, rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getUnreadCount(req, res));
router.get('/inbox/:requestId', auth_1.authenticateToken, rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getInboxMessage(req, res));
router.post('/inbox/:requestId/replies', auth_1.authenticateToken, rateLimiting_1.organizationUpdateRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.addReply, 'body'), (req, res) => getContactRequestController().addSenderReply(req, res));
router.patch('/inbox/:requestId/archive', auth_1.authenticateToken, rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().archiveMessage(req, res));
router.delete('/inbox/:requestId', auth_1.authenticateToken, rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().deleteMessage(req, res));
router.get('/organizations/:id/contact-requests', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.listContactRequestsQuery, 'query'), rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getOrganizationContactRequests(req, res));
router.get('/organizations/:id/contact-requests/stats', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getOrganizationContactStats(req, res));
router.get('/organizations/:id/contact-requests/:requestId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.organizationContactParams, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getOrganizationContactRequest(req, res));
router.get('/organizations/:id/contact-requests/:requestId/replies', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.organizationContactParams, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getOrganizationContactReplies(req, res));
router.post('/organizations/:id/contact-requests/:requestId/replies', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.organizationContactParams, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.addReply, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().addOrganizationReply(req, res));
router.patch('/organizations/:id/contact-requests/:requestId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.organizationContactParams, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.updateContactRequest, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().updateOrganizationContactRequest(req, res));
router.delete('/organizations/:id/contact-requests/:requestId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.organizationContactParams, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().deleteOrganizationContactRequest(req, res));
router.get('/federations/:allianceId/contact-requests', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.listContactRequestsQuery, 'query'), rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getAllianceContactRequests(req, res));
router.get('/federations/:allianceId/contact-requests/stats', auth_1.authenticateToken, rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getAllianceContactStats(req, res));
router.get('/federations/:allianceId/contact-requests/:requestId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.allianceContactParams, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getContactRequestController().getAllianceContactRequest(req, res));
router.patch('/federations/:allianceId/contact-requests/:requestId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.allianceContactParams, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.updateContactRequest, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().updateAllianceContactRequest(req, res));
router.delete('/federations/:allianceId/contact-requests/:requestId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.allianceContactParams, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getContactRequestController().deleteAllianceContactRequest(req, res));
//# sourceMappingURL=contactRequestRoutes.js.map