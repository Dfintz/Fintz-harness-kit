"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationMemberService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Invitation_1 = require("../../models/Invitation");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const cacheInvalidation_1 = require("../../utils/cacheInvalidation");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const roleUtils_1 = require("../../utils/roleUtils");
const AuditService_1 = require("../audit/AuditService");
const RoleService_1 = require("../security/core/RoleService");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const OrganizationPermissionService_1 = require("./OrganizationPermissionService");
class OrganizationMemberService {
    membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    invitationRepository = data_source_1.AppDataSource.getRepository(Invitation_1.Invitation);
    roleService = (0, RoleService_1.getRoleService)();
    orgPermissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    async addMember(orgId, userId, role = 'member', title, metadata, manager, options) {
        const orgRepo = manager ? manager.getRepository(Organization_1.Organization) : this.organizationRepository;
        const userRepo = manager ? manager.getRepository(User_1.User) : this.userRepository;
        const membershipRepo = manager
            ? manager.getRepository(OrganizationMembership_1.OrganizationMembership)
            : this.membershipRepository;
        const org = await orgRepo.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const user = await userRepo.findOne({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const existing = await membershipRepo.findOne({
            where: {
                organizationId: orgId,
                userId,
            },
        });
        if (existing?.isActive) {
            throw new Error('User is already a member of this organization');
        }
        const roleName = role || 'member';
        const resolvedRoleId = await (0, RoleService_1.getRoleService)().resolveRoleIdWithDefaultFallback(roleName, orgId);
        if (!resolvedRoleId) {
            throw new Error(`Role '${roleName}' not found for organization ${orgId}`);
        }
        if (existing && !existing.isActive) {
            existing.isActive = true;
            existing.roleId = resolvedRoleId;
            existing.title = title;
            existing.joinedAt = new Date();
            existing.leftAt = undefined;
            existing.metadata = { ...existing.metadata, ...metadata };
            if (options?.acquisitionSource) {
                existing.acquisitionSource = options.acquisitionSource;
                existing.acquisitionRefId = options.acquisitionRefId;
            }
            const reactivated = await membershipRepo.save(existing);
            if (!user.activeOrgId) {
                user.activeOrgId = orgId;
                await userRepo.save(user);
            }
            return reactivated;
        }
        const membership = membershipRepo.create({
            organizationId: orgId,
            userId,
            roleId: resolvedRoleId,
            title,
            isActive: true,
            joinedAt: new Date(),
            metadata,
            acquisitionSource: options?.acquisitionSource,
            acquisitionRefId: options?.acquisitionRefId,
        });
        const saved = await membershipRepo.save(membership);
        if (!user.activeOrgId) {
            user.activeOrgId = orgId;
            await userRepo.save(user);
        }
        if (!manager) {
            await this.updateMemberCount(orgId);
            (0, cacheInvalidation_1.invalidateMemberStatsCache)(orgId);
        }
        logger_1.logger.info('OrganizationMemberService.addMember: Member added', {
            orgId,
            userId,
            role,
            acquisitionSource: options?.acquisitionSource,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.MEMBERSHIP,
            action: 'MEMBER_ADDED',
            message: `Member ${userId} added to organization ${orgId} with role '${role}'`,
            userId,
            organizationId: orgId,
            resource: `org/${orgId}/member/${userId}`,
            metadata: { role, acquisitionSource: options?.acquisitionSource },
        });
        return saved;
    }
    async removeMember(orgId, userId, permanent = false) {
        const membership = await this.membershipRepository.findOne({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        if (!membership) {
            throw new Error('Membership not found');
        }
        if (permanent) {
            await this.membershipRepository.delete(membership.id);
        }
        else {
            membership.isActive = false;
            membership.leftAt = new Date();
            await this.membershipRepository.save(membership);
        }
        await this.updateMemberCount(orgId);
        (0, cacheInvalidation_1.invalidateMemberStatsCache)(orgId);
        logger_1.logger.info('OrganizationMemberService.removeMember: Member removed', {
            orgId,
            userId,
            permanent,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.MEMBERSHIP,
            action: permanent ? 'MEMBER_REMOVED_PERMANENT' : 'MEMBER_REMOVED',
            message: `Member ${userId} removed from organization ${orgId} (permanent: ${permanent})`,
            userId,
            organizationId: orgId,
            resource: `org/${orgId}/member/${userId}`,
            metadata: { permanent },
        });
    }
    async leaveOrganization(orgId, userId, authenticatedUserId) {
        if (userId !== authenticatedUserId) {
            throw new apiErrors_1.ForbiddenError('You can only remove yourself from an organization');
        }
        const membership = await this.membershipRepository.findOne({
            where: { organizationId: orgId, userId, isActive: true },
            relations: ['role'],
        });
        if (!membership) {
            throw new apiErrors_1.NotFoundError('Membership');
        }
        if ((0, roleUtils_1.isOwnerRole)(membership.role)) {
            throw new apiErrors_1.ForbiddenError('Organization owners cannot leave. Transfer ownership first.');
        }
        let username = userId;
        await data_source_1.AppDataSource.transaction(async (manager) => {
            membership.isActive = false;
            membership.leftAt = new Date();
            await manager.save(membership);
            const user = await manager.findOne(User_1.User, { where: { id: userId } });
            if (user) {
                username = user.username;
                if (user.activeOrgId === orgId) {
                    user.activeOrgId = undefined;
                    await manager.save(user);
                }
            }
        });
        await this.updateMemberCount(orgId);
        (0, cacheInvalidation_1.invalidateMemberStatsCache)(orgId);
        logger_1.logger.info(`User ${userId} left organization ${orgId}`);
        DomainEventBus_1.domainEvents.emit('member:platform_left', {
            timestamp: new Date().toISOString(),
            userId,
            organizationId: orgId,
            username,
        });
    }
    async updateMemberRole(orgId, userId, newRole, newRoleId) {
        const membership = await this.membershipRepository.findOne({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        if (!membership) {
            throw new Error('Membership not found');
        }
        let role = null;
        if (newRoleId) {
            role = await this.roleService.getRoleById(newRoleId);
            if (role?.organizationId !== orgId) {
                throw new Error('Role not found for this organization');
            }
        }
        else {
            const roleName = newRole?.trim() ?? '';
            const ALLOWED_ROLE_PATTERN = /^[a-z][a-z0-9_-]{1,49}$/i;
            if (!ALLOWED_ROLE_PATTERN.test(roleName)) {
                throw new Error(`Invalid role name: '${roleName}'. Only letters, numbers, hyphens, and underscores are allowed.`);
            }
            role = await this.roleService.getOrCreateRole(roleName, orgId);
        }
        membership.roleId = role.id;
        membership.role = role;
        return this.membershipRepository.save(membership);
    }
    async updateMemberTitle(orgId, userId, title) {
        const membership = await this.membershipRepository.findOne({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        if (!membership) {
            throw new Error('Membership not found');
        }
        membership.title = title;
        return this.membershipRepository.save(membership);
    }
    async updateMemberPermissions(orgId, userId, permissions) {
        const membership = await this.membershipRepository.findOne({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        if (!membership) {
            throw new Error('Membership not found');
        }
        membership.permissions = permissions;
        return this.membershipRepository.save(membership);
    }
    async updateMemberMetadata(orgId, userId, metadata) {
        const membership = await this.membershipRepository.findOne({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        if (!membership) {
            throw new Error('Membership not found');
        }
        membership.metadata = { ...membership.metadata, ...metadata };
        return this.membershipRepository.save(membership);
    }
    async getMember(orgId, userId) {
        return this.membershipRepository.findOne({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
            relations: ['user', 'organization'],
        });
    }
    async getMembers(orgId, includeInactive = false, pagination) {
        const queryBuilder = this.membershipRepository
            .createQueryBuilder('membership')
            .leftJoinAndSelect('membership.user', 'user')
            .where('membership.organizationId = :orgId', { orgId });
        if (!includeInactive) {
            queryBuilder.andWhere('membership.isActive = true');
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        const sortBy = pagination?.sortBy || 'joinedAt';
        const sortOrder = pagination?.sortOrder || 'DESC';
        queryBuilder.orderBy(`membership.${sortBy}`, sortOrder);
        const [data, total] = await queryBuilder.getManyAndCount();
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getMembersByRole(orgId, role) {
        return this.membershipRepository.find({
            where: {
                organizationId: orgId,
                role: { name: role },
                isActive: true,
            },
            relations: ['user', 'role'],
            order: { joinedAt: 'DESC' },
        });
    }
    async isMember(orgId, userId) {
        const count = await this.membershipRepository.count({
            where: {
                organizationId: orgId,
                userId,
                isActive: true,
            },
        });
        return count > 0;
    }
    async getUserOrganizations(userId, includeInactive = false) {
        const queryBuilder = this.membershipRepository
            .createQueryBuilder('membership')
            .leftJoinAndSelect('membership.organization', 'organization')
            .where('membership.userId = :userId', { userId });
        if (!includeInactive) {
            queryBuilder.andWhere('membership.isActive = true');
        }
        return queryBuilder.orderBy('membership.joinedAt', 'DESC').getMany();
    }
    async transferMember(fromOrgId, toOrgId, userId, newRole, keepMembership = false) {
        const currentMembership = await this.membershipRepository.findOne({
            where: { organizationId: fromOrgId, userId },
        });
        if (!currentMembership) {
            throw new Error('Member not found in source organization');
        }
        const existingInTarget = await this.isMember(toOrgId, userId);
        if (existingInTarget) {
            throw new Error('User is already a member of target organization');
        }
        const newMembership = await this.addMember(toOrgId, userId, newRole || (0, roleUtils_1.getRoleName)(currentMembership.role) || 'member', currentMembership.title, {
            ...currentMembership.metadata,
            transferredFrom: fromOrgId,
            transferredAt: new Date(),
        });
        if (!keepMembership) {
            await this.removeMember(fromOrgId, userId, false);
        }
        return newMembership;
    }
    async bulkTransferMembers(fromOrgId, toOrgId, userIds, newRole) {
        const transferred = [];
        for (const userId of userIds) {
            try {
                const membership = await this.transferMember(fromOrgId, toOrgId, userId, newRole, false);
                transferred.push(membership);
            }
            catch (error) {
                logger_1.logger.error(`Failed to transfer user ${userId}:`, error);
            }
        }
        return transferred;
    }
    async searchMembers(orgId, filters, pagination) {
        const queryBuilder = this.membershipRepository
            .createQueryBuilder('membership')
            .leftJoinAndSelect('membership.user', 'user')
            .leftJoinAndSelect('membership.role', 'memberRole')
            .where('membership.organizationId = :orgId', { orgId })
            .andWhere('membership.isActive = true');
        if (filters.query) {
            queryBuilder.andWhere('(user.username ILIKE :query OR user.email ILIKE :query OR membership.title ILIKE :query)', { query: `%${filters.query}%` });
        }
        if (filters.role) {
            queryBuilder.andWhere('memberRole.name = :role', { role: filters.role });
        }
        if (filters.roles && filters.roles.length > 0) {
            queryBuilder.andWhere('memberRole.name IN (:...roles)', { roles: filters.roles });
        }
        if (filters.joinedAfter) {
            queryBuilder.andWhere('membership.joinedAt >= :joinedAfter', {
                joinedAfter: filters.joinedAfter,
            });
        }
        if (filters.joinedBefore) {
            queryBuilder.andWhere('membership.joinedAt <= :joinedBefore', {
                joinedBefore: filters.joinedBefore,
            });
        }
        if (filters.hasPermission) {
            queryBuilder.andWhere(':permission = ANY(membership.permissions)', {
                permission: filters.hasPermission,
            });
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        const sortBy = pagination?.sortBy || 'joinedAt';
        const sortOrder = pagination?.sortOrder || 'DESC';
        queryBuilder.orderBy(`membership.${sortBy}`, sortOrder);
        const [data, total] = await queryBuilder.getManyAndCount();
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getMemberStats(orgId, daysBack = 30) {
        const cacheKey = `org:${orgId}:member:stats`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        const roleStats = await this.membershipRepository
            .createQueryBuilder('m')
            .select('LOWER(m.role)', 'role')
            .addSelect('COUNT(*)::int', 'count')
            .where('m.organizationId = :orgId', { orgId })
            .andWhere('m.isActive = true')
            .groupBy('LOWER(m.role)')
            .getRawMany();
        const totals = await this.membershipRepository
            .createQueryBuilder('m')
            .select('COUNT(*)::int', 'total')
            .addSelect('SUM(CASE WHEN m."isActive" = true THEN 1 ELSE 0 END)::int', 'active')
            .addSelect('SUM(CASE WHEN m."isActive" = false THEN 1 ELSE 0 END)::int', 'inactive')
            .addSelect(`SUM(CASE WHEN m."isActive" = true AND m."joinedAt" >= :cutoff THEN 1 ELSE 0 END)::int`, 'recentJoins')
            .addSelect(`SUM(CASE WHEN m."isActive" = false AND m."leftAt" >= :cutoff THEN 1 ELSE 0 END)::int`, 'recentDepartures')
            .where('m.organizationId = :orgId', { orgId })
            .setParameter('cutoff', cutoffDate)
            .getRawOne();
        const membersByRole = {};
        for (const row of roleStats) {
            membersByRole[row.role || 'unknown'] = row.count;
        }
        const acquisitionStats = await this.membershipRepository
            .createQueryBuilder('m')
            .select("COALESCE(m.acquisitionSource, 'unknown')", 'source')
            .addSelect('COUNT(*)::int', 'count')
            .where('m.organizationId = :orgId', { orgId })
            .andWhere('m.isActive = true')
            .groupBy("COALESCE(m.acquisitionSource, 'unknown')")
            .getRawMany();
        const membersByAcquisition = {};
        for (const row of acquisitionStats) {
            membersByAcquisition[row.source] = row.count;
        }
        const result = {
            totalMembers: totals?.total ?? 0,
            activeMembers: totals?.active ?? 0,
            inactiveMembers: totals?.inactive ?? 0,
            membersByRole,
            membersByAcquisition,
            recentJoins: totals?.recentJoins ?? 0,
            recentDepartures: totals?.recentDepartures ?? 0,
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
    async getMemberRetention(orgId, periodDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - periodDays);
        const membersAtStart = await this.membershipRepository.count({
            where: {
                organizationId: orgId,
                joinedAt: (0, typeorm_1.Not)((0, typeorm_1.In)([cutoffDate])),
            },
        });
        const stillActive = await this.membershipRepository.count({
            where: {
                organizationId: orgId,
                joinedAt: (0, typeorm_1.Not)((0, typeorm_1.In)([cutoffDate])),
                isActive: true,
            },
        });
        if (membersAtStart === 0) {
            return 100;
        }
        return (stillActive / membersAtStart) * 100;
    }
    async updateMemberCount(orgId) {
        const count = await this.membershipRepository.count({
            where: {
                organizationId: orgId,
                isActive: true,
            },
        });
        await this.organizationRepository.update({ id: orgId }, { totalMembers: count });
    }
    async validateMemberExists(orgId, userId) {
        const exists = await this.isMember(orgId, userId);
        if (!exists) {
            throw new Error('User is not a member of this organization');
        }
    }
    async getMemberCount(orgId) {
        return this.membershipRepository.count({
            where: {
                organizationId: orgId,
                isActive: true,
            },
        });
    }
    async batchAddMembers(orgId, members) {
        if (!members || members.length === 0) {
            return [];
        }
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const userIds = members.map(m => m.userId);
        const users = await this.userRepository.find({
            where: { id: (0, typeorm_1.In)(userIds) },
        });
        if (users.length !== userIds.length) {
            const foundIds = new Set(users.map(u => u.id));
            const missingIds = userIds.filter(id => !foundIds.has(id));
            throw new Error(`Users not found: ${missingIds.join(', ')}`);
        }
        const existing = await this.membershipRepository.find({
            where: {
                organizationId: orgId,
                userId: (0, typeorm_1.In)(userIds),
            },
        });
        const existingUserIds = existing.filter(m => m.isActive).map(m => m.userId);
        if (existingUserIds.length > 0) {
            throw new Error(`Users already members: ${existingUserIds.join(', ')}`);
        }
        const now = new Date();
        const uniqueRoles = [...new Set(members.map(m => m.role || 'member'))];
        const roleIdMap = new Map();
        for (const rn of uniqueRoles) {
            const rid = await (0, RoleService_1.getRoleService)().resolveRoleIdWithDefaultFallback(rn, orgId);
            if (!rid) {
                throw new Error(`Role '${rn}' not found for organization ${orgId}`);
            }
            roleIdMap.set(rn, rid);
        }
        const membershipsToCreate = members.map(member => {
            const roleName = member.role || 'member';
            const roleId = roleIdMap.get(roleName);
            const inactiveMembership = existing.find(e => e.userId === member.userId && !e.isActive);
            if (inactiveMembership) {
                return {
                    ...inactiveMembership,
                    isActive: true,
                    roleId,
                    title: member.title,
                    joinedAt: now,
                    leftAt: undefined,
                    metadata: { ...inactiveMembership.metadata, ...member.metadata },
                    acquisitionSource: member.acquisitionSource ?? inactiveMembership.acquisitionSource,
                    acquisitionRefId: member.acquisitionRefId ?? inactiveMembership.acquisitionRefId,
                };
            }
            else {
                return this.membershipRepository.create({
                    organizationId: orgId,
                    userId: member.userId,
                    roleId,
                    title: member.title,
                    isActive: true,
                    joinedAt: now,
                    metadata: member.metadata,
                    acquisitionSource: member.acquisitionSource,
                    acquisitionRefId: member.acquisitionRefId,
                });
            }
        });
        const saved = await this.membershipRepository.save(membershipsToCreate);
        await this.updateMemberCount(orgId);
        (0, cacheInvalidation_1.invalidateMemberStatsCache)(orgId);
        return saved;
    }
    async batchRemoveMembers(orgId, userIds, permanent = false) {
        if (!userIds || userIds.length === 0) {
            return;
        }
        const memberships = await this.membershipRepository.find({
            where: {
                organizationId: orgId,
                userId: (0, typeorm_1.In)(userIds),
                isActive: true,
            },
        });
        if (memberships.length === 0) {
            return;
        }
        if (permanent) {
            await this.membershipRepository.delete(memberships.map(m => m.id));
        }
        else {
            const now = new Date();
            memberships.forEach(m => {
                m.isActive = false;
                m.leftAt = now;
            });
            await this.membershipRepository.save(memberships);
        }
        await this.updateMemberCount(orgId);
        (0, cacheInvalidation_1.invalidateMemberStatsCache)(orgId);
    }
    async batchUpdateMemberRoles(orgId, updates) {
        if (!updates || updates.length === 0) {
            return [];
        }
        const userIds = updates.map(u => u.userId);
        const memberships = await this.membershipRepository.find({
            where: {
                organizationId: orgId,
                userId: (0, typeorm_1.In)(userIds),
                isActive: true,
            },
        });
        if (memberships.length === 0) {
            throw new Error('No memberships found');
        }
        const roleService = (0, RoleService_1.getRoleService)();
        const uniqueRoleNames = [...new Set(updates.map(u => u.role))];
        const roleIdMap = new Map();
        for (const roleName of uniqueRoleNames) {
            const roleId = await roleService.getRoleIdByName(roleName, orgId);
            if (roleId) {
                roleIdMap.set(roleName, roleId);
            }
        }
        memberships.forEach(membership => {
            const update = updates.find(u => u.userId === membership.userId);
            if (update) {
                const roleId = roleIdMap.get(update.role);
                if (roleId) {
                    membership.roleId = roleId;
                }
            }
        });
        return this.membershipRepository.save(memberships);
    }
}
exports.OrganizationMemberService = OrganizationMemberService;
//# sourceMappingURL=OrganizationMemberService.js.map