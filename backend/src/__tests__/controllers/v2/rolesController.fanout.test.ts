import { Request, Response } from 'express';

import { RolesControllerV2 } from '../../../controllers/v2/rolesController';

const mockPermissionChangeEventService = {
  onRolePermissionChanged: jest.fn(),
  onUserRoleChanged: jest.fn(),
};

jest.mock('../../../services/security/permissions/PermissionChangeEventService', () => ({
  PermissionChangeEventService: {
    getInstance: jest.fn(() => mockPermissionChangeEventService),
  },
}));

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    transaction: jest.fn(),
    manager: {
      getRepository: jest.fn(),
    },
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

describe('RolesControllerV2 fanout mutation paths', () => {
  let controller: RolesControllerV2;
  let mockRoleRepository: Record<string, jest.Mock>;
  let mockMembershipRepository: Record<string, jest.Mock>;
  let mockResponse: Partial<Response>;
  let processPermissionChangeSpy: jest.SpyInstance;

  const createRequest = (overrides?: Partial<Request>): Partial<Request> => ({
    params: {},
    body: {},
    query: {},
    user: { id: 'actor-user' } as any,
    ...overrides,
  });

  beforeEach(() => {
    mockRoleRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn().mockImplementation(async (entity: Record<string, unknown>) => ({
        ...entity,
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
      createQueryBuilder: jest.fn(),
    };

    const { AppDataSource } = require('../../../config/database');
    const resolveRepository = (entity: { name: string } | string) => {
      const name = typeof entity === 'string' ? entity : entity.name;
      if (name === 'Role') {
        return mockRoleRepository;
      }
      if (name === 'OrganizationMembership') {
        return mockMembershipRepository;
      }
      return {};
    };
    AppDataSource.getRepository.mockImplementation(resolveRepository);
    // MemberRoleAssignmentService applies the grant via AppDataSource.manager.
    AppDataSource.manager.getRepository.mockImplementation(resolveRepository);

    AppDataSource.transaction.mockImplementation(async (cb: (manager: any) => Promise<void>) => {
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          find: mockRoleRepository.find,
          save: mockRoleRepository.save,
        }),
      };
      await cb(manager);
    });

    const { getAuthenticatedUserId } = require('../../../utils/authHelpers');
    getAuthenticatedUserId.mockReturnValue('actor-user');

    mockResponse = {
      success: jest.fn(),
      paginated: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    controller = new RolesControllerV2();
    (controller as any).roleRepository = mockRoleRepository;
    (controller as any).membershipRepository = mockMembershipRepository;

    jest.spyOn(controller as any, 'verifyRoleManagementAccess').mockResolvedValue(undefined);
    jest.spyOn(controller as any, 'resolveAffectedUserIdsByRole').mockResolvedValue(['user-1']);
    jest.spyOn(controller as any, 'resolveAffectedUserIdsByRoles').mockResolvedValue(['user-1']);
    processPermissionChangeSpy = jest
      .spyOn(controller as any, 'processPermissionChange')
      .mockResolvedValue(undefined);

    mockPermissionChangeEventService.onRolePermissionChanged.mockReset();
    mockPermissionChangeEventService.onUserRoleChanged.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fanouts on updateRole with role_updated', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
      permissions: [],
      priority: 10,
    });

    const req = createRequest({
      params: { roleId: 'role-1' },
      body: { name: 'updated' },
    }) as Request;
    await controller.updateRole(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).toHaveBeenCalledWith(
      'org-1',
      'actor-user',
      'role_updated',
      ['user-1']
    );
  });

  it('maps updateRole fanout args to onRolePermissionChanged contract', async () => {
    processPermissionChangeSpy.mockRestore();

    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
      permissions: [],
      priority: 10,
    });

    const req = createRequest({
      params: { roleId: 'role-1' },
      body: { name: 'updated' },
    }) as Request;

    await controller.updateRole(req, mockResponse as Response);

    expect(mockPermissionChangeEventService.onRolePermissionChanged).toHaveBeenCalledWith(
      'org-1',
      ['user-1'],
      'role_updated',
      'actor-user'
    );
  });

  it('fanouts on reorderRoles with roles_reordered', async () => {
    mockRoleRepository.find.mockResolvedValue([
      { id: 'role-1', organizationId: 'org-1', isSystemRole: false, priority: 10 },
      { id: 'role-2', organizationId: 'org-1', isSystemRole: false, priority: 20 },
    ]);

    const req = createRequest({
      params: { orgId: 'org-1' },
      body: {
        updates: [
          { roleId: 'role-1', priority: 30 },
          { roleId: 'role-2', priority: 40 },
        ],
      },
    }) as Request;

    await controller.reorderRoles(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).toHaveBeenCalledWith(
      'org-1',
      'actor-user',
      'roles_reordered',
      ['user-1']
    );
  });

  it('fanouts on deleteRole with role_deleted', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
    });
    mockMembershipRepository.count.mockResolvedValue(0);

    const req = createRequest({ params: { roleId: 'role-1' } }) as Request;
    await controller.deleteRole(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).toHaveBeenCalledWith(
      'org-1',
      'actor-user',
      'role_deleted',
      ['user-1']
    );
  });

  it('fanouts on assignRoleToUser with role_assigned', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
    });
    mockMembershipRepository.findOne.mockResolvedValue({
      userId: 'target-1',
      organizationId: 'org-1',
      roleId: 'old-role',
      role: { name: 'member' },
    });

    const req = createRequest({
      params: { roleId: 'role-1' },
      body: { userId: 'target-1', organizationId: 'org-1' },
    }) as Request;

    await controller.assignRoleToUser(req, mockResponse as Response);

    expect(mockPermissionChangeEventService.onUserRoleChanged).toHaveBeenCalledWith(
      'org-1',
      'target-1',
      'role_assigned',
      'actor-user'
    );
  });

  it('fanouts on removeRoleFromUser with role_revoked', async () => {
    mockRoleRepository.findOne
      .mockResolvedValueOnce({
        id: 'role-1',
        name: 'role-one',
        organizationId: 'org-1',
      })
      .mockResolvedValueOnce({
        id: 'member-role',
        name: 'member',
        organizationId: 'org-1',
      });

    mockMembershipRepository.findOne.mockResolvedValue({
      userId: 'target-1',
      organizationId: 'org-1',
      roleId: 'role-1',
    });

    const req = createRequest({
      params: { roleId: 'role-1', userId: 'target-1' },
      query: { organizationId: 'org-1' },
    }) as Request;

    await controller.removeRoleFromUser(req, mockResponse as Response);

    expect(mockPermissionChangeEventService.onUserRoleChanged).toHaveBeenCalledWith(
      'org-1',
      'target-1',
      'role_revoked',
      'actor-user'
    );
  });

  it('fanouts on addPermissionToRole with permission_added', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
      permissions: [],
    });

    const req = createRequest({
      params: { roleId: 'role-1' },
      body: { permissionId: 'perm-1' },
    }) as Request;

    await controller.addPermissionToRole(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).toHaveBeenCalledWith(
      'org-1',
      'actor-user',
      'permission_added',
      ['user-1']
    );
  });

  it('fanouts on removePermissionFromRole with permission_removed', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
      permissions: ['perm-1'],
    });

    const req = createRequest({
      params: { roleId: 'role-1', permissionId: 'perm-1' },
    }) as Request;

    await controller.removePermissionFromRole(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).toHaveBeenCalledWith(
      'org-1',
      'actor-user',
      'permission_removed',
      ['user-1']
    );
  });

  it('does not fanout when addPermissionToRole is idempotent', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
      permissions: ['perm-1'],
    });

    const req = createRequest({
      params: { roleId: 'role-1' },
      body: { permissionId: 'perm-1' },
    }) as Request;

    await controller.addPermissionToRole(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).not.toHaveBeenCalled();
    expect(mockRoleRepository.save).not.toHaveBeenCalled();
  });

  it('does not fanout when removePermissionFromRole is idempotent', async () => {
    mockRoleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      name: 'role-one',
      organizationId: 'org-1',
      isSystemRole: false,
      permissions: ['perm-2'],
    });

    const req = createRequest({
      params: { roleId: 'role-1', permissionId: 'perm-1' },
    }) as Request;

    await controller.removePermissionFromRole(req, mockResponse as Response);

    expect((controller as any).processPermissionChange).not.toHaveBeenCalled();
    expect(mockRoleRepository.save).not.toHaveBeenCalled();
  });
});
