"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionManagerService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const data_source_1 = require("../../../data-source");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../../models/OrganizationPermission");
const Permission_1 = require("../../../models/Permission");
const Role_1 = require("../../../models/Role");
const SecurityLevel_1 = require("../../../models/SecurityLevel");
const TeamMember_1 = require("../../../models/TeamMember");
const auditLogger_1 = require("../../../utils/auditLogger");
const logger_1 = require("../../../utils/logger");
const roleUtils_1 = require("../../../utils/roleUtils");
class PermissionManagerService {
    repository = data_source_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission);
    permissionRepository;
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    cache;
    cacheEnabled;
    constructor() {
        this.cacheEnabled = true;
        this.cache = new node_cache_1.default({
            stdTTL: 300,
            checkperiod: 60,
        });
        try {
            this.permissionRepository = data_source_1.AppDataSource.getRepository(Permission_1.Permission);
        }
        catch {
            logger_1.logger.debug('Permission entity not available - legacy permission support disabled');
            this.permissionRepository = undefined;
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
    }
    getCacheStats() {
        if (!this.cacheEnabled || !this.cache) {
            return null;
        }
        return this.cache.getStats();
    }
    async hasPermission(orgId, userId, resource, action, resourceId) {
        const cacheKey = this.getPermissionCacheKey(orgId, userId, resource, action, resourceId);
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const result = await this.checkPermissionInternal(orgId, userId, resource, action, resourceId);
        this.setInCache(cacheKey, result.allowed);
        return result.allowed;
    }
    async checkPermission(orgId, userId, resource, action, resourceId) {
        return this.checkPermissionInternal(orgId, userId, resource, action, resourceId);
    }
    async hasTeamPermission(orgId, userId, teamId, resource, action) {
        const result = await this.checkTeamPermission(orgId, userId, teamId, resource, action);
        return result.allowed;
    }
    async checkTeamPermission(orgId, userId, teamId, resource, action) {
        const teamMemberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
        const teamMember = await teamMemberRepo.findOne({
            where: { teamId, userId, organizationId: orgId, status: 'active' },
        });
        if (!teamMember) {
            return {
                allowed: false,
                reason: 'User is not a member of this team',
                missingPermission: { resource, action, scope: orgId, resourceId: teamId },
            };
        }
        const teamPermissions = await this.repository.find({
            where: {
                organizationId: orgId,
                resourceId: teamId,
                resource: resource,
                isActive: true,
            },
        });
        const userTeamPerms = teamPermissions.filter(p => p.userId === userId);
        const userResult = this.checkDirectGrantPermissions(userTeamPerms, action);
        if (userResult) {
            return {
                ...userResult,
                reason: 'Permission granted via direct team grant',
            };
        }
        const userOrg = await this.getUserOrgRole(orgId, userId);
        if (userOrg?.roleId) {
            const roleTeamPerms = teamPermissions.filter(p => p.roleId === userOrg.roleId);
            const roleResult = this.checkDirectGrantPermissions(roleTeamPerms, action);
            if (roleResult) {
                return {
                    ...roleResult,
                    source: 'role',
                    reason: `Permission granted via role in team context`,
                };
            }
        }
        return this.checkPermissionInternal(orgId, userId, resource, action);
    }
    async batchCheckPermissions(orgId, userId, permissions) {
        const result = {};
        const uncachedPermissions = [];
        for (const perm of permissions) {
            const key = this.getPermissionKey(perm.resource, perm.action, perm.resourceId);
            const cacheKey = this.getPermissionCacheKey(orgId, userId, perm.resource, perm.action, perm.resourceId);
            const cached = this.getFromCache(cacheKey);
            if (cached === undefined) {
                uncachedPermissions.push(perm);
            }
            else {
                result[key] = cached;
            }
        }
        if (uncachedPermissions.length === 0) {
            return result;
        }
        const userOrg = await this.getUserOrgRole(orgId, userId);
        for (const perm of uncachedPermissions) {
            const key = this.getPermissionKey(perm.resource, perm.action, perm.resourceId);
            const cacheKey = this.getPermissionCacheKey(orgId, userId, perm.resource, perm.action, perm.resourceId);
            const checkResult = await this.checkPermissionInternal(orgId, userId, perm.resource, perm.action, perm.resourceId, userOrg);
            result[key] = checkResult.allowed;
            this.setInCache(cacheKey, checkResult.allowed);
        }
        return result;
    }
    async getUserPermissions(orgId, userId) {
        const permissions = new Set();
        const userOrg = await this.getUserOrgRole(orgId, userId);
        if (!userOrg) {
            return [];
        }
        if (userOrg.roleId) {
            const roleDbPerms = await this.repository.find({
                where: {
                    organizationId: orgId,
                    roleId: userOrg.roleId,
                    isActive: true,
                },
            });
            this.collectActivePermissions(permissions, roleDbPerms);
        }
        const roleEntity = userOrg.role;
        if (roleEntity && typeof roleEntity === 'object' && roleEntity.permissions?.length) {
            roleEntity.permissions.forEach((p) => permissions.add(p));
        }
        const defaultPerms = userOrg.role
            ? (0, roleUtils_1.getDefaultPermissionsForRole)((0, roleUtils_1.getRoleName)(userOrg.role))
            : [];
        defaultPerms.forEach(p => permissions.add(p));
        (userOrg.permissions ?? []).forEach(p => permissions.add(p));
        const directPermissions = await this.repository.find({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        this.collectActivePermissions(permissions, directPermissions);
        return Array.from(permissions).sort((a, b) => a.localeCompare(b));
    }
    async getUserRole(orgId, userId) {
        const userOrg = await this.getUserOrgRole(orgId, userId);
        return (0, roleUtils_1.getRoleName)(userOrg?.role) || null;
    }
    async getRolePermissions(roleId) {
        const roleRepository = data_source_1.AppDataSource.getRepository(Role_1.Role);
        const role = await roleRepository.findOne({ where: { id: roleId } });
        return role?.permissions || [];
    }
    async updateUserRole(orgId, userId, newRoleId, updatedBy) {
        const userOrg = await this.userOrgRepository.findOne({
            where: { organizationId: orgId, userId, isActive: true },
        });
        if (!userOrg) {
            return null;
        }
        const oldRoleName = (0, roleUtils_1.getRoleName)(userOrg.role);
        userOrg.roleId = newRoleId;
        const updated = await this.userOrgRepository.save(userOrg);
        this.invalidateUserPermissionCache(orgId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: updatedBy,
            message: `User role updated from ${oldRoleName} to ${newRoleId} in org ${orgId}`,
            metadata: { orgId, userId, newRole: newRoleId, oldRoleName },
        });
        return updated;
    }
    async grantPermission(orgId, userId, resource, action, grantedBy, expiresAt, resourceId) {
        let permission = await this.repository.findOne({
            where: {
                organizationId: orgId,
                userId,
                resource: resource,
                resourceId,
            },
        });
        if (permission) {
            if (!permission.actions.includes(action)) {
                permission.actions.push(action);
            }
            permission.isActive = true;
            permission.expiresAt = expiresAt;
        }
        else {
            permission = this.repository.create({
                organizationId: orgId,
                userId,
                resource: resource,
                resourceId,
                actions: [action],
                isActive: true,
                expiresAt,
                grantedBy,
                scope: 'custom',
            });
        }
        const saved = await this.repository.save(permission);
        this.invalidateUserPermissionCache(orgId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: grantedBy,
            message: `Permission granted: ${resource}:${action} to user ${userId} in org ${orgId}`,
            metadata: { orgId, userId, resource, action, resourceId },
        });
        return saved;
    }
    async revokePermission(orgId, userId, resource, action, revokedBy, resourceId) {
        const permission = await this.repository.findOne({
            where: {
                organizationId: orgId,
                userId,
                resource: resource,
                resourceId,
            },
        });
        if (permission) {
            permission.actions = permission.actions.filter(a => a !== action);
            if (permission.actions.length === 0) {
                permission.isActive = false;
            }
            await this.repository.save(permission);
        }
        this.invalidateUserPermissionCache(orgId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: revokedBy,
            message: `Permission revoked: ${resource}:${action} from user ${userId} in org ${orgId}`,
            metadata: { orgId, userId, resource, action, resourceId },
        });
    }
    async checkPermissionInternal(orgId, userId, resource, action, resourceId, userOrg) {
        userOrg ??= await this.getUserOrgRole(orgId, userId);
        if (!userOrg) {
            return {
                allowed: false,
                reason: 'User is not a member of this organization',
                missingPermission: { resource, action, scope: orgId, resourceId },
            };
        }
        if (!userOrg.role) {
            return {
                allowed: false,
                reason: 'User role not found',
                missingPermission: { resource, action, scope: orgId, resourceId },
            };
        }
        const permissionKey = `${resource}:${action}`;
        const roleResult = await this.checkRoleBasedPermission(userOrg, resource, permissionKey);
        if (roleResult) {
            return roleResult;
        }
        if (userOrg.permissions?.includes(permissionKey)) {
            return {
                allowed: true,
                source: 'direct',
                reason: 'Permission granted via member-specific override',
            };
        }
        try {
            const permissions = await this.repository.find({
                where: {
                    organizationId: orgId,
                    userId,
                    resource: resource,
                    isActive: true,
                },
            });
            const directResult = this.checkDirectGrantPermissions(permissions, action, resourceId);
            if (directResult) {
                return directResult;
            }
        }
        catch {
        }
        const legacyResult = await this.checkLegacyPermission(userId, orgId, resource, action);
        if (legacyResult) {
            return legacyResult;
        }
        return {
            allowed: false,
            reason: 'No applicable permissions found',
            missingPermission: { resource, action, scope: orgId, resourceId },
        };
    }
    async checkRoleBasedPermission(userOrg, resource, permissionKey) {
        const roleName = (0, roleUtils_1.getRoleName)(userOrg.role);
        const dbResult = await this.checkRoleDbPermissions(userOrg, resource, permissionKey, roleName);
        if (dbResult) {
            return dbResult;
        }
        const entityResult = this.checkRoleEntityPermissions(userOrg, resource, permissionKey, roleName);
        if (entityResult) {
            return entityResult;
        }
        return this.checkRoleDefaultPermissions(roleName, resource, permissionKey);
    }
    async checkRoleDbPermissions(userOrg, resource, permissionKey, roleName) {
        if (!userOrg.roleId) {
            return null;
        }
        let rolePermissions;
        try {
            rolePermissions = await this.repository.find({
                where: {
                    organizationId: userOrg.organizationId,
                    roleId: userOrg.roleId,
                    resource: resource,
                    isActive: true,
                },
            });
        }
        catch {
            return null;
        }
        const colonIdx = permissionKey.indexOf(':');
        const action = colonIdx >= 0 ? permissionKey.substring(colonIdx + 1) : permissionKey;
        const dbResult = this.checkDirectGrantPermissions(rolePermissions, action);
        if (dbResult) {
            return {
                allowed: true,
                source: 'role',
                reason: `Permission granted via ${roleName} role (database)`,
                matchedPermissions: dbResult.matchedPermissions,
            };
        }
        return null;
    }
    checkRoleEntityPermissions(userOrg, resource, permissionKey, roleName) {
        const roleEntity = userOrg.role;
        if (!roleEntity || typeof roleEntity !== 'object' || !roleEntity.permissions?.length) {
            return null;
        }
        const entityPerms = roleEntity.permissions;
        const hasEntityPerm = entityPerms.includes(permissionKey) ||
            entityPerms.includes(`${resource}:*`) ||
            entityPerms.includes('*');
        if (hasEntityPerm) {
            return {
                allowed: true,
                source: 'role',
                reason: `Permission granted via ${roleName} role (entity)`,
            };
        }
        return null;
    }
    checkRoleDefaultPermissions(roleName, resource, permissionKey) {
        const defaultPermissions = (0, roleUtils_1.getDefaultPermissionsForRole)(roleName);
        const hasDefault = defaultPermissions.includes(permissionKey) ||
            defaultPermissions.includes(`${resource}:*`) ||
            defaultPermissions.includes('*') ||
            defaultPermissions.includes('system:*');
        if (hasDefault) {
            return {
                allowed: true,
                source: 'role',
                reason: `Permission granted via ${roleName} role (default)`,
            };
        }
        return null;
    }
    checkDirectGrantPermissions(permissions, action, resourceId) {
        for (const perm of permissions) {
            if (perm.expiresAt && perm.expiresAt < new Date()) {
                continue;
            }
            if (resourceId && perm.resourceId && perm.resourceId !== resourceId) {
                continue;
            }
            if (perm.allowsAction(action)) {
                return {
                    allowed: true,
                    source: 'direct',
                    reason: 'Direct permission grant',
                    matchedPermissions: [perm],
                };
            }
        }
        return null;
    }
    async checkLegacyPermission(userId, orgId, resource, action) {
        if (!this.permissionRepository) {
            return null;
        }
        try {
            const legacyPermission = await this.permissionRepository.findOne({
                where: { userId, organizationId: orgId, resource, action, granted: true },
            });
            if (legacyPermission &&
                (!legacyPermission.expiresAt || legacyPermission.expiresAt >= new Date())) {
                return { allowed: true, source: 'direct', reason: 'Legacy permission grant' };
            }
        }
        catch {
            logger_1.logger.debug('Legacy Permission table not available for permission check');
        }
        return null;
    }
    collectActivePermissions(permissions, directPermissions) {
        const now = new Date();
        for (const perm of directPermissions) {
            if (perm.expiresAt && perm.expiresAt < now) {
                continue;
            }
            for (const action of perm.actions) {
                const base = `${perm.resource}:${action}`;
                permissions.add(perm.resourceId ? `${base}:${perm.resourceId}` : base);
            }
        }
    }
    async getUserOrgRole(orgId, userId) {
        return this.userOrgRepository.findOne({
            where: { organizationId: orgId, userId, isActive: true },
        });
    }
    getPermissionCacheKey(orgId, userId, resource, action, resourceId) {
        return `permission:${orgId}:${userId}:${resource}:${action}:${resourceId || 'any'}`;
    }
    getPermissionKey(resource, action, resourceId) {
        const base = `${resource}:${action}`;
        return resourceId ? `${base}:${resourceId}` : base;
    }
    invalidateUserPermissionCache(orgId, userId) {
        if (!this.cache) {
            return;
        }
        const keys = this.cache.keys();
        const userPrefix = `permission:${orgId}:${userId}:`;
        for (const key of keys) {
            if (key.startsWith(userPrefix)) {
                this.cache.del(key);
            }
        }
    }
    invalidateUserPermissionCacheForUser(orgId, userId) {
        this.invalidateUserPermissionCache(orgId, userId);
    }
    getPermissionCacheStats() {
        const stats = this.getCacheStats();
        if (!stats) {
            return null;
        }
        const totalRequests = stats.hits + stats.misses;
        const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
        return {
            hits: stats.hits,
            misses: stats.misses,
            hitRate: Number.parseFloat(hitRate.toFixed(2)),
            size: stats.keys,
        };
    }
    clearOrganizationPermissionCache(orgId) {
        if (!this.cache) {
            return;
        }
        const keys = this.cache.keys();
        const orgPrefix = `permission:${orgId}:`;
        for (const key of keys) {
            if (key.startsWith(orgPrefix)) {
                this.cache.del(key);
            }
        }
    }
    get securityLevelRepository() {
        return data_source_1.AppDataSource.getRepository(SecurityLevel_1.SecurityLevel);
    }
    async updateSecurityLevel(userId, organizationId, securityLevel, updatedBy) {
        const userOrg = await this.userOrgRepository.findOne({
            where: { userId, organizationId },
        });
        if (!userOrg) {
            throw new Error('User is not a member of this organization');
        }
        if (securityLevel < 1 || securityLevel > 5) {
            throw new Error('Security level must be between 1 and 5');
        }
        userOrg.securityLevel = securityLevel;
        const updated = await this.userOrgRepository.save(userOrg);
        this.invalidateUserPermissionCache(organizationId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: updatedBy,
            message: `Security level updated: User ${userId} in org ${organizationId} set to level ${securityLevel}`,
            metadata: { targetUserId: userId, organizationId, newSecurityLevel: securityLevel },
        });
        return updated;
    }
    async setInterOrgSecurityLevel(options) {
        const { sourceOrgId, targetOrgId, level, resourceType, accessLevel, approvedBy, restrictions, notes, expiresAt, } = options;
        if (level < 1 || level > 10) {
            throw new Error('Security level must be between 1 and 10');
        }
        const validAccessLevels = ['none', 'read', 'write', 'full'];
        if (!validAccessLevels.includes(accessLevel)) {
            throw new Error(`Access level must be one of: ${validAccessLevels.join(', ')}`);
        }
        if (sourceOrgId === targetOrgId) {
            throw new Error('Cannot set security level from an organization to itself');
        }
        let securityLevel = await this.securityLevelRepository.findOne({
            where: { sourceOrgId, targetOrgId, resourceType },
        });
        if (securityLevel) {
            securityLevel.level = level;
            securityLevel.accessLevel = accessLevel;
            securityLevel.approvedBy = approvedBy;
            securityLevel.updatedBy = approvedBy;
            if (restrictions !== undefined) {
                securityLevel.restrictions = restrictions;
            }
            if (notes !== undefined) {
                securityLevel.notes = notes;
            }
            if (expiresAt !== undefined) {
                securityLevel.expiresAt = expiresAt;
            }
            securityLevel.isActive = true;
        }
        else {
            securityLevel = this.securityLevelRepository.create({
                sourceOrgId,
                targetOrgId,
                level,
                resourceType,
                accessLevel,
                approvedBy,
                restrictions,
                notes,
                expiresAt,
                isActive: true,
            });
        }
        const saved = await this.securityLevelRepository.save(securityLevel);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: approvedBy,
            message: `Inter-org security level set: ${sourceOrgId} -> ${targetOrgId} for ${resourceType}`,
            metadata: { sourceOrgId, targetOrgId, resourceType, level, accessLevel, expiresAt },
        });
        return saved;
    }
    async hasInterOrgAccess(sourceOrgId, targetOrgId, resourceType, requiredAccessLevel = 'read', requiredSecurityLevel = 1) {
        let securityLevel = await this.securityLevelRepository.findOne({
            where: { sourceOrgId, targetOrgId, resourceType, isActive: true },
        });
        securityLevel ??= await this.securityLevelRepository.findOne({
            where: { sourceOrgId, targetOrgId, resourceType: '*', isActive: true },
        });
        if (!securityLevel) {
            return false;
        }
        return securityLevel.grantsAccess(requiredSecurityLevel, requiredAccessLevel);
    }
    async getInterOrgSecurityLevels(organizationId) {
        return this.securityLevelRepository.find({
            where: [{ sourceOrgId: organizationId }, { targetOrgId: organizationId }],
            relations: ['sourceOrganization', 'targetOrganization'],
            order: { createdAt: 'DESC' },
        });
    }
    async getAllSecurityLevels() {
        return this.securityLevelRepository.find({
            relations: ['sourceOrganization', 'targetOrganization'],
            order: { createdAt: 'DESC' },
        });
    }
    async revokeInterOrgSecurityLevel(sourceOrgId, targetOrgId, resourceType, revokedBy) {
        const securityLevel = await this.securityLevelRepository.findOne({
            where: { sourceOrgId, targetOrgId, resourceType },
        });
        if (securityLevel) {
            securityLevel.isActive = false;
            securityLevel.updatedBy = revokedBy;
            await this.securityLevelRepository.save(securityLevel);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: revokedBy,
                message: `Inter-org security level revoked: ${sourceOrgId} -> ${targetOrgId} for ${resourceType}`,
                metadata: { sourceOrgId, targetOrgId, resourceType },
            });
        }
    }
    async cleanupExpiredPermissions() {
        const result = await this.repository
            .createQueryBuilder()
            .update(OrganizationPermission_1.OrganizationPermission)
            .set({ isActive: false })
            .where('expiresAt < :now', { now: new Date() })
            .andWhere('isActive = :active', { active: true })
            .execute();
        let legacyCount = 0;
        if (this.permissionRepository) {
            try {
                const legacyResult = await this.permissionRepository
                    .createQueryBuilder()
                    .update(Permission_1.Permission)
                    .set({ granted: false })
                    .where('expiresAt < :now', { now: new Date() })
                    .andWhere('granted = :granted', { granted: true })
                    .execute();
                legacyCount = legacyResult.affected || 0;
            }
            catch {
                logger_1.logger.debug('Legacy Permission table not available for expired permission cleanup');
            }
        }
        return (result.affected || 0) + legacyCount;
    }
}
exports.PermissionManagerService = PermissionManagerService;
//# sourceMappingURL=PermissionManagerService.js.map