import { Request, Response } from 'express';

import { FleetInventoryController } from '../../controllers/fleetInventoryController';
import { InventoryCategory, InventoryUnit, StockStatus } from '../../models/FleetInventory';
import { FleetInventoryService } from '../../services/fleet';

// Mock dependencies
jest.mock('../../services/fleet');
const TEST_ORG_ID = 'org-123';
const TEST_FLEET_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('FleetInventoryController', () => {
  let controller: FleetInventoryController;
  let mockInventoryService: jest.Mocked<FleetInventoryService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockInventoryService = new FleetInventoryService() as jest.Mocked<FleetInventoryService>;
    controller = new FleetInventoryController();
    (controller as any).inventoryService = mockInventoryService;

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: {
        id: 'user-1',
        currentOrganizationId: TEST_ORG_ID,
        role: 'admin',
      },
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

  describe('createInventoryItem', () => {
    it('should create inventory item successfully', async () => {
      const dto = {
        fleetId: TEST_FLEET_ID,
        itemName: 'Quantum Fuel',
        description: 'High-grade fuel for quantum drives',
        category: InventoryCategory.FUEL,
        quantity: 1000,
        unit: InventoryUnit.LITERS,
        thresholds: {
          criticalLevel: 100,
          lowLevel: 300,
          targetLevel: 800,
          maxLevel: 1500,
        },
        location: { stationName: 'Port Olisar' },
      };

      const mockItem = { id: 'inv-1', ...dto, status: StockStatus.ADEQUATE };
      mockInventoryService.createInventoryItem = jest.fn().mockResolvedValue(mockItem);
      mockRequest.body = dto;

      await controller.createInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.createInventoryItem).toHaveBeenCalledWith(TEST_ORG_ID, dto);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockItem);
    });

    it('should handle errors when creating inventory item', async () => {
      const error = new Error('Database error');
      mockInventoryService.createInventoryItem = jest.fn().mockRejectedValue(error);
      mockRequest.body = { fleetId: TEST_FLEET_ID, itemName: 'Test Item' };

      await controller.createInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' })
      );
    });
  });

  // ==================== READ ====================

  describe('getInventory', () => {
    it('should get inventory with filters', async () => {
      const mockItems = [
        {
          id: 'inv-1',
          fleetId: TEST_FLEET_ID,
          itemName: 'Fuel',
          category: InventoryCategory.FUEL,
          status: StockStatus.LOW,
        },
        {
          id: 'inv-2',
          fleetId: TEST_FLEET_ID,
          itemName: 'Ammo',
          category: InventoryCategory.AMMUNITION,
          status: StockStatus.ADEQUATE,
        },
      ];

      mockInventoryService.getInventory = jest.fn().mockResolvedValue(mockItems);
      mockRequest.query = {
        fleetId: TEST_FLEET_ID,
        category: InventoryCategory.FUEL,
        status: StockStatus.LOW,
        lowStockOnly: 'true',
        searchTerm: 'fuel',
      };

      await controller.getInventory(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventory).toHaveBeenCalledWith(TEST_ORG_ID, {
        fleetId: TEST_FLEET_ID,
        category: InventoryCategory.FUEL,
        status: StockStatus.LOW,
        managerId: undefined,
        lowStockOnly: true,
        criticalOnly: false,
        searchTerm: 'fuel',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockItems);
    });

    it('should handle criticalOnly filter', async () => {
      mockInventoryService.getInventory = jest.fn().mockResolvedValue([]);
      mockRequest.query = {
        fleetId: TEST_FLEET_ID,
        criticalOnly: 'true',
      };

      await controller.getInventory(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventory).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.objectContaining({
          criticalOnly: true,
          lowStockOnly: false,
        })
      );
    });

    it('should handle errors when getting inventory', async () => {
      const error = new Error('Query failed');
      mockInventoryService.getInventory = jest.fn().mockRejectedValue(error);

      await controller.getInventory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Query failed' })
      );
    });
  });

  describe('getInventoryItem', () => {
    it('should get inventory item by id', async () => {
      const mockItem = {
        id: 'inv-1',
        fleetId: TEST_FLEET_ID,
        itemName: 'Missiles',
        category: InventoryCategory.AMMUNITION,
      };

      mockInventoryService.getInventoryItemById = jest.fn().mockResolvedValue(mockItem);
      mockRequest.params = { id: 'inv-1' };

      await controller.getInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventoryItemById).toHaveBeenCalledWith(TEST_ORG_ID, 'inv-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockItem);
    });

    it('should return 404 when item not found', async () => {
      mockInventoryService.getInventoryItemById = jest.fn().mockResolvedValue(null);
      mockRequest.params = { id: 'invalid-id' };

      await controller.getInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Inventory item not found' })
      );
    });

    it('should handle errors when getting item', async () => {
      const error = new Error('Database error');
      mockInventoryService.getInventoryItemById = jest.fn().mockRejectedValue(error);
      mockRequest.params = { id: 'inv-1' };

      await controller.getInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' })
      );
    });
  });

  // ==================== UPDATE ====================

  describe('updateInventoryItem', () => {
    it('should update inventory item successfully', async () => {
      const updateDto = {
        itemName: 'Updated Fuel',
        quantity: 1500,
        thresholds: {
          criticalLevel: 150,
          lowLevel: 400,
          targetLevel: 1000,
          maxLevel: 2000,
        },
      };

      const mockUpdatedItem = {
        id: 'inv-1',
        fleetId: TEST_FLEET_ID,
        ...updateDto,
        status: StockStatus.ADEQUATE,
      };

      mockInventoryService.updateInventoryItem = jest.fn().mockResolvedValue(mockUpdatedItem);
      mockRequest.params = { id: 'inv-1' };
      mockRequest.body = updateDto;

      await controller.updateInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.updateInventoryItem).toHaveBeenCalledWith(
        TEST_ORG_ID,
        'inv-1',
        updateDto
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedItem);
    });

    it('should handle errors when updating item', async () => {
      const error = new Error('Update failed');
      mockInventoryService.updateInventoryItem = jest.fn().mockRejectedValue(error);
      mockRequest.params = { id: 'inv-1' };
      mockRequest.body = { quantity: 500 };

      await controller.updateInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Update failed' })
      );
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock successfully', async () => {
      const adjustmentDto = {
        adjustment: 500,
        reason: 'Restocked from supplier',
        performedBy: 'user-1',
      };

      const mockAdjustedItem = {
        id: 'inv-1',
        fleetId: TEST_FLEET_ID,
        itemName: 'Fuel',
        quantity: 1500,
        status: StockStatus.ADEQUATE,
      };

      mockInventoryService.adjustStock = jest.fn().mockResolvedValue(mockAdjustedItem);
      mockRequest.params = { id: 'inv-1' };
      mockRequest.body = adjustmentDto;

      await controller.adjustStock(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(
        TEST_ORG_ID,
        'inv-1',
        adjustmentDto
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockAdjustedItem);
    });

    it('should handle negative stock adjustment', async () => {
      const adjustmentDto = {
        adjustment: -200,
        reason: 'Used in mission',
        performedBy: 'user-1',
      };

      const mockAdjustedItem = {
        id: 'inv-1',
        quantity: 800,
        status: StockStatus.LOW,
      };

      mockInventoryService.adjustStock = jest.fn().mockResolvedValue(mockAdjustedItem);
      mockRequest.params = { id: 'inv-1' };
      mockRequest.body = adjustmentDto;

      await controller.adjustStock(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(
        TEST_ORG_ID,
        'inv-1',
        adjustmentDto
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockAdjustedItem);
    });

    it('should handle errors when adjusting stock', async () => {
      const error = new Error('Adjustment failed');
      mockInventoryService.adjustStock = jest.fn().mockRejectedValue(error);
      mockRequest.params = { id: 'inv-1' };
      mockRequest.body = { adjustment: 100 };

      await controller.adjustStock(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Adjustment failed' })
      );
    });
  });

  // ==================== DELETE ====================

  describe('deleteInventoryItem', () => {
    it('should delete inventory item successfully', async () => {
      mockInventoryService.deleteInventoryItem = jest.fn().mockResolvedValue(undefined);
      mockRequest.params = { id: 'inv-1' };

      await controller.deleteInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.deleteInventoryItem).toHaveBeenCalledWith(TEST_ORG_ID, 'inv-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Inventory item deleted successfully',
      });
    });

    it('should handle errors when deleting item', async () => {
      const error = new Error('Delete failed');
      mockInventoryService.deleteInventoryItem = jest.fn().mockRejectedValue(error);
      mockRequest.params = { id: 'inv-1' };

      await controller.deleteInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Delete failed' })
      );
    });
  });

  // ==================== STATISTICS & REPORTS ====================

  describe('getInventoryStatistics', () => {
    it('should get inventory statistics for fleet', async () => {
      const mockStats = {
        totalItems: 150,
        totalValue: 1250000,
        itemsByCategory: {
          fuel: 30,
          ammunition: 25,
          medical: 20,
        },
        stockByStatus: {
          adequate: 120,
          low: 20,
          critical: 8,
          out_of_stock: 2,
        },
        averageStockLevel: 75.5,
      };

      mockInventoryService.getInventoryStatistics = jest.fn().mockResolvedValue(mockStats);
      mockRequest.params = { fleetId: TEST_FLEET_ID };

      await controller.getInventoryStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventoryStatistics).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_FLEET_ID
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockStats);
    });

    it('should handle errors when getting statistics', async () => {
      const error = new Error('Stats query failed');
      mockInventoryService.getInventoryStatistics = jest.fn().mockRejectedValue(error);
      mockRequest.params = { fleetId: TEST_FLEET_ID };

      await controller.getInventoryStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Stats query failed' })
      );
    });
  });

  describe('getInventoryByCategory', () => {
    it('should get inventory grouped by category', async () => {
      const mockCategoryData = {
        fuel: [{ id: 'inv-1', itemName: 'Quantum Fuel', quantity: 1000 }],
        ammunition: [
          { id: 'inv-2', itemName: 'Missiles', quantity: 50 },
          { id: 'inv-3', itemName: 'Torpedoes', quantity: 20 },
        ],
        medical: [{ id: 'inv-4', itemName: 'Med Pens', quantity: 100 }],
      };

      mockInventoryService.getInventoryByCategory = jest.fn().mockResolvedValue(mockCategoryData);
      mockRequest.params = { fleetId: TEST_FLEET_ID };

      await controller.getInventoryByCategory(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventoryByCategory).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_FLEET_ID
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockCategoryData);
    });

    it('should handle errors when getting inventory by category', async () => {
      const error = new Error('Category query failed');
      mockInventoryService.getInventoryByCategory = jest.fn().mockRejectedValue(error);
      mockRequest.params = { fleetId: TEST_FLEET_ID };

      await controller.getInventoryByCategory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Category query failed' })
      );
    });
  });

  describe('getLowStockReport', () => {
    it('should get low stock report for fleet', async () => {
      const mockReport = {
        critical: [
          {
            id: 'inv-1',
            itemName: 'Quantum Fuel',
            quantity: 50,
            thresholds: { criticalLevel: 100 },
            status: StockStatus.CRITICAL,
          },
        ],
        low: [
          {
            id: 'inv-2',
            itemName: 'Missiles',
            quantity: 25,
            thresholds: { lowLevel: 30 },
            status: StockStatus.LOW,
          },
        ],
        summary: {
          totalCritical: 1,
          totalLow: 1,
          estimatedReplenishmentCost: 15000,
        },
      };

      mockInventoryService.getLowStockReport = jest.fn().mockResolvedValue(mockReport);
      mockRequest.params = { fleetId: TEST_FLEET_ID };

      await controller.getLowStockReport(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getLowStockReport).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_FLEET_ID
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockReport);
    });

    it('should handle errors when getting low stock report', async () => {
      const error = new Error('Report generation failed');
      mockInventoryService.getLowStockReport = jest.fn().mockRejectedValue(error);
      mockRequest.params = { fleetId: TEST_FLEET_ID };

      await controller.getLowStockReport(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Report generation failed' })
      );
    });
  });
});
