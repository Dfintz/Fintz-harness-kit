"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSharedAccountRoutes = void 0;
const express_1 = require("express");
const sharedAccountController_1 = require("../controllers/sharedAccountController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let sharedAccountController;
const getController = () => {
    if (!sharedAccountController) {
        sharedAccountController = new sharedAccountController_1.SharedAccountController();
    }
    return sharedAccountController;
};
const setSharedAccountRoutes = (app) => {
    router.post('/shared-accounts', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.create, 'body'), (req, res) => getController().createSharedAccount(req, res));
    router.post('/shared-accounts/bulk-import', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.bulkImport, 'body'), (req, res) => getController().bulkImport(req, res));
    router.post('/shared-accounts/permissions/grant', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.grantPermission, 'body'), (req, res) => getController().grantPermission(req, res));
    router.get('/shared-accounts/organization/:organizationId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.query, 'query'), (req, res) => getController().getSharedAccountsByOrganization(req, res));
    router.get('/shared-accounts/organization/:organizationId/export', auth_1.authenticateToken, (req, res) => getController().bulkExport(req, res));
    router.get('/shared-accounts/organization/:organizationId/category/:category', auth_1.authenticateToken, (req, res) => getController().getAccountsByCategory(req, res));
    router.get('/shared-accounts/organization/:organizationId/tag/:tag', auth_1.authenticateToken, (req, res) => getController().getAccountsByTag(req, res));
    router.get('/shared-accounts/organization/:organizationId/expired', auth_1.authenticateToken, (req, res) => getController().getExpiredAccounts(req, res));
    router.get('/shared-accounts/organization/:organizationId/expiring-soon', auth_1.authenticateToken, (req, res) => getController().getExpiringSoonAccounts(req, res));
    router.get('/shared-accounts/permissions/user/:userId/organization/:organizationId', auth_1.authenticateToken, (req, res) => getController().getUserPermissions(req, res));
    router.get('/shared-accounts/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getSharedAccount(req, res));
    router.get('/shared-accounts/:id/password', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getSharedAccountPassword(req, res));
    router.get('/shared-accounts/:id/2fa-secret', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().get2FASecret(req, res));
    router.get('/shared-accounts/:id/access-logs', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getAccessLogs(req, res));
    router.get('/shared-accounts/:id/analytics', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getAccountAnalytics(req, res));
    router.put('/shared-accounts/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.update, 'body'), (req, res) => getController().updateSharedAccount(req, res));
    router.put('/shared-accounts/:id/password', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.updatePassword, 'body'), (req, res) => getController().updateSharedAccountPassword(req, res));
    router.put('/shared-accounts/:id/2fa-secret', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.update2FA, 'body'), (req, res) => getController().update2FASecret(req, res));
    router.delete('/shared-accounts/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteSharedAccount(req, res));
    router.delete('/shared-accounts/permissions/:permissionId', auth_1.authenticateToken, (req, res) => getController().revokePermission(req, res));
    app.use('/api', router);
};
exports.setSharedAccountRoutes = setSharedAccountRoutes;
//# sourceMappingURL=sharedAccountRoutes.js.map