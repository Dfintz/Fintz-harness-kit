import { Request, Response, NextFunction } from 'express';

import { AppDataSource } from '../../config/database';
import { trackUserActivity } from '../../middleware/activityTracking';
import { AuthRequest } from '../../middleware/auth';
import { User } from '../../models/User';

jest.mock('../../config/database');
describe('trackUserActivity middleware', () => {
  let mockUserRepo: any;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockUserRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === User || entity.name === 'User') {
        return mockUserRepo;
      }
      return {};
    });

    mockRequest = {
      user: {
        id: 'user-123',
        username: 'testuser',
        role: 'user',
      },
    };

    mockResponse = {};
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  it('should update lastActiveAt for authenticated user', async () => {
    await trackUserActivity(mockRequest as Request, mockResponse as Response, mockNext);

    // Allow async update to complete
    await new Promise(resolve => setImmediate(resolve));

    expect(mockNext).toHaveBeenCalled();
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      { id: 'user-123' },
      expect.objectContaining({
        lastActiveAt: expect.any(Date),
      })
    );
  });

  it('should call next immediately without waiting for update', async () => {
    await trackUserActivity(mockRequest as Request, mockResponse as Response, mockNext);

    // next() should be called before update completes
    expect(mockNext).toHaveBeenCalled();
  });

  it('should skip tracking when user is not authenticated', async () => {
    mockRequest.user = undefined;

    await trackUserActivity(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it('should skip tracking when user id is missing', async () => {
    mockRequest.user = {
      id: '',
      username: 'testuser',
      role: 'user',
    };

    await trackUserActivity(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it('should not block request when update fails', async () => {
    mockUserRepo.update.mockRejectedValue(new Error('Database error'));

    await trackUserActivity(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();

    // Wait for async operation to complete
    await new Promise(resolve => setImmediate(resolve));

    // Error should be logged but not thrown
    expect(mockUserRepo.update).toHaveBeenCalled();
  });

  it('should handle repository not available gracefully', async () => {
    (AppDataSource.getRepository as jest.Mock).mockImplementation(() => {
      throw new Error('Repository not available');
    });

    await trackUserActivity(mockRequest as Request, mockResponse as Response, mockNext);

    // Should still call next and not throw
    expect(mockNext).toHaveBeenCalled();
  });
});
