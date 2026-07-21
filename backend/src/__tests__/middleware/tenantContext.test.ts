import { Response } from 'express';
import { AppDataSource } from '../../config/database';
import { TenantAuthRequest, tenantContext } from '../../middleware/tenantContext';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';

jest.mock('../../services/user/UserPreferencesService', () => {
  const clearStaleActiveOrganization = jest.fn();
  return {
    UserPreferencesService: jest.fn().mockImplementation(() => ({
      clearStaleActiveOrganization,
    })),
    mockClearStaleActiveOrganization: clearStaleActiveOrganization,
  };
});

const { mockClearStaleActiveOrganization } = jest.requireMock(
  '../../services/user/UserPreferencesService'
) as { mockClearStaleActiveOrganization: jest.Mock };

jest.mock('../../config/database');
describe('tenantContext middleware', () => {
  let mockRequest: Partial<TenantAuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let mockUserRepo: any;
  let mockUserOrgRepo: any;
  let mockUserQueryBuilder: any;
  let mockMembershipQueryBuilder: any;

  beforeEach(() => {
    mockClearStaleActiveOrganization.mockResolvedValue(undefined);
    mockRequest = {
      user: { id: 'user-123' },
      path: '/organizations',
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();

    mockUserQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockMembershipQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockUserRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockUserQueryBuilder),
      save: jest.fn().mockImplementation(user => Promise.resolve(user)),
    };
    mockUserOrgRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockMembershipQueryBuilder),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === User) return mockUserRepo;
      if (entity === OrganizationMembership) return mockUserOrgRepo;
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('tenant-optional paths', () => {
    it('should allow /users/me without organization', async () => {
      mockRequest.path = '/users/me';
      mockRequest.originalUrl = '/api/v2/users/me';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should require organization for lookalike paths such as /users/meh', async () => {
      mockRequest.path = '/users/meh';
      mockRequest.originalUrl = '/api/v2/users/meh';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should allow /users/me/ships without organization', async () => {
      mockRequest.path = '/users/me/ships';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should allow /users/me/loadouts without organization', async () => {
      mockRequest.path = '/users/me/loadouts';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should allow /users/me/activity without organization', async () => {
      mockRequest.path = '/users/me/activity';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should allow /gdpr/consent without organization', async () => {
      mockRequest.path = '/gdpr/consent';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should require organization context for /inventory', async () => {
      mockRequest.path = '/inventory';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should allow /directory/federations without organization', async () => {
      mockRequest.path = '/directory/federations';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should allow /rsi/verify/initiate without organization (personal RSI verification)', async () => {
      // Regression: router-level tenantContextMiddleware on bare-`/api` routers (e.g.
      // cargoManifestRoutes) leaks onto unmatched `/api/*` paths. An org-less user
      // generating an RSI verification link must not be blocked with 400.
      mockRequest.path = '/rsi/verify/initiate';
      mockRequest.originalUrl = '/api/rsi/verify/initiate';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });
  });

  describe('UUID pattern matching', () => {
    it('should match /users/{uuid}/ships pattern', async () => {
      mockRequest.path = '/users/550e8400-e29b-41d4-a716-446655440000/ships';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should match /users/{uuid}/loadouts pattern', async () => {
      mockRequest.path = '/users/550e8400-e29b-41d4-a716-446655440000/loadouts';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should match /users/{uuid}/activity pattern', async () => {
      mockRequest.path = '/users/550e8400-e29b-41d4-a716-446655440000/activity';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should match /users/{any-string}/ships pattern', async () => {
      mockRequest.path = '/users/some-user-id-123/ships';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });
  });

  describe('organization required paths', () => {
    it('should allow /organizations without active organization (tenant-optional)', async () => {
      mockRequest.path = '/organizations';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    });

    it('should block /fleets without active organization', async () => {
      mockRequest.path = '/fleets';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: null,
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow /organizations with active organization', async () => {
      mockRequest.path = '/organizations';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: 'org-456',
        role: 'user',
      });
      mockMembershipQueryBuilder.getOne.mockResolvedValue({
        userId: 'user-123',
        organizationId: 'org-456',
        role: 'member',
        securityLevel: 1,
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.tenantContext).toEqual({
        organizationId: 'org-456',
        userId: 'user-123',
        userRole: 'user',
        securityLevel: 1,
        organizationRole: 'member',
      });
    });

    it('should clear stale active organization and require reselection on org-required paths', async () => {
      mockRequest.path = '/fleets';
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: 'org-stale',
        role: 'user',
      });
      mockMembershipQueryBuilder.getOne.mockResolvedValue(null);

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockClearStaleActiveOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          activeOrgId: 'org-stale',
        }),
        expect.objectContaining({
          staleOrganizationId: 'org-stale',
          path: '/fleets',
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No active organization selected',
          requiresOrgSelection: true,
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should clear stale active organization and continue on tenant-optional paths', async () => {
      mockRequest.path = '/users/me';
      mockRequest.originalUrl = '/api/v2/users/me';
      mockRequest.user = {
        id: 'user-123',
        currentOrganizationId: 'org-stale',
        currentOrganizationName: 'Stale Org',
      };
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: 'org-stale',
        role: 'user',
      });
      mockMembershipQueryBuilder.getOne.mockResolvedValue(null);

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockClearStaleActiveOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          activeOrgId: 'org-stale',
        }),
        expect.objectContaining({
          staleOrganizationId: 'org-stale',
          path: '/users/me',
        })
      );
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(400);
      expect(mockRequest.user?.currentOrganizationId).toBeUndefined();
      expect(mockRequest.user?.currentOrganizationName).toBeUndefined();
    });
  });

  describe('admin organization override', () => {
    it('should allow admin to override organization via header', async () => {
      mockRequest.path = '/organizations';
      mockRequest.headers = { 'x-organization-id': 'org-override' };
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: 'org-456',
        role: 'admin',
      });
      mockMembershipQueryBuilder.getOne.mockResolvedValue({
        userId: 'user-123',
        organizationId: 'org-override',
        role: 'admin',
        securityLevel: 5,
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.tenantContext?.organizationId).toBe('org-override');
    });

    it('should block non-admin from overriding organization via header', async () => {
      mockRequest.path = '/organizations';
      mockRequest.headers = { 'x-organization-id': 'org-override' };
      mockUserQueryBuilder.getOne.mockResolvedValue({
        id: 'user-123',
        activeOrgId: 'org-456',
        role: 'user',
      });

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions to override organization context',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('unauthenticated requests', () => {
    it('should skip middleware for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockUserRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('user not found', () => {
    it('should return 401 when user is not found', async () => {
      mockUserQueryBuilder.getOne.mockResolvedValue(null);

      await tenantContext(mockRequest as TenantAuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
