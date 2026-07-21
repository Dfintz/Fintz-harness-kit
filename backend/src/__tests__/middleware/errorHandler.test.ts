import { Request, Response, NextFunction } from 'express';

import {
  asyncHandler,
  errorHandler,
  notFoundHandler,
  AppError,
} from '../../middleware/errorHandler';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      path: '/test',
      method: 'GET',
      originalUrl: '/test',
      headers: {}, // Add headers property
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('asyncHandler', () => {
    it('should call next with error if async function throws', async () => {
      const asyncFn = async () => {
        throw new Error('Test error');
      };

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not call next if async function succeeds', async () => {
      const asyncFn = async (req: Request, res: Response) => {
        res.json({ success: true });
      };

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('AppError', () => {
    it('should create an error with custom status code', () => {
      const error = new AppError('Test error', 404);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    it('should default to 500 status code', () => {
      const error = new AppError('Test error');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError with custom status code', () => {
      const error = new AppError('Custom error', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Custom error',
        })
      );
    });

    it('should handle ValidationError with 400 status', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
        })
      );
    });

    it('should handle UnauthorizedError with 401 status', () => {
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedError';

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        })
      );
    });

    it('should default to 500 for unknown errors', () => {
      const error = new Error('Unknown error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
        })
      );
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should create 404 error for non-existent routes', () => {
      mockRequest.originalUrl = '/non-existent-route';

      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0] as AppError;
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('/non-existent-route');
    });
  });
});
