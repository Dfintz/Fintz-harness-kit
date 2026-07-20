"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const health_1 = require("../../types/health");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
class TenantService {
    repository;
    cache;
    cacheEnabled;
    organizationCacheIndex;
    entityName;
    constructor(repository, options) {
        this.repository = repository;
        this.entityName = repository.metadata.name;
        this.cacheEnabled = options?.enableCache ?? false;
        if (this.cacheEnabled) {
            this.cache = new node_cache_1.default({
                stdTTL: options?.cacheTTL ?? 300,
                checkperiod: options?.cacheCheckPeriod ?? 60,
                useClones: options?.useClones ?? false,
            });
            this.organizationCacheIndex = new Map();
            this.cache.on('expired', (key) => {
                this.removeKeyFromOrganizationIndex(key);
            });
            logger_1.logger.info('Cache enabled for service', {
                entity: this.entityName,
                ttl: options?.cacheTTL ?? 300,
                checkPeriod: options?.cacheCheckPeriod ?? 60,
            });
        }
    }
    getCacheKey(organizationId, id) {
        return `${this.entityName}:${organizationId}:${id}`;
    }
    getListCacheKey(organizationId, suffix) {
        return suffix
            ? `${this.entityName}:${organizationId}:list:${suffix}`
            : `${this.entityName}:${organizationId}:list`;
    }
    getOrganizationIdFromCacheKey(key) {
        const prefix = `${this.entityName}:`;
        if (!key.startsWith(prefix)) {
            return null;
        }
        const parts = key.split(':', 3);
        if (parts.length < 3 || !parts[1]) {
            return null;
        }
        return parts[1];
    }
    addKeyToOrganizationIndex(key) {
        if (!this.organizationCacheIndex) {
            return;
        }
        const organizationId = this.getOrganizationIdFromCacheKey(key);
        if (!organizationId) {
            return;
        }
        const existing = this.organizationCacheIndex.get(organizationId);
        if (existing) {
            existing.add(key);
            return;
        }
        this.organizationCacheIndex.set(organizationId, new Set([key]));
    }
    removeKeyFromOrganizationIndex(key) {
        if (!this.organizationCacheIndex) {
            return;
        }
        const organizationId = this.getOrganizationIdFromCacheKey(key);
        if (!organizationId) {
            return;
        }
        const existing = this.organizationCacheIndex.get(organizationId);
        if (!existing) {
            return;
        }
        existing.delete(key);
        if (existing.size === 0) {
            this.organizationCacheIndex.delete(organizationId);
        }
    }
    getFromCache(key) {
        if (!this.cacheEnabled || !this.cache) {
            return undefined;
        }
        return this.cache.get(key);
    }
    setInCache(key, value, ttl) {
        if (!this.cacheEnabled || !this.cache) {
            return;
        }
        if (ttl) {
            this.cache.set(key, value, ttl);
        }
        else {
            this.cache.set(key, value);
        }
        this.addKeyToOrganizationIndex(key);
        logger_1.logger.debug('Cache set', { key, entity: this.entityName });
    }
    invalidateCache(key) {
        if (!this.cacheEnabled || !this.cache) {
            return;
        }
        this.cache.del(key);
        this.removeKeyFromOrganizationIndex(key);
        logger_1.logger.debug('Cache invalidated', { key, entity: this.entityName });
    }
    invalidateOrgCache(organizationId) {
        if (!this.cacheEnabled || !this.cache || !this.organizationCacheIndex) {
            return;
        }
        const orgKeys = this.organizationCacheIndex.get(organizationId);
        if (!orgKeys || orgKeys.size === 0) {
            return;
        }
        const keys = Array.from(orgKeys);
        const count = this.cache.del(keys);
        this.organizationCacheIndex.delete(organizationId);
        if (count > 0) {
            logger_1.logger.debug('Organization cache invalidated', {
                organizationId,
                entity: this.entityName,
                keysInvalidated: count,
            });
        }
    }
    invalidateAllCache() {
        if (!this.cacheEnabled || !this.cache) {
            return;
        }
        this.cache.flushAll();
        this.organizationCacheIndex?.clear();
        logger_1.logger.debug('All cache invalidated', { entity: this.entityName });
    }
    getCacheStats() {
        if (!this.cacheEnabled || !this.cache) {
            return null;
        }
        return this.cache.getStats();
    }
    getFormattedCacheStats() {
        if (!this.cacheEnabled || !this.cache) {
            return undefined;
        }
        const stats = this.cache.getStats();
        const hitRate = stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0;
        return {
            hits: stats.hits,
            misses: stats.misses,
            keys: stats.keys,
            hitRate: Math.round(hitRate * 100) / 100,
            ksize: stats.ksize,
            vsize: stats.vsize,
        };
    }
    async checkDatabaseConnection() {
        try {
            await this.repository.query('SELECT 1');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Database health check failed', {
                entity: this.entityName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    async withTransaction(callback) {
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        logger_1.logger.debug('Transaction started', { entity: this.entityName });
        try {
            const result = await callback(queryRunner);
            await queryRunner.commitTransaction();
            logger_1.logger.debug('Transaction committed', { entity: this.entityName });
            return result;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Transaction rolled back', {
                entity: this.entityName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async withEntityLock(id, callback, options) {
        return this.withTransaction(async (queryRunner) => {
            const primaryColumn = this.repository.metadata.primaryColumns[0].propertyName;
            const entity = await queryRunner.manager
                .getRepository(this.repository.target)
                .createQueryBuilder('entity')
                .where(`entity.${primaryColumn} = :id`, { id })
                .setLock('pessimistic_write')
                .getOne();
            if (!entity) {
                throw options?.onNotFound?.() ?? new apiErrors_1.NotFoundError(this.entityName, id);
            }
            return callback(entity, queryRunner);
        });
    }
    async healthCheck() {
        const startTime = Date.now();
        const databaseConnected = await this.checkDatabaseConnection();
        const responseTime = Date.now() - startTime;
        let status = health_1.HealthStatus.HEALTHY;
        if (!databaseConnected) {
            status = health_1.HealthStatus.UNHEALTHY;
        }
        else if (responseTime > 1000) {
            status = health_1.HealthStatus.DEGRADED;
        }
        const cacheStats = this.getFormattedCacheStats();
        if (this.cacheEnabled && cacheStats) {
            if (cacheStats.hitRate < 50 && cacheStats.hits + cacheStats.misses > 100) {
                status = health_1.HealthStatus.DEGRADED;
            }
        }
        return {
            service: this.entityName,
            status,
            cacheEnabled: this.cacheEnabled,
            cacheStats,
            databaseConnected,
            responseTime,
            lastCheck: new Date(),
            details: {
                cacheKeys: cacheStats?.keys || 0,
                memoryUsage: cacheStats ? `${cacheStats.ksize + cacheStats.vsize} bytes` : 'N/A',
            },
        };
    }
    addTenantFilter(organizationId, where) {
        if (Array.isArray(where)) {
            return where.map(w => ({
                ...w,
                organizationId,
            }));
        }
        return {
            ...where,
            organizationId,
        };
    }
    async findAll(organizationId, options) {
        logger_1.logger.debug('TenantService.findAll', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        return this.repository.find({
            ...options,
            where: this.addTenantFilter(organizationId, options?.where),
        });
    }
    async findAllIncludingShared(organizationId) {
        logger_1.logger.debug('TenantService.findAllIncludingShared', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        return this.repository
            .createQueryBuilder('entity')
            .where('entity.organizationId = :organizationId', { organizationId })
            .orWhere(':organizationId = ANY(entity.sharedWithOrgs)', { organizationId })
            .getMany();
    }
    async findOne(organizationId, where, options) {
        logger_1.logger.debug('TenantService.findOne', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        return this.repository.findOne({
            ...options,
            where: this.addTenantFilter(organizationId, where),
        });
    }
    async findByIdSimple(id) {
        return this.repository.findOne({
            where: { id },
        });
    }
    async findById(organizationId, id, options) {
        logger_1.logger.debug('TenantService.findById', {
            organizationId,
            id,
            entityType: this.repository.metadata.name,
        });
        const cacheKey = this.getCacheKey(organizationId, id);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            logger_1.logger.debug('Cache hit', { cacheKey, entity: this.entityName });
            return cached;
        }
        const entity = await this.repository.findOne({
            ...options,
            where: this.addTenantFilter(organizationId, { id }),
        });
        if (entity) {
            this.setInCache(cacheKey, entity);
        }
        return entity;
    }
    async findByIdIncludingShared(organizationId, id, options) {
        logger_1.logger.debug('TenantService.findByIdIncludingShared', {
            organizationId,
            id,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.repository.findOne({
            ...options,
            where: { id },
        });
        if (!entity) {
            return null;
        }
        if (entity.organizationId === organizationId || entity.isSharedWith(organizationId)) {
            return entity;
        }
        return null;
    }
    async create(organizationId, data) {
        logger_1.logger.info('TenantService.create', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        const entity = this.repository.create({
            ...data,
            organizationId,
        });
        const saved = await this.repository.save(entity);
        if ('id' in saved && typeof saved.id === 'string') {
            this.setInCache(this.getCacheKey(organizationId, saved.id), saved);
        }
        return saved;
    }
    async createMany(organizationId, dataArray) {
        logger_1.logger.info('TenantService.createMany', {
            organizationId,
            count: dataArray.length,
            entityType: this.repository.metadata.name,
        });
        const entities = dataArray.map(data => this.repository.create({
            ...data,
            organizationId,
        }));
        return this.repository.save(entities);
    }
    async update(organizationId, id, data) {
        logger_1.logger.info('TenantService.update', {
            organizationId,
            id,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.findById(organizationId, id);
        if (!entity) {
            logger_1.logger.warn('TenantService.update: Entity not found or access denied', {
                organizationId,
                id,
                entityType: this.repository.metadata.name,
            });
            return null;
        }
        const { organizationId: _, ...updateData } = data;
        Object.assign(entity, updateData);
        const updated = await this.repository.save(entity);
        this.invalidateCache(this.getCacheKey(organizationId, id));
        return updated;
    }
    async delete(organizationId, id) {
        logger_1.logger.info('TenantService.delete', {
            organizationId,
            id,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.findById(organizationId, id);
        if (!entity) {
            logger_1.logger.warn('TenantService.delete: Entity not found or access denied', {
                organizationId,
                id,
                entityType: this.repository.metadata.name,
            });
            throw new Error('Entity not found or access denied');
        }
        await this.repository.delete({ id });
        this.invalidateCache(this.getCacheKey(organizationId, id));
    }
    async deleteMany(organizationId, ids) {
        logger_1.logger.info('TenantService.deleteMany', {
            organizationId,
            count: ids.length,
            entityType: this.repository.metadata.name,
        });
        const result = await this.repository.delete({
            id: ids,
            organizationId,
        });
        return result.affected || 0;
    }
    async count(organizationId, where) {
        return this.repository.count({
            where: this.addTenantFilter(organizationId, where),
        });
    }
    async exists(organizationId, where) {
        const count = await this.count(organizationId, where);
        return count > 0;
    }
    async shareWith(organizationId, id, targetOrgIds) {
        logger_1.logger.info('TenantService.shareWith', {
            organizationId,
            id,
            targetOrgIds,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.findById(organizationId, id);
        if (!entity) {
            return null;
        }
        targetOrgIds.forEach(orgId => entity.addSharedOrg(orgId));
        return this.repository.save(entity);
    }
    async unshareWith(organizationId, id, targetOrgIds) {
        logger_1.logger.info('TenantService.unshareWith', {
            organizationId,
            id,
            targetOrgIds,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.findById(organizationId, id);
        if (!entity) {
            return null;
        }
        targetOrgIds.forEach(orgId => entity.removeSharedOrg(orgId));
        return this.repository.save(entity);
    }
    async getSharedOrgs(organizationId, id) {
        const entity = await this.findById(organizationId, id);
        return entity?.sharedWithOrgs || [];
    }
    async findAllPaginated(organizationId, options, where) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'DESC';
        logger_1.logger.debug('TenantService.findAllPaginated', {
            organizationId,
            page,
            limit,
            sortBy,
            sortOrder,
            entityType: this.repository.metadata.name,
        });
        const findOptions = {
            where: this.addTenantFilter(organizationId, where),
            skip,
            take: limit,
            order: { [sortBy]: sortOrder },
        };
        const [data, total] = await this.repository.findAndCount(findOptions);
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
    async findAllPaginatedWithQuery(organizationId, options, queryBuilderCallback) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'DESC';
        logger_1.logger.debug('TenantService.findAllPaginatedWithQuery', {
            organizationId,
            page,
            limit,
            entityType: this.repository.metadata.name,
        });
        const queryBuilder = this.repository
            .createQueryBuilder('entity')
            .where('entity.organizationId = :organizationId', { organizationId });
        if (queryBuilderCallback) {
            queryBuilderCallback(queryBuilder);
        }
        queryBuilder.skip(skip).take(limit).orderBy(`entity.${sortBy}`, sortOrder);
        const [data, total] = await queryBuilder.getManyAndCount();
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
    async softDelete(organizationId, id, deletedBy) {
        logger_1.logger.info('TenantService.softDelete', {
            organizationId,
            id,
            deletedBy,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.findById(organizationId, id);
        if (!entity) {
            logger_1.logger.warn('TenantService.softDelete: Entity not found or access denied', {
                organizationId,
                id,
                entityType: this.repository.metadata.name,
            });
            return null;
        }
        const updateData = {
            deletedAt: new Date(),
        };
        if (deletedBy) {
            updateData.deletedBy = deletedBy;
        }
        await this.repository.update({ id }, updateData);
        this.invalidateCache(this.getCacheKey(organizationId, id));
        return this.repository.findOne({
            where: { id },
            withDeleted: true,
        });
    }
    async restore(organizationId, id) {
        logger_1.logger.info('TenantService.restore', {
            organizationId,
            id,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.repository.findOne({
            where: this.addTenantFilter(organizationId, { id }),
            withDeleted: true,
        });
        if (!entity) {
            logger_1.logger.warn('TenantService.restore: Entity not found', {
                organizationId,
                id,
                entityType: this.repository.metadata.name,
            });
            return null;
        }
        if (!entity.deletedAt) {
            logger_1.logger.warn('TenantService.restore: Entity is not deleted', {
                organizationId,
                id,
                entityType: this.repository.metadata.name,
            });
            return entity;
        }
        await this.repository.update({ id }, { deletedAt: null, deletedBy: null });
        this.invalidateCache(this.getCacheKey(organizationId, id));
        return this.findById(organizationId, id);
    }
    async findAllActive(organizationId, options) {
        logger_1.logger.debug('TenantService.findAllActive', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        const whereWithDeletedFilter = this.addTenantFilter(organizationId, {
            ...options?.where,
            deletedAt: (0, typeorm_1.IsNull)(),
        });
        return this.repository.find({
            ...options,
            where: whereWithDeletedFilter,
        });
    }
    async findAllIncludingDeleted(organizationId) {
        logger_1.logger.debug('TenantService.findAllIncludingDeleted', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        return this.repository.find({
            where: this.addTenantFilter(organizationId),
            withDeleted: true,
        });
    }
    async findDeleted(organizationId) {
        logger_1.logger.debug('TenantService.findDeleted', {
            organizationId,
            entityType: this.repository.metadata.name,
        });
        return this.repository
            .createQueryBuilder('entity')
            .withDeleted()
            .where('entity.organizationId = :organizationId', { organizationId })
            .andWhere('entity.deletedAt IS NOT NULL')
            .getMany();
    }
    async permanentDelete(organizationId, id) {
        logger_1.logger.info('TenantService.permanentDelete', {
            organizationId,
            id,
            entityType: this.repository.metadata.name,
        });
        const entity = await this.repository.findOne({
            where: this.addTenantFilter(organizationId, { id }),
            withDeleted: true,
        });
        if (!entity) {
            logger_1.logger.warn('TenantService.permanentDelete: Entity not found', {
                organizationId,
                id,
                entityType: this.repository.metadata.name,
            });
            return false;
        }
        await this.repository.delete({ id });
        this.invalidateCache(this.getCacheKey(organizationId, id));
        return true;
    }
    async bulkSoftDelete(organizationId, ids, deletedBy) {
        logger_1.logger.info('TenantService.bulkSoftDelete', {
            organizationId,
            count: ids.length,
            deletedBy,
            entityType: this.repository.metadata.name,
        });
        const updateData = {
            deletedAt: new Date(),
        };
        if (deletedBy) {
            updateData.deletedBy = deletedBy;
        }
        const result = await this.repository
            .createQueryBuilder()
            .update()
            .set(updateData)
            .where('organizationId = :organizationId', { organizationId })
            .andWhere('id IN (:...ids)', { ids })
            .execute();
        ids.forEach(id => {
            this.invalidateCache(this.getCacheKey(organizationId, id));
        });
        return result.affected || 0;
    }
}
exports.TenantService = TenantService;
//# sourceMappingURL=TenantService.js.map