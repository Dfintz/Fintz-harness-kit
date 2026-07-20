"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiRoleMutationAuthorizationService = exports.RsiRoleMutationAuthorizationService = void 0;
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const RsiRoleMapping_1 = require("../../models/RsiRoleMapping");
const RsiSyncSchedule_1 = require("../../models/RsiSyncSchedule");
const RsiUserLink_1 = require("../../models/RsiUserLink");
const DEFAULT_AUTHZ_CACHE_TTL_MS = 30_000;
const MAX_AUTHZ_CACHE_ENTRIES = 5_000;
class RsiRoleMutationAuthorizationService {
    cacheTtlMs;
    scheduleCache = new Map();
    roleAllowedCache = new Map();
    constructor(cacheTtlMs = DEFAULT_AUTHZ_CACHE_TTL_MS) {
        this.cacheTtlMs = cacheTtlMs;
    }
    getCachedValue(cache, key) {
        const entry = cache.get(key);
        if (!entry) {
            return undefined;
        }
        if (entry.expiresAt <= Date.now()) {
            cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    setCachedValue(cache, key, value) {
        this.evictIfOverCapacity(cache);
        cache.set(key, {
            value,
            expiresAt: Date.now() + this.cacheTtlMs,
        });
    }
    evictIfOverCapacity(cache) {
        if (cache.size < MAX_AUTHZ_CACHE_ENTRIES) {
            return;
        }
        const now = Date.now();
        for (const [cacheKey, entry] of cache) {
            if (entry.expiresAt <= now) {
                cache.delete(cacheKey);
            }
        }
        if (cache.size >= MAX_AUTHZ_CACHE_ENTRIES) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) {
                cache.delete(oldest);
            }
        }
    }
    async getSchedule(organizationId) {
        const cached = this.getCachedValue(this.scheduleCache, organizationId);
        if (cached !== undefined) {
            return cached;
        }
        const schedule = await data_source_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule)
            .createQueryBuilder('schedule')
            .where('schedule.organizationId = :organizationId', { organizationId })
            .getOne();
        this.setCachedValue(this.scheduleCache, organizationId, schedule);
        return schedule;
    }
    async isMappedRole(organizationId, roleId) {
        const cacheKey = `${organizationId}:${roleId}`;
        const cached = this.getCachedValue(this.roleAllowedCache, cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const isMappedRole = await data_source_1.AppDataSource.getRepository(RsiRoleMapping_1.RsiRoleMapping).exist({
            where: {
                organizationId,
                discordRoleId: roleId,
                isActive: true,
            },
        });
        this.setCachedValue(this.roleAllowedCache, cacheKey, isMappedRole);
        return isMappedRole;
    }
    async validateRoleMutation(payload) {
        if (!data_source_1.AppDataSource.isInitialized) {
            return 'Role IPC authorization unavailable';
        }
        const schedule = await this.getSchedule(payload.organizationId);
        if (!schedule) {
            return 'Unknown organization for role synchronization';
        }
        if (schedule.guildId && schedule.guildId !== payload.guildId) {
            return 'Guild is not authorized for organization role synchronization';
        }
        const isMappedRole = await this.isMappedRole(payload.organizationId, payload.roleId);
        const isAffiliateRole = schedule.affiliateRoleId === payload.roleId;
        if (!isMappedRole && !isAffiliateRole) {
            return 'Role is not allowed for this organization';
        }
        const link = await data_source_1.AppDataSource.getRepository(RsiUserLink_1.RsiUserLink)
            .createQueryBuilder('link')
            .where('link.organizationId = :organizationId', { organizationId: payload.organizationId })
            .andWhere('link.discordUserId = :discordUserId', { discordUserId: payload.discordUserId })
            .getOne();
        if (!link?.verifiedAt || link.syncStatus === RsiUserLink_1.SyncStatus.REMOVED) {
            return 'Discord user is not linked to an active verified organization member';
        }
        const isMemberActive = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).exist({
            where: {
                organizationId: payload.organizationId,
                userId: link.userId,
                isActive: true,
            },
        });
        if (!isMemberActive) {
            return 'Discord user is not an active member of the organization';
        }
        return null;
    }
    clearCachesForTests() {
        this.scheduleCache.clear();
        this.roleAllowedCache.clear();
    }
}
exports.RsiRoleMutationAuthorizationService = RsiRoleMutationAuthorizationService;
exports.rsiRoleMutationAuthorizationService = new RsiRoleMutationAuthorizationService();
//# sourceMappingURL=RsiRoleMutationAuthorizationService.js.map