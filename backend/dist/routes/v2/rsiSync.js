"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const rsiSyncScheduleController_1 = require("../../controllers/rsiSyncScheduleController");
const auth_1 = require("../../middleware/auth");
const orgMembership_1 = require("../../middleware/orgMembership");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const rsiSyncScheduleSchemas_1 = require("../../schemas/rsiSyncScheduleSchemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.param('orgId', (req, res, next) => {
    (0, orgMembership_1.requireOrgMembership)(req, res, next).catch(next);
});
let syncController;
const getController = () => {
    if (!syncController) {
        syncController = new rsiSyncScheduleController_1.RsiSyncScheduleController();
    }
    return syncController;
};
const auth = (handler) => (req, res) => handler(req, res);
router.get('/schedule/:orgId', auth((...args) => getController().getSchedule(...args)));
router.post('/schedule/:orgId', (0, schemaValidation_1.validateSchema)(rsiSyncScheduleSchemas_1.rsiSyncScheduleSchemas.upsertSchedule, 'body'), auth((...args) => getController().upsertSchedule(...args)));
router.post('/schedule/:orgId/enable', auth((...args) => getController().enableSchedule(...args)));
router.post('/schedule/:orgId/disable', auth((...args) => getController().disableSchedule(...args)));
router.delete('/schedule/:orgId', auth((...args) => getController().deleteSchedule(...args)));
router.get('/audit/:orgId', auth((...args) => getController().getAuditLogs(...args)));
router.get('/audit/:orgId/stats', auth((...args) => getController().getAuditStats(...args)));
router.get('/audit/:orgId/:logId', auth((...args) => getController().getAuditLogById(...args)));
router.post('/trigger/:orgId', auth((...args) => getController().triggerManualSync(...args)));
router.get('/members/:orgId', auth((...args) => getController().listMembers(...args)));
router.post('/manual-assign/:orgId', (0, schemaValidation_1.validateSchema)(rsiSyncScheduleSchemas_1.rsiSyncScheduleSchemas.manualAssign, 'body'), auth((...args) => getController().manualAssign(...args)));
router.post('/members/:orgId/:linkId/verify', auth((...args) => getController().manualVerify(...args)));
router.delete('/members/:orgId/:linkId', auth((...args) => getController().removeMember(...args)));
router.post('/bulk-verify/:orgId', (0, schemaValidation_1.validateSchema)(rsiSyncScheduleSchemas_1.rsiSyncScheduleSchemas.bulkVerify, 'body'), auth((...args) => getController().bulkVerify(...args)));
router.post('/bulk-assign/:orgId', (0, schemaValidation_1.validateSchema)(rsiSyncScheduleSchemas_1.rsiSyncScheduleSchemas.bulkAssign, 'body'), auth((...args) => getController().bulkAssign(...args)));
router.get('/review/:orgId', auth((...args) => getController().getReviewQueue(...args)));
router.post('/review/:orgId/resolve', (0, schemaValidation_1.validateSchema)(rsiSyncScheduleSchemas_1.rsiSyncScheduleSchemas.resolveReview, 'body'), auth((...args) => getController().resolveReviewItem(...args)));
router.get('/review/:orgId/stats', auth((...args) => getController().getReviewStats(...args)));
router.post('/review/:orgId/flag', (0, schemaValidation_1.validateSchema)(rsiSyncScheduleSchemas_1.rsiSyncScheduleSchemas.flagForReview, 'body'), auth((...args) => getController().flagForReview(...args)));
//# sourceMappingURL=rsiSync.js.map