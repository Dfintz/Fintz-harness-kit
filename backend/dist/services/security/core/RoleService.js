"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
exports.getRoleService = getRoleService;
const database_1 = require("../../../config/database");
const OrganizationPermission_1 = require("../../../models/OrganizationPermission");
const Role_1 = require("../../../models/Role");
const logger_1 = require("../../../utils/logger");
const roleUtils_1 = require("../../../utils/roleUtils");
class RoleService {
    roleRepository;
    roleCache = new Map();
    roleCacheByName = new Map();
    constructor() {
        this.roleRepository = database_1.AppDataSource.getRepository(Role_1.Role);
    }
    async getRoleById(roleId) {
        if (this.roleCache.has(roleId)) {
            return this.roleCache.get(roleId) ?? null;
        }
        const role = await this.roleRepository.findOne({ where: { id: roleId } });
        if (role) {
            this.roleCache.set(roleId, role);
        }
        return role;
    }
    async getRoleByName(name, organizationId = null) {
        const cacheKey = organizationId ?? 'system';
        const orgCache = this.roleCacheByName.get(cacheKey);
        if (orgCache?.has(name)) {
            return orgCache.get(name) ?? null;
        }
        const role = await this.roleRepository.findOne({
            where: { name, organizationId: organizationId ?? undefined },
        });
        if (role) {
            if (!this.roleCacheByName.has(cacheKey)) {
                this.roleCacheByName.set(cacheKey, new Map());
            }
            this.roleCacheByName.get(cacheKey)?.set(name, role);
            this.roleCache.set(role.id, role);
        }
        return role;
    }
    async getRoleIdByName(name, organizationId = null) {
        const role = await this.getRoleByName(name, organizationId);
        return role?.id ?? null;
    }
    async getOrCreateRole(name, organizationId, description, permissions, priority) {
        let role = await this.getRoleByName(name, organizationId);
        if (!role) {
            role = this.roleRepository.create({
                name,
                organizationId,
                description,
                permissions,
                priority,
                isSystemRole: organizationId === null,
            });
            await this.roleRepository.save(role);
            this.roleCache.set(role.id, role);
            const cacheKey = organizationId ?? 'system';
            if (!this.roleCacheByName.has(cacheKey)) {
                this.roleCacheByName.set(cacheKey, new Map());
            }
            this.roleCacheByName.get(cacheKey)?.set(name, role);
        }
        return role;
    }
    async getDefaultMemberRole(organizationId) {
        return this.getOrCreateRole('member', organizationId, 'Standard organization member', undefined, 10);
    }
    async getFallbackMemberRoleId(organizationId) {
        const role = await this.roleRepository.findOne({
            where: { organizationId },
            order: { priority: 'ASC' },
        });
        return role?.id ?? null;
    }
    async resolveRoleIdWithDefaultFallback(name, organizationId) {
        const direct = await this.getRoleIdByName(name, organizationId);
        if (direct) {
            return direct;
        }
        const fallbackId = await this.getFallbackMemberRoleId(organizationId);
        if (fallbackId) {
            logger_1.logger.warn('RoleService.resolveRoleIdWithDefaultFallback — requested role missing; using lowest-priority role as fallback', { organizationId, requestedRole: name, fallbackRoleId: fallbackId });
            return fallbackId;
        }
        return null;
    }
    async getOwnerRole(organizationId) {
        const founder = await this.getRoleByName('founder', organizationId);
        if (founder) {
            return founder;
        }
        return this.getOrCreateRole('founder', organizationId, 'Organization founder', undefined, 100);
    }
    async getAdminRole(organizationId) {
        return this.getOrCreateRole('admin', organizationId, 'Organization administrator', undefined, 80);
    }
    async getRecruitRole(organizationId) {
        return this.getOrCreateRole('recruit', organizationId, 'New recruit — probationary member', undefined, 5);
    }
    roleNameEquals(role, targetName) {
        if (!role) {
            return false;
        }
        if (typeof role === 'string') {
            return role === targetName;
        }
        return role.name === targetName;
    }
    async seedDefaultRolePermissions(organizationId, role) {
        const permRepo = database_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission);
        const defaults = (0, roleUtils_1.getDefaultPermissionsForRole)(role.name);
        let created = 0;
        for (const permKey of defaults) {
            const [resource, action] = permKey.split(':');
            if (!resource || !action) {
                continue;
            }
            const existing = await permRepo.findOne({
                where: {
                    organizationId,
                    roleId: role.id,
                    resource: resource,
                    isActive: true,
                },
            });
            if (existing) {
                const actionUpper = action.toUpperCase();
                if (action === '*') {
                    if (!existing.actions.includes(OrganizationPermission_1.PermissionAction.ALL)) {
                        existing.actions.push(OrganizationPermission_1.PermissionAction.ALL);
                        await permRepo.save(existing);
                    }
                }
                else if (!existing.actions.includes(actionUpper)) {
                    existing.actions.push(actionUpper);
                    await permRepo.save(existing);
                }
                continue;
            }
            const actionUpper = action === '*' ? OrganizationPermission_1.PermissionAction.ALL : action.toUpperCase();
            const perm = permRepo.create({
                organizationId,
                roleId: role.id,
                resource: resource,
                actions: [actionUpper],
                isActive: true,
                priority: 1,
                inheritable: true,
                inherited: false,
                reason: `Seeded from default ${role.name} permissions`,
            });
            await permRepo.save(perm);
            created++;
        }
        return created;
    }
    async seedAllRolePermissions(organizationId) {
        const roles = await this.roleRepository.find({
            where: { organizationId },
        });
        let totalCreated = 0;
        for (const role of roles) {
            const count = await this.seedDefaultRolePermissions(organizationId, role);
            totalCreated += count;
        }
        logger_1.logger.info(`Seeded ${totalCreated} role permissions for org ${organizationId}`);
        return totalCreated;
    }
    async getOrganizationRolesWithCounts(organizationId) {
        const roles = await this.roleRepository.find({
            where: { organizationId },
            order: { priority: 'DESC' },
        });
        const membershipRepo = database_1.AppDataSource.getRepository('OrganizationMembership');
        const rolesWithCounts = await Promise.all(roles.map(async (role) => {
            const memberCount = await membershipRepo.count({
                where: { organizationId, roleId: role.id, isActive: true },
            });
            return { ...role, memberCount };
        }));
        return rolesWithCounts;
    }
    clearCache() {
        this.roleCache.clear();
        this.roleCacheByName.clear();
    }
    async initializeOrganizationRoles(organizationId) {
        const [founder, admin, senior_officer, officer, member, recruit] = await Promise.all([
            this.getOrCreateRole('founder', organizationId, 'Organization founder with full control', undefined, 100),
            this.getOrCreateRole('admin', organizationId, 'Organization administrator', undefined, 80),
            this.getOrCreateRole('senior_officer', organizationId, 'Senior officer — fleet and team management', undefined, 60),
            this.getOrCreateRole('officer', organizationId, 'Officer — operational leadership', undefined, 40),
            this.getOrCreateRole('member', organizationId, 'Standard organization member', undefined, 10),
            this.getOrCreateRole('recruit', organizationId, 'New recruit — probationary member', undefined, 5),
        ]);
        await Promise.all([
            this.seedDefaultRolePermissions(organizationId, admin),
            this.seedDefaultRolePermissions(organizationId, senior_officer),
            this.seedDefaultRolePermissions(organizationId, officer),
            this.seedDefaultRolePermissions(organizationId, member),
            this.seedDefaultRolePermissions(organizationId, recruit),
        ]);
        return { founder, admin, senior_officer, officer, member, recruit };
    }
}
exports.RoleService = RoleService;
let roleServiceInstance = null;
function getRoleService() {
    roleServiceInstance ??= new RoleService();
    return roleServiceInstance;
}
//# sourceMappingURL=RoleService.js.map