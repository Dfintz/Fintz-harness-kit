"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const tagController_1 = require("../../controllers/v2/tagController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const tagSchemas_1 = require("../../schemas/tagSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let tagController;
const getController = () => {
    if (!tagController) {
        tagController = new tagController_1.TagController();
    }
    return tagController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/popular', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.query, 'query'), (req, res) => getController().getPopularTags(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.query, 'query'), (req, res) => getController().listTags(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.create, 'body'), (req, res) => getController().createTag(req, res));
router.get('/:tagId', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.param, 'params'), (req, res) => getController().getTag(req, res));
router.put('/:tagId', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.update, 'body'), (req, res) => getController().updateTag(req, res));
router.delete('/:tagId', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.param, 'params'), (req, res) => getController().deleteTag(req, res));
router.post('/:tagId/apply', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.apply, 'body'), (req, res) => getController().applyTag(req, res));
router.delete('/:tagId/remove', ...orgAuth, (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(tagSchemas_1.tagSchemas.remove, 'body'), (req, res) => getController().removeTag(req, res));
//# sourceMappingURL=tags.js.map