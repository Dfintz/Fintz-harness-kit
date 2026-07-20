"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationInventoryService = void 0;
const data_source_1 = require("../../data-source");
const OrganizationInventory_1 = require("../../models/OrganizationInventory");
const logger_1 = require("../../utils/logger");
class OrganizationInventoryService {
    inventoryRepository;
    static DEFAULT_SORT_BY = 'createdAt';
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 50;
    static ALLOWED_SORT_FIELDS = ['itemName', 'quantity', 'totalValue', 'category', 'createdAt', 'updatedAt'];
    constructor() {
        this.inventoryRepository = data_source_1.AppDataSource.getRepository(OrganizationInventory_1.OrganizationInventory);
    }
    async createInventoryItem(organizationId, dto) {
        try {
            const totalValue = dto.unitValue * dto.quantity;
            const item = this.inventoryRepository.create({
                ...dto,
                organizationId,
                totalValue
            });
            const savedItem = await this.inventoryRepository.save(item);
            logger_1.logger.info(`Created organization inventory item: ${savedItem.id} - ${savedItem.itemName}`, { organizationId });
            return savedItem;
        }
        catch (error) {
            logger_1.logger.error('Error creating organization inventory item:', error);
            throw error;
        }
    }
    async getInventory(organizationId, filters = {}) {
        try {
            const queryBuilder = this.inventoryRepository.createQueryBuilder('inventory');
            queryBuilder.andWhere('inventory.organizationId = :organizationId', { organizationId });
            if (filters.category) {
                if (Array.isArray(filters.category)) {
                    queryBuilder.andWhere('inventory.category IN (:...categories)', { categories: filters.category });
                }
                else {
                    queryBuilder.andWhere('inventory.category = :category', { category: filters.category });
                }
            }
            if (filters.searchTerm) {
                queryBuilder.andWhere('(inventory.itemName ILIKE :search OR inventory.description ILIKE :search OR inventory.notes ILIKE :search)', { search: `%${filters.searchTerm}%` });
            }
            if (filters.assignedTo) {
                queryBuilder.andWhere('inventory.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
            }
            const sortBy = filters.sortBy && OrganizationInventoryService.ALLOWED_SORT_FIELDS.includes(filters.sortBy)
                ? filters.sortBy
                : OrganizationInventoryService.DEFAULT_SORT_BY;
            const sortOrder = filters.sortOrder || 'DESC';
            queryBuilder.orderBy(`inventory.${sortBy}`, sortOrder);
            const page = filters.page || OrganizationInventoryService.DEFAULT_PAGE;
            const limit = filters.limit || OrganizationInventoryService.DEFAULT_LIMIT;
            const skip = (page - 1) * limit;
            const total = await queryBuilder.getCount();
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
        }
        catch (error) {
            logger_1.logger.error('Error getting organization inventory:', error);
            throw error;
        }
    }
    async getInventoryItemById(organizationId, id) {
        try {
            const item = await this.inventoryRepository.findOne({
                where: { id, organizationId }
            });
            return item;
        }
        catch (error) {
            logger_1.logger.error(`Error getting organization inventory item ${id}:`, error);
            throw error;
        }
    }
    async updateInventoryItem(organizationId, id, dto) {
        try {
            const item = await this.inventoryRepository.findOne({
                where: { id, organizationId }
            });
            if (!item) {
                throw new Error(`Organization inventory item ${id} not found`);
            }
            Object.assign(item, dto);
            if (dto.quantity !== undefined || dto.unitValue !== undefined) {
                item.totalValue = item.unitValue * item.quantity;
            }
            const updatedItem = await this.inventoryRepository.save(item);
            logger_1.logger.info(`Updated organization inventory item: ${id}`, { organizationId });
            return updatedItem;
        }
        catch (error) {
            logger_1.logger.error(`Error updating organization inventory item ${id}:`, error);
            throw error;
        }
    }
    async deleteInventoryItem(organizationId, id) {
        try {
            const result = await this.inventoryRepository.delete({ id, organizationId });
            if (result.affected === 0) {
                throw new Error(`Organization inventory item ${id} not found`);
            }
            logger_1.logger.info(`Deleted organization inventory item: ${id}`, { organizationId });
        }
        catch (error) {
            logger_1.logger.error(`Error deleting organization inventory item ${id}:`, error);
            throw error;
        }
    }
    async getInventoryStatistics(organizationId) {
        try {
            const totalItems = await this.inventoryRepository.count({
                where: { organizationId }
            });
            const totalValueResult = await this.inventoryRepository
                .createQueryBuilder('inventory')
                .select('SUM(inventory.totalValue)', 'total')
                .where('inventory.organizationId = :organizationId', { organizationId })
                .getRawOne();
            const totalValue = Number(totalValueResult?.total || 0);
            const categoryResults = await this.inventoryRepository
                .createQueryBuilder('inventory')
                .select('inventory.category', 'category')
                .addSelect('COUNT(*)', 'count')
                .addSelect('SUM(inventory.totalValue)', 'value')
                .where('inventory.organizationId = :organizationId', { organizationId })
                .groupBy('inventory.category')
                .getRawMany();
            const stats = {
                totalItems,
                totalValue,
                byCategory: {
                    ships: { count: 0, value: 0 },
                    components: { count: 0, value: 0 },
                    commodities: { count: 0, value: 0 }
                }
            };
            categoryResults.forEach((result) => {
                const category = result.category;
                const count = parseInt(result.count, 10);
                const value = Number(result.value);
                if (category === OrganizationInventory_1.OrganizationInventoryCategory.SHIPS) {
                    stats.byCategory.ships = { count, value };
                }
                else if (category === OrganizationInventory_1.OrganizationInventoryCategory.COMPONENTS) {
                    stats.byCategory.components = { count, value };
                }
                else if (category === OrganizationInventory_1.OrganizationInventoryCategory.COMMODITIES) {
                    stats.byCategory.commodities = { count, value };
                }
            });
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Error getting organization inventory statistics:', error);
            throw error;
        }
    }
    async getTotalInventoryValue(organizationId) {
        try {
            const result = await this.inventoryRepository
                .createQueryBuilder('inventory')
                .select('SUM(inventory.totalValue)', 'total')
                .where('inventory.organizationId = :organizationId', { organizationId })
                .getRawOne();
            return Number(result?.total || 0);
        }
        catch (error) {
            logger_1.logger.error('Error getting total inventory value:', error);
            throw error;
        }
    }
    async getInventoryItemCount(organizationId) {
        try {
            return await this.inventoryRepository.count({
                where: { organizationId }
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting inventory item count:', error);
            throw error;
        }
    }
}
exports.OrganizationInventoryService = OrganizationInventoryService;
//# sourceMappingURL=OrganizationInventoryService.js.map