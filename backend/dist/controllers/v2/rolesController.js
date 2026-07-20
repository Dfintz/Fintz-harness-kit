"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesControllerV2 = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const Role_1 = require("../../models/Role");
const User_1 = require("../../models/User");
const MemberRoleAssignmentService_1 = require("../../services/organization/MemberRoleAssignmentService");
const PermissionChangeEventService_1 = require("../../services/security/permissions/PermissionChangeEventService");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const authHelpers_1 = require("../../utils/authHelpers");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const BaseController_1 = require("../BaseController");
class RolesControllerV2 extends BaseController_1.BaseController {
    roleRepository = database_1.AppDataSource.getRepository(Role_1.Role);
    membershipRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    permissionChangeEventService = PermissionChangeEventService_1.PermissionChangeEventService.getInstance();
    memberRoleAssignmentService = new MemberRoleAssignmentService_1.MemberRoleAssignmentService();
    async resolveAffectedUserIdsByRole(organizationId, roleId) {
        const rows = await this.membershipRepository
            .createQueryBuilder('membership')
            .select('DISTINCT membership.userId', 'userId')
            .where('membership.organizationId = :organizationId', { organizationId })
            .andWhere('membership.roleId = :roleId', { roleId })
            .andWhere('membership.isActive = :isActive', { isActive: true })
            .getRawMany();
        return rows.map(row => row.userId);
    }
    async resolveAffectedUserIdsByRoles(organizationId, roleIds) {
        if (roleIds.length === 0) {
            return [];
        }
        const rows = await this.membershipRepository
            .createQueryBuilder('membership')
            .select('DISTINCT membership.userId', 'userId')
            .where('membership.organizationId = :organizationId', { organizationId })
            .andWhere('membership.roleId IN (:...roleIds)', { roleIds })
            .andWhere('membership.isActive = :isActive', { isActive: true })
            .getRawMany();
        return rows.map(row => row.userId);
    }
    async processPermissionChange(organizationId, actorUserId, changeType, affectedUserIds) {
        await this.permissionChangeEventService.onRolePermissionChanged(organizationId, affectedUserIds, changeType, actorUserId);
    }
    async verifyRoleManagementAccess(userId, organizationId, action) {
        if (organizationId) {
            const membership = await this.membershipRepository.findOne({
                where: { userId, organizationId, isActive: true },
                relations: ['role'],
            });
            const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
            if (!membership || !['owner', 'founder', 'admin'].includes(roleName)) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, `Organization admin access required to ${action}`, 403);
            }
        }
        else {
            const userRepository = database_1.AppDataSource.getRepository(User_1.User);
            const requestingUser = await userRepository.findOne({ where: { id: userId } });
            if (requestingUser?.role !== 'admin') {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, `Platform admin access required to ${action}`, 403);
            }
        }
    }
    async listRoles(req, res) {
        await this.executeAndReturn(req, res, async (request) => {
            (0, authHelpers_1.getAuthenticatedUserId)(request);
            const page = Number.parseInt(request.query.page) || 1;
            const limit = Math.min(Number.parseInt(request.query.limit) || 50, 100);
            const offset = (page - 1) * limit;
            const organizationId = request.query.organizationId;
            const includeSystem = request.query.includeSystem;
            const where = {};
            if (organizationId) {
                where.organizationId = organizationId;
            }
            else if (includeSystem === 'true') {
                where.isSystemRole = true;
            }
            const [dbRoles, total] = await this.roleRepository.findAndCount({
                where,
                order: { priority: 'DESC', name: 'ASC' },
                skip: offset,
                take: limit,
            });
            const roles = dbRoles.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description ?? '',
                scope: r.isSystemRole ? 'system' : 'organization',
                permissions: r.permissions ?? [],
                priority: r.priority,
                isSystemRole: r.isSystemRole,
                organizationId: r.organizationId ?? null,
                default: r.name === 'member' || r.name === 'user',
                createdAt: r.createdAt,
                modifiable: !r.isSystemRole,
            }));
            return {
                roles,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            };
        });
    }
    async getRole(req, res) {
        await this.executeAndReturn(req, res, async (request) => {
            const { roleId } = request.params;
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            const userCount = await this.membershipRepository.count({
                where: { roleId: role.id },
            });
            return {
                id: role.id,
                name: role.name,
                description: role.description,
                scope: role.isSystemRole ? 'system' : 'organization',
                organizationId: role.organizationId,
                permissions: role.permissions ?? [],
                priority: role.priority,
                isSystemRole: role.isSystemRole,
                createdAt: role.createdAt,
                updatedAt: role.updatedAt,
                modifiable: !role.isSystemRole,
                userCount,
            };
        });
    }
    async createRole(req, res) {
        await this.executeAndReturn(req, res, async (request) => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(request);
            const { name, description, scope, permissions, organizationId, priority } = request.body;
            const isSystemRole = scope === 'system';
            if (!isSystemRole && !organizationId) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Organization ID is required for organization-scoped roles', 400);
            }
            await this.verifyRoleManagementAccess(userId, isSystemRole ? null : organizationId, 'create roles');
            const orgIdForQuery = isSystemRole ? undefined : organizationId;
            const existingRole = await this.roleRepository.findOne({
                where: {
                    name,
                    ...(orgIdForQuery ? { organizationId: orgIdForQuery } : { organizationId: (0, typeorm_1.IsNull)() }),
                },
            });
            if (existingRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_ALREADY_EXISTS, 'A role with this name already exists in this scope', 409);
            }
            const newRole = this.roleRepository.create({
                name,
                description,
                organizationId: isSystemRole ? undefined : organizationId,
                isSystemRole,
                priority: typeof priority === 'number' ? Math.max(1, Math.min(100, priority)) : 50,
                permissions: permissions ?? [],
            });
            const savedRole = await this.roleRepository.save(newRole);
            logger_1.logger.info(`Custom role created: ${savedRole.id} (${name}) by user ${userId}`);
            return {
                id: savedRole.id,
                name: savedRole.name,
                description: savedRole.description,
                scope,
                organizationId: savedRole.organizationId,
                permissions: savedRole.permissions ?? [],
                priority: savedRole.priority,
                createdAt: savedRole.createdAt,
                createdBy: userId,
            };
        }, 201);
    }
    async updateRole(req, res) {
        await this.executeAndReturn(req, res, async (request) => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(request);
            const { roleId } = request.params;
            const { name, description, permissions, priority } = request.body;
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            await this.verifyRoleManagementAccess(userId, role.organizationId, 'update roles');
            if (role.isSystemRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'System roles cannot be modified', 403);
            }
            if (name) {
                role.name = name;
            }
            if (description !== undefined) {
                role.description = description;
            }
            if (permissions) {
                role.permissions = permissions;
            }
            if (typeof priority === 'number') {
                role.priority = Math.max(1, Math.min(100, priority));
            }
            const updatedRole = await this.roleRepository.save(role);
            if (updatedRole.organizationId) {
                const affectedUserIds = await this.resolveAffectedUserIdsByRole(updatedRole.organizationId, updatedRole.id);
                await this.processPermissionChange(updatedRole.organizationId, userId, 'role_updated', affectedUserIds);
            }
            logger_1.logger.info(`Role updated: ${roleId} by user ${userId}`);
            return {
                id: updatedRole.id,
                name: updatedRole.name,
                description: updatedRole.description,
                permissions: updatedRole.permissions,
                priority: updatedRole.priority,
                updatedAt: updatedRole.updatedAt,
            };
        });
    }
    async reorderRoles(req, res) {
        await this.executeAndReturn(req, res, async (request) => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(request);
            const { orgId } = request.params;
            const { updates } = request.body;
            await this.verifyRoleManagementAccess(userId, orgId, 'reorder roles');
            const roleIds = updates.map(update => update.roleId);
            const uniqueRoleIds = new Set(roleIds);
            if (uniqueRoleIds.size !== roleIds.length) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Duplicate role IDs in reorder request', 400);
            }
            await database_1.AppDataSource.transaction(async (manager) => {
                const roleRepository = manager.getRepository(Role_1.Role);
                const roles = await roleRepository.find({
                    where: {
                        id: (0, typeorm_1.In)(roleIds),
                        organizationId: orgId,
                    },
                });
                if (roles.length !== roleIds.length) {
                    throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'One or more roles were not found in this organization', 404);
                }
                if (roles.some(role => role.isSystemRole)) {
                    throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'System roles cannot be reordered', 403);
                }
                const updatesByRoleId = new Map(updates.map(update => [update.roleId, update.priority]));
                for (const role of roles) {
                    const nextPriority = updatesByRoleId.get(role.id);
                    if (typeof nextPriority === 'number') {
                        role.priority = Math.max(1, Math.min(100, nextPriority));
                    }
                }
                await roleRepository.save(roles);
            });
            const affectedUserIds = await this.resolveAffectedUserIdsByRoles(orgId, roleIds);
            await this.processPermissionChange(orgId, userId, 'roles_reordered', affectedUserIds);
            logger_1.logger.info(`Roles reordered for organization ${orgId} by user ${userId}`);
            return {
                organizationId: orgId,
                updatedCount: updates.length,
                updatedAt: new Date(),
            };
        });
    }
    async deleteRole(req, res) {
        await this.executeAndReturn(req, res, async (request) => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(request);
            const { roleId } = request.params;
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            await this.verifyRoleManagementAccess(userId, role.organizationId, 'delete roles');
            if (role.isSystemRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'System roles cannot be deleted', 403);
            }
            const usersWithRole = await this.membershipRepository.count({
                where: { roleId: role.id },
            });
            if (usersWithRole > 0) {
                const memberRole = await this.roleRepository.findOne({
                    where: { name: 'member', organizationId: role.organizationId },
                });
                if (memberRole) {
                    await this.membershipRepository.update({ roleId: role.id }, { roleId: memberRole.id });
                }
                logger_1.logger.info(`Reassigned ${usersWithRole} users from role ${role.name} to member`);
            }
            await this.roleRepository.remove(role);
            if (role.organizationId) {
                const affectedUserIds = await this.resolveAffectedUserIdsByRole(role.organizationId, role.id);
                await this.processPermissionChange(role.organizationId, userId, 'role_deleted', affectedUserIds);
            }
            logger_1.logger.info(`Role deleted: ${roleId} by user ${userId}`);
            return {
                deletedId: roleId,
                deletedAt: new Date(),
                reassignedUsers: usersWithRole,
            };
        });
    }
    async assignRoleToUser(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { roleId } = req.params;
            const { userId: targetUserId, organizationId } = req.body;
            await this.verifyRoleManagementAccess(userId, organizationId, 'assign roles');
            const result = await this.memberRoleAssignmentService.assignRole({
                organizationId,
                targetUserId,
                roleId,
                actorUserId: userId,
            });
            logger_1.logger.info(`Role ${result.roleName} assigned to user ${targetUserId} in org ${organizationId} (previous: ${result.previousRoleName})`);
            res.status(201).success({
                userId: targetUserId,
                organizationId,
                roleId: result.roleId,
                roleName: result.roleName,
                previousRoleId: result.previousRoleName,
                assignedAt: new Date(),
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to assign role: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async removeRoleFromUser(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { roleId, userId: targetUserId } = req.params;
            const organizationId = (req.query.organizationId ??
                req.body?.organizationId);
            if (!organizationId) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Organization ID is required', 400);
            }
            await this.verifyRoleManagementAccess(userId, organizationId, 'remove roles');
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            const membership = await this.membershipRepository.findOne({
                where: { userId: targetUserId, organizationId },
            });
            if (!membership) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User is not a member of this organization', 404);
            }
            if (membership.roleId !== roleId) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'User does not have this role', 400);
            }
            const memberRole = await this.roleRepository.findOne({
                where: { name: 'member', organizationId },
            });
            if (!memberRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Default member role not found', 500);
            }
            membership.roleId = memberRole.id;
            await this.membershipRepository.save(membership);
            await this.permissionChangeEventService.onUserRoleChanged(organizationId, targetUserId, 'role_revoked', userId);
            logger_1.logger.info(`Role ${role.name} removed from user ${targetUserId} in org ${organizationId}`);
            res.success({
                userId: targetUserId,
                organizationId,
                removedRoleId: roleId,
                newRoleId: 'member',
                newRoleName: 'member',
                removedAt: new Date(),
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to remove role: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getRolePermissions(req, res) {
        try {
            const { roleId } = req.params;
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            const permissions = role.permissions ?? [];
            res.success({
                roleId,
                roleName: role.name,
                permissions,
                count: permissions.length,
                isSystemRole: role.isSystemRole,
                priority: role.priority,
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get role permissions: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async addPermissionToRole(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { roleId } = req.params;
            const { permissionId } = req.body;
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            await this.verifyRoleManagementAccess(userId, role.organizationId, 'modify role permissions');
            if (role.isSystemRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Cannot modify permissions of system roles', 403);
            }
            const permissions = role.permissions ?? [];
            if (!permissions.includes(permissionId)) {
                permissions.push(permissionId);
                role.permissions = permissions;
                await this.roleRepository.save(role);
                if (role.organizationId) {
                    const affectedUserIds = await this.resolveAffectedUserIdsByRole(role.organizationId, role.id);
                    await this.processPermissionChange(role.organizationId, userId, 'permission_added', affectedUserIds);
                }
                logger_1.logger.info(`Permission ${permissionId} added to role ${roleId}`);
            }
            res.status(201).success({
                roleId,
                roleName: role.name,
                permissionId,
                permissions: role.permissions,
                addedAt: new Date(),
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to add permission: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async removePermissionFromRole(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { roleId, permissionId } = req.params;
            const role = await this.roleRepository.findOne({ where: { id: roleId } });
            if (!role) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            await this.verifyRoleManagementAccess(userId, role.organizationId, 'modify role permissions');
            if (role.isSystemRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Cannot modify permissions of system roles', 403);
            }
            const permissions = role.permissions ?? [];
            const initialLength = permissions.length;
            role.permissions = permissions.filter(p => p !== permissionId);
            if (role.permissions.length < initialLength) {
                await this.roleRepository.save(role);
                if (role.organizationId) {
                    const affectedUserIds = await this.resolveAffectedUserIdsByRole(role.organizationId, role.id);
                    await this.processPermissionChange(role.organizationId, userId, 'permission_removed', affectedUserIds);
                }
                logger_1.logger.info(`Permission ${permissionId} removed from role ${roleId}`);
            }
            res.success({
                roleId,
                roleName: role.name,
                removedPermissionId: permissionId,
                permissions: role.permissions,
                removedAt: new Date(),
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to remove permission: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async searchByScope(req, res) {
        try {
            const scope = req.query.scope;
            const searchOrgId = req.query.organizationId;
            let dbRoles = [];
            if (scope === 'system') {
                dbRoles = await this.roleRepository.find({
                    where: { isSystemRole: true },
                    order: { priority: 'DESC' },
                });
            }
            else if (scope === 'organization' && searchOrgId) {
                dbRoles = await this.roleRepository.find({
                    where: { organizationId: searchOrgId, isSystemRole: false },
                    order: { priority: 'DESC' },
                });
            }
            else {
                dbRoles = [];
            }
            const roles = dbRoles.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description ?? '',
                scope,
                permissions: r.permissions ?? [],
                priority: r.priority,
                isSystemRole: !!r.isSystemRole,
                organizationId: scope === 'organization' ? (searchOrgId ?? null) : null,
                createdAt: r.createdAt,
                modifiable: !r.isSystemRole,
            }));
            res.success({
                scope,
                organizationId: searchOrgId ?? null,
                roles,
                count: roles.length,
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to search roles: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    getTemplates(_req, res) {
        try {
            const templates = [
                {
                    id: 'template:org-admin',
                    name: 'Organization Admin Template',
                    description: 'Pre-configured for org administrators',
                    scope: 'organization',
                    permissions: [
                        'org:members:manage',
                        'org:settings:write',
                        'org:permissions:manage',
                        'fleet:manage_members',
                        'fleet:manage_ships',
                    ],
                },
                {
                    id: 'template:fleet-lead',
                    name: 'Fleet Leader Template',
                    description: 'Pre-configured for fleet leaders',
                    scope: 'fleet',
                    permissions: ['fleet:*', 'org:read'],
                },
                {
                    id: 'template:member',
                    name: 'Standard Member Template',
                    description: 'Pre-configured for regular members',
                    scope: 'organization',
                    permissions: ['org:read', 'org:members:read'],
                },
            ];
            res.success({
                templates,
                count: templates.length,
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get templates: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async applyTemplate(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { templateId } = req.params;
            const { roleName, organizationId } = req.body;
            const templates = {
                'template:org-admin': {
                    description: 'Pre-configured for org administrators',
                    permissions: [
                        'org:members:manage',
                        'org:settings:write',
                        'org:permissions:manage',
                        'fleet:manage_members',
                        'fleet:manage_ships',
                    ],
                    priority: 90,
                    scope: 'organization',
                },
                'template:fleet-lead': {
                    description: 'Pre-configured for fleet leaders',
                    permissions: ['fleet:*', 'org:read'],
                    priority: 80,
                    scope: 'fleet',
                },
                'template:member': {
                    description: 'Pre-configured for regular members',
                    permissions: ['org:read', 'org:members:read'],
                    priority: 10,
                    scope: 'organization',
                },
            };
            const template = templates[templateId];
            if (!template) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Template not found', 404);
            }
            await this.verifyRoleManagementAccess(userId, template.scope === 'system' ? null : organizationId, 'apply role templates');
            if (template.scope !== 'system' && !organizationId) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Organization ID is required for organization-scoped roles', 400);
            }
            const existingRole = await this.roleRepository.findOne({
                where: {
                    name: roleName,
                    ...(organizationId ? { organizationId } : { organizationId: (0, typeorm_1.IsNull)() }),
                },
            });
            if (existingRole) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_ALREADY_EXISTS, 'A role with this name already exists', 409);
            }
            const newRole = this.roleRepository.create({
                name: roleName,
                description: template.description,
                organizationId,
                isSystemRole: template.scope === 'system',
                priority: template.priority,
                permissions: template.permissions,
            });
            const savedRole = await this.roleRepository.save(newRole);
            logger_1.logger.info(`Role created from template ${templateId}: ${savedRole.id} by user ${userId}`);
            res.status(201).success({
                id: savedRole.id,
                name: savedRole.name,
                description: savedRole.description,
                templateApplied: templateId,
                organizationId: savedRole.organizationId,
                permissions: savedRole.permissions,
                priority: savedRole.priority,
                createdAt: savedRole.createdAt,
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ApiError) {
                throw error;
            }
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to apply template: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
}
exports.RolesControllerV2 = RolesControllerV2;
//# sourceMappingURL=rolesController.js.map