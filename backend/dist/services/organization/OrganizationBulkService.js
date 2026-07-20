"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationBulkService = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationActivity_1 = require("../../models/OrganizationActivity");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const RoleService_1 = require("../security/core/RoleService");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const OrganizationPermissionService_1 = require("./OrganizationPermissionService");
class OrganizationBulkService {
    static DEFAULT_BATCH_SIZE = 10;
    static DEFAULT_BATCH_DELAY_MS = 100;
    static MIN_MEMBER_COUNT_FOR_DELETION = 1;
    organizationRepository;
    membershipRepository;
    permissionRepository;
    activityRepository;
    userRepository;
    orgPermissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    constructor() {
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.permissionRepository = data_source_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission);
        this.activityRepository = data_source_1.AppDataSource.getRepository(OrganizationActivity_1.OrganizationActivity);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    }
    async bulkAddMembers(organizationId, members, actorId) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
            details: [],
        };
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const permission = await this.orgPermissionService.checkPermission(actorId, organizationId, OrganizationPermission_1.ResourceType.MEMBER, OrganizationPermission_1.PermissionAction.MANAGE);
        if (!permission.allowed) {
            logger_1.logger.warn('Unauthorized bulk member addition attempt', { actorId, organizationId });
            throw new apiErrors_1.ForbiddenError(`You do not have permission to manage members of this organization. ${permission.reason ?? ''}`.trim());
        }
        const userIds = members.map(m => m.userId);
        const existingMemberships = await this.membershipRepository.find({
            where: {
                organizationId,
                userId: (0, typeorm_1.In)(userIds),
            },
        });
        const existingUserIds = new Set(existingMemberships.map(m => m.userId));
        const roleService = (0, RoleService_1.getRoleService)();
        const uniqueRoles = [...new Set(members.map(m => m.role))];
        const bulkRoleIdMap = new Map();
        for (const roleName of uniqueRoles) {
            const roleId = await roleService.getRoleIdByName(roleName, organizationId);
            if (roleId) {
                bulkRoleIdMap.set(roleName, roleId);
            }
        }
        for (const member of members) {
            try {
                if (existingUserIds.has(member.userId)) {
                    this.recordFailure(result, member, 'User is already a member');
                    continue;
                }
                const user = await this.userRepository.findOne({
                    where: { id: member.userId },
                });
                if (!user) {
                    this.recordFailure(result, member, 'User not found');
                    continue;
                }
                const resolvedRoleId = bulkRoleIdMap.get(member.role);
                if (!resolvedRoleId) {
                    this.recordFailure(result, member, `Role '${member.role}' not found`);
                    continue;
                }
                const membership = this.membershipRepository.create({
                    organizationId,
                    userId: member.userId,
                    roleId: resolvedRoleId,
                    permissions: member.permissions || [],
                    metadata: member.metadata,
                });
                await this.membershipRepository.save(membership);
                await this.logActivity(organizationId, actorId, 'member_added', 'low', {
                    userId: member.userId,
                    role: member.role,
                });
                result.successful++;
                result.details?.push({
                    userId: member.userId,
                    username: user.username,
                    role: member.role,
                    status: 'success',
                });
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    item: member,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: actorId,
            resource: 'organization.members',
            action: 'bulk_add',
            message: `Bulk member addition to org ${organizationId}: ${result.successful} added, ${result.failed} failed`,
            metadata: { organizationId, successCount: result.successful, failedCount: result.failed },
        });
        return result;
    }
    async bulkRemoveMembers(organizationId, userIds, actorId) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
        };
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const permission = await this.orgPermissionService.checkPermission(actorId, organizationId, OrganizationPermission_1.ResourceType.MEMBER, OrganizationPermission_1.PermissionAction.MANAGE);
        if (!permission.allowed) {
            logger_1.logger.warn('Unauthorized bulk member removal attempt', { actorId, organizationId });
            throw new apiErrors_1.ForbiddenError(`You do not have permission to manage members of this organization. ${permission.reason ?? ''}`.trim());
        }
        if (organization.ownerId && userIds.includes(organization.ownerId)) {
            result.failed++;
            result.errors.push({
                item: { userId: organization.ownerId },
                error: 'Cannot remove organization owner',
            });
            userIds = userIds.filter(id => id !== organization.ownerId);
        }
        const memberships = await this.membershipRepository.find({
            where: {
                organizationId,
                userId: (0, typeorm_1.In)(userIds),
            },
        });
        const foundUserIds = new Set(memberships.map(m => m.userId));
        for (const userId of userIds) {
            try {
                if (!foundUserIds.has(userId)) {
                    this.recordFailure(result, { userId }, 'User is not a member');
                    continue;
                }
                await this.membershipRepository.delete({
                    organizationId,
                    userId,
                });
                await this.logActivity(organizationId, actorId, 'member_removed', 'medium', { userId });
                result.successful++;
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    item: { userId },
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: actorId,
            resource: 'organization.members',
            action: 'bulk_remove',
            message: `Bulk member removal from org ${organizationId}: ${result.successful} removed, ${result.failed} failed`,
            metadata: { organizationId, successCount: result.successful, failedCount: result.failed },
        });
        return result;
    }
    async bulkUpdateRoles(organizationId, updates, actorId) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
        };
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const permission = await this.orgPermissionService.checkPermission(actorId, organizationId, OrganizationPermission_1.ResourceType.MEMBER, OrganizationPermission_1.PermissionAction.MANAGE);
        if (!permission.allowed) {
            logger_1.logger.warn('Unauthorized bulk role update attempt', { actorId, organizationId });
            throw new apiErrors_1.ForbiddenError(`You do not have permission to manage member roles in this organization. ${permission.reason ?? ''}`.trim());
        }
        const userIds = updates.map(u => u.userId);
        const memberships = await this.membershipRepository.find({
            where: { organizationId, userId: (0, typeorm_1.In)(userIds) },
        });
        const membershipMap = new Map(memberships.map(m => [m.userId, m]));
        const toSave = [];
        const activityLogs = [];
        const roleService = (0, RoleService_1.getRoleService)();
        const uniqueRoleNames = [...new Set(updates.map(u => u.role))];
        const roleIdMap = new Map();
        for (const roleName of uniqueRoleNames) {
            const roleId = await roleService.getRoleIdByName(roleName, organizationId);
            if (roleId) {
                roleIdMap.set(roleName, roleId);
            }
        }
        for (const update of updates) {
            try {
                if (update.userId === organization.ownerId) {
                    this.recordFailure(result, update, 'Cannot change owner role');
                    continue;
                }
                const membership = membershipMap.get(update.userId);
                if (!membership) {
                    this.recordFailure(result, update, 'User is not a member');
                    continue;
                }
                const roleId = roleIdMap.get(update.role);
                if (!roleId) {
                    this.recordFailure(result, update, `Role '${update.role}' not found`);
                    continue;
                }
                const oldRole = (0, roleUtils_1.getRoleName)(membership.role);
                membership.roleId = roleId;
                toSave.push(membership);
                activityLogs.push({ userId: update.userId, oldRole, newRole: update.role });
                result.successful++;
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    item: update,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        if (toSave.length > 0) {
            await this.membershipRepository.save(toSave);
        }
        for (const log of activityLogs) {
            DomainEventBus_1.domainEvents.emit('member:platform_role_changed', {
                timestamp: new Date().toISOString(),
                userId: log.userId,
                organizationId,
                previousRoleName: log.oldRole,
                newRoleName: log.newRole,
                performedById: actorId,
            });
        }
        for (const log of activityLogs) {
            await this.logActivity(organizationId, actorId, 'role_updated', 'medium', {
                userId: log.userId,
                oldRole: log.oldRole,
                newRole: log.newRole,
            });
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: actorId,
            resource: 'organization.members',
            action: 'bulk_update_roles',
            message: `Bulk role update in org ${organizationId}: ${result.successful} updated, ${result.failed} failed`,
            metadata: { organizationId, successCount: result.successful, failedCount: result.failed },
        });
        return result;
    }
    async bulkGrantPermissions(organizationId, grants, actorId) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
        };
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        for (const grant of grants) {
            try {
                const membership = await this.membershipRepository.findOne({
                    where: {
                        organizationId,
                        userId: grant.userId,
                    },
                });
                if (!membership) {
                    this.recordFailure(result, grant, 'User is not a member');
                    continue;
                }
                const currentPermissions = new Set(membership.permissions || []);
                grant.permissions.forEach(p => currentPermissions.add(p));
                membership.permissions = Array.from(currentPermissions);
                await this.membershipRepository.save(membership);
                await this.logActivity(organizationId, actorId, 'permissions_granted', 'low', {
                    userId: grant.userId,
                    permissions: grant.permissions,
                });
                result.successful++;
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    item: grant,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    async bulkRevokePermissions(organizationId, revocations, actorId) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
        };
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        for (const revocation of revocations) {
            try {
                if (revocation.userId === organization.ownerId) {
                    this.recordFailure(result, revocation, 'Cannot revoke owner permissions');
                    continue;
                }
                const membership = await this.membershipRepository.findOne({
                    where: {
                        organizationId,
                        userId: revocation.userId,
                    },
                });
                if (!membership) {
                    this.recordFailure(result, revocation, 'User is not a member');
                    continue;
                }
                const permissionsToRevoke = new Set(revocation.permissions);
                membership.permissions = (membership.permissions || []).filter(p => !permissionsToRevoke.has(p));
                await this.membershipRepository.save(membership);
                await this.logActivity(organizationId, actorId, 'permissions_revoked', 'medium', {
                    userId: revocation.userId,
                    permissions: revocation.permissions,
                });
                result.successful++;
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    item: revocation,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    async importMembersFromCSV(organizationId, csvContent, actorId) {
        const members = [];
        const stream = stream_1.Readable.from(csvContent);
        await new Promise((resolve, reject) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                members.push({
                    email: row.email,
                    username: row.username,
                    role: row.role || 'member',
                    permissions: row.permissions
                        ? row.permissions.split(',').map((p) => p.trim())
                        : [],
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                });
            })
                .on('end', () => resolve())
                .on('error', (error) => reject(error));
        });
        const emails = members.map(m => m.email);
        const users = await this.userRepository.find({
            where: { email: (0, typeorm_1.In)(emails) },
        });
        const emailToUserId = new Map(users.map(u => [u.email, u.id]));
        const membersToAdd = members
            .filter(m => emailToUserId.has(m.email))
            .map(m => ({
            userId: emailToUserId.get(m.email),
            role: m.role,
            permissions: m.permissions,
            metadata: m.metadata,
        }));
        const notFoundEmails = members.filter(m => !emailToUserId.has(m.email)).map(m => m.email);
        const result = await this.bulkAddMembers(organizationId, membersToAdd, actorId);
        notFoundEmails.forEach(email => {
            result.failed++;
            result.errors.push({
                item: { email },
                error: 'User not found',
            });
        });
        return result;
    }
    async exportMembersToCSV(organizationId) {
        const memberships = await this.membershipRepository.find({
            where: { organizationId },
            relations: ['user'],
        });
        const headers = ['user_id', 'username', 'email', 'role', 'permissions', 'joined_at'];
        const rows = memberships.map(m => [
            m.userId,
            m.user.username,
            m.user.email,
            (0, roleUtils_1.getRoleName)(m.role),
            m.permissions ? m.permissions.join(',') : '',
            m.joinedAt?.toISOString() || '',
        ]);
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');
        return csv;
    }
    async bulkUpdateMetadata(organizationId, updates, _actorId) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
        };
        for (const update of updates) {
            try {
                const membership = await this.membershipRepository.findOne({
                    where: {
                        organizationId,
                        userId: update.userId,
                    },
                });
                if (!membership) {
                    this.recordFailure(result, update, 'User is not a member');
                    continue;
                }
                membership.metadata = {
                    ...membership.metadata,
                    ...update.metadata,
                };
                await this.membershipRepository.save(membership);
                result.successful++;
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    item: update,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    async bulkCreateOrganizations(orgsData, creatorId) {
        const result = {
            success: true,
            created: [],
            errors: [],
        };
        const creator = await this.userRepository.findOne({
            where: { id: creatorId },
        });
        if (!creator) {
            throw new Error('Creator not found');
        }
        for (const orgData of orgsData) {
            try {
                if (!orgData.name || orgData.name.trim().length === 0) {
                    result.errors.push({
                        item: orgData,
                        error: 'Organization name is required',
                    });
                    result.success = false;
                    continue;
                }
                const organizationData = {
                    name: orgData.name,
                    type: orgData.type || Organization_1.OrganizationType.ROOT,
                    description: orgData.description || '',
                    status: orgData.status || Organization_1.OrganizationStatus.ACTIVE,
                    ownerId: creatorId,
                    level: 0,
                    memberCount: 0,
                    metadata: orgData.metadata || {},
                };
                const organization = this.organizationRepository.create(organizationData);
                const savedOrg = await this.organizationRepository.save(organization);
                await this.logActivity(savedOrg.id, creatorId, 'bulk_organization_created', 'medium', {
                    organizationName: orgData.name,
                });
                result.created.push(savedOrg);
            }
            catch (error) {
                result.success = false;
                result.errors.push({
                    item: orgData,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    async bulkUpdateOrganizations(updates) {
        const result = {
            success: true,
            updated: 0,
            errors: [],
        };
        for (const update of updates) {
            try {
                const organization = await this.organizationRepository.findOne({
                    where: { id: update.id },
                });
                if (!organization) {
                    result.success = false;
                    result.errors.push({
                        id: update.id,
                        error: 'Organization not found',
                    });
                    continue;
                }
                Object.assign(organization, update.data);
                await this.organizationRepository.save(organization);
                result.updated++;
            }
            catch (error) {
                result.success = false;
                result.errors.push({
                    id: update.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    async bulkDeleteOrganizations(orgIds) {
        const result = {
            success: true,
            deleted: 0,
            errors: [],
        };
        for (const orgId of orgIds) {
            try {
                const organization = await this.organizationRepository.findOne({
                    where: { id: orgId },
                });
                if (!organization) {
                    result.success = false;
                    result.errors.push({
                        id: orgId,
                        error: 'Organization not found',
                    });
                    continue;
                }
                const memberCount = await this.membershipRepository.count({
                    where: { organizationId: orgId },
                });
                if (memberCount > OrganizationBulkService.MIN_MEMBER_COUNT_FOR_DELETION) {
                    result.success = false;
                    result.errors.push({
                        id: orgId,
                        error: 'Cannot delete organization with members',
                    });
                    continue;
                }
                await this.membershipRepository.delete({ organizationId: orgId });
                await this.organizationRepository.delete({ id: orgId });
                result.deleted++;
            }
            catch (error) {
                result.success = false;
                result.errors.push({
                    id: orgId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    async getBulkOperationStats(organizationId) {
        const memberships = await this.membershipRepository.find({
            where: { organizationId },
        });
        const membersByRole = {};
        memberships.forEach(m => {
            const roleName = (0, roleUtils_1.getRoleName)(m.role) || 'unknown';
            membersByRole[roleName] = (membersByRole[roleName] || 0) + 1;
        });
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentActivities = await this.activityRepository.count({
            where: {
                organizationId,
                action: (0, typeorm_1.In)(['bulk_add', 'bulk_remove', 'bulk_update']),
            },
        });
        return {
            totalMembers: memberships.length,
            membersByRole,
            recentBulkOperations: recentActivities,
            averageOperationSize: 0,
        };
    }
    async logActivity(organizationId, actorId, activityType, severity, metadata) {
        const activityData = this.activityRepository.create({
            organizationId,
            actorId,
            action: activityType,
            severity,
            metadata,
        });
        const activity = Array.isArray(activityData) ? activityData[0] : activityData;
        await this.activityRepository.save(activity);
    }
    recordFailure(result, item, error) {
        result.failed++;
        result.errors.push({ item, error });
    }
    async processBatch(items, processor, options) {
        const batchSize = options?.batchSize || OrganizationBulkService.DEFAULT_BATCH_SIZE;
        const delayBetweenBatches = options?.delayBetweenBatches || OrganizationBulkService.DEFAULT_BATCH_DELAY_MS;
        const progressCallback = options?.progressCallback;
        const results = [];
        const total = items.length;
        let completed = 0;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchPromises = batch.map(async (item, batchIndex) => {
                const globalIndex = i + batchIndex;
                try {
                    const result = await processor(item, globalIndex);
                    completed++;
                    if (progressCallback) {
                        progressCallback({
                            completed,
                            total,
                            percentage: Math.round((completed / total) * 100),
                            currentItem: item,
                            status: 'completed',
                        });
                    }
                    return { success: true, result, item };
                }
                catch (error) {
                    completed++;
                    if (progressCallback) {
                        progressCallback({
                            completed,
                            total,
                            percentage: Math.round((completed / total) * 100),
                            currentItem: item,
                            status: 'error',
                        });
                    }
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        item,
                    };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + batchSize < items.length && delayBetweenBatches > 0) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }
        return results;
    }
    async bulkAddMembersWithProgress(organizationId, members, actorId, options) {
        const result = {
            successful: 0,
            failed: 0,
            errors: [],
            details: [],
        };
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        const userIds = members.map(m => m.userId);
        const existingMemberships = await this.membershipRepository.find({
            where: {
                organizationId,
                userId: (0, typeorm_1.In)(userIds),
            },
        });
        const existingUserIds = new Set(existingMemberships.map(m => m.userId));
        const roleService = (0, RoleService_1.getRoleService)();
        const uniqueRoles = [...new Set(members.map(m => m.role))];
        const batchRoleIdMap = new Map();
        for (const roleName of uniqueRoles) {
            const roleId = await roleService.getRoleIdByName(roleName, organizationId);
            if (roleId) {
                batchRoleIdMap.set(roleName, roleId);
            }
        }
        const results = await this.processBatch(members, async (member) => {
            if (existingUserIds.has(member.userId)) {
                throw new Error('User is already a member');
            }
            const user = await this.userRepository.findOne({
                where: { id: member.userId },
            });
            if (!user) {
                throw new Error('User not found');
            }
            const resolvedRoleId = batchRoleIdMap.get(member.role);
            if (!resolvedRoleId) {
                throw new Error(`Role '${member.role}' not found`);
            }
            const membership = this.membershipRepository.create({
                organizationId,
                userId: member.userId,
                roleId: resolvedRoleId,
                permissions: member.permissions || [],
                metadata: member.metadata,
            });
            await this.membershipRepository.save(membership);
            await this.logActivity(organizationId, actorId, 'member_added', 'low', {
                userId: member.userId,
                role: member.role,
            });
            return {
                userId: member.userId,
                username: user.username,
                role: member.role,
                status: 'success',
            };
        }, options);
        results.forEach(r => {
            if (r.success) {
                result.successful++;
                result.details?.push(r.result);
            }
            else {
                result.failed++;
                result.errors.push({
                    item: r.item,
                    error: r.error || 'Unknown error',
                });
            }
        });
        return result;
    }
    async bulkInviteMembers(organizationId, members, actorId, options) {
        if (options && (options.progressCallback || options.batchSize || options.delayBetweenBatches)) {
            return this.bulkAddMembersWithProgress(organizationId, members, actorId, options);
        }
        return this.bulkAddMembers(organizationId, members, actorId);
    }
}
exports.OrganizationBulkService = OrganizationBulkService;
//# sourceMappingURL=OrganizationBulkService.js.map