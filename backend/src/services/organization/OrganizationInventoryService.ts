import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { 
    OrganizationInventory, 
    CreateOrganizationInventoryDto, 
    UpdateOrganizationInventoryDto,
    OrganizationInventoryFilterOptions,
    OrganizationInventoryStatistics,
    OrganizationInventoryCategory
} from '../../models/OrganizationInventory';
import { logger } from '../../utils/logger';

/**
 * Service for managing organization inventory
 * Handles CRUD operations and statistics for organization-owned items
 * 
 * Multi-tenancy: All operations are scoped to organizationId
 */
export class OrganizationInventoryService {
    private inventoryRepository: Repository<OrganizationInventory>;

    // Constants for default values
    private static readonly DEFAULT_SORT_BY = 'createdAt';
    private static readonly DEFAULT_PAGE = 1;
    private static readonly DEFAULT_LIMIT = 50;
    private static readonly ALLOWED_SORT_FIELDS = ['itemName', 'quantity', 'totalValue', 'category', 'createdAt', 'updatedAt'];

    constructor() {
        this.inventoryRepository = AppDataSource.getRepository(OrganizationInventory);
    }

    /**
     * Create a new inventory item
     * @param organizationId - Organization (tenant) ID
     * @param dto - Inventory item creation data
     */
    async createInventoryItem(organizationId: string, dto: CreateOrganizationInventoryDto): Promise<OrganizationInventory> {
        try {
            const totalValue = dto.unitValue * dto.quantity;
            
            const item = this.inventoryRepository.create({
                ...dto,
                organizationId,
                totalValue
            });

            const savedItem = await this.inventoryRepository.save(item);
            logger.info(`Created organization inventory item: ${savedItem.id} - ${savedItem.itemName}`, { organizationId });
            return savedItem;
        } catch (error: unknown) {
            logger.error('Error creating organization inventory item:', error);
            throw error;
        }
    }

    /**
     * Get inventory items with filtering and pagination
     * @param organizationId - Organization (tenant) ID
     * @param filters - Filter options including pagination
     */
    async getInventory(organizationId: string, filters: OrganizationInventoryFilterOptions = {}): Promise<{
        items: OrganizationInventory[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }> {
        try {
            const queryBuilder = this.inventoryRepository.createQueryBuilder('inventory');
            
            // Always filter by organization
            queryBuilder.andWhere('inventory.organizationId = :organizationId', { organizationId });

            // Apply category filter
            if (filters.category) {
                if (Array.isArray(filters.category)) {
                    queryBuilder.andWhere('inventory.category IN (:...categories)', { categories: filters.category });
                } else {
                    queryBuilder.andWhere('inventory.category = :category', { category: filters.category });
                }
            }

            // Apply search filter
            if (filters.searchTerm) {
                queryBuilder.andWhere(
                    '(inventory.itemName ILIKE :search OR inventory.description ILIKE :search OR inventory.notes ILIKE :search)',
                    { search: `%${filters.searchTerm}%` }
                );
            }

            // Apply assignedTo filter
            if (filters.assignedTo) {
                queryBuilder.andWhere('inventory.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
            }

            // Apply sorting with whitelist validation for SQL injection prevention
            const sortBy = filters.sortBy && OrganizationInventoryService.ALLOWED_SORT_FIELDS.includes(filters.sortBy) 
                ? filters.sortBy 
                : OrganizationInventoryService.DEFAULT_SORT_BY;
            const sortOrder = filters.sortOrder || 'DESC';
            queryBuilder.orderBy(`inventory.${sortBy}`, sortOrder);

            // Apply pagination
            const page = filters.page || OrganizationInventoryService.DEFAULT_PAGE;
            const limit = filters.limit || OrganizationInventoryService.DEFAULT_LIMIT;
            const skip = (page - 1) * limit;

            // Get total count before pagination
            const total = await queryBuilder.getCount();

            // Apply pagination
            queryBuilder.skip(skip).take(limit);

            const items = await queryBuilder.getMany();
            const totalPages = Math.ceil(total / limit);

            return {
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };
        } catch (error: unknown) {
            logger.error('Error getting organization inventory:', error);
            throw error;
        }
    }

    /**
     * Get inventory item by ID
     * @param organizationId - Organization (tenant) ID
     * @param id - Inventory item ID
     */
    async getInventoryItemById(organizationId: string, id: string): Promise<OrganizationInventory | null> {
        try {
            const item = await this.inventoryRepository.findOne({ 
                where: { id, organizationId } 
            });
            return item;
        } catch (error: unknown) {
            logger.error(`Error getting organization inventory item ${id}:`, error);
            throw error;
        }
    }

    /**
     * Update inventory item
     * @param organizationId - Organization (tenant) ID
     * @param id - Inventory item ID
     * @param dto - Update data
     */
    async updateInventoryItem(organizationId: string, id: string, dto: UpdateOrganizationInventoryDto): Promise<OrganizationInventory> {
        try {
            const item = await this.inventoryRepository.findOne({ 
                where: { id, organizationId } 
            });

            if (!item) {
                throw new Error(`Organization inventory item ${id} not found`);
            }

            Object.assign(item, dto);

            // Recalculate total value if quantity or unitValue changed
            if (dto.quantity !== undefined || dto.unitValue !== undefined) {
                item.totalValue = item.unitValue * item.quantity;
            }

            const updatedItem = await this.inventoryRepository.save(item);
            logger.info(`Updated organization inventory item: ${id}`, { organizationId });
            return updatedItem;
        } catch (error: unknown) {
            logger.error(`Error updating organization inventory item ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete inventory item
     * @param organizationId - Organization (tenant) ID
     * @param id - Inventory item ID
     */
    async deleteInventoryItem(organizationId: string, id: string): Promise<void> {
        try {
            const result = await this.inventoryRepository.delete({ id, organizationId });
            
            if (result.affected === 0) {
                throw new Error(`Organization inventory item ${id} not found`);
            }

            logger.info(`Deleted organization inventory item: ${id}`, { organizationId });
        } catch (error: unknown) {
            logger.error(`Error deleting organization inventory item ${id}:`, error);
            throw error;
        }
    }

    /**
     * Get inventory statistics
     * @param organizationId - Organization (tenant) ID
     */
    async getInventoryStatistics(organizationId: string): Promise<OrganizationInventoryStatistics> {
        try {
            // Get total count
            const totalItems = await this.inventoryRepository.count({ 
                where: { organizationId } 
            });

            // Get total value using aggregation
            const totalValueResult = await this.inventoryRepository
                .createQueryBuilder('inventory')
                .select('SUM(inventory.totalValue)', 'total')
                .where('inventory.organizationId = :organizationId', { organizationId })
                .getRawOne();

            const totalValue = Number(totalValueResult?.total || 0);

            // Get category breakdown using aggregation
            const categoryResults = await this.inventoryRepository
                .createQueryBuilder('inventory')
                .select('inventory.category', 'category')
                .addSelect('COUNT(*)', 'count')
                .addSelect('SUM(inventory.totalValue)', 'value')
                .where('inventory.organizationId = :organizationId', { organizationId })
                .groupBy('inventory.category')
                .getRawMany();

            const stats: OrganizationInventoryStatistics = {
                totalItems,
                totalValue,
                byCategory: {
                    ships: { count: 0, value: 0 },
                    components: { count: 0, value: 0 },
                    commodities: { count: 0, value: 0 }
                }
            };

            // Populate category stats from aggregation results
            categoryResults.forEach((result: { category: string; count: string; value: string }) => {
                const category = result.category as OrganizationInventoryCategory;
                const count = parseInt(result.count, 10);
                const value = Number(result.value);

                if (category === OrganizationInventoryCategory.SHIPS) {
                    stats.byCategory.ships = { count, value };
                } else if (category === OrganizationInventoryCategory.COMPONENTS) {
                    stats.byCategory.components = { count, value };
                } else if (category === OrganizationInventoryCategory.COMMODITIES) {
                    stats.byCategory.commodities = { count, value };
                }
            });

            return stats;
        } catch (error: unknown) {
            logger.error('Error getting organization inventory statistics:', error);
            throw error;
        }
    }

    /**
     * Get total inventory value for an organization
     * @param organizationId - Organization (tenant) ID
     */
    async getTotalInventoryValue(organizationId: string): Promise<number> {
        try {
            const result = await this.inventoryRepository
                .createQueryBuilder('inventory')
                .select('SUM(inventory.totalValue)', 'total')
                .where('inventory.organizationId = :organizationId', { organizationId })
                .getRawOne();

            return Number(result?.total || 0);
        } catch (error: unknown) {
            logger.error('Error getting total inventory value:', error);
            throw error;
        }
    }

    /**
     * Get item count for an organization
     * @param organizationId - Organization (tenant) ID
     */
    async getInventoryItemCount(organizationId: string): Promise<number> {
        try {
            return await this.inventoryRepository.count({ 
                where: { organizationId } 
            });
        } catch (error: unknown) {
            logger.error('Error getting inventory item count:', error);
            throw error;
        }
    }
}

