import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { MiningOperationController } from '../../controllers/miningOperationController';
import { MiningOperation, MiningOperationStatus } from '../../models/MiningOperation';
import logger from '../../utils/logger';
import { extractPaginationOptions, paginateRepository } from '../../utils/pagination';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/pagination', () => ({
  extractPaginationOptions: jest.fn(),
  paginateRepository: jest.fn(),
}));

describe('MiningOperationController', () => {
  let controller: MiningOperationController;
  let mockRepository: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    controller = new MiningOperationController();
    (controller as any).miningOperationRepository = mockRepository;

    mockRequest = {
      params: {},
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE ====================

  describe('createMiningOperation', () => {
    it('should create mining operation successfully', async () => {
      const requestBody = {
        name: 'Quantanium Extraction',
        description: 'High-value mineral extraction',
        location: 'Aaron Halo',
        coordinatorId: 'user-1',
        scheduledDate: '2024-12-01T10:00:00Z',
        notes: 'Watch for pirates',
      };

      const mockOperation = {
        id: expect.stringContaining('mining-'),
        ...requestBody,
        scheduledDate: new Date('2024-12-01T10:00:00Z'),
        status: MiningOperationStatus.PLANNED,
        crew: [],
        resourcesFound: [],
        totalValue: 0,
      };

      mockRepository.create.mockReturnValue(mockOperation);
      mockRepository.save.mockResolvedValue(mockOperation);
      mockRequest.body = requestBody;

      await controller.createMiningOperation(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Quantanium Extraction',
          status: MiningOperationStatus.PLANNED,
          crew: [],
          resourcesFound: [],
          totalValue: 0,
        })
      );
      expect(mockRepository.save).toHaveBeenCalledWith(mockOperation);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockOperation);
    });

    it('should handle errors when creating operation', async () => {
      const error = new Error('Database error');
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue(error);
      mockRequest.body = { name: 'Test', location: 'Test' };

      await controller.createMiningOperation(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' })
      );
    });
  });

  // ==================== READ ====================

  describe('getMiningOperations', () => {
    it('should get all operations with pagination', async () => {
      const mockPaginationOptions = { page: 1, limit: 10 };
      const mockResult = {
        data: [
          { id: 'mining-1', name: 'Op 1', status: MiningOperationStatus.PLANNED },
          { id: 'mining-2', name: 'Op 2', status: MiningOperationStatus.IN_PROGRESS },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      (extractPaginationOptions as jest.Mock).mockReturnValue(mockPaginationOptions);
      (paginateRepository as jest.Mock).mockResolvedValue(mockResult);

      await controller.getMiningOperations(mockRequest as Request, mockResponse as Response);

      expect(extractPaginationOptions).toHaveBeenCalledWith(mockRequest);
      expect(paginateRepository).toHaveBeenCalledWith(
        mockRepository,
        mockPaginationOptions,
        undefined,
        'createdAt'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors when getting operations', async () => {
      const error = new Error('Query failed');
      (extractPaginationOptions as jest.Mock).mockReturnValue({});
      (paginateRepository as jest.Mock).mockRejectedValue(error);

      await controller.getMiningOperations(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMiningOperationById', () => {
    it('should get operation by id', async () => {
      const mockOperation = {
        id: 'mining-1',
        name: 'Test Operation',
        status: MiningOperationStatus.PLANNED,
      };

      mockRepository.findOne.mockResolvedValue(mockOperation);
      mockRequest.params = { id: 'mining-1' };

      await controller.getMiningOperationById(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'mining-1' } });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockOperation);
    });

    it('should return 404 when operation not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };

      await controller.getMiningOperationById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Mining operation not found' })
      );
    });

    it('should handle errors when getting operation by id', async () => {
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);
      mockRequest.params = { id: 'mining-1' };

      await controller.getMiningOperationById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ==================== UPDATE ====================

  describe('addCrewMember', () => {
    it('should add crew member to operation', async () => {
      const existingOperation = {
        id: 'mining-1',
        name: 'Test Op',
        crew: [],
      };

      const updatedOperation = {
        ...existingOperation,
        crew: [
          {
            userId: 'user-1',
            role: 'miner',
            shipId: 'ship-1',
          },
        ],
      };

      mockRepository.findOne.mockResolvedValue(existingOperation);
      mockRepository.save.mockResolvedValue(updatedOperation);
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = {
        userId: 'user-1',
        role: 'miner',
        shipId: 'ship-1',
      };

      await controller.addCrewMember(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'mining-1' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when operation not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };
      mockRequest.body = { userId: 'user-1', role: 'miner' };

      await controller.addCrewMember(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Mining operation not found' })
      );
    });

    it('should handle errors when adding crew member', async () => {
      const error = new Error('Add failed');
      mockRepository.findOne.mockResolvedValue({ id: 'mining-1', crew: [] });
      mockRepository.save.mockRejectedValue(error);
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = { userId: 'user-1', role: 'miner' };

      await controller.addCrewMember(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('recordResources', () => {
    it('should record resources and update total value', async () => {
      const existingOperation = {
        id: 'mining-1',
        name: 'Test Op',
        resourcesFound: [],
        totalValue: 0,
      };

      const updatedOperation = {
        ...existingOperation,
        resourcesFound: [
          {
            resourceType: 'Quantanium',
            quantity: 100,
            value: 50000,
          },
        ],
        totalValue: 50000,
      };

      mockRepository.findOne.mockResolvedValue(existingOperation);
      mockRepository.save.mockResolvedValue(updatedOperation);
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = {
        resourceType: 'Quantanium',
        quantity: 100,
        value: 50000,
      };

      await controller.recordResources(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'mining-1' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should accumulate total value from multiple resources', async () => {
      const existingOperation = {
        id: 'mining-1',
        resourcesFound: [{ resourceType: 'Gold', quantity: 50, value: 25000 }],
        totalValue: 25000,
      };

      mockRepository.findOne.mockResolvedValue(existingOperation);
      mockRepository.save.mockImplementation((op: any) => {
        expect(op.totalValue).toBe(75000);
        return Promise.resolve(op);
      });
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = {
        resourceType: 'Quantanium',
        quantity: 100,
        value: 50000,
      };

      await controller.recordResources(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return 404 when operation not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };
      mockRequest.body = { resourceType: 'Gold', quantity: 10, value: 1000 };

      await controller.recordResources(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when recording resources', async () => {
      const error = new Error('Record failed');
      mockRepository.findOne.mockResolvedValue({
        id: 'mining-1',
        resourcesFound: [],
        totalValue: 0,
      });
      mockRepository.save.mockRejectedValue(error);
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = { resourceType: 'Gold', quantity: 10, value: 1000 };

      await controller.recordResources(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateStatus', () => {
    it('should update operation status', async () => {
      const mockOperation = {
        id: 'mining-1',
        status: MiningOperationStatus.PLANNED,
      };

      const updatedOperation = {
        ...mockOperation,
        status: MiningOperationStatus.IN_PROGRESS,
      };

      mockRepository.findOne.mockResolvedValue(mockOperation);
      mockRepository.save.mockResolvedValue(updatedOperation);
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = { status: MiningOperationStatus.IN_PROGRESS };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'mining-1' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should set completedDate when status is COMPLETED', async () => {
      const mockOperation = {
        id: 'mining-1',
        status: MiningOperationStatus.IN_PROGRESS,
      };

      mockRepository.findOne.mockResolvedValue(mockOperation);
      mockRepository.save.mockImplementation((op: any) => {
        expect(op.completedDate).toBeInstanceOf(Date);
        return Promise.resolve(op);
      });
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = { status: MiningOperationStatus.COMPLETED };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return 404 when operation not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };
      mockRequest.body = { status: MiningOperationStatus.CANCELLED };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when updating status', async () => {
      const error = new Error('Status update failed');
      mockRepository.findOne.mockResolvedValue({ id: 'mining-1' });
      mockRepository.save.mockRejectedValue(error);
      mockRequest.params = { id: 'mining-1' };
      mockRequest.body = { status: MiningOperationStatus.CANCELLED };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
