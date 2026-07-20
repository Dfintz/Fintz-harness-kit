"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const logger_1 = require("../../utils/logger");
const prototypePollutionPrevention_1 = require("../../utils/prototypePollutionPrevention");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
let _sharedAccountService;
let _permissionService;
let _accessLogService;
async function getServices() {
    if (!_sharedAccountService) {
        const { SharedAccountService } = await Promise.resolve().then(() => __importStar(require('../../services/user/SharedAccountService')));
        _sharedAccountService = new SharedAccountService();
    }
    if (!_permissionService || !_accessLogService) {
        const { AccountPermissionService, AccountAccessLogService } = await Promise.resolve().then(() => __importStar(require('../../services/security')));
        _permissionService = new AccountPermissionService();
        _accessLogService = new AccountAccessLogService();
    }
    return {
        service: _sharedAccountService,
        permissionService: _permissionService,
        accessLogService: _accessLogService,
    };
}
function stripSecrets(account) {
    const { keyVaultSecretName: _k, twoFactorSecretName: _t, ...safe } = account;
    return safe;
}
router.get('/organization/:organizationId', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.params.organizationId, 'params'), async (req, res) => {
    try {
        const { service, permissionService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { organizationId } = req.params;
        const hasPermission = await permissionService.hasPermission(userId, organizationId, 'read');
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions to view shared accounts' });
            return;
        }
        const accounts = await service.getSharedAccountsByOrganization(organizationId);
        const sanitized = accounts.map(a => stripSecrets(a));
        res.json({ success: true, data: sanitized });
    }
    catch (error) {
        logger_1.logger.error('Failed to get shared accounts by organization', {
            orgId: req.params.organizationId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get shared accounts' });
    }
});
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.create, 'body'), async (req, res) => {
    try {
        const { service, permissionService, accessLogService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
            'accountName',
            'accountUsername',
            'password',
            'organizationId',
            'description',
            'passwordExpiresAt',
            'categories',
            'tags',
            'twoFactorSecret',
        ]);
        const { accountName, accountUsername, password, organizationId, description } = safeBody;
        const hasPermission = await permissionService.hasPermission(userId, organizationId, 'create');
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions to create shared accounts' });
            return;
        }
        const account = await service.createSharedAccount(accountName, accountUsername, password, organizationId, userId, description);
        if (!account) {
            res.status(500).json({ error: 'Failed to create shared account' });
            return;
        }
        await accessLogService.logAccess(account.id, userId, organizationId, 'create', req.ip, req.get('user-agent'));
        res.status(201).json({
            success: true,
            data: stripSecrets(account),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create shared account', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to create shared account' });
    }
});
router.get('/:accountId', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.params.accountId, 'params'), async (req, res) => {
    try {
        const { service, permissionService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const account = await service.getSharedAccountById(req.params.accountId);
        if (!account) {
            res.status(404).json({ error: 'Shared account not found' });
            return;
        }
        const hasPermission = await permissionService.hasPermission(userId, account.organizationId, 'read', account.id);
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        res.json({
            success: true,
            data: stripSecrets(account),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get shared account', {
            accountId: req.params.accountId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get shared account' });
    }
});
router.get('/:accountId/password', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.params.accountId, 'params'), async (req, res) => {
    try {
        const { service, permissionService, accessLogService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const account = await service.getSharedAccountById(req.params.accountId);
        if (!account) {
            res.status(404).json({ error: 'Shared account not found' });
            return;
        }
        const hasPermission = await permissionService.hasPermission(userId, account.organizationId, 'reveal_password', account.id);
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions to reveal password' });
            return;
        }
        const password = await service.getSharedAccountPassword(req.params.accountId);
        if (!password) {
            res.status(404).json({ error: 'Password not found' });
            return;
        }
        await accessLogService.logAccess(account.id, userId, account.organizationId, 'password_reveal', req.ip, req.get('user-agent'));
        await service.updateLastAccess(account.id, userId);
        res.json({ success: true, data: { password } });
    }
    catch (error) {
        logger_1.logger.error('Failed to get shared account password', {
            accountId: req.params.accountId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get password' });
    }
});
router.put('/:accountId', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.params.accountId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.update, 'body'), async (req, res) => {
    try {
        const { service, permissionService, accessLogService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const account = await service.getSharedAccountById(req.params.accountId);
        if (!account) {
            res.status(404).json({ error: 'Shared account not found' });
            return;
        }
        const hasPermission = await permissionService.hasPermission(userId, account.organizationId, 'update', account.id);
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions to update shared account' });
            return;
        }
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
            'accountName',
            'accountUsername',
            'description',
            'categories',
            'tags',
        ]);
        const updated = await service.updateSharedAccount(req.params.accountId, safeBody);
        if (!updated) {
            res.status(404).json({ error: 'Shared account not found' });
            return;
        }
        await accessLogService.logAccess(account.id, userId, account.organizationId, 'update', req.ip, req.get('user-agent'));
        res.json({
            success: true,
            data: stripSecrets(updated),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update shared account', {
            accountId: req.params.accountId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to update shared account' });
    }
});
router.delete('/:accountId', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.params.accountId, 'params'), async (req, res) => {
    try {
        const { service, permissionService, accessLogService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const account = await service.getSharedAccountById(req.params.accountId);
        if (!account) {
            res.status(404).json({ error: 'Shared account not found' });
            return;
        }
        const hasPermission = await permissionService.hasPermission(userId, account.organizationId, 'delete', account.id);
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions to delete shared account' });
            return;
        }
        const accountMeta = {
            accountName: account.accountName,
            organizationId: account.organizationId,
        };
        const success = await service.deleteSharedAccount(req.params.accountId);
        if (!success) {
            res.status(500).json({ error: 'Failed to delete shared account' });
            return;
        }
        await accessLogService.logAccess(account.id, userId, accountMeta.organizationId, 'delete', req.ip, req.get('user-agent'));
        res.json({ success: true, data: { message: 'Shared account deleted successfully' } });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete shared account', {
            accountId: req.params.accountId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to delete shared account' });
    }
});
router.get('/:accountId/audit-log', (0, schemaValidation_1.validateSchema)(schemas_1.sharedAccountSchemas.params.accountId, 'params'), async (req, res) => {
    try {
        const { service, permissionService, accessLogService } = await getServices();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const account = await service.getSharedAccountById(req.params.accountId);
        if (!account) {
            res.status(404).json({ error: 'Shared account not found' });
            return;
        }
        const hasPermission = await permissionService.hasPermission(userId, account.organizationId, 'read', account.id);
        if (!hasPermission) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        const logs = await accessLogService.getAccountAccessLogs(req.params.accountId);
        res.json({ success: true, data: logs });
    }
    catch (error) {
        logger_1.logger.error('Failed to get shared account audit log', {
            accountId: req.params.accountId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get audit log' });
    }
});
//# sourceMappingURL=sharedAccounts.js.map