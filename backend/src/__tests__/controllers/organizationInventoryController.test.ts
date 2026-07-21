import { Request, Response } from 'express';

import { OrganizationInventoryController } from '../../controllers/organizationInventoryController';
import { OrganizationInventoryCategory } from '../../models/OrganizationInventory';
import { OrganizationInventoryService } from '../../services/organization/OrganizationInventoryService';

// Mock dependencies
jest.mock('../../services/organization/OrganizationInventoryService');
const TEST_ORG_ID = 'org-123';

describe('OrganizationInventoryController', () => {
  let controller: OrganizationInventoryController;
  let mockInventoryService: jest.Mocked<OrganizationInventoryService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockInventoryService =
      new OrganizationInventoryService() as jest.Mocked<OrganizationInventoryService>;
    controller = new OrganizationInventoryController();
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
        itemName: 'Anvil Gladius',
        description: 'Light fighter',
        category: OrganizationInventoryCategory.SHIPS,
        quantity: 3,
        unitValue: 900000,
        location: 'Port Olisar',
      };

      const mockItem = {
        id: 'inv-1',
        ...dto,
        organizationId: TEST_ORG_ID,
        totalValue: 2700000,
      };

      mockInventoryService.createInventoryItem = jest.fn().mockResolvedValue(mockItem);
      mockRequest.params = { orgId: TEST_ORG_ID };
      mockRequest.body = dto;

      await controller.createInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.createInventoryItem).toHaveBeenCalledWith(TEST_ORG_ID, dto);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockItem);
    });

    it('should handle errors when creating inventory item', async () => {
      const error = new Error('Database error');
      mockInventoryService.createInventoryItem = jest.fn().mockRejectedValue(error);
      mockRequest.params = { orgId: TEST_ORG_ID };
      mockRequest.body = { itemName: 'Test Item', category: OrganizationInventoryCategory.SHIPS };

      await controller.createInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' })
      );
    });
  });

  // ==================== READ ====================

  describe('getInventory', () => {
    it('should get inventory with pagination', async () => {
      const mockResult = {
        items: [
          {
            id: 'inv-1',
            itemName: 'Carrack',
            category: OrganizationInventoryCategory.SHIPS,
            quantity: 1,
            unitValue: 30000000,
            totalValue: 30000000,
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockInventoryService.getInventory = jest.fn().mockResolvedValue(mockResult);
      mockRequest.params = { orgId: TEST_ORG_ID };
      mockRequest.query = { page: '1', limit: '50' };

      await controller.getInventory(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventory).toHaveBeenCalledWith(TEST_ORG_ID, {
        category: undefined,
        searchTerm: undefined,
        assignedTo: undefined,
        page: 1,
        limit: 50,
        sortBy: undefined,
        sortOrder: undefined,
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should filter by category', async () => {
      const mockResult = {
        items: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };

      mockInventoryService.getInventory = jest.fn().mockResolvedValue(mockResult);
      mockRequest.params = { orgId: TEST_ORG_ID };
      mockRequest.query = { category: OrganizationInventoryCategory.COMPONENTS };

      await controller.getInventory(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventory).toHaveBeenCalledWith(
        TEST_ORG_ID,
        expect.objectContaining({ category: OrganizationInventoryCategory.COMPONENTS })
      );
    });
  });

  describe('getInventoryItem', () => {
    it('should get inventory item by ID', async () => {
      const mockItem = {
        id: 'inv-1',
        itemName: 'Quantum Drive',
        organizationId: TEST_ORG_ID,
        category: OrganizationInventoryCategory.COMPONENTS,
      };

      mockInventoryService.getInventoryItemById = jest.fn().mockResolvedValue(mockItem);
      mockRequest.params = { orgId: TEST_ORG_ID, id: 'inv-1' };

      await controller.getInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventoryItemById).toHaveBeenCalledWith(TEST_ORG_ID, 'inv-1');
      expect(mockResponse.json).toHaveBeenCalledWith(mockItem);
    });

    it('should throw NotFoundError if item not found', async () => {
      mockInventoryService.getInventoryItemById = jest.fn().mockResolvedValue(null);
      mockRequest.params = { orgId: TEST_ORG_ID, id: 'non-existent' };

      await controller.getInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== UPDATE ====================

  describe('updateInventoryItem', () => {
    it('should update inventory item successfully', async () => {
      const updateDto = { quantity: 10, unitValue: 1000000 };
      const mockUpdatedItem = {
        id: 'inv-1',
        itemName: 'Gladius',
        quantity: 10,
        unitValue: 1000000,
        totalValue: 10000000,
      };

      mockInventoryService.updateInventoryItem = jest.fn().mockResolvedValue(mockUpdatedItem);
      mockRequest.params = { orgId: TEST_ORG_ID, id: 'inv-1' };
      mockRequest.body = updateDto;

      await controller.updateInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.updateInventoryItem).toHaveBeenCalledWith(
        TEST_ORG_ID,
        'inv-1',
        updateDto
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedItem);
    });

    it('should handle update errors', async () => {
      const error = new Error('Organization inventory item non-existent not found');
      mockInventoryService.updateInventoryItem = jest.fn().mockRejectedValue(error);
      mockRequest.params = { orgId: TEST_ORG_ID, id: 'non-existent' };
      mockRequest.body = { quantity: 5 };

      await controller.updateInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== DELETE ====================

  describe('deleteInventoryItem', () => {
    it('should delete inventory item successfully', async () => {
      mockInventoryService.deleteInventoryItem = jest.fn().mockResolvedValue(undefined);
      mockRequest.params = { orgId: TEST_ORG_ID, id: 'inv-1' };

      await controller.deleteInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.deleteInventoryItem).toHaveBeenCalledWith(TEST_ORG_ID, 'inv-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Organization inventory item deleted successfully',
      });
    });

    it('should handle delete errors', async () => {
      const error = new Error('Organization inventory item non-existent not found');
      mockInventoryService.deleteInventoryItem = jest.fn().mockRejectedValue(error);
      mockRequest.params = { orgId: TEST_ORG_ID, id: 'non-existent' };

      await controller.deleteInventoryItem(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== STATISTICS ====================

  describe('getInventoryStatistics', () => {
    it('should get inventory statistics', async () => {
      const mockStats = {
        totalItems: 10,
        totalValue: 50000000,
        byCategory: {
          ships: { count: 5, value: 40000000 },
          components: { count: 3, value: 8000000 },
          commodities: { count: 2, value: 2000000 },
        },
      };

      mockInventoryService.getInventoryStatistics = jest.fn().mockResolvedValue(mockStats);
      mockRequest.params = { orgId: TEST_ORG_ID };

      await controller.getInventoryStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockInventoryService.getInventoryStatistics).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(mockResponse.json).toHaveBeenCalledWith(mockStats);
    });

    it('should handle statistics errors', async () => {
      const error = new Error('Database error');
      mockInventoryService.getInventoryStatistics = jest.fn().mockRejectedValue(error);
      mockRequest.params = { orgId: TEST_ORG_ID };

      await controller.getInventoryStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
