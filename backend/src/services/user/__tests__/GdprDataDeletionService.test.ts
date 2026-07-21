/**
 * GdprDataDeletionService Deletion Request Tests
 *
 * Tests for deletion request tracking, grace period, and cancellation functionality
 */

import { mockAppDataSource } from '../../../__tests__/helpers/database-mock';

jest.mock('../../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { GdprDataDeletionService } from '../GdprDataDeletionService';
import { DeletionRequest, DeletionRequestStatus } from '../../../models/DeletionRequest';
import { Repository } from 'typeorm';

// Mock dependencies
describe('GdprDataDeletionService - Deletion Requests', () => {
  let service: GdprDataDeletionService;
  let mockDeletionRequestRepository: jest.Mocked<Repository<DeletionRequest>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked repository
    mockDeletionRequestRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    } as any;

    service = new GdprDataDeletionService();
    (service as any).deletionRequestRepository = mockDeletionRequestRepository;
  });

  describe('createDeletionRequest', () => {
    it('should create a new deletion request with grace period', async () => {
      const userId = 'test-user-id';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      mockDeletionRequestRepository.findOne.mockResolvedValue(null);

      const mockRequest: Partial<DeletionRequest> = {
        id: 'request-id',
        userId,
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        requestIpAddress: ipAddress,
        requestUserAgent: userAgent,
      };

      mockDeletionRequestRepository.create.mockReturnValue(mockRequest as DeletionRequest);
      mockDeletionRequestRepository.save.mockResolvedValue(mockRequest as DeletionRequest);

      // Mock getDataDeletionPreview
      jest.spyOn(service, 'getDataDeletionPreview').mockResolvedValue({ user: 1, consents: 2 });

      const result = await service.createDeletionRequest(userId, ipAddress, userAgent);

      expect(mockDeletionRequestRepository.findOne).toHaveBeenCalledWith({
        where: { userId, status: DeletionRequestStatus.PENDING },
      });
      expect(mockDeletionRequestRepository.create).toHaveBeenCalled();
      expect(mockDeletionRequestRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should return existing pending request if one already exists', async () => {
      const userId = 'test-user-id';

      const existingRequest: Partial<DeletionRequest> = {
        id: 'existing-request-id',
        userId,
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        scheduledFor: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(existingRequest as DeletionRequest);

      const result = await service.createDeletionRequest(userId);

      expect(mockDeletionRequestRepository.findOne).toHaveBeenCalledWith({
        where: { userId, status: DeletionRequestStatus.PENDING },
      });
      expect(mockDeletionRequestRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existingRequest);
    });
  });

  describe('cancelDeletionRequest', () => {
    it('should cancel a pending deletion request during grace period', async () => {
      const userId = 'test-user-id';
      const reason = 'Changed my mind';

      const pendingRequest: Partial<DeletionRequest> = {
        id: 'request-id',
        userId,
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        scheduledFor: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days in future
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(pendingRequest as DeletionRequest);
      mockDeletionRequestRepository.save.mockResolvedValue({
        ...pendingRequest,
        status: DeletionRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      } as DeletionRequest);

      const result = await service.cancelDeletionRequest(userId, reason);

      expect(result).toBeDefined();
      expect(result?.status).toBe(DeletionRequestStatus.CANCELLED);
      expect(result?.cancellationReason).toBe(reason);
      expect(mockDeletionRequestRepository.save).toHaveBeenCalled();
    });

    it('should return null if no pending request exists', async () => {
      const userId = 'test-user-id';

      mockDeletionRequestRepository.findOne.mockResolvedValue(null);

      const result = await service.cancelDeletionRequest(userId);

      expect(result).toBeNull();
      expect(mockDeletionRequestRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error if grace period has expired', async () => {
      const userId = 'test-user-id';

      const expiredRequest: Partial<DeletionRequest> = {
        id: 'request-id',
        userId,
        status: DeletionRequestStatus.PENDING,
        requestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        scheduledFor: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day in past
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(expiredRequest as DeletionRequest);

      await expect(service.cancelDeletionRequest(userId)).rejects.toThrow(
        'Grace period has expired'
      );
      expect(mockDeletionRequestRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getPendingDeletionRequest', () => {
    it('should return pending deletion request for user', async () => {
      const userId = 'test-user-id';

      const pendingRequest: Partial<DeletionRequest> = {
        id: 'request-id',
        userId,
        status: DeletionRequestStatus.PENDING,
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(pendingRequest as DeletionRequest);

      const result = await service.getPendingDeletionRequest(userId);

      expect(result).toBe(pendingRequest);
      expect(mockDeletionRequestRepository.findOne).toHaveBeenCalledWith({
        where: { userId, status: DeletionRequestStatus.PENDING },
      });
    });

    it('should return null if no pending request exists', async () => {
      const userId = 'test-user-id';

      mockDeletionRequestRepository.findOne.mockResolvedValue(null);

      const result = await service.getPendingDeletionRequest(userId);

      expect(result).toBeNull();
    });
  });

  describe('getAllPendingDeletionRequests', () => {
    it('should return all pending deletion requests ordered by scheduled date', async () => {
      const pendingRequests: Partial<DeletionRequest>[] = [
        {
          id: 'request-1',
          userId: 'user-1',
          status: DeletionRequestStatus.PENDING,
          scheduledFor: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'request-2',
          userId: 'user-2',
          status: DeletionRequestStatus.PENDING,
          scheduledFor: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        },
      ];

      mockDeletionRequestRepository.find.mockResolvedValue(pendingRequests as DeletionRequest[]);

      const result = await service.getAllPendingDeletionRequests();

      expect(result).toHaveLength(2);
      expect(mockDeletionRequestRepository.find).toHaveBeenCalledWith({
        where: { status: DeletionRequestStatus.PENDING },
        order: { scheduledFor: 'ASC' },
      });
    });

    it('should return empty array if no pending requests', async () => {
      mockDeletionRequestRepository.find.mockResolvedValue([]);

      const result = await service.getAllPendingDeletionRequests();

      expect(result).toEqual([]);
    });
  });

  describe('getPendingDeletionCount', () => {
    it('should return count of pending deletion requests', async () => {
      mockDeletionRequestRepository.count.mockResolvedValue(5);

      const result = await service.getPendingDeletionCount();

      expect(result).toBe(5);
      expect(mockDeletionRequestRepository.count).toHaveBeenCalledWith({
        where: { status: DeletionRequestStatus.PENDING },
      });
    });

    it('should return 0 if no pending requests', async () => {
      mockDeletionRequestRepository.count.mockResolvedValue(0);

      const result = await service.getPendingDeletionCount();

      expect(result).toBe(0);
    });
  });

  describe('markDeletionComplete', () => {
    it('should mark deletion as completed on success', async () => {
      const requestId = 'request-id';
      const result = {
        success: true,
        userId: 'user-id',
        deletedCounts: { user: 1, consents: 2 },
        totalDeleted: 3,
        errors: [],
        completedAt: new Date(),
      };

      const mockRequest: Partial<DeletionRequest> = {
        id: requestId,
        userId: 'user-id',
        status: DeletionRequestStatus.PENDING,
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(mockRequest as DeletionRequest);
      mockDeletionRequestRepository.save.mockResolvedValue({
        ...mockRequest,
        status: DeletionRequestStatus.COMPLETED,
        completedAt: new Date(),
      } as DeletionRequest);

      await service.markDeletionComplete(requestId, result);

      expect(mockDeletionRequestRepository.save).toHaveBeenCalled();
      const savedRequest = (mockDeletionRequestRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedRequest.status).toBe(DeletionRequestStatus.COMPLETED);
      expect(savedRequest.completedAt).toBeDefined();
    });

    it('should mark deletion as failed on error', async () => {
      const requestId = 'request-id';
      const result = {
        success: false,
        userId: 'user-id',
        deletedCounts: {},
        totalDeleted: 0,
        errors: ['Database error', 'Connection timeout'],
        completedAt: new Date(),
      };

      const mockRequest: Partial<DeletionRequest> = {
        id: requestId,
        userId: 'user-id',
        status: DeletionRequestStatus.PENDING,
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(mockRequest as DeletionRequest);
      mockDeletionRequestRepository.save.mockResolvedValue({
        ...mockRequest,
        status: DeletionRequestStatus.FAILED,
        completedAt: new Date(),
        failureReason: result.errors.join('; '),
      } as DeletionRequest);

      await service.markDeletionComplete(requestId, result);

      expect(mockDeletionRequestRepository.save).toHaveBeenCalled();
      const savedRequest = (mockDeletionRequestRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedRequest.status).toBe(DeletionRequestStatus.FAILED);
      expect(savedRequest.failureReason).toContain('Database error');
    });

    it('should handle missing deletion request gracefully', async () => {
      const requestId = 'non-existent-id';
      const result = {
        success: true,
        userId: 'user-id',
        deletedCounts: {},
        totalDeleted: 0,
        errors: [],
        completedAt: new Date(),
      };

      mockDeletionRequestRepository.findOne.mockResolvedValue(null);

      await service.markDeletionComplete(requestId, result);

      expect(mockDeletionRequestRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('processDueDeletions', () => {
    it('should process deletion requests that are due', async () => {
      const now = Date.now();
      const dueRequests: Partial<DeletionRequest>[] = [
        {
          id: 'request-1',
          userId: 'user-1',
          status: DeletionRequestStatus.PENDING,
          scheduledFor: new Date(now - 1000), // Past due
        },
        {
          id: 'request-2',
          userId: 'user-2',
          status: DeletionRequestStatus.PENDING,
          scheduledFor: new Date(now + 10 * 24 * 60 * 60 * 1000), // Not due yet
        },
      ];

      mockDeletionRequestRepository.find.mockResolvedValue(dueRequests as DeletionRequest[]);
      mockDeletionRequestRepository.findOne.mockResolvedValue(dueRequests[0] as DeletionRequest);

      // Mock deleteAllUserData to return success
      jest.spyOn(service, 'deleteAllUserData').mockResolvedValue({
        success: true,
        userId: 'user-1',
        deletedCounts: { user: 1 },
        totalDeleted: 1,
        errors: [],
        completedAt: new Date(),
      });

      const results = await service.processDueDeletions();

      expect(results).toHaveLength(1); // Only the due request should be processed
      expect(results[0].userId).toBe('user-1');
      expect(results[0].result.success).toBe(true);
    });

    it('should handle errors during deletion processing', async () => {
      const dueRequest: Partial<DeletionRequest> = {
        id: 'request-1',
        userId: 'user-1',
        status: DeletionRequestStatus.PENDING,
        scheduledFor: new Date(Date.now() - 1000),
      };

      mockDeletionRequestRepository.find.mockResolvedValue([dueRequest as DeletionRequest]);
      mockDeletionRequestRepository.findOne.mockResolvedValue(dueRequest as DeletionRequest);

      // Mock deleteAllUserData to throw error
      jest.spyOn(service, 'deleteAllUserData').mockRejectedValue(new Error('Deletion failed'));

      const results = await service.processDueDeletions();

      expect(results).toHaveLength(1);
      expect(results[0].result.success).toBe(false);
      expect(results[0].result.errors).toContain('Deletion failed');
    });

    it('should return empty array if no due deletions', async () => {
      const futureRequest: Partial<DeletionRequest> = {
        id: 'request-1',
        userId: 'user-1',
        status: DeletionRequestStatus.PENDING,
        scheduledFor: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      };

      mockDeletionRequestRepository.find.mockResolvedValue([futureRequest as DeletionRequest]);

      const results = await service.processDueDeletions();

      expect(results).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

