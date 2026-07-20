"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setIntelVaultRoutes = setIntelVaultRoutes;
const express_1 = require("express");
const intelVaultController_1 = require("../controllers/intelVaultController");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let intelVaultController;
const getController = () => {
    if (!intelVaultController) {
        intelVaultController = new intelVaultController_1.IntelVaultController();
    }
    return intelVaultController;
};
const authStack = [auth_1.authenticateToken];
router.get('/organizations/:orgId/intel/access', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getController().checkAccess(req, res));
router.post('/organizations/:orgId/intel/entries', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.createEntry, 'body'), rateLimiting_1.intelWriteRateLimiter, (req, res) => getController().createEntry(req, res));
router.get('/organizations/:orgId/intel/entries', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryEntries, 'query'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getController().getEntries(req, res));
router.get('/organizations/:orgId/intel/entries/:entryId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getController().getEntry(req, res));
router.patch('/organizations/:orgId/intel/entries/:entryId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.updateEntry, 'body'), rateLimiting_1.intelWriteRateLimiter, (req, res) => getController().updateEntry(req, res));
router.delete('/organizations/:orgId/intel/entries/:entryId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), rateLimiting_1.intelDeleteRateLimiter, (req, res) => getController().deleteEntry(req, res));
router.post('/organizations/:orgId/intel/officers', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.appointOfficer, 'body'), rateLimiting_1.intelOfficerManagementRateLimiter, (req, res) => getController().appointOfficer(req, res));
router.get('/organizations/:orgId/intel/officers', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryOfficers, 'query'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getController().getOfficers(req, res));
router.get('/organizations/:orgId/intel/officers/:officerId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.officerIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getController().getOfficer(req, res));
router.patch('/organizations/:orgId/intel/officers/:officerId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.officerIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.updateOfficer, 'body'), rateLimiting_1.intelOfficerManagementRateLimiter, (req, res) => getController().updateOfficer(req, res));
router.delete('/organizations/:orgId/intel/officers/:officerId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.officerIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.removeOfficer, 'body'), rateLimiting_1.intelOfficerManagementRateLimiter, (req, res) => getController().removeOfficer(req, res));
router.get('/organizations/:orgId/intel/audit-logs', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryAuditLogs, 'query'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getController().getAuditLogs(req, res));
function setIntelVaultRoutes(app) {
    app.use('/api', router);
}
//# sourceMappingURL=intelVaultRoutes.js.map