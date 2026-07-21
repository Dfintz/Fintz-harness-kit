import { Request, Response } from 'express';

import { EventConflictControllerV2 } from '../../../controllers/v2/eventConflictController';
import { ApiError } from '../../../middleware/errorHandlerV2';
import { EventConflictService } from '../../../services/event/EventConflictService';
import { ApiErrorCode } from '../../../types/api';

// Mock dependencies
jest.mock('../../../services/event/EventConflictService');
jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn(() => 'test-user-id'),
  getOrganizationIdFromContext: jest.fn(() => 'test-org-id'),
}));

describe('EventConflictControllerV2 - Error Handling', () => {
  let controller: EventConflictControllerV2;
  let mockConflictService: jest.Mocked<EventConflictService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConflictService = {
      checkConflicts: jest.fn(),
      getUserConflicts: jest.fn(),
      getActivityConflicts: jest.fn(),
      getConflictsInRange: jest.fn(),
    } as any;

    (EventConflictService as jest.MockedClass<typeof EventConflictService>).mockImplementation(
      () => mockConflictService
    );

    controller = new EventConflictControllerV2();

    mockRequest = {
      body: {},
      query: {},
      params: {},
      user: { id: 'test-user-id' } as any,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      success: jest.fn().mockReturnThis(),
      paginated: jest.fn().mockReturnThis(),
    };
  });

  describe('checkConflicts', () => {
    it('should throw ApiError with proper code when startDate is missing', async () => {
      mockRequest.body = {
        endDate: '2024-01-02T00:00:00Z',
      };

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.MISSING_REQUIRED_FIELD,
        statusCode: 400,
      });
    });

    it('should throw ApiError with proper code when date format is invalid', async () => {
      mockRequest.body = {
        startDate: 'invalid-date',
        endDate: '2024-01-02T00:00:00Z',
      };

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    });

    it('should throw ApiError with proper code when startDate >= endDate', async () => {
      mockRequest.body = {
        startDate: '2024-01-02T00:00:00Z',
        endDate: '2024-01-01T00:00:00Z',
      };

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    });

    it('should wrap service errors in ApiError with INTERNAL_ERROR code', async () => {
      mockRequest.body = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-02T00:00:00Z',
      };

      mockConflictService.checkConflicts.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.checkConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    });
  });

  describe('getMyConflicts', () => {
    it('should wrap service errors in ApiError with proper code', async () => {
      mockConflictService.getUserConflicts.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        controller.getMyConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.getMyConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    });
  });

  describe('getActivityConflicts', () => {
    it('should throw ApiError when activityId is missing', async () => {
      mockRequest.params = {};

      await expect(
        controller.getActivityConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(ApiError);

      await expect(
        controller.getActivityConflicts(mockRequest as Request, mockResponse as Response)
      ).rejects.toMatchObject({
        code: ApiErrorCode.MISSING_REQUIRED_FIELD,
        statusCode: 400,
      });
    });
  });

  /**
   * Verify that ApiError instances contain the required fields for v2 error format:
   * - code: ApiErrorCode
   * - message: string
   * - statusCode: number
   * 
   * These will be formatted by errorHandlerV2 middleware into:
   * {
   *   success: false,
   *   error: {
   *     code: string,
   *     message: string,
   *     details?: unknown,
   *     timestamp: string,
   *     requestId: string
   *   }
   * }
   */
  describe('Error Format Compatibility', () => {
    it('should throw ApiError with all required v2 fields', async () => {
      mockRequest.body = { endDate: '2024-01-02T00:00:00Z' };

      try {
        await controller.checkConflicts(mockRequest as Request, mockResponse as Response);
        fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        
        // Verify required fields for v2 error format
        expect(apiError).toHaveProperty('code');
        expect(apiError).toHaveProperty('message');
        expect(apiError).toHaveProperty('statusCode');
        expect(typeof apiError.code).toBe('string');
        expect(typeof apiError.message).toBe('string');
        expect(typeof apiError.statusCode).toBe('number');
      }
    });
  });
});
