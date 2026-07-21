/**
 * User Controller V2 - Profile Endpoint Tests
 * Tests for profile update and active organization switching behaviors.
 */

import { Request, Response } from 'express';

import { UserControllerV2 } from '../../../controllers/v2/userController';
import { ApiErrorCode } from '../../../types/api';

const mockUpdateProfile = jest.fn();
const mockSetActiveOrganization = jest.fn();

// Core dependency mocks used across existing UserControllerV2 test suites
jest.mock('../../../config/database');
jest.mock('../../../data-source');
jest.mock('../../../services/authentication/AuthenticationService');
jest.mock('../../../services/user/UserAuthenticationService');
jest.mock('../../../services/user/ExportRequestService');
jest.mock('../../../services/user/GdprDataDeletionService');
jest.mock('../../../services/security/access/AccountAccessLogService');
jest.mock('../../../services/security/access/TrustedDeviceService', () => {
  const mockTrustedDeviceService = {
    getUserDevices: jest.fn(),
    revokeDevice: jest.fn(),
    revokeAllDevices: jest.fn(),
  };

  return {
    TrustedDeviceService: jest.fn(() => mockTrustedDeviceService),
    getTrustedDeviceService: jest.fn(() => mockTrustedDeviceService),
  };
});

jest.mock('../../../services/user/UserProfileService', () => ({
  UserProfileService: jest.fn().mockImplementation(() => ({
    updateProfile: mockUpdateProfile,
  })),
}));

jest.mock('../../../services/user/UserPreferencesService', () => ({
  UserPreferencesService: jest.fn().mockImplementation(() => ({
    setActiveOrganization: mockSetActiveOrganization,
  })),
}));

jest.mock('../../../utils/logger');

jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn((req: Request) => req.user?.id || 'user-123'),
  getActiveOrganizationId: jest.fn(),
}));

describe('UserControllerV2 - Profile endpoints', () => {
  let controller: UserControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new UserControllerV2();

    mockRequest = {
      user: {
        id: 'user-123',
        username: 'testuser',
        role: 'user',
      } as Request['user'],
      body: {},
    };

    mockResponse = {
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('updateCurrentUser', () => {
    it('should reject activeOrgId updates through /users/me', async () => {
      mockRequest.body = {
        activeOrgId: 'org-999',
      };

      await expect(
        controller.updateCurrentUser(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.INVALID_INPUT,
        statusCode: 400,
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('should update only whitelisted profile fields', async () => {
      const updatedAt = new Date('2026-06-01T10:00:00Z');
      mockUpdateProfile.mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        displayName: 'Test Pilot',
        bio: 'Ready for launch',
        avatar: 'https://cdn.example/avatar.png',
        activeOrgId: 'org-123',
        updatedAt,
      });

      mockRequest.body = {
        displayName: 'Test Pilot',
        bio: 'Ready for launch',
        avatar: 'https://cdn.example/avatar.png',
        ignoredField: 'ignore-me',
      };

      await controller.updateCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockUpdateProfile).toHaveBeenCalledWith('user-123', {
        displayName: 'Test Pilot',
        bio: 'Ready for launch',
        avatar: 'https://cdn.example/avatar.png',
      });

      expect(mockResponse.success).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'testuser',
        displayName: 'Test Pilot',
        bio: 'Ready for launch',
        avatar: 'https://cdn.example/avatar.png',
        activeOrgId: 'org-123',
        updatedAt,
      });
    });
  });

  describe('switchActiveOrganization', () => {
    it('should reject empty active organization payload', async () => {
      mockRequest.body = {};

      await expect(
        controller.switchActiveOrganization(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.INVALID_INPUT,
        statusCode: 400,
      });

      expect(mockSetActiveOrganization).not.toHaveBeenCalled();
    });

    it('should switch active organization and return refreshed org context', async () => {
      const organizationId = '550e8400-e29b-41d4-a716-446655440000';

      mockSetActiveOrganization.mockResolvedValue({
        activeOrgId: organizationId,
      });

      jest.spyOn(controller as any, 'findOrganizationById').mockResolvedValue({
        id: organizationId,
        name: 'The New Org',
        logoUrl: 'https://cdn.example/org-logo.png',
      });

      jest.spyOn(controller as any, 'findActiveMembership').mockResolvedValue({
        role: 'admin',
      });

      mockRequest.body = {
        organizationId,
      };

      await controller.switchActiveOrganization(mockRequest as Request, mockResponse as Response);

      expect(mockSetActiveOrganization).toHaveBeenCalledWith('user-123', organizationId);
      expect(mockResponse.success).toHaveBeenCalledWith({
        activeOrgId: organizationId,
        activeOrgName: 'The New Org',
        activeOrgLogoUrl: 'https://cdn.example/org-logo.png',
        orgRole: 'admin',
      });
    });
  });
});
