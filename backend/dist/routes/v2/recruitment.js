"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const recruitmentController_1 = require("../../controllers/recruitmentController");
const botOrUserAuth_1 = require("../../middleware/botOrUserAuth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let recruitmentController;
const getController = () => {
    if (!recruitmentController) {
        recruitmentController = new recruitmentController_1.RecruitmentController();
    }
    return recruitmentController;
};
router.get('/my-applications', botOrUserAuth_1.botOrUserAuth, (req, res) => getController().getMyApplications(req, res));
router.post('/:id/discord-apply', botOrUserAuth_1.botOrUserAuth, (req, res) => getController().discordApply(req, res));
router.post('/:id/apply', botOrUserAuth_1.botOrUserAuth, tenantContext_1.tenantContextMiddleware, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.apply, 'body'), (req, res) => getController().submitApplication(req, res));
router.post('/:id/invite-binding', botOrUserAuth_1.botOrUserAuth, tenantContext_1.tenantContextMiddleware, (req, res) => getController().createInviteBinding(req, res));
router.use(botOrUserAuth_1.botOrUserAuth);
router.use(tenantContext_1.tenantContextMiddleware);
router.use(tenantContext_1.requireTenantContext);
router.get('/', (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.query, 'query'), (req, res) => getController().listRecruitments(req, res));
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.create, 'body'), (req, res) => getController().createRecruitment(req, res));
router.get('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getRecruitment(req, res));
router.put('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.update, 'body'), (req, res) => getController().updateRecruitment(req, res));
router.delete('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteRecruitment(req, res));
router.put('/:id/status', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
router.get('/:id/applications', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.applicationQuery, 'query'), (req, res) => getController().listApplications(req, res));
router.put('/:id/applications/:applicationId', (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.applicationParams, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.reviewApplication, 'body'), (req, res) => getController().reviewApplication(req, res));
//# sourceMappingURL=recruitment.js.map