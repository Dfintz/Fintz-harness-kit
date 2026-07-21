import { Response } from 'express';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { ShipController } from '../../controllers/shipDataController';
import { AuthRequest } from '../../middleware/auth';
import { Ship, ShipSize, ShipStatus } from '../../models/Ship';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../utils/pagination', () => ({
  extractPaginationOptions: jest.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
  })),
  paginateRepository: jest.fn((repository, options) =>
    Promise.resolve({
      data: [],
      pagination: {
        page: options.page,
        limit: options.limit,
        total: 0,
        totalPages: 0,
      },
    })
  ),
  paginateQueryBuilder: jest.fn((queryBuilder, options) =>
    Promise.resolve({
      data: [],
      pagination: {
        page: options.page,
        limit: options.limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    })
  ),
}));

describe('ShipController', () => {
  let shipController: ShipController;
  let mockShipRepository: jest.Mocked<Repository<Ship>>;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<Ship>>;

  const mockShip: Ship = {
    id: 'aegis-avenger-titan',
    name: 'Avenger Titan',
    manufacturer: 'Aegis Dynamics',
    manufacturerCode: 'AEGS',
    description: 'A versatile light fighter',
    role: 'Fighter',
    roles: ['Fighter', 'Courier'],
    size: ShipSize.SMALL,
    status: ShipStatus.FLIGHT_READY,
    crew: 1,
    minCrew: 1,
    maxCrew: 1,
    length: 22.5,
    beam: 16.5,
    height: 7.5,
    mass: 52690,
    cargo: 8,
    vehicleCargo: 0,
    price: 870000,
    pledgePrice: 50,
    speed: 220,
    afterburnerSpeed: 1140,
    quantumSpeed: 114000000,
    quantumFuelCapacity: 583,
    hydrogenFuelCapacity: 90000,
    shields: 4680,
    armor: 2790,
    weapons: [
      { type: 'Gun', size: 3, count: 2 },
      { type: 'Missile', size: 2, count: 8 },
    ],
    hardpoints: [],
    isActive: true,
    isVehicle: false,
    variants: ['Avenger Stalker', 'Avenger Warlock'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    organizationId: 'test-org',
    organization: undefined as any,
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
  } as any;

  const mockVehicle: Ship = {
    id: 'rsi-ursa-rover',
    name: 'Ursa Rover',
    manufacturer: 'Roberts Space Industries',
    manufacturerCode: 'RSI',
    description: 'Ground exploration vehicle',
    role: 'Ground',
    size: ShipSize.VEHICLE,
    status: ShipStatus.FLIGHT_READY,
    crew: 2,
    isActive: true,
    isVehicle: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    organizationId: 'test-org',
    organization: undefined as any,
    isSharedWith: jest.fn(),
    canAccessFromOrg: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock query builder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    } as any;

    // Mock repository
    mockShipRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    } as any;

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockShipRepository);

    shipController = new ShipController();

    // Mock request and response
    mockRequest = {
      query: {},
      params: {},
      body: {},
      user: { id: 'user-123', username: 'testuser', role: 'admin' },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getAllShips', () => {
    it('should get all ships with pagination', async () => {
      const mockPagination = require('../../utils/pagination');
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [mockShip],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.createQueryBuilder).toHaveBeenCalledWith('ship');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
          data: [mockShip],
          pagination: expect.any(Object),
        });
    });

    it('should filter ships by manufacturer', async () => {
      mockRequest.query = { manufacturer: 'Aegis Dynamics' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(ship.manufacturer) = LOWER(:manufacturer)',
        { manufacturer: 'Aegis Dynamics' }
      );
    });

    it('should filter ships by size', async () => {
      mockRequest.query = { size: ShipSize.SMALL };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.size = :size', {
        size: ShipSize.SMALL,
      });
    });

    it('should filter ships by role', async () => {
      mockRequest.query = { role: 'Fighter' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(ship.role) LIKE LOWER(:role)', {
        role: '%Fighter%',
      });
    });

    it('should filter ships by search term', async () => {
      mockRequest.query = { search: 'Avenger' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
        { search: '%Avenger%' }
      );
    });

    it('should filter vehicles when isVehicle is true', async () => {
      mockRequest.query = { isVehicle: 'true' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isVehicle = :isVehicle', {
        isVehicle: true,
      });
    });

    it('should filter non-vehicles when isVehicle is false', async () => {
      mockRequest.query = { isVehicle: 'false' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isVehicle = :isVehicle', {
        isVehicle: false,
      });
    });

    it('should filter by status', async () => {
      mockRequest.query = { status: ShipStatus.IN_CONCEPT };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.status = :status', {
        status: ShipStatus.IN_CONCEPT,
      });
    });

    it('should apply custom sorting', async () => {
      mockRequest.query = { sortBy: 'manufacturer', sortOrder: 'DESC' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.manufacturer', 'DESC');
    });

    it('should apply default sorting by name ASC', async () => {
      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.name', 'ASC');
    });

    it('should handle errors gracefully', async () => {
      mockShipRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database error');
      });

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Database error' }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      mockRequest.query = {
        manufacturer: 'Aegis Dynamics',
        size: ShipSize.SMALL,
        role: 'Fighter',
        search: 'Avenger',
      };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(5); // manufacturer, size, role, search, isActive
    });
  });

  describe('getShipById', () => {
    it('should get ship by ID', async () => {
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockShipRepository.findOne.mockResolvedValue(mockShip);

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'aegis-avenger-titan', isActive: true },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockShip);
    });

    it('should return 404 when ship not found', async () => {
      mockRequest.params = { id: 'nonexistent-ship' };
      mockShipRepository.findOne.mockResolvedValue(null);

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('not found') }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockShipRepository.findOne.mockRejectedValue(new Error('Database error'));

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('getManufacturers', () => {
    it('should get list of manufacturers', async () => {
      const mockManufacturers = [
        { manufacturer: 'Aegis Dynamics' },
        { manufacturer: 'Anvil Aerospace' },
        { manufacturer: 'Origin Jumpworks' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockManufacturers);

      await shipController.getManufacturers(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'DISTINCT ship.manufacturer',
        'manufacturer'
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.manufacturer', 'ASC');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(['Aegis Dynamics', 'Anvil Aerospace', 'Origin Jumpworks']);
    });

    it('should filter out null manufacturers', async () => {
      const mockManufacturers = [
        { manufacturer: 'Aegis Dynamics' },
        { manufacturer: null },
        { manufacturer: 'Anvil Aerospace' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockManufacturers);

      await shipController.getManufacturers(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(['Aegis Dynamics', 'Anvil Aerospace']);
    });

    it('should handle errors gracefully', async () => {
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error('Database error'));

      await shipController.getManufacturers(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('getRoles', () => {
    it('should get list of ship roles', async () => {
      const mockRoles = [{ role: 'Fighter' }, { role: 'Cargo' }, { role: 'Exploration' }];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockRoles);

      await shipController.getRoles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('DISTINCT ship.role', 'role');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.role IS NOT NULL');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.role', 'ASC');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(['Fighter', 'Cargo', 'Exploration']);
    });

    it('should filter out null roles', async () => {
      const mockRoles = [{ role: 'Fighter' }, { role: null }, { role: 'Cargo' }];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockRoles);

      await shipController.getRoles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(['Fighter', 'Cargo']);
    });

    it('should handle errors gracefully', async () => {
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error('Database error'));

      await shipController.getRoles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('getVehicles', () => {
    it('should get all vehicles with pagination', async () => {
      const mockPagination = require('../../utils/pagination');
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [mockVehicle],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await shipController.getVehicles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isVehicle = :isVehicle', {
        isVehicle: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.name', 'ASC');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should filter vehicles by manufacturer', async () => {
      mockRequest.query = { manufacturer: 'Roberts Space Industries' };

      await shipController.getVehicles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(ship.manufacturer) = LOWER(:manufacturer)',
        { manufacturer: 'Roberts Space Industries' }
      );
    });

    it('should filter vehicles by search term', async () => {
      mockRequest.query = { search: 'Rover' };

      await shipController.getVehicles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
        { search: '%Rover%' }
      );
    });

    it('should handle errors gracefully', async () => {
      mockShipRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database error');
      });

      await shipController.getVehicles(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('getSpacecraft', () => {
    it('should get all spacecraft with pagination', async () => {
      const mockPagination = require('../../utils/pagination');
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [mockShip],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      await shipController.getSpacecraft(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isVehicle = :isVehicle', {
        isVehicle: false,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.name', 'ASC');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should filter spacecraft by manufacturer', async () => {
      mockRequest.query = { manufacturer: 'Aegis Dynamics' };

      await shipController.getSpacecraft(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(ship.manufacturer) = LOWER(:manufacturer)',
        { manufacturer: 'Aegis Dynamics' }
      );
    });

    it('should filter spacecraft by size', async () => {
      mockRequest.query = { size: ShipSize.SMALL };

      await shipController.getSpacecraft(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.size = :size', {
        size: ShipSize.SMALL,
      });
    });

    it('should filter spacecraft by role', async () => {
      mockRequest.query = { role: 'Fighter' };

      await shipController.getSpacecraft(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(ship.role) LIKE LOWER(:role)', {
        role: '%Fighter%',
      });
    });

    it('should filter spacecraft by search term', async () => {
      mockRequest.query = { search: 'Avenger' };

      await shipController.getSpacecraft(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
        { search: '%Avenger%' }
      );
    });

    it('should handle errors gracefully', async () => {
      mockShipRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database error');
      });

      await shipController.getSpacecraft(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('createShip', () => {
    it('should create a new ship', async () => {
      const newShipData = {
        name: 'Gladius',
        manufacturer: 'Aegis Dynamics',
        description: 'Light fighter',
        role: 'Fighter',
        size: ShipSize.SMALL,
      };

      mockRequest.body = newShipData;
      mockShipRepository.create.mockReturnValue({ ...mockShip, ...newShipData } as any);
      mockShipRepository.save.mockResolvedValue({ ...mockShip, ...newShipData } as any);

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.create).toHaveBeenCalled();
      expect(mockShipRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should generate ID if not provided', async () => {
      const newShipData = {
        name: 'Gladius',
        manufacturer: 'Aegis Dynamics',
      };

      mockRequest.body = newShipData;
      mockShipRepository.create.mockReturnValue(mockShip);
      mockShipRepository.save.mockResolvedValue(mockShip);

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      const createCall = mockShipRepository.create.mock.calls[0][0];
      expect(createCall.id).toBe('aegis-dynamics-gladius');
    });

    it('should use provided ID', async () => {
      const newShipData = {
        id: 'custom-ship-id',
        name: 'Gladius',
        manufacturer: 'Aegis Dynamics',
      };

      mockRequest.body = newShipData;
      mockShipRepository.create.mockReturnValue(mockShip);
      mockShipRepository.save.mockResolvedValue(mockShip);

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      const createCall = mockShipRepository.create.mock.calls[0][0];
      expect(createCall.id).toBe('custom-ship-id');
    });

    it('should handle array response from save', async () => {
      mockRequest.body = { name: 'Gladius', manufacturer: 'Aegis Dynamics' };
      mockShipRepository.create.mockReturnValue(mockShip);
      mockShipRepository.save.mockResolvedValue([mockShip] as any);

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockShip);
    });

    it('should handle errors gracefully', async () => {
      mockRequest.body = { name: 'Gladius', manufacturer: 'Aegis Dynamics' };
      mockShipRepository.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('updateShip', () => {
    it('should update an existing ship', async () => {
      const updateData = { description: 'Updated description', price: 1000000 };
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockRequest.body = updateData;
      mockShipRepository.findOne.mockResolvedValue(mockShip);
      mockShipRepository.save.mockResolvedValue({ ...mockShip, ...updateData } as any);

      await shipController.updateShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'aegis-avenger-titan' },
      });
      expect(mockShipRepository.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining(updateData)
      );
    });

    it('should return 404 when ship not found', async () => {
      mockRequest.params = { id: 'nonexistent-ship' };
      mockRequest.body = { description: 'Updated' };
      mockShipRepository.findOne.mockResolvedValue(null);

      await shipController.updateShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('not found') }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockRequest.body = { description: 'Updated' };
      mockShipRepository.findOne.mockRejectedValue(new Error('Database error'));

      await shipController.updateShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });

    it('should update multiple fields', async () => {
      const updateData = {
        description: 'Updated description',
        price: 1000000,
        crew: 2,
        cargo: 16,
      };
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockRequest.body = updateData;
      mockShipRepository.findOne.mockResolvedValue(mockShip);
      mockShipRepository.save.mockResolvedValue({ ...mockShip, ...updateData } as any);

      await shipController.updateShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateData));
    });
  });

  describe('deleteShip', () => {
    it('should soft delete a ship', async () => {
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockShipRepository.findOne.mockResolvedValue(mockShip);
      mockShipRepository.save.mockResolvedValue({
        ...mockShip,
        isActive: false,
        isSharedWith: jest.fn(),
        canAccessFromOrg: jest.fn(),
        addSharedOrg: jest.fn(),
        removeSharedOrg: jest.fn(),
      } as any);

      await shipController.deleteShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'aegis-avenger-titan' },
      });
      expect(mockShipRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Ship deleted successfully' });
    });

    it('should return 404 when ship not found', async () => {
      mockRequest.params = { id: 'nonexistent-ship' };
      mockShipRepository.findOne.mockResolvedValue(null);

      await shipController.deleteShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('not found') }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { id: 'aegis-avenger-titan' };
      mockShipRepository.findOne.mockRejectedValue(new Error('Database error'));

      await shipController.deleteShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return ship statistics', async () => {
      mockShipRepository.count
        .mockResolvedValueOnce(150) // totalShips
        .mockResolvedValueOnce(25); // totalVehicles

      const mockManufacturerStats = [
        { manufacturer: 'Aegis Dynamics', count: '35' },
        { manufacturer: 'Anvil Aerospace', count: '28' },
        { manufacturer: 'Origin Jumpworks', count: '22' },
      ];

      const mockSizeStats = [
        { size: ShipSize.SMALL, count: '50' },
        { size: ShipSize.MEDIUM, count: '45' },
        { size: ShipSize.LARGE, count: '30' },
      ];

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce(mockManufacturerStats)
        .mockResolvedValueOnce(mockSizeStats);

      await shipController.getStats(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockShipRepository.count).toHaveBeenCalledWith({
        where: { isActive: true, isVehicle: false },
      });
      expect(mockShipRepository.count).toHaveBeenCalledWith({
        where: { isActive: true, isVehicle: true },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
          totalShips: 150,
          totalVehicles: 25,
          total: 175,
          byManufacturer: mockManufacturerStats,
          bySize: mockSizeStats,
        });
    });

    it('should limit manufacturer stats to top 10', async () => {
      mockShipRepository.count.mockResolvedValue(100);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await shipController.getStats(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should handle errors gracefully', async () => {
      mockShipRepository.count.mockRejectedValue(new Error('Database error'));

      await shipController.getStats(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        })
      );
    });

    it('should handle zero ships', async () => {
      mockShipRepository.count.mockResolvedValue(0);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await shipController.getStats(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
          totalShips: 0,
          totalVehicles: 0,
          total: 0,
          byManufacturer: [],
          bySize: [],
        });
    });
  });

  describe('Data Validation', () => {
    it('should validate ship size enum', async () => {
      const invalidShip = {
        ...mockShip,
        size: 'INVALID_SIZE' as ShipSize,
        isSharedWith: jest.fn(),
        canAccessFromOrg: jest.fn(),
        addSharedOrg: jest.fn(),
        removeSharedOrg: jest.fn(),
      } as any;

      mockRequest.body = invalidShip;
      mockShipRepository.create.mockReturnValue(invalidShip);
      mockShipRepository.save.mockRejectedValue(new Error('Invalid enum value'));

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should validate ship status enum', async () => {
      const invalidShip = {
        ...mockShip,
        status: 'INVALID_STATUS' as ShipStatus,
        isSharedWith: jest.fn(),
        canAccessFromOrg: jest.fn(),
        addSharedOrg: jest.fn(),
        removeSharedOrg: jest.fn(),
      } as any;

      mockRequest.body = invalidShip;
      mockShipRepository.create.mockReturnValue(invalidShip);
      mockShipRepository.save.mockRejectedValue(new Error('Invalid enum value'));

      await shipController.createShip(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should handle ships with complete weapon data', async () => {
      const shipWithWeapons = {
        ...mockShip,
        weapons: [
          { type: 'Gun', size: 4, count: 2 },
          { type: 'Missile', size: 3, count: 12 },
          { type: 'Torpedo', size: 9, count: 4 },
        ],
        isSharedWith: jest.fn(),
        canAccessFromOrg: jest.fn(),
        addSharedOrg: jest.fn(),
        removeSharedOrg: jest.fn(),
      } as any;

      mockRequest.params = { id: shipWithWeapons.id };
      mockShipRepository.findOne.mockResolvedValue(shipWithWeapons);

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          weapons: expect.arrayContaining([
            expect.objectContaining({ type: 'Gun', size: 4, count: 2 }),
          ]),
        })
      );
    });

    it('should handle ships with hardpoint data', async () => {
      const shipWithHardpoints = {
        ...mockShip,
        hardpoints: [
          { type: 'Weapon', size: 4, location: 'Wing Left' },
          { type: 'Weapon', size: 4, location: 'Wing Right' },
        ],
        isSharedWith: jest.fn(),
        canAccessFromOrg: jest.fn(),
        addSharedOrg: jest.fn(),
        removeSharedOrg: jest.fn(),
      } as any;

      mockRequest.params = { id: shipWithHardpoints.id };
      mockShipRepository.findOne.mockResolvedValue(shipWithHardpoints);

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          hardpoints: expect.any(Array),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle ships with null optional fields', async () => {
      const minimalShip: Ship = {
        id: 'minimal-ship',
        name: 'Minimal Ship',
        manufacturer: 'Unknown',
        status: ShipStatus.FLIGHT_READY,
        isActive: true,
        isVehicle: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Ship;

      mockRequest.params = { id: 'minimal-ship' };
      mockShipRepository.findOne.mockResolvedValue(minimalShip);

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(minimalShip);
    });

    it('should handle very large ships with maximum data', async () => {
      const largeShip: Ship = {
        ...mockShip,
        size: ShipSize.CAPITAL,
        crew: 100,
        length: 890,
        cargo: 3000,
        weapons: Array(50).fill({ type: 'Turret', size: 10, count: 1 }),
        isSharedWith: jest.fn(),
        canAccessFromOrg: jest.fn(),
        addSharedOrg: jest.fn(),
        removeSharedOrg: jest.fn(),
      } as any;

      mockRequest.params = { id: largeShip.id };
      mockShipRepository.findOne.mockResolvedValue(largeShip);

      await shipController.getShipById(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          size: ShipSize.CAPITAL,
        })
      );
    });

    it('should handle special characters in search', async () => {
      mockRequest.query = { search: "O'Neil's Ship & Co." };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ search: "%O'Neil's Ship & Co.%" })
      );
    });

    it('should handle case-insensitive manufacturer filter', async () => {
      mockRequest.query = { manufacturer: 'AEGIS DYNAMICS' };

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(ship.manufacturer) = LOWER(:manufacturer)',
        { manufacturer: 'AEGIS DYNAMICS' }
      );
    });

    it('should handle empty result sets', async () => {
      const mockPagination = require('../../utils/pagination');
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await shipController.getAllShips(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
          data: [],
          pagination: expect.any(Object),
        });
    });
  });
});
