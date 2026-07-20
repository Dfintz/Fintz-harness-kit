"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedAccountController = void 0;
const security_1 = require("../services/security");
const user_1 = require("../services/user");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class SharedAccountController extends BaseController_1.BaseController {
    sharedAccountService;
    permissionService;
    accessLogService;
    bulkService;
    constructor() {
        super();
        this.sharedAccountService = new user_1.SharedAccountService();
        this.permissionService = new security_1.AccountPermissionService();
        this.accessLogService = new security_1.AccountAccessLogService();
        this.bulkService = new user_1.BulkAccountService();
    }
    createSharedAccount = async (req, res) => {
        await this.execute(req, res, async () => {
            const { accountName, accountUsername, password, organizationId, description, passwordExpiresAt, categories, tags, twoFactorSecret } = req.body;
            const userId = req.user?.id;
            this.validateRequired(req.body, 'accountName', 'accountUsername', 'password', 'organizationId');
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'create');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to create shared accounts');
            }
            const expiresAt = passwordExpiresAt ? new Date(passwordExpiresAt) : undefined;
            const sharedAccount = await this.sharedAccountService.createSharedAccount(accountName, accountUsername, password, organizationId, userId, description, expiresAt, categories, tags, twoFactorSecret);
            if (!sharedAccount) {
                throw new Error('Failed to create shared account');
            }
            await this.accessLogService.logAccess(sharedAccount.id, userId, organizationId, 'create', req.ip, req.get('user-agent'));
            const { keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...accountData } = sharedAccount;
            res.status(201).json(accountData);
        });
    };
    getSharedAccountsByOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;
            this.validateRequired(req.params, 'organizationId');
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'read');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view shared accounts');
            }
            const accounts = await this.sharedAccountService.getSharedAccountsByOrganization(organizationId);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);
            res.status(200).json(sanitizedAccounts);
        });
    };
    getSharedAccount = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'read', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view this account');
            }
            const { keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...accountData } = account;
            res.status(200).json(accountData);
        });
    };
    getSharedAccountPassword = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'reveal_password', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to reveal password');
            }
            const password = await this.sharedAccountService.getSharedAccountPassword(id);
            if (!password) {
                throw new apiErrors_1.NotFoundError('Password');
            }
            await this.accessLogService.logAccess(id, userId, account.organizationId, 'password_reveal', req.ip, req.get('user-agent'));
            await this.sharedAccountService.updateLastAccess(id, userId);
            res.status(200).json({ password });
        });
    };
    updateSharedAccount = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { accountName, accountUsername, description, passwordExpiresAt, categories, tags } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'update', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update shared account');
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
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            await this.accessLogService.logAccess(id, userId, account.organizationId, 'update', req.ip, req.get('user-agent'));
            const { keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...accountData } = updatedAccount;
            res.status(200).json(accountData);
        });
    };
    updateSharedAccountPassword = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { password } = req.body;
            this.validateRequired(req.body, 'password');
            const success = await this.sharedAccountService.updateSharedAccountPassword(id, password);
            if (!success) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            res.status(200).json({ message: 'Password updated successfully' });
        });
    };
    deleteSharedAccount = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'delete', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to delete shared account');
            }
            await this.accessLogService.logAccess(id, userId, account.organizationId, 'delete', req.ip, req.get('user-agent'));
            const success = await this.sharedAccountService.deleteSharedAccount(id);
            if (!success) {
                throw new Error('Failed to delete shared account');
            }
            res.status(200).json({ message: 'Shared account deleted successfully' });
        });
    };
    get2FASecret = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'reveal_password', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const secret = await this.sharedAccountService.getSharedAccount2FASecret(id);
            if (!secret) {
                throw new apiErrors_1.NotFoundError('2FA secret');
            }
            await this.accessLogService.logAccess(id, userId, account.organizationId, '2fa_reveal', req.ip, req.get('user-agent'));
            res.status(200).json({ twoFactorSecret: secret });
        });
    };
    update2FASecret = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { twoFactorSecret } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            this.validateRequired(req.body, 'twoFactorSecret');
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'update', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const success = await this.sharedAccountService.updateSharedAccount2FASecret(id, twoFactorSecret);
            if (!success) {
                throw new Error('Failed to update 2FA secret');
            }
            await this.accessLogService.logAccess(id, userId, account.organizationId, '2fa_update', req.ip, req.get('user-agent'));
            res.status(200).json({ message: '2FA secret updated successfully' });
        });
    };
    getAccessLogs = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = parseInt(req.query.offset) || 0;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'read', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const logs = await this.accessLogService.getAccountAccessLogs(id, limit, offset);
            res.status(200).json(logs);
        });
    };
    getAccountAnalytics = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const account = await this.sharedAccountService.getSharedAccountById(id);
            if (!account) {
                throw new apiErrors_1.NotFoundError('Shared account');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, account.organizationId, 'read', id);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const analytics = await this.accessLogService.getAccountAnalytics(id);
            res.status(200).json(analytics);
        });
    };
    bulkImport = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId, accounts } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            this.validateRequired(req.body, 'organizationId', 'accounts');
            if (!Array.isArray(accounts)) {
                throw new apiErrors_1.ValidationError('Accounts must be an array');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'create');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to import accounts');
            }
            const result = await this.bulkService.importAccounts(accounts, organizationId, userId);
            await this.accessLogService.logAccess('bulk-import', userId, organizationId, 'bulk_import', req.ip, req.get('user-agent'), { imported: result.imported, failed: result.failed });
            res.status(200).json(result);
        });
    };
    bulkExport = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;
            const format = req.query.format || 'json';
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'read');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to export accounts');
            }
            const accounts = await this.bulkService.exportAccounts(organizationId);
            await this.accessLogService.logAccess('bulk-export', userId, organizationId, 'bulk_export', req.ip, req.get('user-agent'), { count: accounts.length });
            if (format === 'csv') {
                const csv = this.bulkService.toCSV(accounts);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="accounts-${organizationId}.csv"`);
                res.status(200).send(csv);
            }
            else {
                res.status(200).json(accounts);
            }
        });
    };
    getAccountsByCategory = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId, category } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'read');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const accounts = await this.sharedAccountService.getAccountsByCategory(organizationId, category);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);
            res.status(200).json(sanitizedAccounts);
        });
    };
    getAccountsByTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId, tag } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'read');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const accounts = await this.sharedAccountService.getAccountsByTag(organizationId, tag);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);
            res.status(200).json(sanitizedAccounts);
        });
    };
    getExpiredAccounts = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'read');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const accounts = await this.sharedAccountService.getAccountsWithExpiredPasswords(organizationId);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);
            res.status(200).json(sanitizedAccounts);
        });
    };
    getExpiringSoonAccounts = async (req, res) => {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const userId = req.user?.id;
            const days = parseInt(req.query.days) || 7;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'read');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const accounts = await this.sharedAccountService.getAccountsExpiringSoon(organizationId, days);
            const sanitizedAccounts = accounts.map(({ keyVaultSecretName: _keyVaultSecretName, twoFactorSecretName: _twoFactorSecretName, ...account }) => account);
            res.status(200).json(sanitizedAccounts);
        });
    };
    grantPermission = async (req, res) => {
        await this.execute(req, res, async () => {
            const { targetUserId, organizationId, action, accountId, expiresAt } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            this.validateRequired(req.body, 'targetUserId', 'organizationId', 'action');
            const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'manage_permissions');
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to grant permissions');
            }
            const expiry = expiresAt ? new Date(expiresAt) : undefined;
            const permission = await this.permissionService.grantPermission(targetUserId, organizationId, action, userId, accountId, expiry);
            if (!permission) {
                throw new Error('Failed to grant permission');
            }
            res.status(201).json(permission);
        });
    };
    revokePermission = async (req, res) => {
        await this.execute(req, res, async () => {
            const { permissionId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const success = await this.permissionService.revokePermission(permissionId);
            if (!success) {
                throw new apiErrors_1.NotFoundError('Permission');
            }
            res.status(200).json({ message: 'Permission revoked successfully' });
        });
    };
    getUserPermissions = async (req, res) => {
        await this.execute(req, res, async () => {
            const { userId: targetUserId, organizationId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (userId !== targetUserId) {
                const hasPermission = await this.permissionService.hasPermission(userId, organizationId, 'manage_permissions');
                if (!hasPermission) {
                    throw new apiErrors_1.ForbiddenError('Insufficient permissions');
                }
            }
            const permissions = await this.permissionService.getUserPermissions(targetUserId, organizationId);
            res.status(200).json(permissions);
        });
    };
}
exports.SharedAccountController = SharedAccountController;
//# sourceMappingURL=sharedAccountController.js.map