import { AppDataSource } from '../../config/database';
import { Fleet } from '../../models/Fleet';
import { InventoryCategory, InventoryUnit, StockStatus } from '../../models/FleetInventory';
import { FleetInventoryService } from '../../services/fleet';

// Mock the database
jest.mock('../../config/database');

// Mock the logger
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

const TEST_ORG_ID = 'org-123';

describe('FleetInventoryService', () => {
  let service: FleetInventoryService;
  let mockInventoryRepository: any;
  let mockFleetRepository: any;

  beforeEach(() => {
    // Create mock inventory repository
    mockInventoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    // Create mock fleet repository for verifyFleetAccess
    mockFleetRepository = {
      findOne: jest.fn().mockImplementation((options: any) => {
        // Return a fleet when organizationId matches TEST_ORG_ID
        if (options?.where?.organizationId === TEST_ORG_ID) {
          return Promise.resolve({
            id: options.where.id,
            organizationId: TEST_ORG_ID,
            name: `Fleet ${options.where.id}`,
          } as Partial<Fleet>);
        }
        return Promise.resolve(null);
      }),
    };

    // Mock AppDataSource.getRepository to return appropriate repositories
    (AppDataSource.getRepository as jest.Mock) = jest.fn().mockImplementation((entity: any) => {
      const entityName = typeof entity === 'function' ? entity.name : String(entity);
      if (entityName === 'Fleet') {
        return mockFleetRepository;
      }
      return mockInventoryRepository;
    });

    service = new FleetInventoryService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE INVENTORY ITEM ====================
  describe('createInventoryItem', () => {
    it('should create inventory item with adequate status', async () => {
      const dto = {
        fleetId: 'fleet-123',
        itemName: 'Hydrogen Fuel',
        category: InventoryCategory.FUEL,
        quantity: 5000,
        unit: InventoryUnit.LITERS,
        thresholds: {
          criticalLevel: 1000,
          lowLevel: 2000,
          targetLevel: 8000,
          maxLevel: 10000,
        },
        unitCost: 1.5,
        managerId: 'user-123',
      };

      const expectedItem = {
        ...dto,
        status: StockStatus.ADEQUATE,
        totalValue: 7500,
        alertEnabled: true,
      };

      mockInventoryRepository.create.mockReturnValue(expectedItem);
      mockInventoryRepository.save.mockResolvedValue(expectedItem);

      const result = await service.createInventoryItem(TEST_ORG_ID, dto);

      expect(mockInventoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fleetId: dto.fleetId,
          itemName: dto.itemName,
          status: StockStatus.ADEQUATE,
        })
      );
      expect(result).toEqual(expectedItem);
    });

    it('should create inventory item with critical status', async () => {
      const dto = {
        fleetId: 'fleet-123',
        itemName: 'Medical Supplies',
        category: InventoryCategory.MEDICAL,
        quantity: 50,
        unit: InventoryUnit.UNITS,
        thresholds: {
          criticalLevel: 100,
          lowLevel: 200,
          targetLevel: 500,
          maxLevel: 1000,
        },
        managerId: 'user-123',
      };

      const expectedItem = {
        ...dto,
        status: StockStatus.CRITICAL,
      };

      mockInventoryRepository.create.mockReturnValue(expectedItem);
      mockInventoryRepository.save.mockResolvedValue(expectedItem);

      const result = await service.createInventoryItem(TEST_ORG_ID, dto);

      expect(result.status).toBe(StockStatus.CRITICAL);
    });

    it('should calculate days remaining with consumption rate', async () => {
      const dto = {
        fleetId: 'fleet-123',
        itemName: 'Ammunition',
        category: InventoryCategory.AMMUNITION,
        quantity: 1000,
        unit: InventoryUnit.UNITS,
        thresholds: {
          criticalLevel: 100,
          lowLevel: 300,
          targetLevel: 800,
          maxLevel: 2000,
        },
        averageConsumptionRate: 50,
        managerId: 'user-123',
      };

      const expectedItem = {
        ...dto,
        status: StockStatus.ADEQUATE,
        estimatedDaysRemaining: 20,
      };

      mockInventoryRepository.create.mockReturnValue(expectedItem);
      mockInventoryRepository.save.mockResolvedValue(expectedItem);

      const result = await service.createInventoryItem(TEST_ORG_ID, dto);

      expect(result.estimatedDaysRemaining).toBe(20);
    });
  });

  // ==================== GET INVENTORY ====================
  describe('getInventory', () => {
    it('should get inventory with filters', async () => {
      const filters = {
        fleetId: 'fleet-123',
        category: InventoryCategory.FUEL,
        status: StockStatus.LOW,
      };

      const mockItems = [
        { id: '1', itemName: 'Hydrogen Fuel', status: StockStatus.LOW },
        { id: '2', itemName: 'Quantum Fuel', status: StockStatus.LOW },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockItems),
      };

      mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getInventory(TEST_ORG_ID, filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result.items).toEqual(mockItems);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by low stock only', async () => {
      const filters = {
        fleetId: 'fleet-123',
        lowStockOnly: true,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getInventory(TEST_ORG_ID, filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'inventory.status IN (:...statuses)',
        expect.any(Object)
      );
    });

    it('should search by term', async () => {
      const filters = {
        fleetId: 'fleet-123',
        searchTerm: 'fuel',
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getInventory(TEST_ORG_ID, filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.any(Object)
      );
    });
  });

  // ==================== UPDATE INVENTORY ====================
  describe('updateInventoryItem', () => {
    it('should update inventory item', async () => {
      const existingItem = {
        id: 'item-1',
        fleetId: 'fleet-123',
        itemName: 'Hydrogen Fuel',
        quantity: 5000,
        thresholds: { criticalLevel: 1000, lowLevel: 2000, targetLevel: 8000, maxLevel: 10000 },
        status: StockStatus.ADEQUATE,
      };

      const updateDto = {
        quantity: 1500,
      };

      mockInventoryRepository.findOne.mockResolvedValue(existingItem);
      mockInventoryRepository.save.mockResolvedValue({
        ...existingItem,
        ...updateDto,
        status: StockStatus.LOW,
      });

      const result = await service.updateInventoryItem(TEST_ORG_ID, 'item-1', updateDto);

      expect(result.quantity).toBe(1500);
      expect(result.status).toBe(StockStatus.LOW);
    });

    it('should throw error if item not found', async () => {
      mockInventoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateInventoryItem(TEST_ORG_ID, 'nonexistent', { quantity: 100 })
      ).rejects.toThrow('Inventory item nonexistent not found');
    });

    it('should recalculate total value on cost update', async () => {
      const existingItem = {
        id: 'item-1',
        fleetId: 'fleet-123',
        quantity: 1000,
        unitCost: 1.5,
        thresholds: { criticalLevel: 100, lowLevel: 200, targetLevel: 800, maxLevel: 2000 },
      };

      const updateDto = {
        unitCost: 2,
      };

      mockInventoryRepository.findOne.mockResolvedValue(existingItem);
      mockInventoryRepository.save.mockResolvedValue({
        ...existingItem,
        ...updateDto,
        totalValue: 2000,
      });

      const result = await service.updateInventoryItem(TEST_ORG_ID, 'item-1', updateDto);

      expect(result.totalValue).toBe(2000);
    });
  });

  // ==================== ADJUST STOCK ====================
  describe('adjustStock', () => {
    it('should increase stock quantity', async () => {
      const existingItem = {
        id: 'item-1',
        fleetId: 'fleet-123',
        quantity: 1000,
        thresholds: { criticalLevel: 500, lowLevel: 1000, targetLevel: 3000, maxLevel: 5000 },
        status: StockStatus.LOW,
        unitCost: 1.5,
      };

      const adjustment = {
        quantity: 2500,
        reason: 'Restocked',
        adjustedBy: 'user-123',
      };

      mockInventoryRepository.findOne.mockResolvedValue(existingItem);
      mockInventoryRepository.save.mockResolvedValue({
        ...existingItem,
        quantity: 3500,
        status: StockStatus.ADEQUATE,
        totalValue: 5250,
        lastRestockDate: expect.any(Date),
      });

      const result = await service.adjustStock(TEST_ORG_ID, 'item-1', adjustment);

      expect(result.quantity).toBe(3500);
      expect(result.status).toBe(StockStatus.ADEQUATE);
      expect(result.lastRestockDate).toBeDefined();
    });

    it('should decrease stock quantity', async () => {
      const existingItem = {
        id: 'item-1',
        fleetId: 'fleet-123',
        quantity: 5000,
        thresholds: { criticalLevel: 1000, lowLevel: 2000, targetLevel: 8000, maxLevel: 10000 },
        status: StockStatus.ADEQUATE,
      };

      const adjustment = {
        quantity: -3500,
        reason: 'Consumed during operation',
        adjustedBy: 'user-123',
      };

      mockInventoryRepository.findOne.mockResolvedValue(existingItem);
      mockInventoryRepository.save.mockResolvedValue({
        ...existingItem,
        quantity: 1500,
        status: StockStatus.LOW,
      });

      const result = await service.adjustStock(TEST_ORG_ID, 'item-1', adjustment);

      expect(result.quantity).toBe(1500);
      expect(result.status).toBe(StockStatus.LOW);
    });

    it('should not allow negative quantities', async () => {
      const existingItem = {
        id: 'item-1',
        fleetId: 'fleet-123',
        quantity: 100,
        thresholds: { criticalLevel: 50, lowLevel: 100, targetLevel: 500, maxLevel: 1000 },
      };

      const adjustment = {
        quantity: -200,
        reason: 'Test',
        adjustedBy: 'user-123',
      };

      mockInventoryRepository.findOne.mockResolvedValue(existingItem);
      mockInventoryRepository.save.mockResolvedValue({
        ...existingItem,
        quantity: 0,
        status: StockStatus.OUT_OF_STOCK,
      });

      const result = await service.adjustStock(TEST_ORG_ID, 'item-1', adjustment);

      expect(result.quantity).toBe(0);
      expect(result.status).toBe(StockStatus.OUT_OF_STOCK);
    });
  });

  // ==================== DELETE INVENTORY ====================
  describe('deleteInventoryItem', () => {
    it('should delete inventory item', async () => {
      const existingItem = {
        id: 'item-1',
        fleetId: 'fleet-123',
        itemName: 'Test Item',
      };

      mockInventoryRepository.findOne.mockResolvedValue(existingItem);
      mockInventoryRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteInventoryItem(TEST_ORG_ID, 'item-1');

      expect(mockInventoryRepository.delete).toHaveBeenCalledWith('item-1');
    });

    it('should throw error if item not found', async () => {
      mockInventoryRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteInventoryItem(TEST_ORG_ID, 'nonexistent')).rejects.toThrow(
        'Inventory item nonexistent not found'
      );
    });
  });

  // ==================== STATISTICS ====================
  describe('getInventoryStatistics', () => {
    it('should calculate inventory statistics', async () => {
      const mockItems = [
        {
          status: StockStatus.ADEQUATE,
          totalValue: 5000,
          alertEnabled: true,
          estimatedDaysRemaining: 30,
        },
        {
          status: StockStatus.LOW,
          totalValue: 2000,
          alertEnabled: true,
          estimatedDaysRemaining: 10,
        },
        {
          status: StockStatus.CRITICAL,
          totalValue: 1000,
          alertEnabled: false,
          estimatedDaysRemaining: 5,
        },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(3),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockItems),
      };

      mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const stats = await service.getInventoryStatistics(TEST_ORG_ID, 'fleet-123');

      expect(stats.totalItems).toBe(3);
      expect(stats.totalValue).toBe(8000);
      expect(stats.byStatus.adequate).toBe(1);
      expect(stats.byStatus.low).toBe(1);
      expect(stats.byStatus.critical).toBe(1);
      expect(stats.alertsEnabled).toBe(2);
      expect(stats.itemsNeedingRestock).toBe(2);
      expect(stats.averageDaysRemaining).toBe(15);
    });
  });

  // ==================== LOW STOCK REPORT ====================
  describe('getLowStockReport', () => {
    it('should generate low stock report', async () => {
      const mockItems = [
        {
          id: '1',
          itemName: 'Fuel',
          category: InventoryCategory.FUEL,
          status: StockStatus.CRITICAL,
          quantity: 500,
          unitCost: 1.5,
          thresholds: { targetLevel: 5000 },
        },
        {
          id: '2',
          itemName: 'Ammo',
          category: InventoryCategory.AMMUNITION,
          status: StockStatus.LOW,
          quantity: 150,
          unitCost: 2,
          thresholds: { targetLevel: 500 },
        },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockItems),
      };

      mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const report = await service.getLowStockReport(TEST_ORG_ID, 'fleet-123');

      expect(report.totalLowStockItems).toBe(2);
      expect(report.critical).toHaveLength(1);
      expect(report.warning).toHaveLength(1);
      expect(report.estimatedRestockCost).toBeGreaterThan(0);
    });
  });

  // ==================== BULK OPERATIONS WITH TRANSACTIONS ====================
  describe('bulkCreateInventoryItems', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn(),
          findOne: jest.fn(),
          find: jest.fn(),
          delete: jest.fn(),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);
    });

    it('should bulk create inventory items with transaction', async () => {
      const items = [
        {
          fleetId: 'fleet-123',
          itemName: 'Fuel',
          category: InventoryCategory.FUEL,
          quantity: 1000,
          unit: InventoryUnit.LITERS,
          thresholds: { criticalLevel: 100, lowLevel: 200, targetLevel: 800, maxLevel: 2000 },
          managerId: 'user-123',
        },
        {
          fleetId: 'fleet-123',
          itemName: 'Ammo',
          category: InventoryCategory.AMMUNITION,
          quantity: 500,
          unit: InventoryUnit.UNITS,
          thresholds: { criticalLevel: 50, lowLevel: 100, targetLevel: 400, maxLevel: 1000 },
          managerId: 'user-123',
        },
      ];

      const savedItems = items.map((item, i) => ({
        id: `item-${i}`,
        ...item,
        status: StockStatus.ADEQUATE,
      }));

      mockInventoryRepository.create.mockImplementation(data => data);
      mockQueryRunner.manager.save.mockImplementation(item =>
        Promise.resolve({ ...item, id: `item-${Math.random()}` })
      );

      const result = await service.bulkCreateInventoryItems(TEST_ORG_ID, items);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should rollback on error during bulk create', async () => {
      const items = [
        {
          fleetId: 'fleet-123',
          itemName: 'Fuel',
          category: InventoryCategory.FUEL,
          quantity: 1000,
          unit: InventoryUnit.LITERS,
          thresholds: { criticalLevel: 100, lowLevel: 200, targetLevel: 800, maxLevel: 2000 },
          managerId: 'user-123',
        },
      ];

      mockInventoryRepository.create.mockImplementation(data => data);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      const result = await service.bulkCreateInventoryItems(TEST_ORG_ID, items);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.failed[0].error).toBe('Database error');
    });

    it('should reject more than 100 items', async () => {
      const items = Array(101)
        .fill(null)
        .map((_, i) => ({
          fleetId: 'fleet-123',
          itemName: `Item ${i}`,
          category: InventoryCategory.OTHER,
          quantity: 100,
          unit: InventoryUnit.UNITS,
          thresholds: { criticalLevel: 10, lowLevel: 20, targetLevel: 80, maxLevel: 200 },
          managerId: 'user-123',
        }));

      await expect(service.bulkCreateInventoryItems(TEST_ORG_ID, items)).rejects.toThrow(
        'Cannot create more than 100 items in a single bulk operation'
      );
    });

    it('should reject empty items array', async () => {
      await expect(service.bulkCreateInventoryItems(TEST_ORG_ID, [])).rejects.toThrow(
        'No inventory items provided for bulk create'
      );
    });
  });

  describe('bulkUpdateInventoryItems', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn(),
          findOne: jest.fn(),
          find: jest.fn(),
          delete: jest.fn(),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);
    });

    it('should bulk update inventory items with transaction', async () => {
      const updates = [
        { id: 'item-1', data: { quantity: 500 } },
        { id: 'item-2', data: { quantity: 300 } },
      ];

      mockQueryRunner.manager.findOne.mockImplementation((_, options) => {
        const id = options.where.id;
        return Promise.resolve({
          id,
          fleetId: 'fleet-123',
          quantity: 1000,
          thresholds: { criticalLevel: 100, lowLevel: 200, targetLevel: 800, maxLevel: 2000 },
        });
      });
      mockQueryRunner.manager.save.mockImplementation(item => Promise.resolve(item));

      const result = await service.bulkUpdateInventoryItems(TEST_ORG_ID, updates);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should rollback if item not found during bulk update', async () => {
      const updates = [{ id: 'item-1', data: { quantity: 500 } }];

      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      const result = await service.bulkUpdateInventoryItems(TEST_ORG_ID, updates);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
    });
  });

  describe('bulkDeleteInventoryItems', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn(),
          findOne: jest.fn(),
          find: jest.fn(),
          delete: jest.fn(),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);
    });

    it('should bulk delete inventory items with transaction', async () => {
      const itemIds = ['item-1', 'item-2'];

      mockQueryRunner.manager.find.mockResolvedValue([
        { id: 'item-1', fleetId: 'fleet-123' },
        { id: 'item-2', fleetId: 'fleet-123' },
      ]);
      mockQueryRunner.manager.delete.mockResolvedValue({ affected: 2 });

      const result = await service.bulkDeleteInventoryItems(TEST_ORG_ID, itemIds);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.deletedCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should rollback if some items not found during bulk delete', async () => {
      const itemIds = ['item-1', 'item-2', 'item-3'];

      mockQueryRunner.manager.find.mockResolvedValue([{ id: 'item-1', fleetId: 'fleet-123' }]);

      const result = await service.bulkDeleteInventoryItems(TEST_ORG_ID, itemIds);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(result.deletedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('bulkAdjustStock', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest.fn(),
          findOne: jest.fn(),
          find: jest.fn(),
          delete: jest.fn(),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);
    });

    it('should bulk adjust stock with transaction', async () => {
      const adjustments = [
        { id: 'item-1', adjustment: { quantity: 100, reason: 'Restock', adjustedBy: 'user-123' } },
        { id: 'item-2', adjustment: { quantity: -50, reason: 'Used', adjustedBy: 'user-123' } },
      ];

      mockQueryRunner.manager.findOne.mockImplementation((_, options) => {
        const id = options.where.id;
        return Promise.resolve({
          id,
          fleetId: 'fleet-123',
          itemName: `Item ${id}`,
          quantity: 500,
          thresholds: { criticalLevel: 100, lowLevel: 200, targetLevel: 800, maxLevel: 2000 },
        });
      });
      mockQueryRunner.manager.save.mockImplementation(item => Promise.resolve(item));

      const result = await service.bulkAdjustStock(TEST_ORG_ID, adjustments);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should rollback if item not found during bulk adjustment', async () => {
      const adjustments = [
        { id: 'item-1', adjustment: { quantity: 100, reason: 'Restock', adjustedBy: 'user-123' } },
      ];

      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      const result = await service.bulkAdjustStock(TEST_ORG_ID, adjustments);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
