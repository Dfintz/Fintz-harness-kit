"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const backupController_1 = require("../../controllers/backupController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const backupSchemas_1 = require("../../schemas/backupSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let backupController;
const getController = () => {
    if (!backupController) {
        backupController = new backupController_1.BackupController();
    }
    return backupController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/status', ...orgAuth, (req, res) => getController().getStatus(req, res));
router.post('/create', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.createBackupSchema, 'body'), (req, res) => getController().createBackup(req, res));
router.get('/list', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.listBackupsQuerySchema, 'query'), (req, res) => getController().listBackups(req, res));
router.get('/:backupId/download', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.backupIdParamSchema, 'params'), (req, res) => getController().downloadBackup(req, res));
router.post('/:backupId/restore', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.backupIdParamSchema, 'params'), (0, schemaValidation_1.validateSchema)(backupSchemas_1.restoreBackupSchema, 'body'), (req, res) => getController().restoreBackup(req, res));
router.delete('/:backupId', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.backupIdParamSchema, 'params'), (req, res) => getController().deleteBackup(req, res));
router.get('/schedule', ...orgAuth, (req, res) => getController().getSchedule(req, res));
router.post('/schedule', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.configureScheduleSchema, 'body'), (req, res) => getController().configureSchedule(req, res));
router.put('/schedule/:scheduleId', ...orgAuth, (0, schemaValidation_1.validateSchema)(backupSchemas_1.updateScheduleSchema, 'body'), (req, res) => getController().updateSchedule(req, res));
//# sourceMappingURL=backup.js.map