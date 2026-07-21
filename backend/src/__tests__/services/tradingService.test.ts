import { AppDataSource } from '../../config/database';
import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import { CreateTradingRouteDto, TradingService } from '../../services/trade/trading/TradingService';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/trade/trading/UIFService', () => ({
  __esModule: true,
  default: {
    getItemsAtLocation: jest.fn(),
    comparePrices: jest.fn(),
    getItemPrices: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TradingService', () => {
  let tradingService: TradingService;
  let mockRepository: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock repository
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
    tradingService = new TradingService();
  });

  describe('createRoute', () => {
    it('should create a new trading route', async () => {
      const dto: CreateTradingRouteDto = {
        name: 'Test Route',
        description: 'A test trading route',
        creatorId: 'user-123',
        stops: [
          { location: 'Port Olisar', buyGoods: ['Laranite'], order: 0 },
          { location: 'Lorville', sellGoods: ['Laranite'], order: 1 },
        ],
        estimatedProfit: 5000,
      };

      const mockRoute: Partial<TradingRoute> = {
        id: 'route-123',
        ...dto,
        status: RouteStatus.ACTIVE,
        performance: { runCount: 0, avgProfit: 0, avgDuration: 0 },
      };

      mockRepository.create.mockReturnValue(mockRoute);
      mockRepository.save.mockResolvedValue(mockRoute);

      const result = await tradingService.createRoute(dto);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Test Route');
      expect(result.status).toBe(RouteStatus.ACTIVE);
    });

    it('should throw error on creation failure', async () => {
      const dto: CreateTradingRouteDto = {
        name: 'Test Route',
        description: 'A test trading route',
        creatorId: 'user-123',
        stops: [],
      };

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(tradingService.createRoute(dto)).rejects.toThrow('Database error');
    });
  });

  describe('getRoutes', () => {
    it('should return all routes without filters', async () => {
      const mockRoutes: Partial<TradingRoute>[] = [
        { id: 'route-1', name: 'Route 1', status: RouteStatus.ACTIVE },
        { id: 'route-2', name: 'Route 2', status: RouteStatus.ACTIVE },
      ];

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRoutes),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await tradingService.getRoutes({ organizationId: 'org-123' });

      expect(result).toHaveLength(2);
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('route.createdAt', 'DESC');
    });

    it('should filter routes by creatorId', async () => {
      const mockRoutes: Partial<TradingRoute>[] = [
        { id: 'route-1', name: 'Route 1', creatorId: 'user-123' },
      ];

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRoutes),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await tradingService.getRoutes({
        creatorId: 'user-123',
        organizationId: 'org-123',
      });

      expect(result).toHaveLength(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('route.creatorId = :creatorId', {
        creatorId: 'user-123',
      });
    });

    it('should filter routes by status', async () => {
      const mockRoutes: Partial<TradingRoute>[] = [
        { id: 'route-1', name: 'Route 1', status: RouteStatus.INACTIVE },
      ];

      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRoutes),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await tradingService.getRoutes({
        status: RouteStatus.INACTIVE,
        organizationId: 'org-123',
      });

      expect(result).toHaveLength(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('route.status = :status', {
        status: RouteStatus.INACTIVE,
      });
    });
  });

  describe('getRouteById', () => {
    it('should return route by ID', async () => {
      const mockRoute: Partial<TradingRoute> = {
        id: 'route-123',
        name: 'Test Route',
        status: RouteStatus.ACTIVE,
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockRoute),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await tradingService.getRouteById('route-123', 'org-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('route-123');
      expect(queryBuilder.where).toHaveBeenCalledWith('route.id = :id', { id: 'route-123' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('route.organizationId = :organizationId', {
        organizationId: 'org-1',
      });
    });

    it('should return null for non-existent route', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await tradingService.getRouteById('non-existent', 'org-1');

      expect(result).toBeNull();
    });
  });

  describe('updateRoute', () => {
    it('should update an existing route', async () => {
      const existingRoute: Partial<TradingRoute> = {
        id: 'route-123',
        name: 'Old Name',
        description: 'Old description',
        stops: [],
        status: RouteStatus.ACTIVE,
      };

      const updatedRoute: Partial<TradingRoute> = {
        ...existingRoute,
        name: 'New Name',
        description: 'New description',
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingRoute),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockRepository.save.mockResolvedValue(updatedRoute);

      const result = await tradingService.updateRoute(
        'route-123',
        {
          name: 'New Name',
          description: 'New description',
        },
        'org-1'
      );

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New description');
    });

    it('should throw error for non-existent route', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(
        tradingService.updateRoute('non-existent', { name: 'New Name' }, 'org-1')
      ).rejects.toThrow('Trading route non-existent not found');
    });
  });

  describe('deleteRoute', () => {
    it('should delete an existing route', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'route-123', organizationId: 'org-1' }),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(tradingService.deleteRoute('route-123', 'org-1')).resolves.not.toThrow();
      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: 'route-123',
        organizationId: 'org-1',
      });
    });

    it('should throw error for non-existent route', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(tradingService.deleteRoute('non-existent', 'org-1')).rejects.toThrow(
        'Trading route non-existent not found'
      );
    });
  });

  describe('recordRouteRun', () => {
    it('should record a completed route run', async () => {
      const existingRoute: Partial<TradingRoute> = {
        id: 'route-123',
        name: 'Test Route',
        performance: {
          runCount: 2,
          avgProfit: 5000,
          avgDuration: 30,
        },
      };

      const updatedRoute: Partial<TradingRoute> = {
        ...existingRoute,
        performance: {
          runCount: 3,
          avgProfit: 5333.33,
          avgDuration: 33.33,
          lastRun: new Date(),
        },
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingRoute),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockRepository.save.mockResolvedValue(updatedRoute);

      const result = await tradingService.recordRouteRun('route-123', 6000, 40, 'org-1');

      expect(result.performance?.runCount).toBe(3);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent route', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(
        tradingService.recordRouteRun('non-existent', 5000, 30, 'org-1')
      ).rejects.toThrow('Trading route non-existent not found');
    });
  });

  describe('refreshAllRouteProfits', () => {
    it('should refresh profits for all active routes', async () => {
      const mockRoutes: Partial<TradingRoute>[] = [
        { id: 'route-1', name: 'Route 1', status: RouteStatus.ACTIVE, stops: [] },
        { id: 'route-2', name: 'Route 2', status: RouteStatus.ACTIVE, stops: [] },
      ];

      mockRepository.find.mockResolvedValue(mockRoutes);
      mockRepository.save.mockImplementation((route: TradingRoute) => Promise.resolve(route));

      const result = await tradingService.refreshAllRouteProfits();

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
