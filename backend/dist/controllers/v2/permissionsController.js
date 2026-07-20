"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const User_1 = require("../../models/User");
const PermissionManagerService_1 = require("../../services/security/permissions/PermissionManagerService");
const PermissionService_1 = require("../../services/security/permissions/PermissionService");
const api_1 = require("../../types/api");
const permissions_1 = require("../../types/permissions");
const authHelpers_1 = require("../../utils/authHelpers");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const BaseController_1 = require("../BaseController");
function titleCasePermissionLabel(permissionKey) {
    return permissionKey
        .split(':')
        .map(part => part
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()))
        .join(' · ');
}
function getPermissionRiskTier(permissionKey) {
    if (permissionKey.includes('*')) {
        return 'high';
    }
    const action = permissionKey.split(':').at(-1) ?? '';
    if (['delete', 'manage', 'admin', 'write'].includes(action)) {
        return 'high';
    }
    if (['create', 'edit', 'approve', 'invite', 'assign', 'revoke'].includes(action)) {
        return 'medium';
    }
    return 'low';
}
function normalizeCatalogFilter(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
}
function buildPermissionCatalog() {
    return Object.entries(permissions_1.PERMISSION_CATEGORIES).map(([categoryKey, category]) => {
        const permissions = Object.values(category.permissions).map(permissionKey => ({
            id: permissionKey,
            key: permissionKey,
            name: titleCasePermissionLabel(permissionKey),
            description: permissions_1.PERMISSION_DESCRIPTIONS[permissionKey] ?? titleCasePermissionLabel(permissionKey),
            category: categoryKey,
            categoryLabel: category.label,
            riskTier: getPermissionRiskTier(permissionKey),
        }));
        return {
            key: categoryKey,
            label: category.label,
            description: category.description,
            count: permissions.length,
            permissions,
        };
    });
}
function filterPermissionCatalog(groups, search, category) {
    const normalizedSearch = search?.trim().toLowerCase() ?? null;
    const normalizedCategory = category?.trim().toLowerCase() ?? null;
    return groups
        .filter(group => !normalizedCategory || group.key.toLowerCase() === normalizedCategory)
        .map(group => {
        const permissions = group.permissions.filter(permission => {
            if (!normalizedSearch) {
                return true;
            }
            return [
                permission.key,
                permission.name,
                permission.description,
                permission.category,
                permission.categoryLabel,
            ].some(value => value.toLowerCase().includes(normalizedSearch));
        });
        return {
            ...group,
            count: permissions.length,
            permissions,
        };
    })
        .filter(group => group.permissions.length > 0);
}
function flattenPermissionCatalog(groups) {
    return groups.flatMap(group => group.permissions);
}
function buildPermissionSourceEntry(permission) {
    const permissionId = permission.resourceId
        ? `${permission.resource}:${permission.actions.join(',')}:${permission.resourceId}`
        : `${permission.resource}:${permission.actions.join(',')}`;
    return {
        id: permission.id,
        permissionId,
        resource: permission.resource,
        actions: permission.actions,
        resourceId: permission.resourceId,
        expiresAt: permission.expiresAt ?? null,
        grantedBy: permission.grantedBy ?? null,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
        description: permissions_1.PERMISSION_DESCRIPTIONS[`${permission.resource}:${permission.actions[0] ?? ''}`] ??
            titleCasePermissionLabel(permissionId),
    };
}
class PermissionsControllerV2 extends BaseController_1.BaseController {
    membershipRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    permissionManager = new PermissionManagerService_1.PermissionManagerService();
    userRepository = database_1.AppDataSource.getRepository(User_1.User);
    async verifyAdminAccess(userId, organizationId) {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.id = :userId', { userId })
            .getOne();
        if (!user) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
        }
        if (user.role === 'admin') {
            return user;
        }
        const membershipsQuery = this.membershipRepository
            .createQueryBuilder('membership')
            .leftJoinAndSelect('membership.role', 'role')
            .where('membership.userId = :userId', { userId })
            .andWhere('membership.isActive = :isActive', { isActive: true });
        if (organizationId) {
            membershipsQuery.andWhere('membership.organizationId = :organizationId', { organizationId });
        }
        const memberships = await membershipsQuery.getMany();
        if (memberships.some(m => (0, roleUtils_1.isOwnerOrAdminRole)(m.role))) {
            return user;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
    }
    async listPermissions(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const queryParams = req.queryParams;
            const query = req.query;
            const parsedSearch = queryParams?.['search'];
            const parsedCategory = queryParams?.['category'];
            const querySearch = query?.['search'];
            const queryCategory = query?.['category'];
            const search = normalizeCatalogFilter(parsedSearch ?? querySearch);
            const category = normalizeCatalogFilter(parsedCategory ?? queryCategory);
            await this.verifyAdminAccess(userId);
            const catalog = buildPermissionCatalog();
            const filteredCatalog = filterPermissionCatalog(catalog, search, category);
            const permissions = flattenPermissionCatalog(filteredCatalog);
            return {
                permissions,
                categories: filteredCatalog,
                total: permissions.length,
                filters: {
                    search,
                    category,
                },
            };
        });
    }
    async getPermission(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { id: permissionId } = req.params;
            await this.verifyAdminAccess(userId);
            const catalog = flattenPermissionCatalog(buildPermissionCatalog());
            const permission = catalog.find(entry => entry.id === permissionId || entry.key === permissionId);
            if (!permission) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Permission not found', 404);
            }
            return permission;
        });
    }
    async getUserPermissions(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { userId } = req.params;
            if (requestingUserId !== userId) {
                await this.verifyAdminAccess(requestingUserId);
            }
            const permissions = [
                {
                    id: 'perm_1',
                    name: 'organization:read',
                    description: 'View organization details',
                    grantedAt: new Date(),
                },
                {
                    id: 'perm_3',
                    name: 'fleet:read',
                    description: 'View fleet information',
                    grantedAt: new Date(),
                },
            ];
            return {
                userId,
                permissions,
                total: permissions.length,
            };
        });
    }
    async checkPermission(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { userId, permission, resource } = req.body;
            if (requestingUserId !== userId) {
                await this.verifyAdminAccess(requestingUserId);
            }
            const hasPermission = permission === 'organization:read';
            return {
                userId,
                permission,
                resource,
                granted: hasPermission,
            };
        });
    }
    async listRoles(req, res) {
        await this.execute(req, res, async () => {
            const _userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { limit = 50, offset = 0 } = req.queryParams || {};
            const allRoles = [
                {
                    id: 'role_1',
                    name: 'admin',
                    description: 'Full system administrator',
                    level: 100,
                },
                {
                    id: 'role_2',
                    name: 'org_owner',
                    description: 'Organization owner',
                    level: 80,
                },
                {
                    id: 'role_3',
                    name: 'org_admin',
                    description: 'Organization administrator',
                    level: 70,
                },
                {
                    id: 'role_4',
                    name: 'fleet_commander',
                    description: 'Fleet commander',
                    level: 60,
                },
                {
                    id: 'role_5',
                    name: 'member',
                    description: 'Regular member',
                    level: 10,
                },
            ];
            const total = allRoles.length;
            const items = allRoles.slice(offset, offset + limit);
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/roles`, offset, limit, total);
            res.paginated(items, { total, limit, offset, hasMore: offset + limit < total }, links);
        });
    }
    async getRole(req, res) {
        await this.execute(req, res, async () => {
            const _userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { roleId } = req.params;
            const role = {
                id: roleId,
                name: 'org_admin',
                description: 'Organization administrator',
                level: 70,
                permissions: [
                    {
                        id: 'perm_1',
                        name: 'organization:read',
                        description: 'View organization details',
                    },
                    {
                        id: 'perm_2',
                        name: 'organization:write',
                        description: 'Modify organization details',
                    },
                    {
                        id: 'perm_3',
                        name: 'fleet:read',
                        description: 'View fleet information',
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            res.success(role);
        });
    }
    async getUserPermissionsForOrg(req, res) {
        await this.execute(req, res, async () => {
            const _userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId: targetUserId } = req.params;
            if (!organizationId || !targetUserId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID and User ID are required', 400);
            }
            const membership = await this.membershipRepository
                .createQueryBuilder('membership')
                .where('membership.userId = :userId', { userId: targetUserId })
                .andWhere('membership.organizationId = :organizationId', { organizationId })
                .andWhere('membership.isActive = :isActive', { isActive: true })
                .getOne();
            if (!membership) {
                res.success({
                    userId: targetUserId,
                    organizationId,
                    role: null,
                    permissions: [],
                    total: 0,
                    sources: {
                        role: [],
                        memberOverrides: [],
                        directGrants: [],
                    },
                });
                return;
            }
            const roleName = (0, roleUtils_1.getRoleName)(membership.role);
            const rolePermissions = membership.role?.permissions?.length
                ? membership.role.permissions
                : (0, roleUtils_1.getDefaultPermissionsForRole)(roleName);
            const memberOverrides = membership.permissions ?? [];
            const directPermissions = await database_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission).find({
                where: {
                    organizationId,
                    userId: targetUserId,
                    isActive: true,
                },
                order: { createdAt: 'DESC' },
            });
            const directGrantPermissions = directPermissions.map(buildPermissionSourceEntry);
            const combinedPermissions = new Set();
            for (const permission of rolePermissions) {
                combinedPermissions.add(permission);
            }
            for (const permission of memberOverrides) {
                combinedPermissions.add(permission);
            }
            for (const permission of directPermissions) {
                for (const action of permission.actions) {
                    combinedPermissions.add(`${permission.resource}:${action}`);
                    if (permission.resourceId) {
                        combinedPermissions.add(`${permission.resource}:${action}:${permission.resourceId}`);
                    }
                }
            }
            const permissions = Array.from(combinedPermissions).sort((left, right) => left.localeCompare(right));
            res.success({
                userId: targetUserId,
                organizationId,
                role: membership.role
                    ? {
                        id: membership.role.id,
                        name: roleName,
                        priority: (0, roleUtils_1.getRolePriority)(roleName),
                    }
                    : null,
                permissions,
                total: permissions.length,
                sources: {
                    role: rolePermissions,
                    memberOverrides,
                    directGrants: directGrantPermissions,
                },
            });
        });
    }
    async grantPermission(req, res) {
        await this.execute(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId: targetUserId } = req.params;
            const { permissionId } = req.body;
            if (!organizationId || !targetUserId || !permissionId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID, User ID, and Permission ID are required', 400);
            }
            await this.verifyAdminAccess(userId, organizationId);
            const parts = permissionId.split(':');
            if (parts.length < 2) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Permission ID must be in format "resource:action" or "resource:action:resourceId"', 400);
            }
            const [resource, action, resourceId] = parts;
            const permission = await this.permissionManager.grantPermission(organizationId, targetUserId, resource, action, userId, undefined, resourceId);
            logger_1.logger.info(`Permission ${permissionId} granted to user ${targetUserId} in org ${organizationId} by ${userId}`);
            res.success({
                userId: targetUserId,
                organizationId,
                permissionId,
                permission: {
                    id: permission.id,
                    resource: permission.resource,
                    actions: permission.actions,
                    resourceId: permission.resourceId,
                },
                grantedAt: new Date(),
            });
        });
    }
    async revokePermission(req, res) {
        await this.execute(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId: targetUserId } = req.params;
            const { permissionId } = req.body;
            if (!organizationId || !targetUserId || !permissionId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID, User ID, and Permission ID are required', 400);
            }
            await this.verifyAdminAccess(userId, organizationId);
            const parts = permissionId.split(':');
            if (parts.length < 2) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Permission ID must be in format "resource:action" or "resource:action:resourceId"', 400);
            }
            const [resource, action, resourceId] = parts;
            await this.permissionManager.revokePermission(organizationId, targetUserId, resource, action, userId, resourceId);
            logger_1.logger.info(`Permission ${permissionId} revoked from user ${targetUserId} in org ${organizationId} by ${userId}`);
            res.success({
                userId: targetUserId,
                organizationId,
                permissionId,
                revokedAt: new Date(),
            });
        });
    }
    async updateSecurityLevel(req, res) {
        await this.execute(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId: targetUserId } = req.params;
            const { securityLevel } = req.body;
            if (!organizationId || !targetUserId || securityLevel === undefined) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID, User ID, and Security Level are required', 400);
            }
            await this.verifyAdminAccess(userId, organizationId);
            if (securityLevel < 1 || securityLevel > 10) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Security level must be between 1 and 10', 400);
            }
            const membership = await this.membershipRepository
                .createQueryBuilder('membership')
                .where('membership.userId = :userId', { userId: targetUserId })
                .andWhere('membership.organizationId = :organizationId', { organizationId })
                .andWhere('membership.isActive = :isActive', { isActive: true })
                .getOne();
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User is not a member of this organization', 404);
            }
            membership.securityLevel = securityLevel;
            await this.membershipRepository.save(membership);
            this.permissionManager.clearOrganizationPermissionCache(organizationId);
            logger_1.logger.info(`Security level updated for user ${targetUserId} in org ${organizationId}`);
            res.success({
                userId: targetUserId,
                organizationId,
                securityLevel,
                previousSecurityLevel: membership.securityLevel,
                updatedAt: new Date(),
            });
        });
    }
    async setInterOrgSecurityLevel(req, res) {
        await this.execute(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { sourceOrgId, targetOrgId, level, resourceType = '*', accessLevel = 'read', restrictions, notes, expiresAt, } = req.body;
            if (!sourceOrgId || !targetOrgId || level === undefined) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Source Org ID, Target Org ID, and Security Level are required', 400);
            }
            await this.verifyAdminAccess(userId, sourceOrgId);
            const permissionService = new PermissionService_1.PermissionService();
            const securityLevel = await permissionService.setInterOrgSecurityLevel(sourceOrgId, targetOrgId, level, resourceType, accessLevel, userId, restrictions, notes, expiresAt ? new Date(expiresAt) : undefined);
            logger_1.logger.info(`Inter-org security level set: ${sourceOrgId} -> ${targetOrgId} (level: ${level}, resource: ${resourceType})`);
            res.success({
                id: securityLevel.id,
                sourceOrgId: securityLevel.sourceOrgId,
                targetOrgId: securityLevel.targetOrgId,
                level: securityLevel.level,
                resourceType: securityLevel.resourceType,
                accessLevel: securityLevel.accessLevel,
                restrictions: securityLevel.restrictions,
                notes: securityLevel.notes,
                expiresAt: securityLevel.expiresAt,
                isActive: securityLevel.isActive,
                approvedBy: securityLevel.approvedBy,
                createdAt: securityLevel.createdAt,
                updatedAt: securityLevel.updatedAt,
            });
        });
    }
    async getOrgSecurityLevels(req, res) {
        await this.execute(req, res, async () => {
            const _userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            if (!organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID is required', 400);
            }
            const permissionService = new PermissionService_1.PermissionService();
            const securityLevels = await permissionService.getInterOrgSecurityLevels(organizationId);
            const mappedLevels = securityLevels.map(sl => ({
                id: sl.id,
                sourceOrgId: sl.sourceOrgId,
                sourceOrgName: sl.sourceOrganization?.name,
                targetOrgId: sl.targetOrgId,
                targetOrgName: sl.targetOrganization?.name,
                level: sl.level,
                resourceType: sl.resourceType,
                accessLevel: sl.accessLevel,
                restrictions: sl.restrictions,
                notes: sl.notes,
                isActive: sl.isActive,
                expiresAt: sl.expiresAt,
                approvedBy: sl.approvedBy,
                updatedBy: sl.updatedBy,
                createdAt: sl.createdAt,
                updatedAt: sl.updatedAt,
            }));
            logger_1.logger.info(`Retrieved ${securityLevels.length} security levels for org ${organizationId}`);
            res.success({
                organizationId,
                securityLevels: mappedLevels,
                total: mappedLevels.length,
            });
        });
    }
    async getAllSecurityLevels(req, res) {
        await this.execute(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            await this.verifyAdminAccess(userId);
            const permissionService = new PermissionService_1.PermissionService();
            const securityLevels = await permissionService.getAllSecurityLevels();
            const mappedLevels = securityLevels.map(sl => ({
                id: sl.id,
                sourceOrgId: sl.sourceOrgId,
                sourceOrgName: sl.sourceOrganization?.name,
                targetOrgId: sl.targetOrgId,
                targetOrgName: sl.targetOrganization?.name,
                level: sl.level,
                resourceType: sl.resourceType,
                accessLevel: sl.accessLevel,
                restrictions: sl.restrictions,
                notes: sl.notes,
                isActive: sl.isActive,
                expiresAt: sl.expiresAt,
                approvedBy: sl.approvedBy,
                updatedBy: sl.updatedBy,
                createdAt: sl.createdAt,
                updatedAt: sl.updatedAt,
            }));
            logger_1.logger.info(`Admin retrieved ${securityLevels.length} security levels`);
            res.success({
                securityLevels: mappedLevels,
                total: mappedLevels.length,
            });
        });
    }
    async revokeInterOrgSecurityLevel(req, res) {
        await this.execute(req, res, async () => {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { sourceOrgId, targetOrgId, resourceType } = req.body;
            if (!sourceOrgId || !targetOrgId || !resourceType) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Source Org ID, Target Org ID, and Resource Type are required', 400);
            }
            await this.verifyAdminAccess(userId, sourceOrgId);
            const permissionService = new PermissionService_1.PermissionService();
            await permissionService.revokeInterOrgSecurityLevel(sourceOrgId, targetOrgId, resourceType, userId);
            logger_1.logger.info(`Inter-org security level revoked: ${sourceOrgId} -> ${targetOrgId} (resource: ${resourceType})`);
            res.success({
                sourceOrgId,
                targetOrgId,
                resourceType,
                revoked: true,
                revokedAt: new Date(),
            });
        });
    }
}
exports.PermissionsControllerV2 = PermissionsControllerV2;
//# sourceMappingURL=permissionsController.js.map