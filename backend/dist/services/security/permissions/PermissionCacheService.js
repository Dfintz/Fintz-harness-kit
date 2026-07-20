"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionCacheService = void 0;
const data_source_1 = require("../../../data-source");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const Permission_1 = require("../../../models/Permission");
const logger_1 = require("../../../utils/logger");
const roleUtils_1 = require("../../../utils/roleUtils");
class PermissionCacheService {
    static instance;
    cache = new Map();
    config;
    cleanupTimer = null;
    permissionRepository = data_source_1.AppDataSource.getRepository(Permission_1.Permission);
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    constructor(config) {
        this.config = {
            ttlMs: config?.ttlMs || 5 * 60 * 1000,
            maxEntries: config?.maxEntries || 10000,
            cleanupIntervalMs: config?.cleanupIntervalMs || 60 * 1000,
        };
        this.startCleanupTimer();
    }
    static getInstance(config) {
        if (!PermissionCacheService.instance) {
            PermissionCacheService.instance = new PermissionCacheService(config);
        }
        return PermissionCacheService.instance;
    }
    getCacheKey(userId, organizationId) {
        return `${userId}:${organizationId}`;
    }
    async getPermissions(userId, organizationId) {
        const key = this.getCacheKey(userId, organizationId);
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached;
        }
        return this.refreshCache(userId, organizationId);
    }
    async refreshCache(userId, organizationId) {
        try {
            const userOrg = await this.userOrgRepository.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!userOrg) {
                return null;
            }
            const permissions = await this.permissionRepository.find({
                where: { userId, organizationId, granted: true },
            });
            const validPermissions = permissions
                .filter(p => !p.expiresAt || p.expiresAt > new Date())
                .map(p => `${p.resource}:${p.action}`);
            const allPermissions = [...validPermissions, ...(userOrg.permissions || [])];
            const cachedPermission = {
                permissions: [...new Set(allPermissions)],
                role: (0, roleUtils_1.getRoleName)(userOrg.role),
                securityLevel: userOrg.securityLevel || 1,
                cachedAt: Date.now(),
                expiresAt: Date.now() + this.config.ttlMs,
            };
            if (this.cache.size >= this.config.maxEntries) {
                this.evictOldestEntries(Math.floor(this.config.maxEntries * 0.1));
            }
            const key = this.getCacheKey(userId, organizationId);
            this.cache.set(key, cachedPermission);
            return cachedPermission;
        }
        catch (error) {
            logger_1.logger.error('Error refreshing permission cache', { userId, organizationId, error });
            return null;
        }
    }
    async hasPermission(userId, organizationId, resource, action) {
        const cached = await this.getPermissions(userId, organizationId);
        if (!cached) {
            return false;
        }
        if (cached.role === 'owner' || cached.role === 'founder' || cached.role === 'admin') {
            return true;
        }
        const permissionKey = `${resource}:${action}`;
        return cached.permissions.includes(permissionKey);
    }
    invalidate(userId, organizationId) {
        const key = this.getCacheKey(userId, organizationId);
        this.cache.delete(key);
        logger_1.logger.debug('Permission cache invalidated', { userId, organizationId });
    }
    invalidateUser(userId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        logger_1.logger.debug('Permission cache invalidated for user', { userId, count: keysToDelete.length });
    }
    invalidateOrganization(organizationId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.endsWith(`:${organizationId}`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        logger_1.logger.debug('Permission cache invalidated for organization', {
            organizationId,
            count: keysToDelete.length,
        });
    }
    clearAll() {
        const size = this.cache.size;
        this.cache.clear();
        logger_1.logger.info('Permission cache cleared', { entriesRemoved: size });
    }
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.config.maxEntries,
            ttlMs: this.config.ttlMs,
            hitRate: 0,
        };
    }
    evictOldestEntries(count) {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
            .slice(0, count);
        entries.forEach(([key]) => this.cache.delete(key));
        logger_1.logger.debug('Evicted oldest cache entries', { count: entries.length });
    }
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, value] of this.cache.entries()) {
            if (value.expiresAt <= now) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        if (keysToDelete.length > 0) {
            logger_1.logger.debug('Permission cache cleanup', { expiredRemoved: keysToDelete.length });
        }
    }
    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
        if (typeof this.cleanupTimer.unref === 'function') {
            this.cleanupTimer.unref();
        }
    }
    stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}
exports.PermissionCacheService = PermissionCacheService;
//# sourceMappingURL=PermissionCacheService.js.map