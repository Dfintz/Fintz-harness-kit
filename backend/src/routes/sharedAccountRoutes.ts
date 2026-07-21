import { Router, Application } from 'express';

import { SharedAccountController } from '../controllers/sharedAccountController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { sharedAccountSchemas, paramSchemas } from '../schemas';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let sharedAccountController: SharedAccountController;
const getController = () => {
    if (!sharedAccountController) {
        sharedAccountController = new SharedAccountController();
    }
    return sharedAccountController;
};

export const setSharedAccountRoutes = (app: Application) => {
    // Create a new shared account
    router.post('/shared-accounts',
        authenticateToken,
        validateSchema(sharedAccountSchemas.create, 'body'),
        (req, res) => getController().createSharedAccount(req, res)
    );

    // Bulk import accounts
    router.post('/shared-accounts/bulk-import',
        authenticateToken,
        validateSchema(sharedAccountSchemas.bulkImport, 'body'),
        (req, res) => getController().bulkImport(req, res)
    );

    // Grant permission
    router.post('/shared-accounts/permissions/grant',
        authenticateToken,
        validateSchema(sharedAccountSchemas.grantPermission, 'body'),
        (req, res) => getController().grantPermission(req, res)
    );

    // Get all shared accounts for an organization
    router.get('/shared-accounts/organization/:organizationId',
        authenticateToken,
        validateSchema(sharedAccountSchemas.query, 'query'),
        (req, res) => getController().getSharedAccountsByOrganization(req, res)
    );

    // Bulk export accounts
    router.get('/shared-accounts/organization/:organizationId/export',
        authenticateToken,
        (req, res) => getController().bulkExport(req, res)
    );

    // Get accounts by category
    router.get('/shared-accounts/organization/:organizationId/category/:category',
        authenticateToken,
        (req, res) => getController().getAccountsByCategory(req, res)
    );

    // Get accounts by tag
    router.get('/shared-accounts/organization/:organizationId/tag/:tag',
        authenticateToken,
        (req, res) => getController().getAccountsByTag(req, res)
    );

    // Get expired accounts
    router.get('/shared-accounts/organization/:organizationId/expired',
        authenticateToken,
        (req, res) => getController().getExpiredAccounts(req, res)
    );

    // Get accounts expiring soon
    router.get('/shared-accounts/organization/:organizationId/expiring-soon',
        authenticateToken,
        (req, res) => getController().getExpiringSoonAccounts(req, res)
    );

    // Get user permissions
    router.get('/shared-accounts/permissions/user/:userId/organization/:organizationId',
        authenticateToken,
        (req, res) => getController().getUserPermissions(req, res)
    );

    // Get a specific shared account
    router.get('/shared-accounts/:id',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        (req, res) => getController().getSharedAccount(req, res)
    );

    // Get password for a shared account
    router.get('/shared-accounts/:id/password',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        (req, res) => getController().getSharedAccountPassword(req, res)
    );

    // Get 2FA secret for a shared account
    router.get('/shared-accounts/:id/2fa-secret',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        (req, res) => getController().get2FASecret(req, res)
    );

    // Get access logs for a shared account
    router.get('/shared-accounts/:id/access-logs',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        (req, res) => getController().getAccessLogs(req, res)
    );

    // Get analytics for a shared account
    router.get('/shared-accounts/:id/analytics',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        (req, res) => getController().getAccountAnalytics(req, res)
    );

    // Update a shared account (not password)
    router.put('/shared-accounts/:id',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        validateSchema(sharedAccountSchemas.update, 'body'),
        (req, res) => getController().updateSharedAccount(req, res)
    );

    // Update password for a shared account
    router.put('/shared-accounts/:id/password',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        validateSchema(sharedAccountSchemas.updatePassword, 'body'),
        (req, res) => getController().updateSharedAccountPassword(req, res)
    );

    // Update 2FA secret for a shared account
    router.put('/shared-accounts/:id/2fa-secret',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        validateSchema(sharedAccountSchemas.update2FA, 'body'),
        (req, res) => getController().update2FASecret(req, res)
    );

    // Delete a shared account
    router.delete('/shared-accounts/:id',
        authenticateToken,
        validateSchema(paramSchemas.id, 'params'),
        (req, res) => getController().deleteSharedAccount(req, res)
    );

    // Revoke permission
    router.delete('/shared-accounts/permissions/:permissionId',
        authenticateToken,
        (req, res) => getController().revokePermission(req, res)
    );

    app.use('/api', router);
};
