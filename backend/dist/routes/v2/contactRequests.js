"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const contactRequestController_1 = require("../../controllers/contactRequestController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let contactRequestController;
const getController = () => {
    if (!contactRequestController) {
        contactRequestController = new contactRequestController_1.ContactRequestController();
    }
    return contactRequestController;
};
router.post('/contact/submit', (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.submitContactRequest, 'body'), (req, res) => getController().submitContactRequest(req, res));
router.get('/contact/options', (req, res) => getController().getContactOptions(req, res));
router.use(auth_1.authenticate);
router.get('/:organizationId', (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.listContactRequestsQuery, 'query'), (req, res) => getController().getOrganizationContactRequests(req, res));
router.get('/:organizationId/stats', (req, res) => getController().getOrganizationContactStats(req, res));
router.get('/:organizationId/:requestId', (req, res) => getController().getOrganizationContactRequest(req, res));
router.put('/:organizationId/:requestId', (0, schemaValidation_1.validateSchema)(schemas_1.contactRequestSchemas.updateContactRequest, 'body'), (req, res) => getController().updateOrganizationContactRequest(req, res));
//# sourceMappingURL=contactRequests.js.map