import { FleetLogistics, LogisticsStatus } from '../../../models/FleetLogistics';
import { NotFoundError, ValidationError } from '../../../utils/apiErrors';

// Mock database
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue(mockRepository),
  },
}));

jest.mock('../../../utils/pagination', () => ({
  paginateRepository: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
}));

import { FleetLogisticsService } from '../../../services/fleet/FleetLogisticsService';
import { paginateRepository } from '../../../utils/pagination';

describe('FleetLogisticsService', () => {
  let service: FleetLogisticsService;

  const mockLogistics: Partial<FleetLogistics> = {
    id: 'test-uuid',
    fleetId: 'fleet-1',
    operationName: 'Supply Run Alpha',
    description: 'Resupply mission',
    coordinatorId: 'user-1',
    status: LogisticsStatus.PLANNING,
    ships: [
      {
        shipId: 'ship-1',
        shipName: 'Caterpillar',
        fuelCapacity: 1000,
        cargoCapacity: 500,
        currentFuel: 800,
        currentCargo: 200,
        jumpRange: 50,
      },
      {
        shipId: 'ship-2',
        shipName: 'Freelancer',
        fuelCapacity: 600,
        cargoCapacity: 300,
        currentFuel: 600,
        currentCargo: 100,
        jumpRange: 30,
      },
    ],
    resources: [{ name: 'Medical Supplies', quantity: 50, totalWeight: 100, unit: 'SCU' }],
    route: [
      { location: 'Port Olisar', distance: 0, requiredFuel: 0, order: 1 },
      { location: 'Hurston', distance: 25, requiredFuel: 200, order: 2 },
    ],
    totalFuelCapacity: 1600,
    totalCargoCapacity: 800,
    totalFuelRequired: 200,
    totalCargoUsed: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FleetLogisticsService();
  });

  describe('create', () => {
    it('should create logistics with UUID and calculated totals', async () => {
      const dto = {
        fleetId: 'fleet-1',
        operationName: 'Supply Run Alpha',
        coordinatorId: 'user-1',
        ships: mockLogistics.ships,
        resources: mockLogistics.resources,
        route: mockLogistics.route,
      };

      mockRepository.create.mockReturnValue({ ...mockLogistics });
      mockRepository.save.mockResolvedValue({ ...mockLogistics });

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fleetId: 'fleet-1',
          operationName: 'Supply Run Alpha',
          status: LogisticsStatus.PLANNING,
        })
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
        })
      );
      // UUID format check — not Date.now()
      const createdId = mockRepository.create.mock.calls[0][0].id;
      expect(createdId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should default arrays to empty when not provided', async () => {
      const dto = {
        fleetId: 'fleet-1',
        operationName: 'Empty Op',
        coordinatorId: 'user-1',
      };

      mockRepository.create.mockReturnValue({ ...dto, ships: [], resources: [], route: [] });
      mockRepository.save.mockResolvedValue({ ...dto, ships: [], resources: [], route: [] });

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ships: [],
          resources: [],
          route: [],
        })
      );
    });
  });

  describe('findAll', () => {
    it('should delegate to paginateRepository', async () => {
      await service.findAll({ page: 1, limit: 10 });

      expect(paginateRepository).toHaveBeenCalledWith(
        mockRepository,
        { page: 1, limit: 10 },
        undefined,
        'createdAt'
      );
    });

    it('should filter by fleetId when provided', async () => {
      await service.findAll({ page: 1, limit: 10 }, 'fleet-1');

      expect(paginateRepository).toHaveBeenCalledWith(
        mockRepository,
        { page: 1, limit: 10 },
        { fleetId: 'fleet-1' },
        'createdAt'
      );
    });
  });

  describe('findById', () => {
    it('should return logistics when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockLogistics);

      const result = await service.findById('test-uuid');

      expect(result).toEqual(mockLogistics);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'test-uuid' } });
    });

    it('should throw NotFoundError when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundError);
      await expect(service.findById('missing')).rejects.toThrow('Fleet logistics');
    });
  });

  describe('update', () => {
    it('should update only allowed fields', async () => {
      const existing = { ...mockLogistics };
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(existing);

      await service.update('test-uuid', {
        operationName: 'Updated Name',
        notes: 'New notes',
      } as Partial<FleetLogistics>);

      expect(existing.operationName).toBe('Updated Name');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should recalculate totals when ships change', async () => {
      const existing = { ...mockLogistics, totalFuelCapacity: 0 };
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(existing);

      await service.update('test-uuid', {
        ships: mockLogistics.ships,
      } as Partial<FleetLogistics>);

      expect(existing.totalFuelCapacity).toBe(1600);
      expect(existing.totalCargoCapacity).toBe(800);
    });
  });

  describe('updateStatus', () => {
    it('should update status with valid value', async () => {
      const existing = { ...mockLogistics };
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(existing);

      const result = await service.updateStatus('test-uuid', LogisticsStatus.READY);

      expect(result.status).toBe(LogisticsStatus.READY);
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(
        service.updateStatus('test-uuid', 'INVALID' as LogisticsStatus)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should delete when record exists', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.delete('test-uuid')).resolves.toBeUndefined();
    });

    it('should throw NotFoundError when record does not exist', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.delete('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('calculateFuelRequirements', () => {
    it('should calculate fuel requirements correctly', () => {
      const result = service.calculateFuelRequirements(mockLogistics as FleetLogistics);

      expect(result.totalFuelRequired).toBe(200);
      expect(result.totalCurrentFuel).toBe(1400);
      expect(result.fuelShortage).toBe(0);
      expect(result.canCompleteRoute).toBe(true);
      expect(result.shipsStatus).toHaveLength(2);
    });

    it('should handle zero fuel capacity without division errors', () => {
      const logistics = {
        ...mockLogistics,
        ships: [
          { shipId: 's1', shipName: 'Empty', fuelCapacity: 0, cargoCapacity: 0, currentFuel: 0, currentCargo: 0, jumpRange: 0 },
        ],
      } as FleetLogistics;

      const result = service.calculateFuelRequirements(logistics);

      expect(result.shipsStatus[0].fuelPercentage).toBe('0.00');
    });
  });

  describe('calculateCargoCapacity', () => {
    it('should calculate cargo correctly', () => {
      const result = service.calculateCargoCapacity(mockLogistics as FleetLogistics);

      expect(result.totalCargoCapacity).toBe(800);
      expect(result.totalCargoUsed).toBe(100);
      expect(result.cargoAvailable).toBe(700);
      expect(result.canFitAllResources).toBe(true);
    });

    it('should handle zero cargo capacity without division errors', () => {
      const logistics = {
        ...mockLogistics,
        ships: [
          { shipId: 's1', shipName: 'Empty', fuelCapacity: 0, cargoCapacity: 0, currentFuel: 0, currentCargo: 0, jumpRange: 0 },
        ],
      } as FleetLogistics;

      const result = service.calculateCargoCapacity(logistics);

      expect(result.shipsStatus[0].cargoPercentage).toBe('0.00');
    });
  });

  describe('calculateJumpRange', () => {
    it('should use minimum jump range across fleet', () => {
      const result = service.calculateJumpRange(mockLogistics as FleetLogistics);

      expect(result.fleetMinJumpRange).toBe(30); // Freelancer is the limiting factor
      expect(result.shipsJumpRange[1].isLimitingFactor).toBe(true);
    });

    it('should detect infeasible routes', () => {
      const logistics = {
        ...mockLogistics,
        route: [{ location: 'Far Away', distance: 100, requiredFuel: 500, order: 1 }],
      } as FleetLogistics;

      const result = service.calculateJumpRange(logistics);

      expect(result.canCompleteRoute).toBe(false);
      expect(result.routeFeasibility[0].exceedsRange).toBe(70); // 100 - 30
    });

    it('should handle empty ships array', () => {
      const logistics = { ...mockLogistics, ships: [] } as unknown as FleetLogistics;

      const result = service.calculateJumpRange(logistics);

      expect(result.fleetMinJumpRange).toBe(0);
    });
  });
});
