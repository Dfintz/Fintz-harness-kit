"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiRoleSyncService = exports.RsiRoleSyncService = void 0;
const data_source_1 = require("../../data-source");
const RsiMemberCache_1 = require("../../models/RsiMemberCache");
const logger_1 = require("../../utils/logger");
const RSIApiService_1 = require("./RSIApiService");
class RsiRoleSyncService {
    config;
    refreshTimers = new Map();
    memberCacheRepository;
    static DEFAULT_CONFIG = {
        refreshInterval: 60 * 60 * 1000,
        cacheTTL: 2 * 60 * 60 * 1000,
        maxMembersPerRequest: 100,
        paginationDelay: 1000,
        autoRefreshEnabled: false,
    };
    constructor(config) {
        this.config = {
            ...RsiRoleSyncService.DEFAULT_CONFIG,
            ...config,
            refreshInterval: config?.refreshInterval ?? parseInt(process.env.RSI_SYNC_REFRESH_INTERVAL ?? '3600000'),
            cacheTTL: config?.cacheTTL ?? parseInt(process.env.RSI_SYNC_CACHE_TTL ?? '7200000'),
        };
        this.memberCacheRepository = data_source_1.AppDataSource.getRepository(RsiMemberCache_1.RsiMemberCache);
        logger_1.logger.info('RsiRoleSyncService initialized', {
            refreshInterval: this.config.refreshInterval,
            cacheTTL: this.config.cacheTTL,
            autoRefreshEnabled: this.config.autoRefreshEnabled,
        });
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        logger_1.logger.info('RsiRoleSyncService configuration updated', this.config);
    }
    async fetchOrganizationMembers(organizationId, rsiOrgSid, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cachedMembers = await this.getCachedMembers(organizationId, rsiOrgSid);
                if (cachedMembers.length > 0) {
                    logger_1.logger.debug(`Returning ${cachedMembers.length} cached members for org ${rsiOrgSid}`);
                    return {
                        success: true,
                        members: cachedMembers,
                        fromCache: true,
                    };
                }
            }
            logger_1.logger.info(`Fetching members from RSI for organization ${rsiOrgSid}`);
            const members = await this.fetchMembersFromRsi(rsiOrgSid);
            if (members.length > 0) {
                await this.updateMemberCache(organizationId, rsiOrgSid, members);
            }
            return {
                success: true,
                members,
                fromCache: false,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to fetch organization members for ${rsiOrgSid}`, {
                error: errorMessage,
            });
            const cachedMembers = await this.getCachedMembers(organizationId, rsiOrgSid);
            if (cachedMembers.length > 0) {
                logger_1.logger.warn(`Returning stale cached data for ${rsiOrgSid} due to API error`);
                return {
                    success: false,
                    members: cachedMembers,
                    error: `API error, returning cached data: ${errorMessage}`,
                    fromCache: true,
                };
            }
            return {
                success: false,
                members: [],
                error: errorMessage,
                fromCache: false,
            };
        }
    }
    async fetchMembersFromRsi(rsiOrgSid) {
        const members = [];
        try {
            const orgData = await RSIApiService_1.rsiApiService.fetchOrganizationData(rsiOrgSid);
            if (!orgData?.sid) {
                throw new Error(`Organization not found: ${rsiOrgSid}`);
            }
            logger_1.logger.warn(`Direct member list fetch not available for ${rsiOrgSid}. Individual member verification is still supported.`);
            return members;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to fetch members from RSI: ${errorMessage}`);
        }
    }
    async verifyAndCacheMember(organizationId, rsiOrgSid, rsiHandle) {
        try {
            const verificationResult = await RSIApiService_1.rsiApiService.verifyOrganizationMembership(rsiHandle, rsiOrgSid);
            if (verificationResult.membershipStatus === 'unknown') {
                logger_1.logger.warn(`API/data error verifying ${rsiHandle} for org ${rsiOrgSid}: ${verificationResult.error}`);
                return { status: 'api_error' };
            }
            if (verificationResult.membershipStatus === 'not_member' ||
                verificationResult.membershipStatus === 'account_not_found') {
                logger_1.logger.debug(`Member ${rsiHandle} departed org ${rsiOrgSid} (${verificationResult.membershipStatus})`);
                await this.removeMemberFromCache(organizationId, rsiHandle);
                return { status: 'departed' };
            }
            const member = {
                rsiHandle,
                rsiRank: verificationResult.rank ?? 'Unknown',
                rsiRankOrder: this.extractRankOrder(verificationResult.rank),
                isAffiliate: this.isAffiliateRank(verificationResult.rank),
                displayName: undefined,
            };
            await this.cacheSingleMember(organizationId, rsiOrgSid, member);
            return { status: 'verified', member };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to verify member ${rsiHandle} for org ${rsiOrgSid}`, {
                error: errorMessage,
            });
            return { status: 'api_error' };
        }
    }
    async getCachedMembers(organizationId, rsiOrgSid) {
        try {
            const cacheExpiry = new Date(Date.now() - this.config.cacheTTL);
            const queryBuilder = this.memberCacheRepository
                .createQueryBuilder('cache')
                .where('cache.organizationId = :organizationId', { organizationId })
                .andWhere('cache.cachedAt > :cacheExpiry', { cacheExpiry });
            if (rsiOrgSid) {
                queryBuilder.andWhere('cache.rsiOrgSid = :rsiOrgSid', { rsiOrgSid });
            }
            const cachedEntries = await queryBuilder.getMany();
            return cachedEntries.map(entry => ({
                rsiHandle: entry.rsiHandle,
                rsiRank: entry.rsiRank,
                rsiRankOrder: entry.rsiRankOrder,
                isAffiliate: entry.isAffiliate,
                displayName: entry.displayName,
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get cached members', { error });
            return [];
        }
    }
    async getCachedMember(organizationId, rsiHandle) {
        try {
            const cached = await this.memberCacheRepository.findOne({
                where: {
                    organizationId,
                    rsiHandle,
                },
            });
            if (!cached) {
                return null;
            }
            const cacheExpiry = new Date(Date.now() - this.config.cacheTTL);
            if (cached.cachedAt < cacheExpiry) {
                return null;
            }
            return {
                rsiHandle: cached.rsiHandle,
                rsiRank: cached.rsiRank,
                rsiRankOrder: cached.rsiRankOrder,
                isAffiliate: cached.isAffiliate,
                displayName: cached.displayName,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get cached member', { error });
            return null;
        }
    }
    async refreshCache(organizationId, rsiOrgSid) {
        const startTime = Date.now();
        const result = {
            success: false,
            membersProcessed: 0,
            membersAdded: 0,
            membersUpdated: 0,
            membersRemoved: 0,
            errors: [],
            duration: 0,
        };
        try {
            logger_1.logger.info(`Starting cache refresh for organization ${rsiOrgSid}`);
            const fetchResult = await this.fetchOrganizationMembers(organizationId, rsiOrgSid, true);
            if (!fetchResult.success && fetchResult.members.length === 0) {
                result.errors.push(fetchResult.error ?? 'Unknown fetch error');
                result.duration = Date.now() - startTime;
                return result;
            }
            result.membersProcessed = fetchResult.members.length;
            result.success = true;
            result.duration = Date.now() - startTime;
            logger_1.logger.info(`Cache refresh completed for ${rsiOrgSid}`, result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMessage);
            result.duration = Date.now() - startTime;
            logger_1.logger.error(`Cache refresh failed for ${rsiOrgSid}`, { error: errorMessage });
            return result;
        }
    }
    startAutoRefresh(organizationId, rsiOrgSid) {
        const key = `${organizationId}:${rsiOrgSid}`;
        this.stopAutoRefresh(organizationId, rsiOrgSid);
        if (!this.config.autoRefreshEnabled) {
            logger_1.logger.warn('Auto refresh is disabled in configuration');
            return;
        }
        const timer = setInterval(async () => {
            try {
                await this.refreshCache(organizationId, rsiOrgSid);
            }
            catch (error) {
                logger_1.logger.error(`Auto refresh failed for ${rsiOrgSid}`, { error });
            }
        }, this.config.refreshInterval);
        this.refreshTimers.set(key, timer);
        logger_1.logger.info(`Started auto refresh for ${rsiOrgSid} with interval ${this.config.refreshInterval}ms`);
    }
    stopAutoRefresh(organizationId, rsiOrgSid) {
        const key = `${organizationId}:${rsiOrgSid}`;
        const timer = this.refreshTimers.get(key);
        if (timer) {
            clearInterval(timer);
            this.refreshTimers.delete(key);
            logger_1.logger.info(`Stopped auto refresh for ${rsiOrgSid}`);
        }
    }
    stopAllAutoRefresh() {
        for (const [key, timer] of this.refreshTimers) {
            clearInterval(timer);
            logger_1.logger.debug(`Stopped auto refresh for ${key}`);
        }
        this.refreshTimers.clear();
        logger_1.logger.info('Stopped all auto refresh timers');
    }
    async clearCache(organizationId, rsiOrgSid) {
        try {
            const queryBuilder = this.memberCacheRepository
                .createQueryBuilder()
                .delete()
                .from(RsiMemberCache_1.RsiMemberCache)
                .where('organizationId = :organizationId', { organizationId });
            if (rsiOrgSid) {
                queryBuilder.andWhere('rsiOrgSid = :rsiOrgSid', { rsiOrgSid });
            }
            const result = await queryBuilder.execute();
            const deletedCount = result.affected ?? 0;
            logger_1.logger.info(`Cleared ${deletedCount} cached members for organization ${organizationId}`);
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to clear cache', { error });
            return 0;
        }
    }
    async getCacheStats(organizationId) {
        try {
            const cacheExpiry = new Date(Date.now() - this.config.cacheTTL);
            const entriesPromise = this.memberCacheRepository
                .createQueryBuilder('cache')
                .select('COUNT(*)', 'count')
                .addSelect('MIN(cache.cachedAt)', 'oldest')
                .addSelect('MAX(cache.cachedAt)', 'newest')
                .where('cache.organizationId = :organizationId', { organizationId })
                .getRawOne();
            const expiredCountPromise = this.memberCacheRepository
                .createQueryBuilder('cache')
                .where('cache.organizationId = :organizationId', { organizationId })
                .andWhere('cache.cachedAt < :cacheExpiry', { cacheExpiry })
                .getCount();
            const [entries, expiredCount] = await Promise.all([entriesPromise, expiredCountPromise]);
            return {
                totalCached: parseInt(entries?.count ?? '0'),
                oldestEntry: entries?.oldest ?? null,
                newestEntry: entries?.newest ?? null,
                expiredEntries: expiredCount,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get cache stats', { error });
            return {
                totalCached: 0,
                oldestEntry: null,
                newestEntry: null,
                expiredEntries: 0,
            };
        }
    }
    async needsRefresh(organizationId, rsiOrgSid) {
        try {
            const latestEntry = await this.memberCacheRepository.findOne({
                where: { organizationId, rsiOrgSid },
                order: { cachedAt: 'DESC' },
            });
            if (!latestEntry) {
                return true;
            }
            const cacheAge = Date.now() - latestEntry.cachedAt.getTime();
            return cacheAge >= this.config.refreshInterval;
        }
        catch (error) {
            logger_1.logger.error('Failed to check if cache needs refresh', { error });
            return true;
        }
    }
    mapUserOrgToMember(userOrg, handle) {
        return {
            rsiHandle: handle,
            rsiRank: userOrg.rank ?? 'Unknown',
            rsiRankOrder: userOrg.stars ?? this.extractRankOrder(userOrg.rank),
            isAffiliate: userOrg.isAffiliate ?? false,
            displayName: undefined,
        };
    }
    async updateMemberCache(organizationId, rsiOrgSid, members) {
        try {
            for (const member of members) {
                await this.cacheSingleMember(organizationId, rsiOrgSid, member);
            }
            logger_1.logger.debug(`Updated cache with ${members.length} members for ${rsiOrgSid}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to update member cache', { error });
            throw error;
        }
    }
    async cacheSingleMember(organizationId, rsiOrgSid, member) {
        try {
            const existing = await this.memberCacheRepository.findOne({
                where: {
                    organizationId,
                    rsiHandle: member.rsiHandle,
                },
            });
            if (existing) {
                existing.rsiRank = member.rsiRank;
                existing.rsiRankOrder = member.rsiRankOrder;
                existing.isAffiliate = member.isAffiliate;
                existing.displayName = member.displayName;
                existing.cachedAt = new Date();
                await this.memberCacheRepository.save(existing);
            }
            else {
                const cacheEntry = this.memberCacheRepository.create({
                    organizationId,
                    rsiOrgSid,
                    rsiHandle: member.rsiHandle,
                    rsiRank: member.rsiRank,
                    rsiRankOrder: member.rsiRankOrder,
                    isAffiliate: member.isAffiliate,
                    displayName: member.displayName,
                    cachedAt: new Date(),
                });
                await this.memberCacheRepository.save(cacheEntry);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to cache member ${member.rsiHandle}`, { error });
            throw error;
        }
    }
    async removeMemberFromCache(organizationId, rsiHandle) {
        try {
            await this.memberCacheRepository.delete({
                organizationId,
                rsiHandle,
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to remove member ${rsiHandle} from cache`, { error });
        }
    }
    extractRankOrder(rank) {
        if (!rank) {
            return undefined;
        }
        const normalizedRank = rank.toLowerCase();
        const rankMap = {
            founder: 5,
            ceo: 5,
            owner: 5,
            director: 4,
            admin: 4,
            officer: 3,
            'senior member': 2,
            member: 1,
            recruit: 0,
            affiliate: 0,
        };
        for (const [pattern, order] of Object.entries(rankMap)) {
            if (normalizedRank.includes(pattern)) {
                return order;
            }
        }
        return undefined;
    }
    isAffiliateRank(rank) {
        if (!rank) {
            return false;
        }
        return rank.toLowerCase().includes('affiliate');
    }
}
exports.RsiRoleSyncService = RsiRoleSyncService;
exports.rsiRoleSyncService = new RsiRoleSyncService();
//# sourceMappingURL=RsiRoleSyncService.js.map