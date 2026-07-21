/**
 * V2 Shared Account Routes
 *
 * Org-scoped shared account management with Key Vault credential storage.
 * Delegates to SharedAccountService / AccountPermissionService for implementation.
 */

import { Response, Router } from 'express';

import { authenticate, AuthRequest } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { sharedAccountSchemas } from '../../schemas';
import { logger } from '../../utils/logger';
import { sanitizeObject } from '../../utils/prototypePollutionPrevention';

const router = Router();

// All shared account routes require authentication
router.use(authenticate);

// ---- Lazy singletons (avoid per-request instantiation) ----
let _sharedAccountService: InstanceType<
  typeof import('../../services/user/SharedAccountService').SharedAccountService
>;
let _permissionService: InstanceType<
  typeof import('../../services/security').AccountPermissionService
>;
let _accessLogService: InstanceType<
  typeof import('../../services/security').AccountAccessLogService
>;

async function getServices(): Promise<{
  service: InstanceType<
    typeof import('../../services/user/SharedAccountService').SharedAccountService
  >;
  permissionService: InstanceType<
    typeof import('../../services/security').AccountPermissionService
  >;
  accessLogService: InstanceType<typeof import('../../services/security').AccountAccessLogService>;
}> {
  if (!_sharedAccountService) {
    const { SharedAccountService } = await import('../../services/user/SharedAccountService');
    _sharedAccountService = new SharedAccountService();
  }
  if (!_permissionService || !_accessLogService) {
    const { AccountPermissionService, AccountAccessLogService } =
      await import('../../services/security');
    _permissionService = new AccountPermissionService();
    _accessLogService = new AccountAccessLogService();
  }
  return {
    service: _sharedAccountService,
    permissionService: _permissionService,
    accessLogService: _accessLogService,
  };
}

/**
 * Strip sensitive Key Vault field names from a shared account response.
 */
function stripSecrets<T extends Record<string, unknown>>(
  account: T
): Omit<T, 'keyVaultSecretName' | 'twoFactorSecretName'> {
  const { keyVaultSecretName: _k, twoFactorSecretName: _t, ...safe } = account;
  return safe;
}

// ==================== SHARED ACCOUNTS ====================

/**
 * GET /api/v2/shared-accounts/organization/:organizationId
 * List shared accounts for an organization
 */
router.get(
  '/organization/:organizationId',
  validateSchema(sharedAccountSchemas.params.organizationId, 'params'),
  async (req: AuthRequest, res: Response) => {
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
      const sanitized = accounts.map(a => stripSecrets(a as unknown as Record<string, unknown>));
      res.json({ success: true, data: sanitized });
    } catch (error: unknown) {
      logger.error('Failed to get shared accounts by organization', {
        orgId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to get shared accounts' });
    }
  }
);

/**
 * POST /api/v2/shared-accounts
 * Create new shared account
 */
router.post(
  '/',
  validateSchema(sharedAccountSchemas.create, 'body'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { service, permissionService, accessLogService } = await getServices();
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const safeBody = sanitizeObject(req.body as Record<string, unknown>, [
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

      const hasPermission = await permissionService.hasPermission(
        userId,
        organizationId as string,
        'create'
      );
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions to create shared accounts' });
        return;
      }

      const account = await service.createSharedAccount(
        accountName as string,
        accountUsername as string,
        password as string,
        organizationId as string,
        userId,
        description as string | undefined
      );

      if (!account) {
        res.status(500).json({ error: 'Failed to create shared account' });
        return;
      }

      await accessLogService.logAccess(
        account.id,
        userId,
        organizationId as string,
        'create',
        req.ip,
        req.get('user-agent')
      );

      res.status(201).json({
        success: true,
        data: stripSecrets(account as unknown as Record<string, unknown>),
      });
    } catch (error: unknown) {
      logger.error('Failed to create shared account', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to create shared account' });
    }
  }
);

/**
 * GET /api/v2/shared-accounts/:accountId
 * Get shared account details
 */
router.get(
  '/:accountId',
  validateSchema(sharedAccountSchemas.params.accountId, 'params'),
  async (req: AuthRequest, res: Response) => {
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

      const hasPermission = await permissionService.hasPermission(
        userId,
        account.organizationId,
        'read',
        account.id
      );
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      res.json({
        success: true,
        data: stripSecrets(account as unknown as Record<string, unknown>),
      });
    } catch (error: unknown) {
      logger.error('Failed to get shared account', {
        accountId: req.params.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to get shared account' });
    }
  }
);

/**
 * GET /api/v2/shared-accounts/:accountId/password
 * Reveal password for a shared account
 */
router.get(
  '/:accountId/password',
  validateSchema(sharedAccountSchemas.params.accountId, 'params'),
  async (req: AuthRequest, res: Response) => {
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

      const hasPermission = await permissionService.hasPermission(
        userId,
        account.organizationId,
        'reveal_password',
        account.id
      );
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions to reveal password' });
        return;
      }

      const password = await service.getSharedAccountPassword(req.params.accountId);
      if (!password) {
        res.status(404).json({ error: 'Password not found' });
        return;
      }

      await accessLogService.logAccess(
        account.id,
        userId,
        account.organizationId,
        'password_reveal',
        req.ip,
        req.get('user-agent')
      );
      await service.updateLastAccess(account.id, userId);

      res.json({ success: true, data: { password } });
    } catch (error: unknown) {
      logger.error('Failed to get shared account password', {
        accountId: req.params.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to get password' });
    }
  }
);

/**
 * PUT /api/v2/shared-accounts/:accountId
 * Update shared account
 */
router.put(
  '/:accountId',
  validateSchema(sharedAccountSchemas.params.accountId, 'params'),
  validateSchema(sharedAccountSchemas.update, 'body'),
  async (req: AuthRequest, res: Response) => {
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

      const hasPermission = await permissionService.hasPermission(
        userId,
        account.organizationId,
        'update',
        account.id
      );
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions to update shared account' });
        return;
      }

      const safeBody = sanitizeObject(req.body as Record<string, unknown>, [
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

      await accessLogService.logAccess(
        account.id,
        userId,
        account.organizationId,
        'update',
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        data: stripSecrets(updated as unknown as Record<string, unknown>),
      });
    } catch (error: unknown) {
      logger.error('Failed to update shared account', {
        accountId: req.params.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to update shared account' });
    }
  }
);

/**
 * DELETE /api/v2/shared-accounts/:accountId
 * Delete shared account
 */
router.delete(
  '/:accountId',
  validateSchema(sharedAccountSchemas.params.accountId, 'params'),
  async (req: AuthRequest, res: Response) => {
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

      const hasPermission = await permissionService.hasPermission(
        userId,
        account.organizationId,
        'delete',
        account.id
      );
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions to delete shared account' });
        return;
      }

      // Capture account metadata before deletion for the audit log
      const accountMeta = {
        accountName: account.accountName,
        organizationId: account.organizationId,
      };

      const success = await service.deleteSharedAccount(req.params.accountId);
      if (!success) {
        res.status(500).json({ error: 'Failed to delete shared account' });
        return;
      }

      // Log after successful deletion to avoid recording phantom deletions
      await accessLogService.logAccess(
        account.id,
        userId,
        accountMeta.organizationId,
        'delete',
        req.ip,
        req.get('user-agent')
      );

      res.json({ success: true, data: { message: 'Shared account deleted successfully' } });
    } catch (error: unknown) {
      logger.error('Failed to delete shared account', {
        accountId: req.params.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to delete shared account' });
    }
  }
);

/**
 * GET /api/v2/shared-accounts/:accountId/audit-log
 * Get audit log for shared account
 */
router.get(
  '/:accountId/audit-log',
  validateSchema(sharedAccountSchemas.params.accountId, 'params'),
  async (req: AuthRequest, res: Response) => {
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

      const hasPermission = await permissionService.hasPermission(
        userId,
        account.organizationId,
        'read',
        account.id
      );
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const logs = await accessLogService.getAccountAccessLogs(req.params.accountId);
      res.json({ success: true, data: logs });
    } catch (error: unknown) {
      logger.error('Failed to get shared account audit log', {
        accountId: req.params.accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to get audit log' });
    }
  }
);

export { router };
