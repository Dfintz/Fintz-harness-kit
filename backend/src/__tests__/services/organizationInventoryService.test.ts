import { AppDataSource } from '../../config/database';
import { OrganizationInventory, OrganizationInventoryCategory } from '../../models/OrganizationInventory';
import { OrganizationInventoryService } from '../../services/organization/OrganizationInventoryService';

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
    }
}));

const TEST_ORG_ID = 'org-123';

describe('OrganizationInventoryService', () => {
    let service: OrganizationInventoryService;
    let mockInventoryRepository: any;

    beforeEach(() => {
        // Create mock inventory repository
        mockInventoryRepository = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn(),
                getMany: jest.fn(),
                getRawOne: jest.fn()
            }))
        };

        // Mock AppDataSource.getRepository
        (AppDataSource.getRepository as jest.Mock) = jest.fn().mockReturnValue(mockInventoryRepository);

        service = new OrganizationInventoryService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==================== CREATE INVENTORY ITEM ====================
    describe('createInventoryItem', () => {
        it('should create inventory item with correct total value', async () => {
            const dto = {
                itemName: 'Cutlass Black',
                category: OrganizationInventoryCategory.SHIPS,
                quantity: 5,
                unitValue: 1300000,
                description: 'Medium fighter',
                location: 'Port Olisar'
            };

            const expectedItem = {
                ...dto,
                organizationId: TEST_ORG_ID,
                totalValue: 6500000,
                id: 'item-123'
            };

            mockInventoryRepository.create.mockReturnValue(expectedItem);
            mockInventoryRepository.save.mockResolvedValue(expectedItem);

            const result = await service.createInventoryItem(TEST_ORG_ID, dto);

            expect(mockInventoryRepository.create).toHaveBeenCalledWith({
                ...dto,
                organizationId: TEST_ORG_ID,
                totalValue: 6500000
            });
            expect(mockInventoryRepository.save).toHaveBeenCalledWith(expectedItem);
            expect(result).toEqual(expectedItem);
            expect(result.totalValue).toBe(6500000);
        });

        it('should handle creation errors', async () => {
            const dto = {
                itemName: 'Quantum Drive',
                category: OrganizationInventoryCategory.COMPONENTS,
                quantity: 10,
                unitValue: 50000
            };

            mockInventoryRepository.create.mockImplementation(() => {
                throw new Error('Database error');
            });

            await expect(service.createInventoryItem(TEST_ORG_ID, dto)).rejects.toThrow('Database error');
        });
    });

    // ==================== GET INVENTORY ====================
    describe('getInventory', () => {
        it('should get inventory with pagination', async () => {
            const mockItems = [
                { id: '1', itemName: 'Ship 1', category: OrganizationInventoryCategory.SHIPS, totalValue: 1000000 },
                { id: '2', itemName: 'Ship 2', category: OrganizationInventoryCategory.SHIPS, totalValue: 2000000 }
            ];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(2),
                getMany: jest.fn().mockResolvedValue(mockItems)
            };
            
            mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.getInventory(TEST_ORG_ID, { page: 1, limit: 10 });

            expect(result.items).toEqual(mockItems);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1,
                hasNext: false,
                hasPrev: false
            });
        });

        it('should filter by category', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(1),
                getMany: jest.fn().mockResolvedValue([])
            };
            
            mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await service.getInventory(TEST_ORG_ID, { 
                category: OrganizationInventoryCategory.COMPONENTS 
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'inventory.category = :category',
                { category: OrganizationInventoryCategory.COMPONENTS }
            );
        });

        it('should filter by search term', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
                getMany: jest.fn().mockResolvedValue([])
            };
            
            mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await service.getInventory(TEST_ORG_ID, { searchTerm: 'Cutlass' });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                { search: '%Cutlass%' }
            );
        });
    });

    // ==================== GET INVENTORY ITEM BY ID ====================
    describe('getInventoryItemById', () => {
        it('should get item by ID', async () => {
            const mockItem = {
                id: 'item-123',
                itemName: 'Anvil Arrow',
                organizationId: TEST_ORG_ID,
                category: OrganizationInventoryCategory.SHIPS
            };

            mockInventoryRepository.findOne.mockResolvedValue(mockItem);

            const result = await service.getInventoryItemById(TEST_ORG_ID, 'item-123');

            expect(mockInventoryRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'item-123', organizationId: TEST_ORG_ID }
            });
            expect(result).toEqual(mockItem);
        });

        it('should return null if item not found', async () => {
            mockInventoryRepository.findOne.mockResolvedValue(null);

            const result = await service.getInventoryItemById(TEST_ORG_ID, 'non-existent');

            expect(result).toBeNull();
        });
    });

    // ==================== UPDATE INVENTORY ITEM ====================
    describe('updateInventoryItem', () => {
        it('should update item and recalculate total value', async () => {
            const existingItem = {
                id: 'item-123',
                itemName: 'Gladius',
                organizationId: TEST_ORG_ID,
                quantity: 3,
                unitValue: 900000,
                totalValue: 2700000
            };

            const updateDto = {
                quantity: 5,
                unitValue: 950000
            };

            mockInventoryRepository.findOne.mockResolvedValue(existingItem);
            mockInventoryRepository.save.mockImplementation((item) => Promise.resolve(item));

            const result = await service.updateInventoryItem(TEST_ORG_ID, 'item-123', updateDto);

            expect(result.quantity).toBe(5);
            expect(result.unitValue).toBe(950000);
            expect(result.totalValue).toBe(4750000); // 5 * 950000
        });

        it('should throw error if item not found', async () => {
            mockInventoryRepository.findOne.mockResolvedValue(null);

            await expect(
                service.updateInventoryItem(TEST_ORG_ID, 'non-existent', { quantity: 10 })
            ).rejects.toThrow('Organization inventory item non-existent not found');
        });
    });

    // ==================== DELETE INVENTORY ITEM ====================
    describe('deleteInventoryItem', () => {
        it('should delete item', async () => {
            mockInventoryRepository.delete.mockResolvedValue({ affected: 1 });

            await service.deleteInventoryItem(TEST_ORG_ID, 'item-123');

            expect(mockInventoryRepository.delete).toHaveBeenCalledWith({
                id: 'item-123',
                organizationId: TEST_ORG_ID
            });
        });

        it('should throw error if item not found', async () => {
            mockInventoryRepository.delete.mockResolvedValue({ affected: 0 });

            await expect(
                service.deleteInventoryItem(TEST_ORG_ID, 'non-existent')
            ).rejects.toThrow('Organization inventory item non-existent not found');
        });
    });

    // ==================== GET STATISTICS ====================
    describe('getInventoryStatistics', () => {
        it('should calculate statistics correctly using aggregation', async () => {
            // Mock count
            mockInventoryRepository.count.mockResolvedValue(4);

            // Mock total value query
            const totalValueQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: '3060000' })
            };

            // Mock category breakdown query
            const categoryQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { category: OrganizationInventoryCategory.SHIPS, count: '2', value: '3000000' },
                    { category: OrganizationInventoryCategory.COMPONENTS, count: '1', value: '50000' },
                    { category: OrganizationInventoryCategory.COMMODITIES, count: '1', value: '10000' }
                ])
            };

            mockInventoryRepository.createQueryBuilder
                .mockReturnValueOnce(totalValueQueryBuilder)
                .mockReturnValueOnce(categoryQueryBuilder);

            const result = await service.getInventoryStatistics(TEST_ORG_ID);

            expect(result.totalItems).toBe(4);
            expect(result.totalValue).toBe(3060000);
            expect(result.byCategory.ships.count).toBe(2);
            expect(result.byCategory.ships.value).toBe(3000000);
            expect(result.byCategory.components.count).toBe(1);
            expect(result.byCategory.components.value).toBe(50000);
            expect(result.byCategory.commodities.count).toBe(1);
            expect(result.byCategory.commodities.value).toBe(10000);
        });

        it('should handle empty inventory', async () => {
            mockInventoryRepository.count.mockResolvedValue(0);

            const totalValueQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: null })
            };

            const categoryQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([])
            };

            mockInventoryRepository.createQueryBuilder
                .mockReturnValueOnce(totalValueQueryBuilder)
                .mockReturnValueOnce(categoryQueryBuilder);

            const result = await service.getInventoryStatistics(TEST_ORG_ID);

            expect(result.totalItems).toBe(0);
            expect(result.totalValue).toBe(0);
            expect(result.byCategory.ships.count).toBe(0);
            expect(result.byCategory.components.count).toBe(0);
            expect(result.byCategory.commodities.count).toBe(0);
        });
    });

    // ==================== GET TOTAL VALUE ====================
    describe('getTotalInventoryValue', () => {
        it('should return total value', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: '5000000' })
            };
            
            mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.getTotalInventoryValue(TEST_ORG_ID);

            expect(result).toBe(5000000);
            expect(mockQueryBuilder.select).toHaveBeenCalledWith('SUM(inventory.totalValue)', 'total');
        });

        it('should return 0 for empty inventory', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total: null })
            };
            
            mockInventoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.getTotalInventoryValue(TEST_ORG_ID);

            expect(result).toBe(0);
        });
    });

    // ==================== GET ITEM COUNT ====================
    describe('getInventoryItemCount', () => {
        it('should return item count', async () => {
            mockInventoryRepository.count.mockResolvedValue(42);

            const result = await service.getInventoryItemCount(TEST_ORG_ID);

            expect(result).toBe(42);
            expect(mockInventoryRepository.count).toHaveBeenCalledWith({
                where: { organizationId: TEST_ORG_ID }
            });
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
