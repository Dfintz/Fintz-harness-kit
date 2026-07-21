import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { FleetLogisticsController } from '../../controllers/fleetLogisticsController';
import { FleetLogistics, LogisticsStatus } from '../../models/FleetLogistics';
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

describe('FleetLogisticsController', () => {
  let controller: FleetLogisticsController;
  let mockRepository: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    controller = new FleetLogisticsController();
    (controller as any).logisticsRepository = mockRepository;

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

  describe('createLogistics', () => {
    it('should create logistics operation successfully', async () => {
      const requestBody = {
        fleetId: 'fleet-1',
        operationName: 'Mining Operation Alpha',
        description: 'Quantum mining mission',
        coordinatorId: 'user-1',
        ships: [
          {
            shipId: 'ship-1',
            shipName: 'Mole-1',
            fuelCapacity: 1000,
            cargoCapacity: 500,
            currentFuel: 800,
            currentCargo: 100,
            jumpRange: 50,
          },
        ],
        resources: [
          {
            resourceType: 'Mining Laser Parts',
            quantity: 10,
            unitWeight: 5,
            totalWeight: 50,
          },
        ],
        route: [
          {
            location: 'Crusader',
            distance: 30,
            requiredFuel: 200,
            order: 1,
          },
        ],
        notes: 'Be careful of pirates',
      };

      const mockLogistics = {
        id: expect.stringContaining('logistics-'),
        ...requestBody,
        status: LogisticsStatus.PLANNING,
        totalFuelCapacity: 1000,
        totalCargoCapacity: 500,
        totalFuelRequired: 200,
        totalCargoUsed: 50,
        maxJumpRange: 50,
      };

      mockRepository.create.mockReturnValue(mockLogistics);
      mockRepository.save.mockResolvedValue(mockLogistics);
      mockRequest.body = requestBody;

      await controller.createLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fleetId: 'fleet-1',
          operationName: 'Mining Operation Alpha',
          status: LogisticsStatus.PLANNING,
        })
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockLogistics);
    });

    it('should create logistics with default empty arrays', async () => {
      const requestBody = {
        fleetId: 'fleet-1',
        operationName: 'Test Operation',
        coordinatorId: 'user-1',
      };

      const mockLogistics = {
        id: expect.any(String),
        ...requestBody,
        ships: [],
        resources: [],
        route: [],
        status: LogisticsStatus.PLANNING,
        totalFuelCapacity: 0,
        totalCargoCapacity: 0,
        totalFuelRequired: 0,
        totalCargoUsed: 0,
      };

      mockRepository.create.mockReturnValue(mockLogistics);
      mockRepository.save.mockResolvedValue(mockLogistics);
      mockRequest.body = requestBody;

      await controller.createLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ships: [],
          resources: [],
          route: [],
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should handle errors when creating logistics', async () => {
      const error = new Error('Database error');
      mockRepository.create.mockReturnValue({
        ships: [],
        resources: [],
        route: [],
      });
      mockRepository.save.mockRejectedValue(error);
      mockRequest.body = { fleetId: 'fleet-1' };

      await controller.createLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) })
      );
    });
  });

  // ==================== READ ====================

  describe('getLogistics', () => {
    it('should get all logistics with pagination', async () => {
      const mockPaginationOptions = { page: 1, limit: 10 };
      const mockResult = {
        data: [
          { id: 'log-1', fleetId: 'fleet-1', operationName: 'Op 1' },
          { id: 'log-2', fleetId: 'fleet-1', operationName: 'Op 2' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      (extractPaginationOptions as jest.Mock).mockReturnValue(mockPaginationOptions);
      (paginateRepository as jest.Mock).mockResolvedValue(mockResult);

      await controller.getLogistics(mockRequest as Request, mockResponse as Response);

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

    it('should filter by fleetId', async () => {
      const mockPaginationOptions = { page: 1, limit: 10 };
      const mockResult = { data: [], total: 0, page: 1, limit: 10 };

      (extractPaginationOptions as jest.Mock).mockReturnValue(mockPaginationOptions);
      (paginateRepository as jest.Mock).mockResolvedValue(mockResult);
      mockRequest.query = { fleetId: 'fleet-1' };

      await controller.getLogistics(mockRequest as Request, mockResponse as Response);

      expect(paginateRepository).toHaveBeenCalledWith(
        mockRepository,
        mockPaginationOptions,
        { fleetId: 'fleet-1' },
        'createdAt'
      );
    });

    it('should handle errors when getting logistics', async () => {
      const error = new Error('Query failed');
      (extractPaginationOptions as jest.Mock).mockReturnValue({});
      (paginateRepository as jest.Mock).mockRejectedValue(error);

      await controller.getLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getLogisticsById', () => {
    it('should get logistics by id', async () => {
      const mockLogistics = {
        id: 'log-1',
        fleetId: 'fleet-1',
        operationName: 'Test Op',
        status: LogisticsStatus.PLANNING,
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.getLogisticsById(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'log-1' } });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockLogistics);
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };

      await controller.getLogisticsById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Fleet logistics not found' })
      );
    });

    it('should handle errors when getting logistics by id', async () => {
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };

      await controller.getLogisticsById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ==================== UPDATE ====================

  describe('updateLogistics', () => {
    it('should update logistics successfully', async () => {
      const existingLogistics = {
        id: 'log-1',
        fleetId: 'fleet-1',
        operationName: 'Old Name',
        ships: [],
        resources: [],
        route: [],
      };

      const updateData = {
        operationName: 'Updated Name',
        description: 'New description',
      };

      const updatedLogistics = {
        ...existingLogistics,
        ...updateData,
      };

      mockRepository.findOne.mockResolvedValue(existingLogistics);
      mockRepository.save.mockResolvedValue(updatedLogistics);
      mockRequest.params = { id: 'log-1' };
      mockRequest.body = updateData;

      await controller.updateLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'log-1' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedLogistics);
    });

    it('should recalculate totals when ships updated', async () => {
      const existingLogistics = {
        id: 'log-1',
        fleetId: 'fleet-1',
        ships: [],
        resources: [],
        route: [],
        totalFuelCapacity: 0,
      };

      const updateData = {
        ships: [
          {
            shipId: 'ship-1',
            shipName: 'Ship',
            fuelCapacity: 2000,
            cargoCapacity: 1000,
            currentFuel: 1500,
            currentCargo: 500,
            jumpRange: 60,
          },
        ],
      };

      mockRepository.findOne.mockResolvedValue(existingLogistics);
      mockRepository.save.mockResolvedValue({ ...existingLogistics, ...updateData });
      mockRequest.params = { id: 'log-1' };
      mockRequest.body = updateData;

      await controller.updateLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };
      mockRequest.body = { operationName: 'Test' };

      await controller.updateLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Fleet logistics not found' })
      );
    });

    it('should handle errors when updating logistics', async () => {
      const error = new Error('Update failed');
      mockRepository.findOne.mockResolvedValue({ id: 'log-1' });
      mockRepository.save.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };
      mockRequest.body = { operationName: 'Test' };

      await controller.updateLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateStatus', () => {
    it('should update logistics status', async () => {
      const mockLogistics = {
        id: 'log-1',
        status: LogisticsStatus.PLANNING,
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRepository.save.mockResolvedValue({
        ...mockLogistics,
        status: LogisticsStatus.READY,
      });
      mockRequest.params = { id: 'log-1' };
      mockRequest.body = { status: LogisticsStatus.READY };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'log-1' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };
      mockRequest.body = { status: LogisticsStatus.COMPLETED };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when updating status', async () => {
      const error = new Error('Status update failed');
      mockRepository.findOne.mockResolvedValue({ id: 'log-1' });
      mockRepository.save.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };
      mockRequest.body = { status: LogisticsStatus.IN_PROGRESS };

      await controller.updateStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ==================== CALCULATIONS ====================

  describe('calculateFuelRequirements', () => {
    it('should calculate fuel requirements correctly', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [
          { shipId: 'ship-1', shipName: 'Ship 1', currentFuel: 500, fuelCapacity: 1000 },
          { shipId: 'ship-2', shipName: 'Ship 2', currentFuel: 300, fuelCapacity: 800 },
        ],
        route: [
          { location: 'Point A', requiredFuel: 200, distance: 10, order: 1 },
          { location: 'Point B', requiredFuel: 300, distance: 15, order: 2 },
        ],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateFuelRequirements(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalFuelRequired: 500,
          totalCurrentFuel: 800,
          fuelShortage: 0,
          canCompleteRoute: true,
          shipsStatus: expect.any(Array),
        })
      );
    });

    it('should detect fuel shortage', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [{ shipId: 'ship-1', shipName: 'Ship 1', currentFuel: 100, fuelCapacity: 500 }],
        route: [{ location: 'Point A', requiredFuel: 300, distance: 20, order: 1 }],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateFuelRequirements(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalFuelRequired: 300,
          totalCurrentFuel: 100,
          fuelShortage: 200,
          canCompleteRoute: false,
        })
      );
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };

      await controller.calculateFuelRequirements(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when calculating fuel', async () => {
      const error = new Error('Calculation failed');
      mockRepository.findOne.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateFuelRequirements(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('calculateCargoCapacity', () => {
    it('should calculate cargo capacity correctly', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [
          { shipId: 'ship-1', shipName: 'Ship 1', currentCargo: 100, cargoCapacity: 500 },
          { shipId: 'ship-2', shipName: 'Ship 2', currentCargo: 200, cargoCapacity: 600 },
        ],
        resources: [
          { resourceType: 'Ore', quantity: 50, totalWeight: 100 },
          { resourceType: 'Equipment', quantity: 10, totalWeight: 50 },
        ],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateCargoCapacity(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCargoCapacity: 1100,
          totalCargoUsed: 150,
          cargoAvailable: 950,
          cargoUtilization: '13.64%',
          canFitAllResources: true,
        })
      );
    });

    it('should use quantity when totalWeight not provided', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [{ shipId: 'ship-1', shipName: 'Ship 1', currentCargo: 0, cargoCapacity: 1000 }],
        resources: [{ resourceType: 'Items', quantity: 100 }],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateCargoCapacity(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCargoUsed: 100,
        })
      );
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };

      await controller.calculateCargoCapacity(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when calculating cargo', async () => {
      const error = new Error('Calculation failed');
      mockRepository.findOne.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateCargoCapacity(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('calculateJumpRange', () => {
    it('should calculate jump range and route feasibility', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [
          { shipId: 'ship-1', shipName: 'Ship 1', jumpRange: 50 },
          { shipId: 'ship-2', shipName: 'Ship 2', jumpRange: 60 },
          { shipId: 'ship-3', shipName: 'Ship 3', jumpRange: 40 },
        ],
        route: [
          { location: 'Point A', distance: 35, order: 1 },
          { location: 'Point B', distance: 40, order: 2 },
          { location: 'Point C', distance: 25, order: 3 },
        ],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateJumpRange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fleetMinJumpRange: 40,
          canCompleteRoute: true,
          routeFeasibility: expect.arrayContaining([
            expect.objectContaining({
              location: 'Point A',
              accessible: true,
              exceedsRange: 0,
            }),
          ]),
        })
      );
    });

    it('should detect inaccessible waypoints', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [{ shipId: 'ship-1', shipName: 'Ship 1', jumpRange: 30 }],
        route: [
          { location: 'Near', distance: 20, order: 1 },
          { location: 'Far', distance: 50, order: 2 },
        ],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateJumpRange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fleetMinJumpRange: 30,
          canCompleteRoute: false,
          routeFeasibility: expect.arrayContaining([
            expect.objectContaining({
              location: 'Far',
              accessible: false,
              exceedsRange: 20,
            }),
          ]),
        })
      );
    });

    it('should identify limiting factor ships', async () => {
      const mockLogistics = {
        id: 'log-1',
        ships: [
          { shipId: 'ship-1', shipName: 'Fast Ship', jumpRange: 80 },
          { shipId: 'ship-2', shipName: 'Slow Ship', jumpRange: 40 },
        ],
        route: [],
      };

      mockRepository.findOne.mockResolvedValue(mockLogistics);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateJumpRange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          shipsJumpRange: expect.arrayContaining([
            expect.objectContaining({
              shipName: 'Slow Ship',
              isLimitingFactor: true,
            }),
            expect.objectContaining({
              shipName: 'Fast Ship',
              isLimitingFactor: false,
            }),
          ]),
        })
      );
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };

      await controller.calculateJumpRange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors when calculating jump range', async () => {
      const error = new Error('Calculation failed');
      mockRepository.findOne.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };

      await controller.calculateJumpRange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ==================== DELETE ====================

  describe('deleteLogistics', () => {
    it('should delete logistics successfully', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });
      mockRequest.params = { id: 'log-1' };

      await controller.deleteLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockRepository.delete).toHaveBeenCalledWith('log-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Fleet logistics deleted successfully',
      });
    });

    it('should return 404 when logistics not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });
      mockRequest.params = { id: 'invalid-id' };

      await controller.deleteLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Fleet logistics not found' })
      );
    });

    it('should handle errors when deleting logistics', async () => {
      const error = new Error('Delete failed');
      mockRepository.delete.mockRejectedValue(error);
      mockRequest.params = { id: 'log-1' };

      await controller.deleteLogistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
