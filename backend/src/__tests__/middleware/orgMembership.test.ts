import { NextFunction, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { requireOrgMembership } from '../../middleware/orgMembership';
import * as auditLogger from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

jest.mock('../../config/database');
jest.mock('../../utils/auditLogger');
jest.mock('../../utils/logger');

describe('requireOrgMembership middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockMembershipRepo: any;

  beforeEach(() => {
    mockRequest = {
      params: {},
      path: '/test',
      method: 'GET',
      user: undefined,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      headers: { 'user-agent': 'test-agent' },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    mockMembershipRepo = {
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockMembershipRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when no organization ID is in the request', () => {
    it('should pass through when no org param exists', async () => {
      mockRequest.path = '/test/route';

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('when user is not authenticated', () => {
    it('should pass through when no user is present', async () => {
      mockRequest.params = { orgId: 'org-123' };
      mockRequest.user = undefined;

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('when user is an admin', () => {
    it('should bypass membership check and attach orgMembership context', async () => {
      mockRequest.params = { orgId: 'org-123' };
      mockRequest.user = {
        id: 'user-1',
        username: 'admin',
        role: 'admin',
        organizationIds: [],
      };

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgMembership).toEqual({ organizationId: 'org-123' });
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('organization ID extraction', () => {
    it('should extract org ID from params.orgId', async () => {
      mockRequest.params = { orgId: 'org-123' };
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'],
      };

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgMembership).toEqual({ organizationId: 'org-123' });
    });

    it('should extract org ID from params.organizationId', async () => {
      mockRequest.params = { organizationId: 'org-456' };
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-456'],
      };

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgMembership).toEqual({ organizationId: 'org-456' });
    });

    it('should extract org ID from URL path regex', async () => {
      mockRequest.params = {};
      mockRequest.path = '/organizations/a1b2c3d4-e5f6-7890-abcd-ef1234567890/members';
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
      };

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgMembership).toEqual({
        organizationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
    });
  });

  describe('fast path: JWT organizationIds check', () => {
    it('should allow access when user has org ID in JWT', async () => {
      mockRequest.params = { orgId: 'org-123' };
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123', 'org-456'],
      };

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgMembership).toEqual({ organizationId: 'org-123' });
      expect(mockMembershipRepo.findOne).not.toHaveBeenCalled();
    });

    it('should fall through to DB check when org ID not in JWT', async () => {
      mockRequest.params = { orgId: 'org-999' };
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123', 'org-456'],
      };

      mockMembershipRepo.findOne.mockResolvedValue({
        role: 'member',
        securityLevel: 1,
      });

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockMembershipRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: 'org-999',
          isActive: true,
        },
        relations: ['role'],
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('slow path: database membership check', () => {
    beforeEach(() => {
      mockRequest.params = { orgId: 'org-999' };
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: [],
      };
    });

    it('should allow access and attach role/securityLevel when membership exists', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({
        role: 'leader',
        securityLevel: 3,
      });

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgMembership).toEqual({
        organizationId: 'org-999',
        role: 'leader',
        securityLevel: 3,
      });
    });

    it('should return 403 when membership does not exist', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'You are not a member of this organization',
        code: 'ORG_MEMBERSHIP_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log authorization failure when membership denied', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);
      const logAuthFailureSpy = jest.spyOn(auditLogger, 'logAuthorizationFailure');

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(logAuthFailureSpy).toHaveBeenCalledWith(
        'user-1',
        'testuser',
        'user',
        'organization:org-999',
        'GET',
        '127.0.0.1',
        'test-agent'
      );

      expect(logger.warn).toHaveBeenCalledWith('Org membership check failed', {
        userId: 'user-1',
        orgId: 'org-999',
        path: '/test',
        method: 'GET',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockMembershipRepo.findOne.mockRejectedValue(new Error('Database error'));

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Error checking org membership',
        expect.objectContaining({
          error: expect.any(Error),
          orgId: 'org-999',
          userId: 'user-1',
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Error validating organization membership',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle missing organizationIds array in JWT', async () => {
      mockRequest.params = { orgId: 'org-123' };
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: undefined,
      };

      mockMembershipRepo.findOne.mockResolvedValue({
        role: 'member',
        securityLevel: 1,
      });

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockMembershipRepo.findOne).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle mixed case UUID in path by falling through to DB check', async () => {
      mockRequest.params = {};
      mockRequest.path = '/organizations/A1B2C3D4-E5F6-7890-ABCD-EF1234567890/settings';
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
      };

      // Since UUID comparison in JWT is case-sensitive, it will fall through to DB check
      mockMembershipRepo.findOne.mockResolvedValue({
        role: 'member',
        securityLevel: 1,
      });

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockMembershipRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
          isActive: true,
        },
        relations: ['role'],
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use socket.remoteAddress when req.ip is undefined', async () => {
      mockRequest.params = { orgId: 'org-999' };
      mockRequest.ip = undefined;
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: [],
      };

      mockMembershipRepo.findOne.mockResolvedValue(null);

      await requireOrgMembership(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(auditLogger.logAuthorizationFailure).toHaveBeenCalledWith(
        'user-1',
        'testuser',
        'user',
        'organization:org-999',
        'GET',
        '127.0.0.1',
        'test-agent'
      );
    });
  });
});
