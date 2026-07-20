"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissaryService = void 0;
const data_source_1 = require("../../data-source");
const CommissaryItem_1 = require("../../models/CommissaryItem");
const CommissaryPurchase_1 = require("../../models/CommissaryPurchase");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const TreasuryService_1 = require("./TreasuryService");
class CommissaryService extends TenantService_1.TenantService {
    purchaseRepo = data_source_1.AppDataSource.getRepository(CommissaryPurchase_1.CommissaryPurchase);
    treasuryService;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(CommissaryItem_1.CommissaryItem), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
        this.treasuryService = (0, TreasuryService_1.getTreasuryService)();
    }
    async createItem(organizationId, creatorId, dto) {
        const item = await this.create(organizationId, {
            name: dto.name,
            description: dto.description,
            price: dto.price,
            category: dto.category,
            stock: dto.stock ?? -1,
            imageUrl: dto.imageUrl,
            metadata: dto.metadata,
            createdBy: creatorId,
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: creatorId,
            resource: `commissary/${item.id}`,
            action: 'commissary_item_created',
            message: `Commissary item created: ${item.name} (${item.price})`,
            metadata: { organizationId, itemId: item.id },
        });
        logger_1.logger.info('Commissary item created', { organizationId, itemId: item.id, name: item.name });
        return item;
    }
    async getItemById(organizationId, itemId) {
        return this.repository.findOne({
            where: { id: itemId, organizationId },
        });
    }
    async listItems(organizationId, pagination, filters) {
        const qb = this.repository
            .createQueryBuilder('item')
            .where('item."organizationId" = :orgId', { orgId: organizationId });
        if (filters?.activeOnly !== false) {
            qb.andWhere('item."isActive" = true');
        }
        if (filters?.category) {
            qb.andWhere('item.category = :category', { category: filters.category });
        }
        if (filters?.searchTerm) {
            qb.andWhere('(item.name ILIKE :term OR item.description ILIKE :term)', {
                term: `%${filters.searchTerm}%`,
            });
        }
        let sortBy = 'item."createdAt"';
        if (filters?.sortBy === 'price') {
            sortBy = 'item.price';
        }
        else if (filters?.sortBy === 'name') {
            sortBy = 'item.name';
        }
        const sortOrder = filters?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
        qb.orderBy(sortBy, sortOrder);
        const page = pagination.page ?? 1;
        const limit = pagination.limit ?? 20;
        qb.skip((page - 1) * limit).take(limit);
        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async updateItem(organizationId, itemId, dto) {
        const item = await this.getItemById(organizationId, itemId);
        if (!item) {
            throw new apiErrors_1.NotFoundError('Commissary item');
        }
        if (dto.name !== undefined) {
            item.name = dto.name;
        }
        if (dto.description !== undefined) {
            item.description = dto.description;
        }
        if (dto.price !== undefined) {
            item.price = dto.price;
        }
        if (dto.category !== undefined) {
            item.category = dto.category;
        }
        if (dto.stock !== undefined) {
            item.stock = dto.stock;
        }
        if (dto.isActive !== undefined) {
            item.isActive = dto.isActive;
        }
        if (dto.imageUrl !== undefined) {
            item.imageUrl = dto.imageUrl;
        }
        if (dto.metadata !== undefined) {
            item.metadata = dto.metadata;
        }
        return this.repository.save(item);
    }
    async deleteItem(organizationId, itemId) {
        const item = await this.getItemById(organizationId, itemId);
        if (!item) {
            throw new apiErrors_1.NotFoundError('Commissary item');
        }
        await this.repository.remove(item);
        logger_1.logger.info('Commissary item deleted', { organizationId, itemId });
    }
    async purchaseItem(organizationId, buyerId, dto) {
        const item = await this.repository.findOne({
            where: { id: dto.itemId, organizationId },
        });
        if (!item) {
            throw new apiErrors_1.NotFoundError('Commissary item');
        }
        if (!item.isActive) {
            throw new apiErrors_1.ValidationError('Item is no longer available');
        }
        if (item.stock !== -1 && item.stock < dto.quantity) {
            throw new apiErrors_1.ValidationError(`Insufficient stock. Available: ${item.stock}, Requested: ${dto.quantity}`);
        }
        const totalPrice = Number(item.price) * dto.quantity;
        const creditTxn = await this.treasuryService.spendCredits(organizationId, buyerId, {
            amount: totalPrice,
            purpose: `Commissary: ${item.name} x${dto.quantity}`,
            category: 'purchase',
            metadata: { itemId: item.id, itemName: item.name, quantity: dto.quantity },
        });
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const lockedItem = await queryRunner.manager.findOne(CommissaryItem_1.CommissaryItem, {
                where: { id: dto.itemId, organizationId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!lockedItem?.isActive) {
                throw new apiErrors_1.ValidationError('Item is no longer available');
            }
            if (lockedItem.stock !== -1 && lockedItem.stock < dto.quantity) {
                throw new apiErrors_1.ValidationError(`Insufficient stock. Available: ${lockedItem.stock}, Requested: ${dto.quantity}`);
            }
            if (lockedItem.stock !== -1) {
                lockedItem.stock -= dto.quantity;
                await queryRunner.manager.save(lockedItem);
            }
            const purchase = queryRunner.manager.create(CommissaryPurchase_1.CommissaryPurchase, {
                organizationId,
                itemId: lockedItem.id,
                buyerId,
                quantity: dto.quantity,
                totalPrice,
                transactionId: creditTxn.id,
            });
            const saved = await queryRunner.manager.save(purchase);
            await queryRunner.commitTransaction();
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: buyerId,
                resource: `commissary/${lockedItem.id}/purchase/${saved.id}`,
                action: 'commissary_purchased',
                message: `Purchased ${dto.quantity}x ${lockedItem.name} for ${totalPrice}`,
                metadata: { organizationId, itemId: lockedItem.id, purchaseId: saved.id },
            });
            (0, websocketServer_1.emitToOrganization)(organizationId, 'commissary:purchased', {
                itemId: lockedItem.id,
                buyerId,
                quantity: dto.quantity,
                totalPrice,
            });
            logger_1.logger.info('Commissary purchase completed', {
                organizationId,
                itemId: lockedItem.id,
                buyerId,
                quantity: dto.quantity,
                totalPrice,
            });
            return saved;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            try {
                await this.treasuryService.earnCredits(organizationId, 'system', {
                    amount: totalPrice,
                    source: `Refund: ${item.name} x${dto.quantity} (purchase failed)`,
                    category: 'refund',
                    metadata: {
                        originalTransactionId: creditTxn.id,
                        itemId: item.id,
                        reason: String(error),
                    },
                });
                logger_1.logger.warn('Commissary purchase failed — credits refunded', {
                    organizationId,
                    itemId: item.id,
                    amount: totalPrice,
                });
            }
            catch (refundError) {
                logger_1.logger.error('CRITICAL: Commissary refund failed — manual intervention required', {
                    organizationId,
                    buyerId,
                    itemId: item.id,
                    amount: totalPrice,
                    originalTransactionId: creditTxn.id,
                    refundError: String(refundError),
                });
            }
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getPurchaseHistory(organizationId, pagination, buyerId) {
        const qb = this.purchaseRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.item', 'item')
            .where('p."organizationId" = :orgId', { orgId: organizationId });
        if (buyerId) {
            qb.andWhere('p."buyerId" = :buyerId', { buyerId });
        }
        qb.orderBy('p."createdAt"', 'DESC');
        const page = pagination.page ?? 1;
        const limit = pagination.limit ?? 20;
        qb.skip((page - 1) * limit).take(limit);
        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
}
exports.CommissaryService = CommissaryService;
//# sourceMappingURL=CommissaryService.js.map