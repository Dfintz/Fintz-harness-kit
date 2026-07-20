"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const reportController_1 = require("../../controllers/v2/reportController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const reportSchemas_1 = require("../../schemas/reportSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let reportController;
const getController = () => {
    if (!reportController) {
        reportController = new reportController_1.ReportController();
    }
    return reportController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/templates', ...orgAuth, (req, res) => getController().getTemplates(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:reportId', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.put('/:reportId', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:reportId', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.param, 'params'), (req, res) => getController().delete(req, res));
router.post('/:reportId/generate', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.generate, 'body'), (req, res) => getController().generate(req, res));
router.get('/:reportId/download', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.downloadQuery, 'query'), (req, res) => getController().download(req, res));
router.post('/:reportId/schedule', ...orgAuth, (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(reportSchemas_1.reportSchemas.schedule, 'body'), (req, res) => getController().schedule(req, res));
//# sourceMappingURL=reports.js.map