import { Repository, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../../config/database';
import { ShipControllerV2 } from '../../../controllers/v2/shipController';
import { Ship, ShipSize, ShipStatus } from '../../../models/Ship';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../services/ship', () => ({
  ShipService: jest.fn().mockImplementation(() => ({
    // Mock methods if needed
  })),
}));
jest.mock('../../../utils/pagination', () => ({
  extractPaginationOptions: jest.fn(() => ({
    page: 1,
    limit: 10,
  })),
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
jest.mock('../../../middleware/queryParser', () => ({
  buildHateoasLinks: jest.fn(() => ({
    self: '/api/v2/ships/catalogue',
    next: null,
    prev: null,
  })),
}));

describe('ShipControllerV2 - Catalogue Endpoints', () => {
  let shipController: ShipControllerV2;
  let mockShipRepository: jest.Mocked<Repository<Ship>>;
  let mockRequest: any;
  let mockResponse: any;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<Ship>>;

  const mockShip: Ship = {
    id: 'aegis-avenger-titan',
    name: 'Avenger Titan',
    manufacturer: 'Aegis Dynamics',
    manufacturerCode: 'AEGS',
    size: ShipSize.SMALL,
    status: ShipStatus.FLIGHT_READY,
    isActive: true,
    isVehicle: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    organizationId: 'global',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock query builder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    } as any;

    // Mock repository
    mockShipRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    } as any;

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockShipRepository);

    shipController = new ShipControllerV2();

    // Mock request and response
    mockRequest = {
      query: {},
      params: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      success: jest.fn().mockReturnThis(),
      paginated: jest.fn().mockReturnThis(),
    };
  });

  describe('getCatalogue', () => {
    it('should get all ships from catalogue with pagination', async () => {
      const mockPagination = require('../../../utils/pagination');
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [mockShip],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });

      await shipController.getCatalogue(mockRequest, mockResponse);

      expect(mockShipRepository.createQueryBuilder).toHaveBeenCalledWith('ship');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockResponse.paginated).toHaveBeenCalled();
    });

    it('should filter by manufacturer', async () => {
      mockRequest.query = { manufacturer: 'Aegis Dynamics' };

      await shipController.getCatalogue(mockRequest, mockResponse);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(ship.manufacturer) = LOWER(:manufacturer)',
        { manufacturer: 'Aegis Dynamics' }
      );
    });

    it('should filter by size', async () => {
      mockRequest.query = { size: ShipSize.SMALL };

      await shipController.getCatalogue(mockRequest, mockResponse);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.size = :size', {
        size: ShipSize.SMALL,
      });
    });

    it('should search by name or manufacturer', async () => {
      mockRequest.query = { search: 'Avenger' };

      await shipController.getCatalogue(mockRequest, mockResponse);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
        { search: '%Avenger%' }
      );
    });

    it('should apply custom sorting', async () => {
      mockRequest.query = { sortBy: 'manufacturer', sortOrder: 'DESC' };

      await shipController.getCatalogue(mockRequest, mockResponse);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.manufacturer', 'DESC');
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

      await shipController.getManufacturers(mockRequest, mockResponse);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'DISTINCT ship.manufacturer',
        'manufacturer'
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.name NOT LIKE :bundlePattern', {
        bundlePattern: '% with %',
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.manufacturer', 'ASC');
      expect(mockResponse.success).toHaveBeenCalledWith([
        'Aegis Dynamics',
        'Anvil Aerospace',
        'Origin Jumpworks',
      ]);
    });

    it('should filter out null manufacturers', async () => {
      const mockManufacturers = [
        { manufacturer: 'Aegis Dynamics' },
        { manufacturer: null },
        { manufacturer: 'Anvil Aerospace' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockManufacturers);

      await shipController.getManufacturers(mockRequest, mockResponse);

      expect(mockResponse.success).toHaveBeenCalledWith(['Aegis Dynamics', 'Anvil Aerospace']);
    });
  });

  describe('getRoles', () => {
    it('should get list of ship roles', async () => {
      const mockRoles = [{ role: 'Fighter' }, { role: 'Cargo' }, { role: 'Exploration' }];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockRoles);

      await shipController.getRoles(mockRequest, mockResponse);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('DISTINCT ship.role', 'role');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.name NOT LIKE :bundlePattern', {
        bundlePattern: '% with %',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.role IS NOT NULL');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.role', 'ASC');
      expect(mockResponse.success).toHaveBeenCalledWith(['Fighter', 'Cargo', 'Exploration']);
    });
  });

  describe('getVehicles', () => {
    it('should get all vehicles with pagination', async () => {
      const mockPagination = require('../../../utils/pagination');
      const mockVehicle = { ...mockShip, isVehicle: true };
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [mockVehicle],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });

      await shipController.getVehicles(mockRequest, mockResponse);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isVehicle = :isVehicle', {
        isVehicle: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.name', 'ASC');
      expect(mockResponse.paginated).toHaveBeenCalled();
    });

    it('should filter vehicles by manufacturer', async () => {
      mockRequest.query = { manufacturer: 'Roberts Space Industries' };

      await shipController.getVehicles(mockRequest, mockResponse);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(ship.manufacturer) = LOWER(:manufacturer)',
        { manufacturer: 'Roberts Space Industries' }
      );
    });
  });

  describe('getSpacecraft', () => {
    it('should get all spacecraft with pagination', async () => {
      const mockPagination = require('../../../utils/pagination');
      mockPagination.paginateQueryBuilder.mockResolvedValue({
        data: [mockShip],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });

      await shipController.getSpacecraft(mockRequest, mockResponse);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ship.isVehicle = :isVehicle', {
        isVehicle: false,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.name', 'ASC');
      expect(mockResponse.paginated).toHaveBeenCalled();
    });

    it('should filter spacecraft by size', async () => {
      mockRequest.query = { size: ShipSize.LARGE };

      await shipController.getSpacecraft(mockRequest, mockResponse);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ship.size = :size', {
        size: ShipSize.LARGE,
      });
    });

    it('should filter spacecraft by role', async () => {
      mockRequest.query = { role: 'Fighter' };

      await shipController.getSpacecraft(mockRequest, mockResponse);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(ship.role) LIKE LOWER(:role)', {
        role: '%Fighter%',
      });
    });
  });
});
