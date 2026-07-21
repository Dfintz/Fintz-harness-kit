import { Request, Response } from 'express';

import { AppDataSource } from '../../../config/database';
import { PermissionsControllerV2 } from '../../../controllers/v2/permissionsController';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { OrganizationPermission } from '../../../models/OrganizationPermission';
import { User } from '../../../models/User';
import { PERMISSION_CATEGORIES } from '../../../types/permissions';

jest.mock('../../../config/database');

describe('PermissionsControllerV2 - listPermissions query parsing', () => {
  let controller: PermissionsControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const mockUserQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'admin' }),
  };

  const mockUserRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockUserQueryBuilder),
  };

  const mockMembershipRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockPermissionRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === User) return mockUserRepository;
      if (entity === OrganizationMembership) return mockMembershipRepository;
      if (entity === OrganizationPermission) return mockPermissionRepository;
      return {};
    });

    controller = new PermissionsControllerV2();

    mockRequest = {
      user: { id: 'admin-1' },
      query: {},
      queryParams: undefined,
      params: {},
    } as Partial<Request>;

    mockResponse = {
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterAll(() => {
    const { enhancedCacheService } = require('../../../services/caching/EnhancedCacheService');
    enhancedCacheService.shutdown();
  });

  it('falls back to req.query when queryParams is undefined', async () => {
    mockRequest.query = { search: 'fleet', category: 'organization' };

    await controller.listPermissions(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          search: 'fleet',
          category: 'organization',
        },
      })
    );
  });

  it('prefers parsed queryParams over raw query values', async () => {
    mockRequest.query = { search: 'from-query', category: 'from-query' };
    mockRequest.queryParams = { search: 'from-query-params', category: 'organization' };

    await controller.listPermissions(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          search: 'from-query-params',
          category: 'organization',
        },
      })
    );
  });

  it('returns permission details by key from GET /permissions/:id', async () => {
    const knownPermission = Object.values(PERMISSION_CATEGORIES)
      .flatMap(category => Object.values(category.permissions))
      .at(0);

    expect(knownPermission).toBeDefined();
    mockRequest.params = { id: knownPermission! };

    await controller.getPermission(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        key: knownPermission,
      })
    );
  });

  it('returns 404 when GET /permissions/:id is unknown', async () => {
    mockRequest.params = { id: 'unknown:permission' };

    await controller.getPermission(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Permission not found',
        }),
      })
    );
  });

  it('returns empty permission sources when org membership is missing', async () => {
    const mockMembershipQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    mockMembershipRepository.createQueryBuilder.mockReturnValue(mockMembershipQueryBuilder);

    mockRequest.params = { organizationId: 'org-1', userId: 'member-1' };

    await controller.getUserPermissionsForOrg(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.success).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        organizationId: 'org-1',
        total: 0,
        permissions: [],
        sources: {
          role: [],
          memberOverrides: [],
          directGrants: [],
        },
      })
    );
  });

  it('combines role, member override, and direct grants for org-scoped user permissions', async () => {
    const mockMembershipQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        role: {
          id: 'role-1',
          name: 'member',
          permissions: ['organization:read'],
        },
        permissions: ['fleet:manage'],
      }),
    };
    mockMembershipRepository.createQueryBuilder.mockReturnValue(mockMembershipQueryBuilder);
    mockPermissionRepository.find.mockResolvedValue([
      {
        id: 'grant-1',
        resource: 'fleet',
        actions: ['read'],
        resourceId: 'fleet-123',
        isActive: true,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]);

    mockRequest.params = { organizationId: 'org-1', userId: 'member-1' };

    await controller.getUserPermissionsForOrg(mockRequest as Request, mockResponse as Response);

    expect(mockPermissionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1', userId: 'member-1' }),
      })
    );
    expect(mockResponse.success).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        organizationId: 'org-1',
        permissions: expect.arrayContaining([
          'organization:read',
          'fleet:manage',
          'fleet:read',
          'fleet:read:fleet-123',
        ]),
        sources: expect.objectContaining({
          role: ['organization:read'],
          memberOverrides: ['fleet:manage'],
          directGrants: expect.arrayContaining([
            expect.objectContaining({
              id: 'grant-1',
              resource: 'fleet',
            }),
          ]),
        }),
      })
    );
  });
});
