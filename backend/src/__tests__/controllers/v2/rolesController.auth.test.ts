import { Request, Response } from 'express';

import { RolesControllerV2 } from '../../../controllers/v2/rolesController';
import { ApiErrorCode } from '../../../types/api';
import { ApiError } from '../../../utils/apiErrors';

// Mock dependencies
jest.mock('../../../services/security/permissions/PermissionManagerService', () => ({
  PermissionManagerService: jest.fn().mockImplementation(() => ({
    clearOrganizationPermissionCache: jest.fn(),
  })),
}));

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// getRoleName is a pure utility -- let it run with real logic so that
// verifyRoleManagementAccess correctly interprets the role value.
jest.mock('../../../utils/roleUtils', () => ({
  getRoleName: jest.fn().mockImplementation((role: unknown) => {
    if (!role) return '';
    if (typeof role === 'string') return role.toLowerCase();
    if (typeof role === 'object' && role !== null && 'name' in role) {
      return ((role as { name?: string }).name ?? '').toLowerCase();
    }
    return '';
  }),
}));

describe('RolesControllerV2 - verifyRoleManagementAccess auth guard', () => {
  let controller: RolesControllerV2;
  let mockRoleRepository: Record<string, jest.Mock>;
  let mockMembershipRepository: Record<string, jest.Mock>;
  let mockUserRepository: Record<string, jest.Mock>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Shortcut to the private method under test
  const callVerify = (userId: string, organizationId: string | null | undefined, action: string) =>
    (controller as any).verifyRoleManagementAccess(userId, organizationId, action);

  beforeEach(() => {
    // Build mock repositories
    mockRoleRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn().mockImplementation(async (entity: Record<string, unknown>) => ({
        ...entity,
        id: entity.id || 'saved-role-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      remove: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    mockMembershipRepository = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    mockUserRepository = {
      findOne: jest.fn(),
    };

    // Wire AppDataSource.getRepository to return the correct mock per entity
    const { AppDataSource } = require('../../../config/database');
    AppDataSource.getRepository.mockImplementation((entity: { name: string } | string) => {
      const name = typeof entity === 'string' ? entity : entity.name;
      switch (name) {
        case 'Role':
          return mockRoleRepository;
        case 'OrganizationMembership':
          return mockMembershipRepository;
        case 'User':
          return mockUserRepository;
        default:
          return {};
      }
    });

    // Build mock response with chaining support
    mockResponse = {
      success: jest.fn(),
      paginated: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Build mock request (default: authenticated user)
    const { getAuthenticatedUserId } = require('../../../utils/authHelpers');
    getAuthenticatedUserId.mockReturnValue('user-1');

    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: { id: 'user-1' } as any,
    };

    // Instantiate the controller -- the constructor calls getRepository for
    // RoleEntity and OrganizationMembership, so the mock must already be in place.
    controller = new RolesControllerV2();

    // Override the repositories that were bound during construction, so our
    // per-test mocks are used instead of the ones captured at `new` time.
    (controller as any).roleRepository = mockRoleRepository;
    (controller as any).membershipRepository = mockMembershipRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Org-scoped: owner can manage roles
  // -----------------------------------------------------------------------
  describe('org-scoped access', () => {
    it('should allow an owner to manage roles', async () => {
      mockMembershipRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
        role: 'owner',
      });

      // Should not throw
      await expect(callVerify('user-1', 'org-1', 'create roles')).resolves.toBeUndefined();
      expect(mockMembershipRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: 'org-1', isActive: true },
        relations: ['role'],
      });
    });

    // -------------------------------------------------------------------
    // 2. Org-scoped: admin can manage roles
    // -------------------------------------------------------------------
    it('should allow an admin to manage roles', async () => {
      mockMembershipRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
        role: 'admin',
      });

      await expect(callVerify('user-1', 'org-1', 'update roles')).resolves.toBeUndefined();
    });

    // -------------------------------------------------------------------
    // 3. Org-scoped: regular member is forbidden
    // -------------------------------------------------------------------
    it('should throw 403 for a regular member', async () => {
      mockMembershipRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
        role: 'member',
      });

      await expect(callVerify('user-1', 'org-1', 'delete roles')).rejects.toThrow(ApiError);
      await expect(callVerify('user-1', 'org-1', 'delete roles')).rejects.toMatchObject({
        statusCode: 403,
        code: ApiErrorCode.FORBIDDEN,
      });
    });

    // -------------------------------------------------------------------
    // 4. Org-scoped: no membership is forbidden
    // -------------------------------------------------------------------
    it('should throw 403 when no membership is found', async () => {
      mockMembershipRepository.findOne.mockResolvedValue(null);

      await expect(callVerify('user-1', 'org-1', 'create roles')).rejects.toThrow(ApiError);
      await expect(callVerify('user-1', 'org-1', 'create roles')).rejects.toMatchObject({
        statusCode: 403,
        code: ApiErrorCode.FORBIDDEN,
      });
    });
  });

  // -----------------------------------------------------------------------
  // 5. System-scoped: platform admin can manage roles
  // -----------------------------------------------------------------------
  describe('system-scoped access', () => {
    it('should allow a platform admin to manage roles', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
      });

      await expect(callVerify('user-1', null, 'create roles')).resolves.toBeUndefined();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    // -------------------------------------------------------------------
    // 6. System-scoped: non-admin is forbidden
    // -------------------------------------------------------------------
    it('should throw 403 for a non-admin user', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        role: 'user',
      });

      await expect(callVerify('user-1', null, 'create roles')).rejects.toThrow(ApiError);
      await expect(callVerify('user-1', null, 'create roles')).rejects.toMatchObject({
        statusCode: 403,
        code: ApiErrorCode.FORBIDDEN,
      });
    });

    it('should throw 403 when the user record is not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(callVerify('user-1', null, 'delete roles')).rejects.toThrow(ApiError);
      await expect(callVerify('user-1', null, 'delete roles')).rejects.toMatchObject({
        statusCode: 403,
        code: ApiErrorCode.FORBIDDEN,
      });
    });

    it('should treat undefined organizationId the same as null (system-scoped)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
      });

      await expect(callVerify('user-1', undefined, 'update roles')).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 7. createRole calls verifyRoleManagementAccess before creating the role
  // -----------------------------------------------------------------------
  describe('createRole integration with auth guard', () => {
    it('should call verifyRoleManagementAccess and succeed for an org admin', async () => {
      // Spy on the private method
      const verifySpy = jest
        .spyOn(controller as any, 'verifyRoleManagementAccess')
        .mockResolvedValue(undefined);

      // No existing role with this name
      mockRoleRepository.findOne.mockResolvedValue(null);
      mockRoleRepository.create.mockReturnValue({
        name: 'custom-role',
        description: 'A custom role',
        organizationId: 'org-1',
        isSystemRole: false,
        priority: 50,
        permissions: ['fleet:view'],
      });
      mockRoleRepository.save.mockResolvedValue({
        id: 'role-new',
        name: 'custom-role',
        description: 'A custom role',
        organizationId: 'org-1',
        isSystemRole: false,
        priority: 50,
        permissions: ['fleet:view'],
        createdAt: new Date(),
      });

      mockRequest.body = {
        name: 'custom-role',
        description: 'A custom role',
        scope: 'organization',
        organizationId: 'org-1',
        permissions: ['fleet:view'],
      };

      await controller.createRole(mockRequest as Request, mockResponse as Response);

      expect(verifySpy).toHaveBeenCalledWith('user-1', 'org-1', 'create roles');
      expect(mockRoleRepository.save).toHaveBeenCalled();
      expect(mockResponse.status as jest.Mock).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'custom-role',
        })
      );

      verifySpy.mockRestore();
    });

    it('should reject createRole when auth guard throws', async () => {
      const verifySpy = jest
        .spyOn(controller as any, 'verifyRoleManagementAccess')
        .mockRejectedValue(
          new ApiError(
            ApiErrorCode.FORBIDDEN,
            'Organization admin access required to create roles',
            403
          )
        );

      mockRequest.body = {
        name: 'custom-role',
        scope: 'organization',
        organizationId: 'org-1',
      };

      await controller.createRole(mockRequest as Request, mockResponse as Response);

      expect(verifySpy).toHaveBeenCalled();
      // save should never have been reached
      expect(mockRoleRepository.save).not.toHaveBeenCalled();
      expect(mockResponse.status as jest.Mock).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: ApiErrorCode.FORBIDDEN }),
        })
      );

      verifySpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // 8. deleteRole calls verifyRoleManagementAccess before deleting the role
  // -----------------------------------------------------------------------
  describe('deleteRole integration with auth guard', () => {
    it('should call verifyRoleManagementAccess and succeed for an org admin', async () => {
      const verifySpy = jest
        .spyOn(controller as any, 'verifyRoleManagementAccess')
        .mockResolvedValue(undefined);

      const existingRole = {
        id: 'role-1',
        name: 'custom-role',
        organizationId: 'org-1',
        isSystemRole: false,
        permissions: [],
      };

      mockRoleRepository.findOne.mockResolvedValue(existingRole);
      mockMembershipRepository.count.mockResolvedValue(0);
      mockRoleRepository.remove.mockResolvedValue(existingRole);

      mockRequest.params = { roleId: 'role-1' };

      await controller.deleteRole(mockRequest as Request, mockResponse as Response);

      expect(verifySpy).toHaveBeenCalledWith('user-1', 'org-1', 'delete roles');
      expect(mockRoleRepository.remove).toHaveBeenCalledWith(existingRole);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedId: 'role-1',
        })
      );

      verifySpy.mockRestore();
    });

    it('should reject deleteRole when auth guard throws', async () => {
      const existingRole = {
        id: 'role-1',
        name: 'custom-role',
        organizationId: 'org-1',
        isSystemRole: false,
      };

      mockRoleRepository.findOne.mockResolvedValue(existingRole);

      const verifySpy = jest
        .spyOn(controller as any, 'verifyRoleManagementAccess')
        .mockRejectedValue(
          new ApiError(
            ApiErrorCode.FORBIDDEN,
            'Organization admin access required to delete roles',
            403
          )
        );

      mockRequest.params = { roleId: 'role-1' };

      await controller.deleteRole(mockRequest as Request, mockResponse as Response);

      expect(verifySpy).toHaveBeenCalled();
      // remove should never have been reached
      expect(mockRoleRepository.remove).not.toHaveBeenCalled();
      expect(mockResponse.status as jest.Mock).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: ApiErrorCode.FORBIDDEN }),
        })
      );

      verifySpy.mockRestore();
    });
  });
});
