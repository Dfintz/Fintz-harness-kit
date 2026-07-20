"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const exportController_1 = require("../../controllers/v2/exportController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const exportSchemas_1 = require("../../schemas/exportSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let exportController;
const getController = () => {
    if (!exportController) {
        exportController = new exportController_1.ExportController();
    }
    return exportController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(exportSchemas_1.exportSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/jobs', ...orgAuth, (0, schemaValidation_1.validateSchema)(exportSchemas_1.exportSchemas.query, 'query'), (req, res) => getController().listJobs(req, res));
router.get('/attendance-correlation', ...orgAuth, (0, schemaValidation_1.validateSchema)(exportSchemas_1.exportSchemas.attendanceCorrelation, 'query'), (req, res) => getController().exportAttendanceCorrelation(req, res));
router.get('/:jobId', ...orgAuth, (req, res) => getController().getById(req, res));
router.get('/:jobId/download', ...orgAuth, (req, res) => getController().download(req, res));
router.delete('/:jobId', ...orgAuth, (req, res) => getController().delete(req, res));
//# sourceMappingURL=export.js.map