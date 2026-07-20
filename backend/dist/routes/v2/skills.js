"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const skillController_1 = require("../../controllers/v2/skillController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const skillSchemas_1 = require("../../schemas/skillSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let skillController;
const getController = () => {
    if (!skillController) {
        skillController = new skillController_1.SkillController();
    }
    return skillController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/categories', ...orgAuth, (req, res) => getController().getCategories(req, res));
router.get('/user/:userId', ...orgAuth, (req, res) => getController().getUserSkills(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.query, 'query'), (req, res) => getController().listSkills(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.create, 'body'), (req, res) => getController().createSkill(req, res));
router.get('/:skillId', ...orgAuth, (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.param, 'params'), (req, res) => getController().getSkill(req, res));
router.put('/:skillId', ...orgAuth, (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.update, 'body'), (req, res) => getController().updateSkill(req, res));
router.delete('/:skillId', ...orgAuth, (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.param, 'params'), (req, res) => getController().deleteSkill(req, res));
router.post('/:skillId/endorse', ...orgAuth, (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(skillSchemas_1.skillSchemas.endorse, 'body'), (req, res) => getController().endorseSkill(req, res));
//# sourceMappingURL=skills.js.map