/**
 * UserControllerV2 GDPR Endpoints Tests
 * Tests for data export and account deletion functionality
 */

import { Request, Response } from 'express';
import { UserControllerV2 } from '../../../controllers/v2/userController';
import { DeletionRequestStatus } from '../../../models/DeletionRequest';
import { ExportRequestStatus } from '../../../models/ExportRequest';
import { ApiErrorCode } from '../../../types/api';

// Mock dependencies
jest.mock('../../../services/user/ExportRequestService');
jest.mock('../../../services/user/GdprDataDeletionService');
jest.mock('../../../services/user/UserAuthenticationService');
jest.mock('../../../utils/authHelpers');
jest.mock('../../../utils/logger');

const mockAuthHelpers = require('../../../utils/authHelpers');

describe('UserControllerV2 - GDPR Endpoints', () => {
  let controller: UserControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockExportService: any;
  let mockDeletionService: any;
  let mockUserAuthService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new UserControllerV2();

    // Mock services
    mockExportService = {
      getUserExportRequests: jest.fn(),
      createExportRequest: jest.fn(),
    };

    mockDeletionService = {
      getPendingDeletionRequest: jest.fn(),
      createDeletionRequest: jest.fn(),
    };

    mockUserAuthService = {
      getUserWithPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };

    // Replace actual services with mocks
    (controller as any).userAuthService = mockUserAuthService;

    // Mock service getters
    const { getExportRequestService } = require('../../../services/user/ExportRequestService');
    const {
      getGdprDataDeletionService,
    } = require('../../../services/user/GdprDataDeletionService');

    getExportRequestService.mockReturnValue(mockExportService);
    getGdprDataDeletionService.mockReturnValue(mockDeletionService);

    mockAuthHelpers.getAuthenticatedUserId.mockReturnValue('user-123');

    mockResponse = {
      success: jest.fn(),
      error: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
      ip: '192.168.1.1',
    };
  });

  describe('exportData', () => {
    it('should create new export request when no recent requests exist', async () => {
      mockRequest.headers = { 'user-agent': 'Test Browser' };
      mockExportService.getUserExportRequests.mockResolvedValue([]);
      mockExportService.createExportRequest.mockResolvedValue({
        id: 'export-123',
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
        requestedAt: new Date(),
      });

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockExportService.getUserExportRequests).toHaveBeenCalledWith('user-123', 1);
      expect(mockExportService.createExportRequest).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        'Test Browser'
      );
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'export-123',
          status: ExportRequestStatus.PENDING,
        })
      );
    });

    it('should return existing pending request if found', async () => {
      const existingRequest = {
        id: 'export-456',
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
        requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      mockExportService.getUserExportRequests.mockResolvedValue([existingRequest]);

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockExportService.createExportRequest).not.toHaveBeenCalled();
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'export-456',
          status: ExportRequestStatus.PENDING,
          message: expect.stringContaining('already in progress'),
        })
      );
    });

    it('should return existing processing request if found', async () => {
      const existingRequest = {
        id: 'export-789',
        userId: 'user-123',
        status: ExportRequestStatus.PROCESSING,
        requestedAt: new Date(Date.now() - 10 * 60 * 1000),
      };

      mockExportService.getUserExportRequests.mockResolvedValue([existingRequest]);

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockExportService.createExportRequest).not.toHaveBeenCalled();
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'export-789',
          status: ExportRequestStatus.PROCESSING,
          message: expect.stringContaining('in progress'),
        })
      );
    });

    it('should reuse completed export within 1 hour window', async () => {
      const completedExport = {
        id: 'export-completed',
        userId: 'user-123',
        status: ExportRequestStatus.COMPLETED,
        requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        completedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
        downloadToken: 'token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockExportService.getUserExportRequests.mockResolvedValue([completedExport]);

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockExportService.createExportRequest).not.toHaveBeenCalled();
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'export-completed',
          status: ExportRequestStatus.COMPLETED,
          downloadToken: 'token-123',
          message: expect.stringContaining('recent data export is still available'),
        })
      );
    });

    it('should create new request if completed export is older than 1 hour', async () => {
      const oldCompletedExport = {
        id: 'export-old',
        userId: 'user-123',
        status: ExportRequestStatus.COMPLETED,
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        completedAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
        downloadUrl: 'https://example.com/export-old.zip',
      };

      mockExportService.getUserExportRequests.mockResolvedValue([oldCompletedExport]);
      mockExportService.createExportRequest.mockResolvedValue({
        id: 'export-new',
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
        requestedAt: new Date(),
      });

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockExportService.createExportRequest).toHaveBeenCalled();
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'export-new',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockExportService.getUserExportRequests.mockRejectedValue(new Error('Database error'));

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INTERNAL_ERROR,
        'Database error',
        undefined,
        500
      );
    });

    it('should track IP address and user agent', async () => {
      mockRequest.ip = '10.0.0.1';
      mockRequest.headers = { 'user-agent': 'Mozilla/5.0' };
      mockExportService.getUserExportRequests.mockResolvedValue([]);
      mockExportService.createExportRequest.mockResolvedValue({
        id: 'export-123',
        userId: 'user-123',
        status: ExportRequestStatus.PENDING,
        requestedAt: new Date(),
      });

      await controller.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockExportService.createExportRequest).toHaveBeenCalledWith(
        'user-123',
        '10.0.0.1',
        'Mozilla/5.0'
      );
    });
  });

  describe('requestAccountDeletion', () => {
    it('should create deletion request with valid password', async () => {
      mockRequest.body = {
        password: 'password123',
        reason: 'No longer needed',
      };
      mockRequest.headers = { 'user-agent': 'Test Browser' };

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
      };

      const mockDeletionRequest = {
        id: 'deletion-123',
        userId: 'user-123',
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
      mockUserAuthService.verifyPassword.mockResolvedValue(true);
      mockDeletionService.getPendingDeletionRequest.mockResolvedValue(null);
      mockDeletionService.createDeletionRequest.mockResolvedValue(mockDeletionRequest);

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockUserAuthService.getUserWithPassword).toHaveBeenCalledWith('user-123');
      expect(mockUserAuthService.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'hashed-password'
      );
      expect(mockDeletionService.createDeletionRequest).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        'Test Browser'
      );
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'deletion-123',
          status: DeletionRequestStatus.PENDING,
          message: expect.stringContaining('30 days'),
        })
      );
    });

    it('should reject request without password', async () => {
      mockRequest.body = {};

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_INPUT,
        'Password is required to request account deletion',
        undefined,
        400
      );
    });

    it('should reject request with invalid password', async () => {
      mockRequest.body = {
        password: 'wrongpassword',
      };

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
      };

      mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
      mockUserAuthService.verifyPassword.mockResolvedValue(false);

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_CREDENTIALS,
        'Invalid password',
        undefined,
        401
      );
    });

    it('should return existing pending deletion request', async () => {
      mockRequest.body = {
        password: 'password123',
      };

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
      };

      const existingRequest = {
        id: 'deletion-456',
        userId: 'user-123',
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        scheduledFor: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days left
      };

      mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
      mockUserAuthService.verifyPassword.mockResolvedValue(true);
      mockDeletionService.getPendingDeletionRequest.mockResolvedValue(existingRequest);

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockDeletionService.createDeletionRequest).not.toHaveBeenCalled();
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'deletion-456',
          message: expect.stringContaining('already pending'),
        })
      );
    });

    it('should handle users without password (OAuth users)', async () => {
      mockRequest.body = {
        password: 'password123',
      };

      const mockUser = {
        id: 'user-123',
        password: null, // OAuth user
      };

      mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_INPUT,
        expect.stringContaining('password is required'),
        undefined,
        400
      );
    });

    it('should handle user not found', async () => {
      mockRequest.body = {
        password: 'password123',
      };

      mockUserAuthService.getUserWithPassword.mockResolvedValue(null);

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      // Should throw ApiError which gets caught
      expect(mockResponse.error).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRequest.body = {
        password: 'password123',
      };

      mockUserAuthService.getUserWithPassword.mockRejectedValue(new Error('Database error'));

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INTERNAL_ERROR,
        'Database error',
        undefined,
        500
      );
    });

    it('should log reason for audit purposes', async () => {
      const logger = require('../../../utils/logger');

      mockRequest.body = {
        password: 'password123',
        reason: 'Privacy concerns',
      };

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
      };

      const mockDeletionRequest = {
        id: 'deletion-123',
        userId: 'user-123',
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        scheduledFor: new Date(),
      };

      mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
      mockUserAuthService.verifyPassword.mockResolvedValue(true);
      mockDeletionService.getPendingDeletionRequest.mockResolvedValue(null);
      mockDeletionService.createDeletionRequest.mockResolvedValue(mockDeletionRequest);

      await controller.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(logger.default.info).toHaveBeenCalledWith(
        'Account deletion request created',
        expect.objectContaining({
          userId: 'user-123',
          requestId: 'deletion-123',
          reason: 'Privacy concerns',
        })
      );
    });
  });
});
