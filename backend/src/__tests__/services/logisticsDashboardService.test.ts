import { StockStatus } from '../../models/FleetInventory';
import { AlertSeverity, AlertStatus, AlertType } from '../../models/LogisticsAlert';
import { LogisticsDashboardService } from '../../services/trade/logistics/LogisticsDashboardService';

// Don't mock LogisticsDashboardService - we want to test it!

describe('LogisticsDashboardService', () => {
  let service: LogisticsDashboardService;
  let mockInventoryRepository: any;
  let mockAlertRepository: any;
  let mockLogisticsRepository: any;

  beforeEach(() => {
    const createMockQueryBuilder = () => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({}),
    });

    mockInventoryRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockImplementation(createMockQueryBuilder),
      metadata: { name: 'FleetInventory' },
    } as any;

    mockAlertRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockImplementation(createMockQueryBuilder),
      metadata: { name: 'LogisticsAlert' },
    } as any;

    mockLogisticsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockImplementation(createMockQueryBuilder),
      metadata: { name: 'FleetLogistics' },
    } as any;

    // Use dependency injection to pass mocks directly
    service = new LogisticsDashboardService(
      mockInventoryRepository,
      mockAlertRepository,
      mockLogisticsRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== DASHBOARD METRICS ====================
  describe('getDashboardMetrics', () => {
    it('should get comprehensive dashboard metrics', async () => {
      const inventoryQB = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalItems: 4,
          totalValue: 3600,
          lowStockItems: 1,
          criticalItems: 1,
          outOfStockItems: 0,
          adequateItems: 2,
          averageDaysRemaining: 14,
        }),
      };
      mockInventoryRepository.createQueryBuilder.mockImplementation(() => inventoryQB);

      const alertsQB = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          active: 3,
          critical: 1,
          warning: 2,
          unacknowledged: 3,
          resolvedToday: 1,
        }),
      };
      mockAlertRepository.createQueryBuilder.mockImplementation(() => alertsQB);

      const operationsQB = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          active: 1,
          planning: 1,
          completed: 0,
          totalShips: 3,
          totalCargo: 300,
          totalFuel: 150,
        }),
      };
      mockLogisticsRepository.createQueryBuilder.mockImplementation(() => operationsQB);

      mockAlertRepository.count.mockResolvedValue(3);

      const metrics = await service.getDashboardMetrics('fleet-123');

      expect(metrics.inventory.totalItems).toBe(4);
      expect(metrics.inventory.lowStockItems).toBe(1);
      expect(metrics.inventory.criticalItems).toBe(1);
      expect(metrics.inventory.adequateItems).toBe(2);
      expect(metrics.alerts.active).toBe(3);
      expect(metrics.operations.active).toBe(1);
      expect(metrics.operations.planning).toBe(1);
    });
  });

  // ==================== CATEGORY BREAKDOWN ====================
  describe('getCategoryBreakdown', () => {
    it('should get category breakdown with top items', async () => {
      const mockInventory = [
        {
          category: 'fuel',
          itemName: 'Hydrogen',
          quantity: 5000,
          unit: 'SCU',
          totalValue: 7500,
          status: StockStatus.ADEQUATE,
        },
        {
          category: 'fuel',
          itemName: 'Quantum Fuel',
          quantity: 2000,
          unit: 'SCU',
          totalValue: 10000,
          status: StockStatus.ADEQUATE,
        },
        {
          category: 'ammunition',
          itemName: 'Size 3 Missiles',
          quantity: 500,
          unit: 'units',
          totalValue: 25000,
          status: StockStatus.LOW,
        },
      ];

      mockInventoryRepository.find.mockResolvedValue(mockInventory);

      const breakdown = await service.getCategoryBreakdown('fleet-123');

      const fuelBreakdown = breakdown.find(b => b.category === 'fuel');
      const ammoBreakdown = breakdown.find(b => b.category === 'ammunition');

      expect(fuelBreakdown).toBeDefined();
      expect(ammoBreakdown).toBeDefined();
      expect(fuelBreakdown.totalItems).toBe(2);
      expect(fuelBreakdown.totalValue).toBe(17500);
      expect(fuelBreakdown.topItems).toHaveLength(2);
    });

    it('should limit top items to 5', async () => {
      const mockInventory = Array.from({ length: 10 }, (_, i) => ({
        category: 'fuel',
        itemName: `Fuel ${i}`,
        quantity: 1000,
        unit: 'SCU',
        totalValue: 1000 * (10 - i), // Descending values
        status: StockStatus.ADEQUATE,
      }));

      mockInventoryRepository.find.mockResolvedValue(mockInventory);

      const breakdown = await service.getCategoryBreakdown('fleet-123');
      const fuelBreakdown = breakdown.find(b => b.category === 'fuel');

      expect(fuelBreakdown.topItems).toHaveLength(5);
    });
  });

  // ==================== ALERT SUMMARY ====================
  describe('getAlertSummary', () => {
    it('should get alert summary with resolution times', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      const mockAlerts = [
        {
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.ACTIVE,
          createdAt: oneHourAgo,
        },
        {
          type: AlertType.CRITICAL_STOCK,
          severity: AlertSeverity.CRITICAL,
          status: AlertStatus.RESOLVED,
          createdAt: twoHoursAgo,
          resolvedAt: oneHourAgo,
        },
      ];

      mockAlertRepository.find.mockResolvedValue(mockAlerts);

      const summary = await service.getAlertSummary('fleet-123');

      const lowStockSummary = summary.find(s => s.type === AlertType.LOW_STOCK);
      const criticalStockSummary = summary.find(s => s.type === AlertType.CRITICAL_STOCK);

      expect(lowStockSummary).toBeDefined();
      expect(criticalStockSummary).toBeDefined();
      expect(lowStockSummary.count).toBe(1);
      expect(criticalStockSummary.count).toBe(1);
    });

    it('should calculate average resolution time', async () => {
      const now = new Date();
      const mockAlerts = [
        {
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.RESOLVED,
          createdAt: new Date(now.getTime() - 7200000), // 2 hours ago
          resolvedAt: new Date(now.getTime() - 3600000), // 1 hour ago (took 1 hour to resolve)
        },
        {
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.CRITICAL,
          status: AlertStatus.RESOLVED,
          createdAt: new Date(now.getTime() - 10800000), // 3 hours ago
          resolvedAt: new Date(now.getTime() - 7200000), // 2 hours ago (took 1 hour to resolve)
        },
      ];

      mockAlertRepository.find.mockResolvedValue(mockAlerts);

      const summary = await service.getAlertSummary('fleet-123');
      const lowStockSummary = summary.find(s => s.type === AlertType.LOW_STOCK);

      expect(lowStockSummary.averageResolutionTime).toBe(60); // 60 minutes
    });
  });

  // ==================== CONSUMPTION REPORT ====================
  describe('getConsumptionReport', () => {
    it('should generate consumption report', async () => {
      const mockInventory = [
        {
          id: 'item-1',
          itemName: 'Hydrogen Fuel',
          category: 'fuel',
          quantity: 5000,
          averageConsumptionRate: 100,
          estimatedDaysRemaining: 50,
        },
        {
          id: 'item-2',
          itemName: 'Ammunition',
          category: 'ammunition',
          quantity: 500,
          averageConsumptionRate: 50,
          estimatedDaysRemaining: 10,
        },
      ];

      mockInventoryRepository.find.mockResolvedValue(mockInventory);

      const report = await service.getConsumptionReport('fleet-123', 30);

      expect(report).toHaveLength(2);
      expect(report[0]).toHaveProperty('category');
      expect(report[0]).toHaveProperty('totalConsumed');
      expect(report[0]).toHaveProperty('averageDaily');
    });
  });

  // ==================== SUPPLIER PERFORMANCE ====================
  describe('getSupplierPerformance', () => {
    it('should calculate supplier performance metrics', async () => {
      const mockInventory = [
        {
          supplierId: 'supplier-1',
          supplierName: 'Crusader Industries',
          lastRestockDate: new Date(),
          expectedRestockDate: new Date(Date.now() + 86400000), // Tomorrow
        },
        {
          supplierId: 'supplier-1',
          supplierName: 'Crusader Industries',
          lastRestockDate: new Date(),
          expectedRestockDate: null,
        },
        {
          supplierId: 'supplier-2',
          supplierName: 'Hurston Dynamics',
          lastRestockDate: new Date(Date.now() - 172800000), // 2 days ago
          expectedRestockDate: new Date(Date.now() - 86400000), // Yesterday (overdue)
        },
      ];

      mockInventoryRepository.find.mockResolvedValue(mockInventory);

      const performance = await service.getSupplierPerformance('fleet-123');

      expect(performance).toHaveLength(2);
      expect(performance[0]).toHaveProperty('supplierId');
      expect(performance[0]).toHaveProperty('totalOrders');
      expect(performance[0]).toHaveProperty('reliabilityScore');
    });
  });

  // ==================== STOCK VALUE TREND ====================
  describe('getStockValueTrend', () => {
    it('should generate stock value trend data', async () => {
      const mockInventory = [
        {
          totalValue: 10000,
          createdAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
        },
        {
          totalValue: 15000,
          createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
        },
        {
          totalValue: 20000,
          createdAt: new Date(),
        },
      ];

      mockInventoryRepository.find.mockResolvedValue(mockInventory);

      const trend = await service.getStockValueTrend('fleet-123', 7);

      expect(trend).toBeDefined();
      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('date');
      expect(trend[0]).toHaveProperty('totalValue');
      expect(trend[0]).toHaveProperty('itemCount');
    });

    it('should handle empty inventory', async () => {
      mockInventoryRepository.find.mockResolvedValue([]);

      const trend = await service.getStockValueTrend('fleet-123', 7);

      expect(trend).toBeDefined();
      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0].totalValue).toBeDefined();
    });
  });

  // ==================== OPERATIONS SUMMARY ====================
  describe('getOperationsSummary', () => {
    it('should get operations summary', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          operationName: 'Supply Run',
          status: 'in_progress',
          ships: [{ id: 'ship1', currentFuel: 100 }],
          totalCargoCapacity: 1000,
          totalCargoUsed: 500,
          totalFuelCapacity: 200,
          estimatedDuration: 120,
        },
        {
          id: 'op-2',
          operationName: 'Combat Patrol',
          status: 'ready',
          ships: [
            { id: 'ship2', currentFuel: 150 },
            { id: 'ship3', currentFuel: 150 },
          ],
          totalCargoCapacity: 500,
          totalCargoUsed: 100,
          totalFuelCapacity: 300,
          estimatedDuration: 60,
        },
      ];

      mockLogisticsRepository.find.mockResolvedValue(mockOperations);

      const summary = await service.getOperationsSummary('fleet-123');

      expect(summary).toHaveLength(2);
      expect(summary[0]).toHaveProperty('operationId');
      expect(summary[0]).toHaveProperty('name');
      expect(summary[0]).toHaveProperty('status');
      expect(summary[0]).toHaveProperty('shipCount');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
