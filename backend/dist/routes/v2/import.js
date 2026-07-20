"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const importController_1 = require("../../controllers/v2/importController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const importSchemas_1 = require("../../schemas/importSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let importController;
const getController = () => {
    if (!importController) {
        importController = new importController_1.ImportController();
    }
    return importController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
const authOnly = [auth_1.authenticate];
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(importSchemas_1.importSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.post('/validate', ...authOnly, (0, schemaValidation_1.validateSchema)(importSchemas_1.importSchemas.validate, 'body'), (req, res) => getController().validate(req, res));
router.get('/jobs', ...orgAuth, (0, schemaValidation_1.validateSchema)(importSchemas_1.importSchemas.query, 'query'), (req, res) => getController().listJobs(req, res));
router.get('/:jobId', ...orgAuth, (req, res) => getController().getById(req, res));
router.post('/:jobId/cancel', ...orgAuth, (req, res) => getController().cancel(req, res));
//# sourceMappingURL=import.js.map