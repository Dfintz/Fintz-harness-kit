/**
 * User Controller V2 - Security Settings Tests
 * Tests for trusted devices, and access log endpoints
 */

import { Request, Response } from 'express';

import { UserControllerV2 } from '../../../controllers/v2/userController';
import { AccountAccessLogService } from '../../../services/security/access/AccountAccessLogService';
import { TrustedDeviceService } from '../../../services/security/access/TrustedDeviceService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../data-source');
jest.mock('../../../services/authentication/AuthenticationService');
jest.mock('../../../services/user/UserAuthenticationService');
jest.mock('../../../services/user/ExportRequestService');
jest.mock('../../../services/user/GdprDataDeletionService');
jest.mock('../../../services/security/access/TrustedDeviceService', () => {
  const mockInstance = {
    getUserDevices: jest.fn(),
    revokeDevice: jest.fn(),
    revokeAllDevices: jest.fn(),
  };
  return {
    TrustedDeviceService: jest.fn(() => mockInstance),
    getTrustedDeviceService: jest.fn(() => mockInstance),
  };
});
jest.mock('../../../services/security/access/AccountAccessLogService');
jest.mock('../../../utils/logger');

// Mock authHelpers
jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn((req: Request) => req.user?.id || 'user-123'),
  getActiveOrganizationId: jest.fn(),
}));

describe('UserControllerV2 - Security Settings', () => {
  let controller: UserControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockTrustedDeviceService: jest.Mocked<TrustedDeviceService>;
  let mockAccessLogService: jest.Mocked<AccountAccessLogService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockResponse = {
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      user: {
        id: 'user-123',
        username: 'testuser',
        role: 'user',
      },
      params: {},
      query: {},
    };

    controller = new UserControllerV2();

    mockTrustedDeviceService = (controller as any)
      .trustedDeviceService as jest.Mocked<TrustedDeviceService>;
    mockAccessLogService = (controller as any)
      .accessLogService as jest.Mocked<AccountAccessLogService>;
  });

  describe('getTrustedDevices', () => {
    it('should return list of trusted devices', async () => {
      const mockDevices = [
        {
          id: 'device-1',
          userId: 'user-123',
          deviceFingerprint: 'fp-abc',
          deviceName: 'Chrome on Windows',
          userAgent: 'Chrome/120.0.0.0',
          ipAddress: '192.168.1.1',
          location: 'New York, US',
          lastUsed: new Date('2024-01-02'),
          isActive: true,
          trustLevel: 'high' as const,
          verificationMethod: 'totp',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'device-2',
          userId: 'user-123',
          deviceFingerprint: 'fp-def',
          deviceName: 'Firefox on Mac',
          userAgent: 'Firefox/121.0',
          ipAddress: '10.0.0.1',
          location: null,
          lastUsed: new Date('2024-01-03'),
          isActive: true,
          trustLevel: 'medium' as const,
          verificationMethod: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      mockTrustedDeviceService.getUserDevices = jest.fn().mockResolvedValue(mockDevices);

      await controller.getTrustedDevices(mockRequest as Request, mockResponse as Response);

      expect(mockTrustedDeviceService.getUserDevices).toHaveBeenCalledWith('user-123');
      expect(mockResponse.success).toHaveBeenCalledWith(mockDevices);
    });

    it('should return empty array when no devices exist', async () => {
      mockTrustedDeviceService.getUserDevices = jest.fn().mockResolvedValue([]);

      await controller.getTrustedDevices(mockRequest as Request, mockResponse as Response);

      expect(mockTrustedDeviceService.getUserDevices).toHaveBeenCalledWith('user-123');
      expect(mockResponse.success).toHaveBeenCalledWith([]);
    });
  });

  describe('revokeTrustedDevice', () => {
    beforeEach(() => {
      mockRequest.params = { deviceId: 'device-1' };
    });

    it('should revoke a trusted device successfully', async () => {
      mockTrustedDeviceService.revokeDevice = jest.fn().mockResolvedValue(true);

      await controller.revokeTrustedDevice(mockRequest as Request, mockResponse as Response);

      expect(mockTrustedDeviceService.revokeDevice).toHaveBeenCalledWith('user-123', 'device-1');
      expect(mockResponse.success).toHaveBeenCalledWith({ message: 'Device revoked successfully' });
    });

    it('should return 404 when device not found', async () => {
      mockTrustedDeviceService.revokeDevice = jest.fn().mockResolvedValue(false);

      await controller.revokeTrustedDevice(mockRequest as Request, mockResponse as Response);

      expect(mockTrustedDeviceService.revokeDevice).toHaveBeenCalledWith('user-123', 'device-1');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Device not found or already revoked',
      });
    });

    it('should prevent revoking devices from other users', async () => {
      mockTrustedDeviceService.revokeDevice = jest.fn().mockResolvedValue(false);

      await controller.revokeTrustedDevice(mockRequest as Request, mockResponse as Response);

      expect(mockTrustedDeviceService.revokeDevice).toHaveBeenCalledWith('user-123', 'device-1');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAccessLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        accountId: 'user-123',
        userId: 'user-123',
        organizationId: 'org-1',
        action: 'login',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0.0.0',
        metadata: { method: 'password' },
        createdAt: new Date('2024-01-02'),
      },
      {
        id: 'log-2',
        accountId: 'user-123',
        userId: 'user-123',
        organizationId: 'org-1',
        action: 'password_change',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0.0.0',
        metadata: null,
        createdAt: new Date('2024-01-01'),
      },
    ];

    it('should return access logs with default pagination', async () => {
      mockAccessLogService.getUserAccessLogs = jest.fn().mockResolvedValue(mockLogs);

      await controller.getAccessLogs(mockRequest as Request, mockResponse as Response);

      expect(mockAccessLogService.getUserAccessLogs).toHaveBeenCalledWith('user-123', 50, 0);
      expect(mockResponse.success).toHaveBeenCalledWith(mockLogs);
    });

    it('should respect custom limit and offset', async () => {
      mockRequest.query = { limit: '10', offset: '20' };
      mockAccessLogService.getUserAccessLogs = jest.fn().mockResolvedValue(mockLogs);

      await controller.getAccessLogs(mockRequest as Request, mockResponse as Response);

      expect(mockAccessLogService.getUserAccessLogs).toHaveBeenCalledWith('user-123', 10, 20);
    });

    it('should cap limit at 100', async () => {
      mockRequest.query = { limit: '500' };
      mockAccessLogService.getUserAccessLogs = jest.fn().mockResolvedValue([]);

      await controller.getAccessLogs(mockRequest as Request, mockResponse as Response);

      expect(mockAccessLogService.getUserAccessLogs).toHaveBeenCalledWith('user-123', 100, 0);
    });

    it('should floor offset at 0', async () => {
      mockRequest.query = { offset: '-10' };
      mockAccessLogService.getUserAccessLogs = jest.fn().mockResolvedValue([]);

      await controller.getAccessLogs(mockRequest as Request, mockResponse as Response);

      expect(mockAccessLogService.getUserAccessLogs).toHaveBeenCalledWith('user-123', 50, 0);
    });

    it('should return empty array when no logs exist', async () => {
      mockAccessLogService.getUserAccessLogs = jest.fn().mockResolvedValue([]);

      await controller.getAccessLogs(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith([]);
    });
  });
});
