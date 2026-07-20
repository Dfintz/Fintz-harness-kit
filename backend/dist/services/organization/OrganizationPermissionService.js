"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationPermissionService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const AuditService_1 = require("../audit/AuditService");
class OrganizationPermissionService {
    permissionRepository = data_source_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission);
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    async checkPermission(userId, orgId, resource, action, resourceId, requestIP) {
        const isOwnerOrAdmin = await this.isOwnerOrAdmin(userId, orgId);
        if (isOwnerOrAdmin) {
            return {
                allowed: true,
                reason: 'Organization owner or admin',
            };
        }
        const permissions = await this.getUserPermissions(userId, orgId);
        const applicablePermissions = permissions.filter(p => {
            if (!p.isValid()) {
                return false;
            }
            if (p.resource !== resource && p.resource !== OrganizationPermission_1.ResourceType.CUSTOM) {
                return false;
            }
            if (!p.allowsAction(action)) {
                return false;
            }
            if (!p.appliesToResource(resourceId)) {
                return false;
            }
            if (!p.matchesTimeRestrictions()) {
                return false;
            }
            if (!p.matchesIPRestrictions(requestIP)) {
                return false;
            }
            return true;
        });
        if (applicablePermissions.length === 0) {
            return {
                allowed: false,
                reason: 'No applicable permissions found',
            };
        }
        applicablePermissions.sort((a, b) => b.priority - a.priority);
        return {
            allowed: true,
            matchedPermissions: applicablePermissions,
        };
    }
    async checkMultiplePermissions(userId, orgId, checks) {
        const results = new Map();
        for (const check of checks) {
            const key = `${check.resource}:${check.action}:${check.resourceId || 'any'}`;
            const result = await this.checkPermission(userId, orgId, check.resource, check.action, check.resourceId);
            results.set(key, result);
        }
        return results;
    }
    async isOwnerOrAdmin(userId, orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            return false;
        }
        if (org.ownerId === userId) {
            return true;
        }
        const membership = await this.membershipRepository.findOne({
            where: { userId, organizationId: orgId, isActive: true },
        });
        if (!membership) {
            return false;
        }
        const roleName = (0, roleUtils_1.getRoleName)(membership.role);
        return roleName === 'admin' || roleName === 'owner' || roleName === 'founder';
    }
    async getUserPermissions(userId, orgId) {
        const directPermissions = await this.permissionRepository.find({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        const inheritedPermissions = await this.getInheritedPermissions(userId, orgId);
        const allPermissions = [...directPermissions, ...inheritedPermissions];
        const uniquePermissions = new Map();
        for (const perm of allPermissions) {
            const key = `${perm.resource}:${perm.resourceId || 'any'}:${perm.actions.join(',')}`;
            const existing = uniquePermissions.get(key);
            if (!existing || perm.priority > existing.priority) {
                uniquePermissions.set(key, perm);
            }
        }
        return Array.from(uniquePermissions.values());
    }
    async getInheritedPermissions(userId, orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org?.parentOrgId) {
            return [];
        }
        if (org.settings?.inheritPermissions === false) {
            return [];
        }
        const ancestorIds = org.getAncestorIds();
        if (ancestorIds.length === 0) {
            return [];
        }
        const inheritedPermissions = await this.permissionRepository.find({
            where: {
                organizationId: (0, typeorm_1.In)(ancestorIds),
                userId,
                inheritable: true,
                isActive: true,
            },
        });
        return inheritedPermissions.map(p => ({
            ...p,
            inherited: true,
            inheritedFrom: p.organizationId,
        }));
    }
    async getOrganizationPermissions(orgId) {
        return this.permissionRepository.find({
            where: { organizationId: orgId },
            relations: ['user'],
            order: { priority: 'DESC', createdAt: 'DESC' },
        });
    }
    async getRolePermissions(orgId, roleId) {
        return this.permissionRepository.find({
            where: {
                organizationId: orgId,
                roleId,
            },
            order: { priority: 'DESC' },
        });
    }
    async grantPermission(orgId, userId, permissionData, grantedBy) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const permission = this.permissionRepository.create({
            organizationId: orgId,
            userId,
            ...permissionData,
            grantedBy,
            isActive: true,
            inherited: false,
        });
        logger_1.logger.info('Granting permission', {
            userId,
            orgId,
            resource: permissionData.resource,
            action: permissionData.actions,
            grantedBy,
        });
        const saved = await this.permissionRepository.save(permission);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
            action: 'PERMISSION_GRANTED',
            message: `Permission granted to user ${userId}`,
            userId: grantedBy,
            organizationId: orgId,
            resource: `permission/${saved.id}`,
            metadata: {
                grantedUserId: userId,
                resource: permissionData.resource,
                actions: permissionData.actions,
                grantedBy,
                grantedAt: new Date().toISOString(),
            },
        });
        return saved;
    }
    async grantMultiplePermissions(orgId, userId, permissions, grantedBy) {
        logger_1.logger.info('Granting multiple permissions', {
            userId,
            orgId,
            permissionCount: permissions.length,
            grantedBy,
        });
        const created = [];
        for (const permData of permissions) {
            const permission = await this.grantPermission(orgId, userId, permData, grantedBy);
            created.push(permission);
        }
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
            action: 'PERMISSION_GRANTED_BULK',
            message: `Bulk permissions granted to user ${userId} - ${created.length} permissions`,
            userId: grantedBy,
            organizationId: orgId,
            resource: `user/${userId}/permissions/bulk`,
            metadata: {
                grantedUserId: userId,
                permissionCount: created.length,
                grantedBy,
                grantedAt: new Date().toISOString(),
            },
        });
        return created;
    }
    async revokePermission(permissionId) {
        logger_1.logger.info('Revoking permission', { permissionId });
        const permission = await this.permissionRepository.findOne({
            where: { id: permissionId },
        });
        if (!permission) {
            logger_1.logger.warn('Permission not found for revocation', { permissionId });
            return;
        }
        await this.permissionRepository.update({ id: permissionId }, { isActive: false });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
            action: 'PERMISSION_REVOKED',
            message: `Permission revoked: ${permission.resource}`,
            organizationId: permission.organizationId,
            resource: `permission/${permissionId}`,
            metadata: {
                revokedPermissionId: permissionId,
                revokedUserId: permission.userId,
                previousResource: permission.resource,
                previousActions: permission.actions,
                revokedAt: new Date().toISOString(),
            },
        });
    }
    async revokeAllUserPermissions(userId, orgId) {
        logger_1.logger.info('Revoking all user permissions', { userId, orgId });
        const revokedCount = await this.permissionRepository.countBy({
            organizationId: orgId,
            userId,
            isActive: true,
        });
        await this.permissionRepository.update({
            organizationId: orgId,
            userId,
        }, { isActive: false });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
            action: 'PERMISSION_REVOKED_ALL',
            message: `All permissions revoked for user ${userId} in organization`,
            organizationId: orgId,
            resource: `user/${userId}/permissions`,
            metadata: {
                revokedUserId: userId,
                revokedCount,
                revokedAt: new Date().toISOString(),
            },
        });
    }
    async updatePermission(permissionId, updates) {
        const permission = await this.permissionRepository.findOne({
            where: { id: permissionId },
        });
        if (!permission) {
            throw new Error('Permission not found');
        }
        logger_1.logger.info('Updating permission', { permissionId, updateFields: Object.keys(updates) });
        const previousValue = { ...permission };
        Object.assign(permission, updates);
        const saved = await this.permissionRepository.save(permission);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
            action: 'PERMISSION_UPDATED',
            message: `Permission updated: ${permission.resource}`,
            organizationId: permission.organizationId,
            resource: `permission/${permissionId}`,
            metadata: {
                permissionId,
                previousValue: {
                    resource: previousValue.resource,
                    actions: previousValue.actions,
                    priority: previousValue.priority,
                    isActive: previousValue.isActive,
                },
                newValue: {
                    resource: saved.resource,
                    actions: saved.actions,
                    priority: saved.priority,
                    isActive: saved.isActive,
                },
                updatedFields: Object.keys(updates),
                updatedAt: new Date().toISOString(),
            },
        });
        return saved;
    }
    async applyPermissionTemplate(orgId, userId, templateName, grantedBy) {
        const template = OrganizationPermission_1.PermissionTemplates[templateName];
        if (!template) {
            throw new Error(`Unknown permission template: ${templateName}`);
        }
        await this.revokeAllUserPermissions(userId, orgId);
        const permissions = template.permissions.map(p => ({
            resource: p.resource,
            actions: p.actions,
            scope: p.scope,
            inheritable: true,
            priority: 5,
            reason: `Applied template: ${template.name}`,
        }));
        return this.grantMultiplePermissions(orgId, userId, permissions, grantedBy);
    }
    getAvailableTemplates() {
        return Object.entries(OrganizationPermission_1.PermissionTemplates).map(([key, value]) => ({
            name: key,
            description: value.description,
        }));
    }
    async propagateToChildren(orgId, permissionId) {
        const permission = await this.permissionRepository.findOne({
            where: { id: permissionId },
        });
        if (!permission?.inheritable) {
            throw new Error('Permission not found or not inheritable');
        }
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const descendants = await this.organizationRepository.find({
            where: {
                path: (0, typeorm_1.In)([`${org.path}.%`]),
            },
        });
        for (const descendant of descendants) {
            if (descendant.settings?.inheritPermissions === false) {
                continue;
            }
            const existing = await this.permissionRepository.findOne({
                where: {
                    organizationId: descendant.id,
                    userId: permission.userId,
                    resource: permission.resource,
                    resourceId: permission.resourceId,
                },
            });
            if (!existing) {
                const inheritedPerm = this.permissionRepository.create({
                    ...permission,
                    id: undefined,
                    organizationId: descendant.id,
                    inherited: true,
                    inheritedFrom: orgId,
                    priority: permission.priority - 1,
                });
                await this.permissionRepository.save(inheritedPerm);
            }
        }
    }
    async cleanupExpiredPermissions() {
        const result = await this.permissionRepository
            .createQueryBuilder()
            .update(OrganizationPermission_1.OrganizationPermission)
            .set({ isActive: false })
            .where('expiresAt IS NOT NULL')
            .andWhere('expiresAt < :now', { now: new Date() })
            .andWhere('isActive = true')
            .execute();
        return result.affected || 0;
    }
    async cleanupOrphanedPermissions() {
        return 0;
    }
    async getPermissionStats(orgId) {
        const allPermissions = await this.permissionRepository.find({
            where: { organizationId: orgId },
        });
        const activePermissions = allPermissions.filter(p => p.isActive);
        const inheritedPermissions = allPermissions.filter(p => p.inherited);
        const directPermissions = allPermissions.filter(p => !p.inherited);
        const permissionsByResource = {};
        for (const perm of allPermissions) {
            permissionsByResource[perm.resource] = (permissionsByResource[perm.resource] || 0) + 1;
        }
        const uniqueUsers = new Set(allPermissions.map(p => p.userId).filter(Boolean));
        return {
            totalPermissions: allPermissions.length,
            activePermissions: activePermissions.length,
            inheritedPermissions: inheritedPermissions.length,
            directPermissions: directPermissions.length,
            permissionsByResource,
            userCount: uniqueUsers.size,
        };
    }
    async batchGrantPermissions(orgId, grants, grantedBy) {
        if (!grants || grants.length === 0) {
            return [];
        }
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const permissions = grants.map(grant => this.permissionRepository.create({
            organizationId: orgId,
            userId: grant.userId,
            resource: grant.resource,
            actions: grant.actions,
            scope: grant.scope || OrganizationPermission_1.PermissionScope.ORGANIZATION,
            resourceId: grant.resourceId,
            inheritedFrom: undefined,
            priority: 100,
            grantedBy,
            isActive: true,
            inherited: false,
            expiresAt: grant.expiresAt,
            metadata: grant.metadata,
        }));
        return this.permissionRepository.save(permissions);
    }
    async batchRevokePermissions(permissionIds) {
        if (!permissionIds || permissionIds.length === 0) {
            return;
        }
        await this.permissionRepository.delete(permissionIds);
    }
    async batchGrantUserPermissions(orgId, userId, permissions, grantedBy) {
        const grants = permissions.map(p => ({
            userId,
            resource: p.resource,
            actions: p.actions,
        }));
        return this.batchGrantPermissions(orgId, grants, grantedBy);
    }
    async batchGrantSamePermissions(orgId, userIds, permissions, grantedBy) {
        const grants = userIds.flatMap(userId => permissions.map(p => ({
            userId,
            resource: p.resource,
            actions: p.actions,
        })));
        return this.batchGrantPermissions(orgId, grants, grantedBy);
    }
}
exports.OrganizationPermissionService = OrganizationPermissionService;
//# sourceMappingURL=OrganizationPermissionService.js.map