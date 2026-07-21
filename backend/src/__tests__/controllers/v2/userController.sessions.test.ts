/**
 * User Controller V2 - Session Management Tests
 * Tests for session listing and revocation endpoints
 */

import { Request, Response } from 'express';

import { UserControllerV2 } from '../../../controllers/v2/userController';
import { AuthenticationService } from '../../../services/authentication/AuthenticationService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../data-source');
jest.mock('../../../services/authentication/AuthenticationService');
jest.mock('../../../services/user/UserAuthenticationService');
jest.mock('../../../services/user/ExportRequestService');
jest.mock('../../../services/user/GdprDataDeletionService');
jest.mock('../../../utils/logger');

// Mock authHelpers
jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn((req: Request) => req.user?.id || 'user-123'),
  getActiveOrganizationId: jest.fn(),
}));

describe('UserControllerV2 - Session Management', () => {
  let controller: UserControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAuthService: jest.Mocked<AuthenticationService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock response
    mockResponse = {
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Setup mock request
    mockRequest = {
      user: {
        id: 'user-123',
        username: 'testuser',
        role: 'user',
      },
      params: {},
    };

    // Create controller instance
    controller = new UserControllerV2();

    // Get mock instance of AuthenticationService
    mockAuthService = (controller as any).authService as jest.Mocked<AuthenticationService>;
  });

  describe('getSessions', () => {
    it('should return list of active sessions', async () => {
      const mockTokens = [
        {
          id: 1,
          familyId: 'family-1',
          createdAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-01-08'),
          lastUsedAt: new Date('2024-01-02'),
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/120.0.0.0',
        },
        {
          id: 2,
          familyId: 'family-2',
          createdAt: new Date('2024-01-03'),
          expiresAt: new Date('2024-01-10'),
          lastUsedAt: undefined,
          ipAddress: '10.0.0.1',
          userAgent: 'Firefox/121.0',
        },
      ];

      mockAuthService.getUserRefreshTokens = jest.fn().mockResolvedValue(mockTokens);

      await controller.getSessions(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.getUserRefreshTokens).toHaveBeenCalledWith('user-123');
      expect(mockResponse.success).toHaveBeenCalledWith([
        {
          id: 1,
          createdAt: mockTokens[0].createdAt,
          expiresAt: mockTokens[0].expiresAt,
          lastUsedAt: mockTokens[0].lastUsedAt,
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/120.0.0.0',
          deviceInfo: 'Chrome/120.0.0.0',
        },
        {
          id: 2,
          createdAt: mockTokens[1].createdAt,
          expiresAt: mockTokens[1].expiresAt,
          lastUsedAt: undefined,
          ipAddress: '10.0.0.1',
          userAgent: 'Firefox/121.0',
          deviceInfo: 'Firefox/121.0',
        },
      ]);
    });

    it('should return empty array when user has no sessions', async () => {
      mockAuthService.getUserRefreshTokens = jest.fn().mockResolvedValue([]);

      await controller.getSessions(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.getUserRefreshTokens).toHaveBeenCalledWith('user-123');
      expect(mockResponse.success).toHaveBeenCalledWith([]);
    });

    it('should use "Unknown device" when userAgent is missing', async () => {
      const mockTokens = [
        {
          id: 1,
          familyId: 'family-1',
          createdAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-01-08'),
          ipAddress: '192.168.1.1',
          userAgent: undefined,
        },
      ];

      mockAuthService.getUserRefreshTokens = jest.fn().mockResolvedValue(mockTokens);

      await controller.getSessions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith([
        {
          id: 1,
          createdAt: mockTokens[0].createdAt,
          expiresAt: mockTokens[0].expiresAt,
          lastUsedAt: undefined,
          ipAddress: '192.168.1.1',
          userAgent: undefined,
          deviceInfo: 'Unknown device',
        },
      ]);
    });
  });

  describe('revokeSession', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: '123' };
    });

    it('should successfully revoke a session', async () => {
      mockAuthService.revokeRefreshTokenById = jest.fn().mockResolvedValue(true);

      await controller.revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeRefreshTokenById).toHaveBeenCalledWith('123', 'user-123');
      expect(mockResponse.success).toHaveBeenCalledWith({
        message: 'Session revoked successfully',
      });
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 404 when session not found', async () => {
      mockAuthService.revokeRefreshTokenById = jest.fn().mockResolvedValue(false);

      await controller.revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeRefreshTokenById).toHaveBeenCalledWith('123', 'user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found or already revoked',
      });
      expect(mockResponse.success).not.toHaveBeenCalled();
    });

    it('should return 404 for invalid sessionId (non-numeric)', async () => {
      mockRequest.params = { sessionId: 'invalid' };
      mockAuthService.revokeRefreshTokenById = jest.fn().mockResolvedValue(false);

      await controller.revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeRefreshTokenById).toHaveBeenCalledWith('invalid', 'user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 for invalid sessionId (NaN)', async () => {
      mockRequest.params = { sessionId: 'abc123' };
      mockAuthService.revokeRefreshTokenById = jest.fn().mockResolvedValue(false);

      await controller.revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeRefreshTokenById).toHaveBeenCalledWith('abc123', 'user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should prevent revoking sessions from other users', async () => {
      // The service method validates ownership, so it would return false
      // if the session doesn't belong to the user
      mockAuthService.revokeRefreshTokenById = jest.fn().mockResolvedValue(false);

      await controller.revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeRefreshTokenById).toHaveBeenCalledWith('123', 'user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
