import { Response } from 'express';

import { SharedAccountController } from '../../controllers/sharedAccountController';
import { AuthRequest } from '../../middleware/auth';
import { AccountAccessLogService, AccountPermissionService } from '../../services/security';
import { BulkAccountService, SharedAccountService } from '../../services/user';

jest.mock('../../utils/logger', () => {
  const logFns = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    trace: jest.fn(),
  };
  return {
    __esModule: true,
    default: logFns,
    logger: logFns,
  };
});

jest.mock('../../services/cloud/KeyVaultService', () => ({
  KeyVaultService: jest.fn().mockImplementation(() => ({
    isConfigured: jest.fn().mockReturnValue(false),
    getSecret: jest.fn().mockResolvedValue(null),
    setSecret: jest.fn().mockResolvedValue(false),
    deleteSecret: jest.fn().mockResolvedValue(false),
    stopCleanup: jest.fn(),
  })),
}));
jest.mock('../../services/user');
jest.mock('../../services/security');
describe('SharedAccountController', () => {
  let controller: SharedAccountController;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockSharedAccountService: jest.Mocked<SharedAccountService>;
  let mockPermissionService: jest.Mocked<AccountPermissionService>;
  let mockAccessLogService: jest.Mocked<AccountAccessLogService>;
  let mockBulkService: jest.Mocked<BulkAccountService>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: { id: 'user-123', organizationId: 'org-123' } as any,
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    controller = new SharedAccountController();
    mockSharedAccountService = (controller as any).sharedAccountService;
    mockPermissionService = (controller as any).permissionService;
    mockAccessLogService = (controller as any).accessLogService;
    mockBulkService = (controller as any).bulkService;
    // Add missing mock method
    (mockPermissionService as any).getPermissionById = jest.fn();
    jest.clearAllMocks();
  });

  describe('createSharedAccount', () => {
    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { accountName: 'Test' };

      await controller.createSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Missing required fields'),
        })
      );
    });

    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        accountName: 'Test',
        accountUsername: 'testuser',
        password: 'password123',
        organizationId: 'org-123',
      };

      await controller.createSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should return 403 if user lacks permissions', async () => {
      mockRequest.body = {
        accountName: 'Test',
        accountUsername: 'testuser',
        password: 'password123',
        organizationId: 'org-123',
      };
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.createSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Insufficient permissions') })
      );
    });

    it('should create shared account successfully', async () => {
      mockRequest.body = {
        accountName: 'Test Account',
        accountUsername: 'testuser',
        password: 'password123',
        organizationId: 'org-123',
        description: 'Test description',
      };

      const mockAccount = {
        id: 'account-123',
        accountName: 'Test Account',
        accountUsername: 'testuser',
        organizationId: 'org-123',
        description: 'Test description',
        keyVaultSecretName: 'secret-name',
        twoFactorSecretName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockSharedAccountService.createSharedAccount.mockResolvedValue(mockAccount as any);
      mockAccessLogService.logAccess.mockResolvedValue({} as any);

      await controller.createSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockSharedAccountService.createSharedAccount).toHaveBeenCalled();
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        'account-123',
        'user-123',
        'org-123',
        'create',
        '127.0.0.1',
        'Mozilla/5.0'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          keyVaultSecretName: expect.anything(),
          twoFactorSecretName: expect.anything(),
        })
      );
    });

    it('should return 500 if account creation fails', async () => {
      mockRequest.body = {
        accountName: 'Test',
        accountUsername: 'testuser',
        password: 'password123',
        organizationId: 'org-123',
      };
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockSharedAccountService.createSharedAccount.mockResolvedValue(null as any);

      await controller.createSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) })
      );
    });

    it('should handle errors gracefully', async () => {
      mockRequest.body = {
        accountName: 'Test',
        accountUsername: 'testuser',
        password: 'password123',
        organizationId: 'org-123',
      };
      mockPermissionService.hasPermission.mockRejectedValue(new Error('Database error'));

      await controller.createSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      // handleError should have been called for error logging and 500 response
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('getSharedAccountsByOrganization', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { organizationId: 'org-123' };

      await controller.getSharedAccountsByOrganization(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should get shared accounts successfully', async () => {
      mockRequest.params = { organizationId: 'org-123' };

      const mockAccounts = [
        { id: 'account-1', accountName: 'Account 1' },
        { id: 'account-2', accountName: 'Account 2' },
      ];

      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockSharedAccountService.getSharedAccountsByOrganization.mockResolvedValue(
        mockAccounts as any
      );

      await controller.getSharedAccountsByOrganization(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockSharedAccountService.getSharedAccountsByOrganization).toHaveBeenCalledWith(
        'org-123'
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockAccounts);
    });

    it('should handle permission denied', async () => {
      mockRequest.params = { organizationId: 'org-123' };
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.getSharedAccountsByOrganization(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Insufficient permissions') })
      );
    });
  });

  describe('getSharedAccount', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'account-123' };

      await controller.getSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should get shared account successfully', async () => {
      mockRequest.params = { id: 'account-123' };

      const mockAccount = {
        id: 'account-123',
        accountName: 'Test Account',
        organizationId: 'org-123',
      };

      mockSharedAccountService.getSharedAccountById.mockResolvedValue(mockAccount as any);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockAccessLogService.logAccess.mockResolvedValue({} as any);

      await controller.getSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockSharedAccountService.getSharedAccountById).toHaveBeenCalledWith('account-123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'account-123' }));
    });

    it('should return 404 if account not found', async () => {
      mockRequest.params = { id: 'account-123' };
      mockSharedAccountService.getSharedAccountById.mockResolvedValue(null);

      await controller.getSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('not found') })
      );
    });
  });

  describe('updateSharedAccount', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'account-123' };
      mockRequest.body = { accountName: 'Updated' };

      await controller.updateSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should update shared account successfully', async () => {
      mockRequest.params = { id: 'account-123' };
      mockRequest.body = { accountName: 'Updated Name' };

      const mockAccount = {
        id: 'account-123',
        accountName: 'Test Account',
        organizationId: 'org-123',
      };

      const mockUpdatedAccount = {
        ...mockAccount,
        accountName: 'Updated Name',
      };

      mockSharedAccountService.getSharedAccountById.mockResolvedValue(mockAccount as any);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockSharedAccountService.updateSharedAccount.mockResolvedValue(mockUpdatedAccount as any);
      mockAccessLogService.logAccess.mockResolvedValue({} as any);

      await controller.updateSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockSharedAccountService.updateSharedAccount).toHaveBeenCalled();
      expect(mockAccessLogService.logAccess).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockUpdatedAccount);
    });

    it('should return 403 if user lacks permissions', async () => {
      mockRequest.params = { id: 'account-123' };
      mockRequest.body = { accountName: 'Updated' };

      const mockAccount = {
        id: 'account-123',
        organizationId: 'org-123',
      };

      mockSharedAccountService.getSharedAccountById.mockResolvedValue(mockAccount as any);
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await controller.updateSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Insufficient permissions') })
      );
    });
  });

  describe('deleteSharedAccount', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'account-123' };

      await controller.deleteSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should delete shared account successfully', async () => {
      mockRequest.params = { id: 'account-123' };

      const mockAccount = {
        id: 'account-123',
        organizationId: 'org-123',
      };

      mockSharedAccountService.getSharedAccountById.mockResolvedValue(mockAccount as any);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockSharedAccountService.deleteSharedAccount.mockResolvedValue(true);
      mockAccessLogService.logAccess.mockResolvedValue({} as any);

      await controller.deleteSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockSharedAccountService.deleteSharedAccount).toHaveBeenCalledWith('account-123');
      expect(mockAccessLogService.logAccess).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Shared account deleted successfully' });
    });

    it('should return 404 if account not found', async () => {
      mockRequest.params = { id: 'account-123' };
      mockSharedAccountService.getSharedAccountById.mockResolvedValue(null);

      await controller.deleteSharedAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('not found') })
      );
    });
  });

  describe('grantPermission', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { userId: 'user-456', accountId: 'account-123', permission: 'read' };

      await controller.grantPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should grant permission successfully', async () => {
      mockRequest.body = {
        targetUserId: 'user-456',
        organizationId: 'org-123',
        action: 'read',
        accountId: 'account-123',
      };
      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockPermissionService.grantPermission.mockResolvedValue({
        id: 'perm-1',
        action: 'read',
      } as any);

      await controller.grantPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionService.grantPermission).toHaveBeenCalledWith(
        'user-456',
        'org-123',
        'read',
        expect.any(String),
        'account-123',
        undefined
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ id: 'perm-1', action: 'read' });
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { userId: 'user-456' };

      await controller.grantPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Missing required fields'),
        })
      );
    });
  });

  describe('revokePermission', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'permission-123' };

      await controller.revokePermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should revoke permission successfully', async () => {
      mockRequest.params = { permissionId: 'permission-123' };
      mockPermissionService.revokePermission.mockResolvedValue(true);

      await controller.revokePermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionService.revokePermission).toHaveBeenCalledWith('permission-123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Permission revoked successfully' });
    });

    it('should return 404 if permission not found', async () => {
      mockRequest.params = { permissionId: 'permission-123' };
      mockPermissionService.revokePermission.mockResolvedValue(false);

      await controller.revokePermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('not found') })
      );
    });
  });

  describe('getUserPermissions', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: 'user-456' };

      await controller.getUserPermissions(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Unauthorized') })
      );
    });

    it('should get user permissions successfully', async () => {
      mockRequest.params = { userId: 'user-456', organizationId: 'org-123' };

      const mockPermissions = [
        { id: 'perm-1', action: 'read', accountId: 'account-1' },
        { id: 'perm-2', action: 'write', accountId: 'account-2' },
      ];

      mockPermissionService.hasPermission.mockResolvedValue(true);
      mockPermissionService.getUserPermissions.mockResolvedValue(mockPermissions as any);

      await controller.getUserPermissions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionService.getUserPermissions).toHaveBeenCalledWith('user-456', 'org-123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockPermissions);
    });
  });
});
