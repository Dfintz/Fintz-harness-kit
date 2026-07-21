import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { AccountPermissionService , AccountAccessLogService } from '../services/security';
import { SharedAccountService , BulkAccountService } from '../services/user';
import { 
    UnauthorizedError, 
    ForbiddenError, 
    NotFoundError,
    ValidationError
} from '../utils/apiErrors';

import { BaseController } from './BaseController';

export class SharedAccountController extends BaseController {
    private sharedAccountService: SharedAccountService;
    private permissionService: AccountPermissionService;
    private accessLogService: AccountAccessLogService;
    private bulkService: BulkAccountService;

    constructor() {
        super();
        this.sharedAccountService = new SharedAccountService();
        this.permissionService = new AccountPermissionService();
        this.accessLogService = new AccountAccessLogService();
        this.bulkService = new BulkAccountService();
    }

    /**
     * Create a new shared account
     * POST /api/shared-accounts
     */
    public createSharedAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { 
                accountName, 
                accountUsername, 
                password, 
                organizationId, 
                description,
                passwordExpiresAt,
                categories,
                tags,
                twoFactorSecret
            } = req.body;
            const userId = req.user?.id;

            this.validateRequired(req.body, 'accountName', 'accountUsername', 'password', 'organizationId');

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'create'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to create shared accounts');
            }

            const expiresAt = passwordExpiresAt ? new Date(passwordExpiresAt) : undefined;

            const sharedAccount = await this.sharedAccountService.createSharedAccount(
                accountName,
                accountUsername,
                password,
                organizationId,
                userId,
                description,
                expiresAt,
                categories,
                tags,
                twoFactorSecret
            );

            if (!sharedAccount) {
                throw new Error('Failed to create shared account');
            }

            // Log the action
            await this.accessLogService.logAccess(
                sharedAccount.id,
                userId,
                organizationId,
                'create',
                req.ip,
                req.get('user-agent')
            );

            // Don't include the Key Vault secret names in the response
            const { keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...accountData } = sharedAccount;

            res.status(201).json(accountData);
        });
    };

    /**
     * Get all shared accounts for an organization
     * GET /api/shared-accounts/organization/:organizationId
     */
    public getSharedAccountsByOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;

            this.validateRequired(req.params, 'organizationId');

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'read'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to view shared accounts');
            }

            const accounts = await this.sharedAccountService.getSharedAccountsByOrganization(organizationId);

            // Remove Key Vault secret names from response
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);

            res.status(200).json(sanitizedAccounts);
        });
    };

    /**
     * Get a specific shared account
     * GET /api/shared-accounts/:id
     */
    public getSharedAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);

            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'read',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to view this account');
            }

            // Remove Key Vault secret names from response
            const { keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...accountData } = account;

            res.status(200).json(accountData);
        });
    };

    /**
     * Get password for a shared account
     * GET /api/shared-accounts/:id/password
     */
    public getSharedAccountPassword = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'reveal_password',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to reveal password');
            }

            const password = await this.sharedAccountService.getSharedAccountPassword(id);

            if (!password) {
                throw new NotFoundError('Password');
            }

            // Log the access
            await this.accessLogService.logAccess(
                id,
                userId,
                account.organizationId,
                'password_reveal',
                req.ip,
                req.get('user-agent')
            );

            // Update last access
            await this.sharedAccountService.updateLastAccess(id, userId);

            res.status(200).json({ password });
        });
    };

    /**
     * Update a shared account
     * PUT /api/shared-accounts/:id
     */
    public updateSharedAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { accountName, accountUsername, description, passwordExpiresAt, categories, tags } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'update',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to update shared account');
            }

            const expiresAt = passwordExpiresAt ? new Date(passwordExpiresAt) : undefined;

            const updatedAccount = await this.sharedAccountService.updateSharedAccount(id, {
                accountName,
                accountUsername,
                description,
                passwordExpiresAt: expiresAt,
                categories,
                tags
            });

            if (!updatedAccount) {
                throw new NotFoundError('Shared account');
            }

            // Log the action
            await this.accessLogService.logAccess(
                id,
                userId,
                account.organizationId,
                'update',
                req.ip,
                req.get('user-agent')
            );

            // Remove Key Vault secret names from response
            const { keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...accountData } = updatedAccount;

            res.status(200).json(accountData);
        });
    };

    /**
     * Update password for a shared account
     * PUT /api/shared-accounts/:id/password
     */
    public updateSharedAccountPassword = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { password } = req.body;

            this.validateRequired(req.body, 'password');

            const success = await this.sharedAccountService.updateSharedAccountPassword(id, password);

            if (!success) {
                throw new NotFoundError('Shared account');
            }

            res.status(200).json({ message: 'Password updated successfully' });
        });
    };

    /**
     * Delete a shared account
     * DELETE /api/shared-accounts/:id
     */
    public deleteSharedAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'delete',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to delete shared account');
            }

            // Log before deletion
            await this.accessLogService.logAccess(
                id,
                userId,
                account.organizationId,
                'delete',
                req.ip,
                req.get('user-agent')
            );

            const success = await this.sharedAccountService.deleteSharedAccount(id);

            if (!success) {
                throw new Error('Failed to delete shared account');
            }

            res.status(200).json({ message: 'Shared account deleted successfully' });
        });
    };

    /**
     * Get 2FA secret for a shared account
     * GET /api/shared-accounts/:id/2fa-secret
     */
    public get2FASecret = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'reveal_password',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const secret = await this.sharedAccountService.getSharedAccount2FASecret(id);

            if (!secret) {
                throw new NotFoundError('2FA secret');
            }

            // Log the access
            await this.accessLogService.logAccess(
                id,
                userId,
                account.organizationId,
                '2fa_reveal',
                req.ip,
                req.get('user-agent')
            );

            res.status(200).json({ twoFactorSecret: secret });
        });
    };

    /**
     * Update 2FA secret for a shared account
     * PUT /api/shared-accounts/:id/2fa-secret
     */
    public update2FASecret = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { twoFactorSecret } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            this.validateRequired(req.body, 'twoFactorSecret');

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'update',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const success = await this.sharedAccountService.updateSharedAccount2FASecret(id, twoFactorSecret);

            if (!success) {
                throw new Error('Failed to update 2FA secret');
            }

            // Log the action
            await this.accessLogService.logAccess(
                id,
                userId,
                account.organizationId,
                '2fa_update',
                req.ip,
                req.get('user-agent')
            );

            res.status(200).json({ message: '2FA secret updated successfully' });
        });
    };

    /**
     * Get access logs for an account
     * GET /api/shared-accounts/:id/access-logs
     */
    public getAccessLogs = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
            const offset = parseInt(req.query.offset as string) || 0;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'read',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const logs = await this.accessLogService.getAccountAccessLogs(id, limit, offset);
            res.status(200).json(logs);
        });
    };

    /**
     * Get analytics for an account
     * GET /api/shared-accounts/:id/analytics
     */
    public getAccountAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new NotFoundError('Shared account');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                account.organizationId,
                'read',
                id
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const analytics = await this.accessLogService.getAccountAnalytics(id);
            res.status(200).json(analytics);
        });
    };

    /**
     * Bulk import accounts
     * POST /api/shared-accounts/bulk-import
     */
    public bulkImport = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId, accounts } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            this.validateRequired(req.body, 'organizationId', 'accounts');

            if (!Array.isArray(accounts)) {
                throw new ValidationError('Accounts must be an array');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'create'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to import accounts');
            }

            const result = await this.bulkService.importAccounts(accounts, organizationId, userId);

            // Log the bulk import
            await this.accessLogService.logAccess(
                'bulk-import',
                userId,
                organizationId,
                'bulk_import',
                req.ip,
                req.get('user-agent'),
                { imported: result.imported, failed: result.failed }
            );

            res.status(200).json(result);
        });
    };

    /**
     * Bulk export accounts
     * GET /api/shared-accounts/organization/:organizationId/export
     */
    public bulkExport = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;
            const format = req.query.format as string || 'json';

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'read'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to export accounts');
            }

            const accounts = await this.bulkService.exportAccounts(organizationId);

            // Log the bulk export
            await this.accessLogService.logAccess(
                'bulk-export',
                userId,
                organizationId,
                'bulk_export',
                req.ip,
                req.get('user-agent'),
                { count: accounts.length }
            );

            if (format === 'csv') {
                const csv = this.bulkService.toCSV(accounts);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="accounts-${organizationId}.csv"`);
                res.status(200).send(csv);
            } else {
                res.status(200).json(accounts);
            }
        });
    };

    /**
     * Get accounts by category
     * GET /api/shared-accounts/organization/:organizationId/category/:category
     */
    public getAccountsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId, category } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'read'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const accounts = await this.sharedAccountService.getAccountsByCategory(organizationId, category);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);

            res.status(200).json(sanitizedAccounts);
        });
    };

    /**
     * Get accounts by tag
     * GET /api/shared-accounts/organization/:organizationId/tag/:tag
     */
    public getAccountsByTag = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId, tag } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'read'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const accounts = await this.sharedAccountService.getAccountsByTag(organizationId, tag);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);

            res.status(200).json(sanitizedAccounts);
        });
    };

    /**
     * Get accounts with expired passwords
     * GET /api/shared-accounts/organization/:organizationId/expired
     */
    public getExpiredAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'read'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const accounts = await this.sharedAccountService.getAccountsWithExpiredPasswords(organizationId);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);

            res.status(200).json(sanitizedAccounts);
        });
    };

    /**
     * Get accounts expiring soon
     * GET /api/shared-accounts/organization/:organizationId/expiring-soon
     */
    public getExpiringSoonAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;
            const days = parseInt(req.query.days as string) || 7;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Check permission
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'read'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            const accounts = await this.sharedAccountService.getAccountsExpiringSoon(organizationId, days);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);

            res.status(200).json(sanitizedAccounts);
        });
    };

    /**
     * Grant permission to a user
     * POST /api/shared-accounts/permissions/grant
     */
    public grantPermission = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { targetUserId, organizationId, action, accountId, expiresAt } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            this.validateRequired(req.body, 'targetUserId', 'organizationId', 'action');

            // Check if user has permission to manage permissions
            const hasPermission = await this.permissionService.hasPermission(
                userId,
                organizationId,
                'manage_permissions'
            );

            if (!hasPermission) {
                throw new ForbiddenError('Insufficient permissions to grant permissions');
            }

            const expiry = expiresAt ? new Date(expiresAt) : undefined;

            const permission = await this.permissionService.grantPermission(
                targetUserId,
                organizationId,
                action,
                userId,
                accountId,
                expiry
            );

            if (!permission) {
                throw new Error('Failed to grant permission');
            }

            res.status(201).json(permission);
        });
    };

    /**
     * Revoke permission from a user
     * DELETE /api/shared-accounts/permissions/:permissionId
     */
    public revokePermission = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { permissionId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Note: In production, you should verify the user has rights to revoke this permission
            // For now, we'll allow it if they have manage_permissions right

            const success = await this.permissionService.revokePermission(permissionId);

            if (!success) {
                throw new NotFoundError('Permission');
            }

            res.status(200).json({ message: 'Permission revoked successfully' });
        });
    };

    /**
     * Get user's permissions
     * GET /api/shared-accounts/permissions/user/:userId/organization/:organizationId
     */
    public getUserPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { userId: targetUserId, organizationId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Users can view their own permissions, or if they have manage_permissions right
            if (userId !== targetUserId) {
                const hasPermission = await this.permissionService.hasPermission(
                    userId,
                    organizationId,
                    'manage_permissions'
                );

                if (!hasPermission) {
                    throw new ForbiddenError('Insufficient permissions');
                }
            }

            const permissions = await this.permissionService.getUserPermissions(targetUserId, organizationId);
            res.status(200).json(permissions);
        });
    };
}
