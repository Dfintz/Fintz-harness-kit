import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import {
  CreateTradeOperationParams,
  ExecuteTradeRunParams,
  SupplyChainAnalysisParams,
  TradeAggregatorService,
} from '../aggregators/TradeAggregatorService';
import { NotificationService } from '../communication';
import { LogisticsAlertService } from '../trade/logistics/LogisticsAlertService';
import { LogisticsRouteOptimizationService } from '../trade/logistics/LogisticsRouteOptimizationService';
import { SupplierManagementService } from '../trade/logistics/SupplierManagementService';
import { TradingService } from '../trade/trading/TradingService';

// Mock all dependencies
jest.mock('../trade/TradeServiceFacade');
jest.mock('../trade/trading/TradingService');
jest.mock('../trade/logistics/LogisticsAlertService');
jest.mock('../trade/logistics/SupplierManagementService');
jest.mock('../trade/logistics/LogisticsRouteOptimizationService');
jest.mock('../communication');

// Mock Discord service
const mockDiscordServiceInstance = {
  sendMessage: jest.fn().mockResolvedValue(undefined),
} as any;

jest.mock('../discord/DiscordService', () => ({
  DiscordService: jest.fn(),
  getDiscordService: jest.fn(() => mockDiscordServiceInstance),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    transaction: jest.fn(callback => callback({})),
    getRepository: jest.fn(() => ({
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  },
}));

describe('TradeAggregatorService', () => {
  let service: TradeAggregatorService;
  let mockTradingService: jest.Mocked<TradingService>;
  let mockAlertService: jest.Mocked<LogisticsAlertService>;
  let mockSupplierService: jest.Mocked<SupplierManagementService>;
  let mockRouteOptimizer: jest.Mocked<LogisticsRouteOptimizationService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockRoute: Partial<TradingRoute> = {
    id: 'route-123',
    name: 'Stanton Trade Route',
    description: 'High-profit trading route',
    creatorId: 'user-trader',
    organizationId: 'org-456',
    status: RouteStatus.ACTIVE,
    stops: [
      { location: 'Port Olisar', buyGoods: ['Titanium'], sellGoods: [], order: 1 },
      { location: 'Lorville', buyGoods: [], sellGoods: ['Titanium'], order: 2 },
    ],
    estimatedProfit: 50000,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TradeAggregatorService();

    // Access internal services
    mockTradingService = (service as any).tradingService;
    mockAlertService = (service as any).alertService;
    mockSupplierService = (service as any).supplierService;
    mockRouteOptimizer = (service as any).routeOptimizer;
    mockNotificationService = (service as any).notificationService;
  });

  describe('createTradeOperation', () => {
    const baseParams: CreateTradeOperationParams = {
      organizationId: 'org-456',
      operationData: {
        name: 'Stanton Trade Route',
        description: 'High-profit trading route',
        coordinatorId: 'user-trader',
        stops: [
          { location: 'Port Olisar', buyGoods: ['Titanium'], sellGoods: [], order: 1 },
          { location: 'Lorville', buyGoods: [], sellGoods: ['Titanium'], order: 2 },
        ],
        estimatedProfit: 50000,
      },
      routeOptions: {
        optimizeForFuel: false,
      },
      alertsConfig: {
        priceThresholds: [{ commodityName: 'Titanium', minPrice: 10, maxPrice: 20 }],
      },
      supplierIds: ['supplier-1'],
      notifyParticipants: true,
      postToDiscord: true,
      discordChannelId: 'channel-123',
    };

    it('should create trade operation with all components', async () => {
      // Arrange
      mockTradingService.createRoute = jest.fn().mockResolvedValue(mockRoute);
      mockRouteOptimizer.optimizeRoute = jest.fn().mockResolvedValue({
        id: 'opt-route-1',
        waypoints: [],
        efficiency: { overallScore: 85 },
      });
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([{
        id: 'supplier-1',
        organizationId: 'org-456',
        name: 'Test Supplier',
      }]);
      (mockNotificationService as any).create = jest.fn().mockResolvedValue({ id: 'notif-1' });

      // Act
      const result = await service.createTradeOperation(baseParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.completed).toContain('createRoute');
      expect(result.completed).toContain('optimizeRoute');
      expect(result.completed).toContain('createAlerts');
      expect(result.completed).toContain('linkSuppliers');
      expect(result.completed).toContain('sendNotifications');
    });

    it('should create trade operation without optional components', async () => {
      // Arrange
      const minimalParams: CreateTradeOperationParams = {
        organizationId: 'org-456',
        operationData: {
          name: 'Simple Route',
          coordinatorId: 'user-trader',
          stops: [{ location: 'Port Olisar', order: 1 }],
        },
      };

      mockTradingService.createRoute = jest.fn().mockResolvedValue(mockRoute);

      // Act
      const result = await service.createTradeOperation(minimalParams);

      // Assert
      expect(result.success).toBe(true);
      expect(mockRouteOptimizer.optimizeRoute).not.toHaveBeenCalled();
      expect(mockSupplierService.getSuppliers).not.toHaveBeenCalled();
    });

    it('should compensate on route creation failure', async () => {
      // Arrange
      mockTradingService.createRoute = jest
        .fn()
        .mockRejectedValue(new Error('Route creation failed'));

      // Act
      const result = await service.createTradeOperation(baseParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failed).toBe('createRoute');
    });

    it('should continue if route optimization fails', async () => {
      // Arrange
      mockTradingService.createRoute = jest.fn().mockResolvedValue(mockRoute);
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([]);
      mockRouteOptimizer.optimizeRoute = jest
        .fn()
        .mockRejectedValue(new Error('Optimization failed'));

      // Act
      const result = await service.createTradeOperation(baseParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.completed).toContain('optimizeRoute');
    });

    it('should post to Discord when configured', async () => {
      // Arrange
      mockTradingService.createRoute = jest.fn().mockResolvedValue(mockRoute);
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([]);

      // Act
      await service.createTradeOperation(baseParams);

      // Assert
      expect(mockDiscordServiceInstance.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.stringContaining('Stanton Trade Route')
      );
    });
  });

  describe('executeTradeRun', () => {
    const executeParams: ExecuteTradeRunParams = {
      organizationId: 'org-456',
      routeId: 'route-123',
      executedById: 'user-trader',
      actualBuyPrice: 10,
      actualSellPrice: 20,
      quantityTraded: 1000,
      notes: 'Successful run',
    };

    it('should execute trade run successfully', async () => {
      // Arrange
      mockTradingService.getRoutes = jest.fn().mockResolvedValue([mockRoute]);
      mockTradingService.updateRoute = jest.fn().mockResolvedValue(mockRoute);

      // Act
      const result = await service.executeTradeRun(executeParams);

      // Assert
      expect(result.route).toBeDefined();
      expect(result.execution.executedAt).toBeDefined();
      expect(result.execution.actualProfit).toBe(10000); // (20-10) * 1000
      expect(result.execution.performanceRating).toBeDefined();
    });

    it('should calculate performance rating correctly', async () => {
      // Arrange
      const highProfitRoute = { ...mockRoute, estimatedProfit: 8000 };
      mockTradingService.getRoutes = jest.fn().mockResolvedValue([highProfitRoute]);
      mockTradingService.updateRoute = jest.fn().mockResolvedValue(highProfitRoute);

      // Act
      const result = await service.executeTradeRun(executeParams);

      // Assert
      expect(result.execution.actualProfit).toBe(10000);
      expect(result.execution.performanceRating).toBe('excellent'); // 10000/8000 = 1.25 > 1.2
    });

    it('should throw error when route not found', async () => {
      // Arrange
      mockTradingService.getRoutes = jest.fn().mockResolvedValue([]);

      // Act & Assert
      await expect(service.executeTradeRun(executeParams)).rejects.toThrow('Trade route not found');
    });

    it('should provide recommendations for poor performance', async () => {
      // Arrange
      const highExpectationRoute = { ...mockRoute, estimatedProfit: 100000 };
      mockTradingService.getRoutes = jest.fn().mockResolvedValue([highExpectationRoute]);
      mockTradingService.updateRoute = jest.fn().mockResolvedValue(highExpectationRoute);

      // Act
      const result = await service.executeTradeRun(executeParams);

      // Assert
      expect(result.execution.performanceRating).toBe('poor');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeSupplyChain', () => {
    const analysisParams: SupplyChainAnalysisParams = {
      organizationId: 'org-456',
      commodities: ['Titanium', 'Gold', 'Medical Supplies'],
      startLocation: 'Port Olisar',
      budget: 100000,
      includeSuppliers: true,
    };

    it('should analyze supply chain successfully', async () => {
      // Arrange
      mockRouteOptimizer.optimizeRoute = jest.fn().mockResolvedValue({
        id: 'opt-1',
        waypoints: [],
        efficiency: { overallScore: 80 },
      });
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([
        { id: 'sup-1', name: 'Supplier A' },
        { id: 'sup-2', name: 'Supplier B' },
      ]);

      // Act
      const result = await service.analyzeSupplyChain(analysisParams);

      // Assert
      expect(result.commodities).toHaveLength(3);
      expect(result.totalEstimatedProfit).toBeGreaterThanOrEqual(0);
      expect(result.recommendations).toBeDefined();
      expect(result.riskFactors).toBeDefined();
    });

    it('should provide risk factors for many commodities', async () => {
      // Arrange
      const manyParams: SupplyChainAnalysisParams = {
        ...analysisParams,
        commodities: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      };

      mockRouteOptimizer.optimizeRoute = jest.fn().mockResolvedValue({ waypoints: [] });
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.analyzeSupplyChain(manyParams);

      // Assert
      expect(result.riskFactors).toContain('High commodity diversity increases complexity');
    });

    it('should include supplier recommendations when requested', async () => {
      // Arrange
      mockRouteOptimizer.optimizeRoute = jest.fn().mockResolvedValue({ waypoints: [] });
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.analyzeSupplyChain(analysisParams);

      // Assert
      expect(result.recommendations).toContain(
        'Consider establishing preferred supplier relationships for regular runs'
      );
    });
  });

  describe('bulkUpdateRouteStatus', () => {
    it('should update multiple routes successfully', async () => {
      // Arrange
      const routes = [
        { ...mockRoute, id: 'route-1', creatorId: 'user-1' },
        { ...mockRoute, id: 'route-2', creatorId: 'user-2' },
      ];

      mockTradingService.updateRoute = jest.fn().mockResolvedValue(mockRoute);
      mockTradingService.getRoutes = jest.fn().mockResolvedValue(routes);
      (mockNotificationService as any).create = jest.fn().mockResolvedValue({ id: 'notif-1' });

      // Act
      const result = await service.bulkUpdateRouteStatus(
        'org-456',
        ['route-1', 'route-2'],
        RouteStatus.INACTIVE,
        'user-admin',
        'Seasonal deactivation'
      );

      // Assert
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.notifications).toBe(2);
    });

    it('should handle partial failures', async () => {
      // Arrange
      const routes = [
        { ...mockRoute, id: 'route-1', creatorId: 'user-1' },
        { ...mockRoute, id: 'route-2', creatorId: 'user-2' },
      ];
      mockTradingService.getRoutes = jest.fn().mockResolvedValue(routes);
      mockTradingService.updateRoute = jest
        .fn()
        .mockResolvedValueOnce(mockRoute)
        .mockRejectedValueOnce(new Error('Update failed'));

      // Act
      const result = await service.bulkUpdateRouteStatus(
        'org-456',
        ['route-1', 'route-2'],
        RouteStatus.DEPRECATED,
        'user-admin'
      );

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('route-2');
    });
  });

  describe('getTradeOperationOverview', () => {
    it('should return comprehensive overview', async () => {
      // Arrange
      const routes = [
        { ...mockRoute, id: 'route-1', status: RouteStatus.ACTIVE },
        { ...mockRoute, id: 'route-2', status: RouteStatus.ACTIVE },
        { ...mockRoute, id: 'route-3', status: RouteStatus.INACTIVE },
      ];

      mockTradingService.getRoutes = jest.fn().mockResolvedValue(routes);
      mockAlertService.getAlerts = jest.fn().mockResolvedValue([
        { id: 'alert-1', status: 'active' },
        { id: 'alert-2', status: 'resolved' },
      ]);
      mockSupplierService.getSuppliers = jest
        .fn()
        .mockResolvedValue([{ id: 'sup-1' }, { id: 'sup-2' }]);

      // Act
      const result = await service.getTradeOperationOverview('org-456');

      // Assert
      expect(result.totalRoutes).toBe(3);
      expect(result.activeRoutes).toBe(2);
      expect(result.activeAlerts).toBe(1);
      expect(result.supplierCount).toBe(2);
      expect(result.recentActivity).toBeDefined();
      expect(result.topPerformingRoutes).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      // Arrange
      mockTradingService.getRoutes = jest.fn().mockResolvedValue([]);
      mockAlertService.getAlerts = jest.fn().mockResolvedValue([]);
      mockSupplierService.getSuppliers = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.getTradeOperationOverview('org-456');

      // Assert
      expect(result.totalRoutes).toBe(0);
      expect(result.activeRoutes).toBe(0);
      expect(result.activeAlerts).toBe(0);
      expect(result.supplierCount).toBe(0);
    });
  });

  describe('Saga Pattern Integration', () => {
    it('should use saga for createTradeOperation', async () => {
      // Arrange
      mockTradingService.createRoute = jest.fn().mockResolvedValue(mockRoute);

      const params: CreateTradeOperationParams = {
        organizationId: 'org-456',
        operationData: {
          name: 'Saga Test Route',
          coordinatorId: 'user-1',
          stops: [{ location: 'Test', order: 1 }],
        },
      };

      // Act
      const result = await service.createTradeOperation(params);

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('data');
    });

    it('should handle optimization failure without compensation', async () => {
      // Arrange
      mockTradingService.createRoute = jest.fn().mockResolvedValue(mockRoute);
      mockRouteOptimizer.optimizeRoute = jest
        .fn()
        .mockRejectedValue(new Error('Optimization failed'));
      mockTradingService.deleteRoute = jest.fn().mockResolvedValue(undefined);

      const params: CreateTradeOperationParams = {
        organizationId: 'org-456',
        operationData: {
          name: 'Failing Route',
          coordinatorId: 'user-1',
          stops: [{ location: 'Test', order: 1 }],
        },
        routeOptions: { optimizeForFuel: true },
      };

      // Act
      const result = await service.createTradeOperation(params);

      // Assert - optimization failure is caught and doesn't trigger compensation
      expect(result.success).toBe(true);
      expect(mockTradingService.deleteRoute).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

