"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const orgApplicationController_1 = require("../../controllers/orgApplicationController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let orgApplicationController;
const getController = () => {
    if (!orgApplicationController) {
        orgApplicationController = new orgApplicationController_1.OrgApplicationController();
    }
    return orgApplicationController;
};
router.get('/users/me/org-applications', auth_1.authenticate, (req, res) => getController().getMyApplications(req, res));
router.get('/organizations/:orgId/application-mode', (req, res) => getController().getApplicationMode(req, res));
router.post('/organizations/:orgId/applications', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.orgApplicationSchemas.submit, 'body'), (req, res) => getController().submitApplication(req, res));
router.get('/organizations/:orgId/applications', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.orgApplicationSchemas.listQuery, 'query'), (req, res) => getController().getApplications(req, res));
router.get('/organizations/:orgId/applications/check', auth_1.authenticate, (req, res) => getController().checkActiveApplication(req, res));
router.patch('/organizations/:orgId/applications/:id/review', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.orgApplicationSchemas.review, 'body'), (req, res) => getController().reviewApplication(req, res));
router.post('/organizations/:orgId/applications/:id/withdraw', auth_1.authenticate, (req, res) => getController().withdrawApplication(req, res));
//# sourceMappingURL=orgApplications.js.map