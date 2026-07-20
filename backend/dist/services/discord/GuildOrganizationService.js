"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildOrganizationService = void 0;
const typeorm_1 = require("typeorm");
const BotClientManager_1 = require("../../bot/BotClientManager");
const data_source_1 = require("../../data-source");
const GuildOrganization_1 = require("../../models/GuildOrganization");
const Organization_1 = require("../../models/Organization");
const logger_1 = require("../../utils/logger");
const EnhancedCacheService_1 = require("../caching/EnhancedCacheService");
const DiscordAuditLogger_1 = require("../shared/DiscordAuditLogger");
class GuildOrganizationService {
    static instance;
    repository;
    orgRepository;
    cache;
    CACHE_PREFIX = 'guild-org:';
    CACHE_TTL = 3600;
    NEGATIVE_CACHE_TTL = 30;
    constructor() {
        this.repository = data_source_1.AppDataSource.getRepository(GuildOrganization_1.GuildOrganization);
        this.orgRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.cache = new EnhancedCacheService_1.EnhancedCacheService({
            stdTTL: this.CACHE_TTL,
            checkperiod: 600,
            maxKeys: 5000,
        });
    }
    static getInstance() {
        if (!GuildOrganizationService.instance) {
            GuildOrganizationService.instance = new GuildOrganizationService();
        }
        return GuildOrganizationService.instance;
    }
    async createOrUpdateMapping(guildId, organizationId, guildName, isPrimary = true, createdBy) {
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let mapping = await queryRunner.manager.findOne(GuildOrganization_1.GuildOrganization, {
                where: { guildId },
            });
            if (mapping) {
                mapping.organizationId = organizationId;
                mapping.guildName = guildName || mapping.guildName;
                mapping.isPrimary = isPrimary;
                mapping.isActive = true;
                mapping.deactivatedAt = undefined;
                mapping.deactivatedBy = undefined;
                logger_1.logger.info(`Updated guild-to-org mapping: ${guildId} -> ${organizationId}`);
            }
            else {
                mapping = queryRunner.manager.create(GuildOrganization_1.GuildOrganization, {
                    guildId,
                    organizationId,
                    guildName,
                    isPrimary,
                    isActive: true,
                    createdBy,
                });
                logger_1.logger.info(`Created guild-to-org mapping: ${guildId} -> ${organizationId}`);
            }
            if (isPrimary) {
                await queryRunner.manager.update(GuildOrganization_1.GuildOrganization, {
                    organizationId,
                    guildId: (0, typeorm_1.Not)(guildId),
                    isPrimary: true,
                }, { isPrimary: false });
            }
            const savedMapping = await queryRunner.manager.save(mapping);
            await queryRunner.commitTransaction();
            this.invalidateGuildCache(guildId);
            DiscordAuditLogger_1.discordAuditLogger.logGuildLinked(organizationId, guildId, savedMapping.guildName, createdBy, savedMapping.isPrimary);
            return savedMapping;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Error creating/updating guild-org mapping:', error);
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async resolveOrganization(guildId) {
        const cacheKey = this.getCacheKey(guildId);
        try {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) {
                logger_1.logger.debug(`Cache hit for guild: ${guildId}`);
                return cached;
            }
            logger_1.logger.debug(`Cache miss for guild: ${guildId}, querying database`);
            const mapping = await this.repository.findOne({
                where: {
                    guildId,
                    isActive: true,
                },
            });
            if (!mapping) {
                logger_1.logger.debug(`No active mapping found for guild: ${guildId}`);
                this.cache.set(cacheKey, null, { ttl: this.NEGATIVE_CACHE_TTL });
                return null;
            }
            this.cache.set(cacheKey, mapping.organizationId, { ttl: this.CACHE_TTL });
            return mapping.organizationId;
        }
        catch (error) {
            logger_1.logger.error('Error resolving organization from guild:', error);
            return null;
        }
    }
    async resolveOrganizationWithFallback(guildId) {
        const organizationId = await this.resolveOrganization(guildId);
        if (!organizationId) {
            logger_1.logger.warn(`No guild-org mapping found for guild ${guildId}. Cannot resolve organization.`);
            return guildId;
        }
        return organizationId;
    }
    async getGuildsForOrganization(organizationId, activeOnly = true) {
        try {
            const where = { organizationId };
            if (activeOnly) {
                where.isActive = true;
            }
            return await this.repository.find({
                where,
                order: {
                    isPrimary: 'DESC',
                    createdAt: 'ASC',
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching guilds for organization:', error);
            return [];
        }
    }
    async getPrimaryGuildForOrganization(organizationId) {
        try {
            return await this.repository.findOne({
                where: {
                    organizationId,
                    isActive: true,
                    isPrimary: true,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching primary guild for organization:', error);
            return null;
        }
    }
    async deactivateMapping(guildId, userId) {
        try {
            const mapping = await this.repository.findOne({
                where: { guildId },
            });
            if (!mapping) {
                logger_1.logger.warn(`Cannot deactivate: mapping not found for guild ${guildId}`);
                return false;
            }
            const previousOrganizationId = mapping.organizationId;
            const previousGuildName = mapping.guildName;
            mapping.deactivate(userId);
            await this.repository.save(mapping);
            this.invalidateGuildCache(guildId);
            DiscordAuditLogger_1.discordAuditLogger.logGuildUnlinked(previousOrganizationId, guildId, previousGuildName, userId);
            logger_1.logger.info(`Deactivated guild-to-org mapping: ${guildId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error deactivating guild mapping:', error);
            return false;
        }
    }
    async syncOnDiscordConnection(guildId, organizationId, guildName, userId) {
        logger_1.logger.info(`Auto-syncing guild mapping on Discord connection: ${guildId} -> ${organizationId}`);
        const existingGuilds = await this.getGuildsForOrganization(organizationId);
        const isPrimary = existingGuilds.length === 0;
        return this.createOrUpdateMapping(guildId, organizationId, guildName, isPrimary, userId);
    }
    async isMapped(guildId) {
        try {
            const count = await this.repository.count({
                where: {
                    guildId,
                    isActive: true,
                },
            });
            return count > 0;
        }
        catch (error) {
            logger_1.logger.error('Error checking if guild is mapped:', error);
            return false;
        }
    }
    async getMapping(guildId) {
        try {
            return await this.repository.findOne({
                where: { guildId },
                relations: ['organization'],
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching guild mapping:', error);
            return null;
        }
    }
    async getOrganizationsForGuild(guildId) {
        try {
            const mapping = await this.repository.findOne({
                where: {
                    guildId,
                    isActive: true,
                },
            });
            return mapping ? [mapping.organizationId] : [];
        }
        catch (error) {
            logger_1.logger.error('Error fetching organizations for guild:', error);
            return [];
        }
    }
    async fetchGuildName(guildId, fallback) {
        const info = await this.fetchGuildInfo(guildId);
        return info?.name ?? fallback;
    }
    async fetchGuildInfo(guildId) {
        try {
            const client = BotClientManager_1.BotClientManager.getInstance().getClient();
            if (client.isReady()) {
                const guild = await client.guilds.fetch(guildId);
                if (guild) {
                    return {
                        name: guild.name,
                        iconUrl: guild.iconURL({ size: 128, extension: 'png' }) ?? null,
                    };
                }
            }
        }
        catch (error) {
            logger_1.logger.debug(`Could not fetch guild info from Discord API for ${guildId}:`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return null;
    }
    getCacheKey(guildId) {
        return `${this.CACHE_PREFIX}${guildId}`;
    }
    invalidateGuildCache(guildId) {
        const cacheKey = this.getCacheKey(guildId);
        this.cache.del(cacheKey);
        logger_1.logger.debug(`Invalidated cache for guild: ${guildId}`);
    }
    clearCache() {
        this.cache.flushAll();
        logger_1.logger.info('Cleared all guild-org mapping cache');
    }
    getCacheMetrics() {
        return this.cache.getMetrics();
    }
}
exports.GuildOrganizationService = GuildOrganizationService;
//# sourceMappingURL=GuildOrganizationService.js.map