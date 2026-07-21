import { NextFunction, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { discordAdminAuthorization } from '../../middleware/discordAuthorization';
import * as auditLogger from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

jest.mock('../../config/database');
jest.mock('../../utils/auditLogger');
jest.mock('../../utils/logger');

describe('discordAdminAuthorization middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockMembershipRepo: any;

  beforeEach(() => {
    mockRequest = {
      params: {},
      path: '/api/discord/settings',
      method: 'POST',
      user: undefined,
      ip: '192.168.1.100',
      socket: { remoteAddress: '192.168.1.100' } as any,
      headers: { 'user-agent': 'jest-test-agent' },
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

  describe('when user is not authenticated', () => {
    it('should return 401 when no user is present', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { orgId: 'org-123' };

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('when orgId parameter is missing', () => {
    it('should return 400 when orgId is not provided', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'],
      };
      mockRequest.params = {}; // No orgId

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Organization ID is required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('when user is an admin', () => {
    it('should bypass all checks and allow access', async () => {
      mockRequest.user = {
        id: 'admin-1',
        username: 'admin',
        role: 'admin',
        organizationIds: [],
      };
      mockRequest.params = { orgId: 'org-123' };

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockMembershipRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('when user is not a member of the organization', () => {
    it('should return 403 and log authorization failure', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: [], // Not in this org
      };
      mockRequest.params = { orgId: 'org-999' };

      mockMembershipRepo.findOne.mockResolvedValue(null);

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockMembershipRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: 'org-999',
          isActive: true,
        },
      });

      expect(auditLogger.logAuthorizationFailure).toHaveBeenCalledWith(
        'user-1',
        'testuser',
        'user',
        'discord:organization:org-999',
        'POST',
        '192.168.1.100',
        'jest-test-agent'
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to manage Discord settings for this organization',
        code: 'ORG_MEMBERSHIP_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use socket.remoteAddress when req.ip is undefined', async () => {
      mockRequest.ip = undefined;
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: [],
      };
      mockRequest.params = { orgId: 'org-999' };

      mockMembershipRepo.findOne.mockResolvedValue(null);

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(auditLogger.logAuthorizationFailure).toHaveBeenCalledWith(
        'user-1',
        'testuser',
        'user',
        'discord:organization:org-999',
        'POST',
        '192.168.1.100',
        'jest-test-agent'
      );
    });
  });

  describe('when user is a member but not owner/admin', () => {
    it('should return 403 for regular member', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'],
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-123',
        role: 'member', // Not owner or admin
      });

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(auditLogger.logAuthorizationFailure).toHaveBeenCalledWith(
        'user-1',
        'testuser',
        'user',
        'discord:organization:org-123:admin-required',
        'POST',
        '192.168.1.100',
        'jest-test-agent'
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Only organization owners and admins can manage Discord settings',
        code: 'INSUFFICIENT_ROLE',
        requiredRole: 'owner or admin',
        currentRole: 'member',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for moderator role', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'],
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-123',
        role: 'moderator',
      });

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Only organization owners and admins can manage Discord settings',
        code: 'INSUFFICIENT_ROLE',
        requiredRole: 'owner or admin',
        currentRole: 'moderator',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('when user is organization owner', () => {
    it('should allow access for owner', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'owner',
        role: 'user',
        organizationIds: ['org-123'],
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-123',
        role: 'owner',
      });

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(auditLogger.logAuthorizationFailure).not.toHaveBeenCalled();
    });
  });

  describe('when user is organization admin', () => {
    it('should allow access for admin', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'orgadmin',
        role: 'user',
        organizationIds: ['org-123'],
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-123',
        role: 'admin',
      });

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(auditLogger.logAuthorizationFailure).not.toHaveBeenCalled();
    });
  });

  describe('when database error occurs', () => {
    it('should return 500 and log error', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'],
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockRejectedValue(new Error('Database connection failed'));

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Discord authorization check failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization check failed',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('JWT fast path behavior', () => {
    it('should still query database even when org is in JWT', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'], // Org in JWT
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-123',
        role: 'owner',
      });

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Should query DB for role information
      expect(mockMembershipRepo.findOne).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle case where JWT has org but DB does not', async () => {
      mockRequest.user = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        organizationIds: ['org-123'], // Stale JWT?
      };
      mockRequest.params = { orgId: 'org-123' };

      mockMembershipRepo.findOne.mockResolvedValue(null); // Not in DB

      await discordAdminAuthorization(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
