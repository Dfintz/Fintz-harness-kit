"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const CrewAssignment_1 = require("../../models/CrewAssignment");
const Team_1 = require("../../models/Team");
const TeamMember_1 = require("../../models/TeamMember");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const TenantService_1 = require("../base/TenantService");
const starcomms_1 = require("../communication/starcomms");
const DomainEventBus_1 = require("../shared/DomainEventBus");
class TeamService extends TenantService_1.TenantService {
    memberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
    starCommsContextSyncService = new starcomms_1.StarCommsContextSyncService();
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Team_1.Team), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    async createTeam(organizationId, data) {
        logger_1.logger.info('TeamService.createTeam', { organizationId, name: data.name });
        let level = 0;
        let sortOrder = 0;
        if (data.parentTeamId) {
            const parent = await this.findById(organizationId, data.parentTeamId);
            if (!parent) {
                throw new apiErrors_1.NotFoundError('Parent team');
            }
            if (parent.level >= 4) {
                throw new apiErrors_1.ValidationError('Maximum nesting depth of 5 levels exceeded');
            }
            level = parent.level + 1;
            const maxSort = await this.repository
                .createQueryBuilder('t')
                .where('t.organizationId = :organizationId', { organizationId })
                .andWhere('t.parentTeamId = :parentTeamId', { parentTeamId: data.parentTeamId })
                .select('MAX(t.sortOrder)', 'max')
                .getRawOne();
            sortOrder = (maxSort?.max ?? -1) + 1;
        }
        else {
            const maxSort = await this.repository
                .createQueryBuilder('t')
                .where('t.organizationId = :organizationId', { organizationId })
                .andWhere('t.parentTeamId IS NULL')
                .select('MAX(t.sortOrder)', 'max')
                .getRawOne();
            sortOrder = (maxSort?.max ?? -1) + 1;
        }
        const team = this.repository.create({
            organizationId,
            name: data.name,
            description: data.description,
            type: data.type ?? 'squadron',
            parentTeamId: data.parentTeamId ?? undefined,
            level,
            sortOrder,
            maxMembers: data.maxMembers ?? 20,
            isActive: true,
            joinPolicy: data.joinPolicy ?? 'closed',
            emblem: data.emblem ?? null,
        });
        const saved = await this.repository.save(team);
        this.invalidateOrgCache(organizationId);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'TEAM_CREATED',
            message: `Team created: ${saved.name}`,
            organizationId,
            resource: `team/${saved.id}`,
            metadata: {
                teamId: saved.id,
                teamName: saved.name,
                type: saved.type,
                level,
            },
        });
        DomainEventBus_1.domainEvents.emit('team:created', {
            teamId: saved.id,
            organizationId,
            teamName: saved.name,
            teamType: saved.type,
            parentTeamId: saved.parentTeamId,
            timestamp: new Date().toISOString(),
        });
        this.starCommsContextSyncService
            .syncTeamContext({
            organizationId,
            teamId: saved.id,
            teamName: saved.name,
            teamType: saved.type,
            action: 'team-created',
        })
            .catch(() => {
        });
        return saved;
    }
    async updateTeam(organizationId, teamId, data) {
        logger_1.logger.info('TeamService.updateTeam', { organizationId, teamId });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        if (data.parentTeamId !== undefined &&
            (data.parentTeamId ?? null) !== (team.parentTeamId ?? null)) {
            await this.moveTeam(organizationId, teamId, data.parentTeamId);
        }
        if (data.name !== undefined) {
            team.name = data.name;
        }
        if (data.description !== undefined) {
            team.description = data.description;
        }
        if (data.type !== undefined) {
            team.type = data.type;
        }
        if (data.maxMembers !== undefined) {
            team.maxMembers = data.maxMembers;
        }
        if (data.isActive !== undefined) {
            team.isActive = data.isActive;
        }
        if (data.joinPolicy !== undefined) {
            team.joinPolicy = data.joinPolicy;
        }
        const emblemChanged = data.emblem !== undefined && (data.emblem ?? null) !== (team.emblem ?? null);
        if (data.emblem !== undefined) {
            team.emblem = data.emblem ?? null;
        }
        const saved = await this.repository.save(team);
        this.invalidateOrgCache(organizationId);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'TEAM_UPDATED',
            message: `Team updated: ${saved.name}`,
            organizationId,
            resource: `team/${saved.id}`,
            metadata: {
                teamId: saved.id,
                teamName: saved.name,
                emblemChanged,
            },
        });
        if (emblemChanged) {
            DomainEventBus_1.domainEvents.emit('team:emblem_updated', {
                teamId: saved.id,
                organizationId,
                emblemUrl: saved.emblem ?? null,
                timestamp: new Date().toISOString(),
            });
        }
        return saved;
    }
    async deleteTeam(organizationId, teamId) {
        logger_1.logger.info('TeamService.deleteTeam', { organizationId, teamId });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        const memberCount = await this.memberRepo.count({
            where: { organizationId, teamId, status: 'active' },
        });
        const teamName = team.name;
        await this.repository.remove(team);
        this.invalidateOrgCache(organizationId);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'TEAM_DELETED',
            message: `Team deleted: ${teamName}`,
            organizationId,
            resource: `team/${teamId}`,
            metadata: {
                teamId,
                teamName,
                memberCount,
            },
        });
        DomainEventBus_1.domainEvents.emit('team:deleted', {
            teamId,
            organizationId,
            teamName,
            memberCount,
            timestamp: new Date().toISOString(),
        });
        this.starCommsContextSyncService
            .syncTeamContext({
            organizationId,
            teamId,
            teamName,
            teamType: team.type,
            action: 'team-deleted',
        })
            .catch(() => {
        });
    }
    async getTeamTree(organizationId) {
        logger_1.logger.debug('TeamService.getTeamTree', { organizationId });
        const allTeams = await this.repository.find({
            where: { organizationId },
            order: { level: 'ASC', sortOrder: 'ASC', name: 'ASC' },
        });
        const memberCounts = await this.memberRepo
            .createQueryBuilder('tm')
            .select('tm.teamId', 'teamId')
            .addSelect('COUNT(*)', 'count')
            .where('tm.organizationId = :organizationId', { organizationId })
            .andWhere('tm.status = :status', { status: 'active' })
            .groupBy('tm.teamId')
            .getRawMany();
        const countMap = new Map();
        for (const row of memberCounts) {
            countMap.set(row.teamId, Number.parseInt(row.count, 10));
        }
        const nodeMap = new Map();
        const roots = [];
        for (const team of allTeams) {
            nodeMap.set(team.id, {
                id: team.id,
                name: team.name,
                description: team.description,
                type: team.type,
                parentTeamId: team.parentTeamId,
                level: team.level,
                sortOrder: team.sortOrder,
                maxMembers: team.maxMembers,
                isActive: team.isActive,
                joinPolicy: team.joinPolicy,
                emblem: team.emblem,
                memberCount: countMap.get(team.id) ?? 0,
                children: [],
            });
        }
        for (const team of allTeams) {
            const node = nodeMap.get(team.id);
            if (team.parentTeamId && nodeMap.has(team.parentTeamId)) {
                nodeMap.get(team.parentTeamId).children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async moveTeam(organizationId, teamId, newParentId) {
        logger_1.logger.info('TeamService.moveTeam', { organizationId, teamId, newParentId });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        if ((team.parentTeamId || null) === newParentId) {
            return team;
        }
        let parentLevel = -1;
        if (newParentId) {
            if (newParentId === teamId) {
                throw new apiErrors_1.ValidationError('Cannot move a team under itself');
            }
            const parent = await this.findById(organizationId, newParentId);
            if (!parent) {
                throw new apiErrors_1.NotFoundError('Target parent team');
            }
            if (await this.isDescendantOf(organizationId, newParentId, teamId)) {
                throw new apiErrors_1.ValidationError('Cannot move team under its own descendant');
            }
            if (parent.level >= 4) {
                throw new apiErrors_1.ValidationError('Maximum nesting depth of 5 levels exceeded');
            }
            parentLevel = parent.level;
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            team.parentTeamId = newParentId || undefined;
            team.level = parentLevel + 1;
            const maxSort = await queryRunner.manager
                .createQueryBuilder(Team_1.Team, 't')
                .where('t.organizationId = :organizationId', { organizationId })
                .andWhere(newParentId ? 't.parentTeamId = :parentId' : 't.parentTeamId IS NULL', {
                parentId: newParentId,
            })
                .andWhere('t.id != :teamId', { teamId })
                .select('MAX(t.sortOrder)', 'max')
                .getRawOne();
            team.sortOrder = (maxSort?.max ?? -1) + 1;
            await queryRunner.manager.save(team);
            await this.updateDescendantLevels(queryRunner, organizationId, team);
            await queryRunner.commitTransaction();
            this.invalidateOrgCache(organizationId);
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ORGANIZATION,
                action: 'TEAM_MOVED',
                message: `Team moved: ${team.name}`,
                organizationId,
                resource: `team/${teamId}`,
                metadata: {
                    teamId,
                    teamName: team.name,
                    newParentId,
                    newLevel: team.level,
                },
            });
            return team;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async reorderTeams(organizationId, orderedIds, _parentTeamId) {
        logger_1.logger.info('TeamService.reorderTeams', { organizationId, count: orderedIds.length });
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            for (let i = 0; i < orderedIds.length; i++) {
                await queryRunner.manager.update(Team_1.Team, { id: orderedIds[i], organizationId }, { sortOrder: i });
            }
            await queryRunner.commitTransaction();
            this.invalidateOrgCache(organizationId);
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ORGANIZATION,
                action: 'TEAMS_REORDERED',
                message: `Teams reordered: ${orderedIds.length} teams`,
                organizationId,
                resource: `organization/${organizationId}/teams`,
                metadata: {
                    teamCount: orderedIds.length,
                },
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async isDescendantOf(organizationId, potentialDescendantId, ancestorId) {
        let currentId = potentialDescendantId;
        const visited = new Set();
        while (currentId) {
            if (visited.has(currentId)) {
                return false;
            }
            visited.add(currentId);
            const team = await this.findById(organizationId, currentId);
            if (!team) {
                return false;
            }
            if (team.parentTeamId === ancestorId) {
                return true;
            }
            currentId = team.parentTeamId;
        }
        return false;
    }
    async updateDescendantLevels(queryRunner, organizationId, parentTeam) {
        const children = await queryRunner.manager.find(Team_1.Team, {
            where: { organizationId, parentTeamId: parentTeam.id },
        });
        for (const child of children) {
            child.level = parentTeam.level + 1;
            await queryRunner.manager.save(child);
            await this.updateDescendantLevels(queryRunner, organizationId, child);
        }
    }
    async getTeamMembers(organizationId, teamId) {
        return this.memberRepo.find({
            where: { organizationId, teamId },
            relations: ['user'],
            order: { role: 'ASC', createdAt: 'ASC' },
        });
    }
    static toParticipantInfo(member) {
        return {
            userId: member.userId,
            organizationId: member.organizationId,
            username: member.user?.username || member.userId,
            displayName: member.user?.displayName,
            roles: (0, shared_types_1.mapTeamsRoleToSystemRoles)(member.role),
            primaryRole: member.role,
            status: (0, shared_types_1.mapTeamStatusToParticipantStatus)(member.status),
            joinedAt: member.joinedAt || member.createdAt,
            lastActiveAt: member.lastActiveAt,
            source: 'system',
            metadata: {
                teamId: member.teamId,
                rank: member.rank,
                shipType: member.shipType,
                specialization: member.specialization,
            },
        };
    }
    toParticipantInfo(member) {
        return TeamService.toParticipantInfo(member);
    }
    async addMember(organizationId, teamId, userId, role = 'member', personnelData) {
        logger_1.logger.info('TeamService.addMember', { organizationId, teamId, userId, role });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        const activeCount = await this.memberRepo.count({
            where: { organizationId, teamId, status: 'active' },
        });
        if (activeCount >= team.maxMembers) {
            throw new apiErrors_1.ConflictError('Team is at maximum capacity');
        }
        const existing = await this.memberRepo.findOne({
            where: { userId, teamId },
        });
        if (existing) {
            if (existing.status === 'removed' || existing.status === 'inactive') {
                existing.status = 'active';
                existing.role = role;
                existing.leftAt = undefined;
                existing.joinedAt = new Date();
                if (personnelData?.rank !== undefined) {
                    existing.rank = personnelData.rank;
                }
                if (personnelData?.shipType !== undefined) {
                    existing.shipType = personnelData.shipType;
                }
                if (personnelData?.specialization !== undefined) {
                    existing.specialization = personnelData.specialization;
                }
                if (personnelData?.certifications !== undefined) {
                    existing.certifications = personnelData.certifications;
                }
                if (personnelData?.additionalRoles !== undefined) {
                    existing.additionalRoles = personnelData.additionalRoles;
                }
                const saved = await this.memberRepo.save(existing);
                AuditService_1.auditService.log({
                    category: AuditService_1.AuditCategory.ORGANIZATION,
                    action: 'TEAM_MEMBER_REACTIVATED',
                    message: `Member reactivated in team: ${userId}`,
                    organizationId,
                    resource: `team/${teamId}/member/${saved.id}`,
                    metadata: {
                        teamId,
                        teamName: team.name,
                        userId,
                        role,
                    },
                });
                DomainEventBus_1.domainEvents.emit('team:member_added', {
                    teamId,
                    organizationId,
                    userId,
                    role,
                    teamName: team.name,
                    timestamp: new Date().toISOString(),
                });
                return saved;
            }
            throw new apiErrors_1.ConflictError('User is already a member of this team');
        }
        const member = this.memberRepo.create({
            organizationId,
            teamId,
            userId,
            role,
            status: 'active',
            joinedAt: new Date(),
            ...(personnelData?.rank !== undefined && { rank: personnelData.rank }),
            ...(personnelData?.shipType !== undefined && { shipType: personnelData.shipType }),
            ...(personnelData?.specialization !== undefined && {
                specialization: personnelData.specialization,
            }),
            ...(personnelData?.certifications !== undefined && {
                certifications: personnelData.certifications,
            }),
            ...(personnelData?.additionalRoles !== undefined && {
                additionalRoles: personnelData.additionalRoles,
            }),
        });
        const saved = await this.memberRepo.save(member);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'TEAM_MEMBER_ADDED',
            message: `Member added to team: ${userId}`,
            organizationId,
            resource: `team/${teamId}/member/${saved.id}`,
            metadata: {
                teamId,
                teamName: team.name,
                userId,
                role,
            },
        });
        DomainEventBus_1.domainEvents.emit('team:member_added', {
            teamId,
            organizationId,
            userId,
            role,
            teamName: team.name,
            timestamp: new Date().toISOString(),
        });
        return saved;
    }
    async updateMember(organizationId, teamId, memberId, data) {
        logger_1.logger.info('TeamService.updateMember', { organizationId, teamId, memberId });
        const member = await this.memberRepo.findOne({
            where: { id: memberId, organizationId, teamId },
        });
        if (!member) {
            throw new apiErrors_1.NotFoundError('Team member');
        }
        if (data.role !== undefined) {
            member.role = data.role;
        }
        if (data.status !== undefined) {
            const previousStatus = member.status;
            member.status = data.status;
            if (data.status === 'removed') {
                member.leftAt = new Date();
            }
            if (previousStatus !== data.status) {
                DomainEventBus_1.domainEvents.emit('team:member_status_changed', {
                    teamId,
                    organizationId,
                    userId: member.userId,
                    memberName: member.rank || undefined,
                    previousStatus,
                    newStatus: data.status,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        if (data.rank !== undefined) {
            member.rank = data.rank || undefined;
        }
        if (data.shipType !== undefined) {
            member.shipType = data.shipType || undefined;
        }
        if (data.specialization !== undefined) {
            member.specialization = data.specialization || undefined;
        }
        if (data.stats !== undefined) {
            member.stats = data.stats;
        }
        if (data.certifications !== undefined) {
            member.certifications = data.certifications;
        }
        if (data.additionalRoles !== undefined) {
            member.additionalRoles = data.additionalRoles;
        }
        if (data.lastActiveAt !== undefined) {
            member.lastActiveAt = data.lastActiveAt ? new Date(data.lastActiveAt) : undefined;
        }
        if (data.departureReason !== undefined) {
            member.departureReason = data.departureReason || undefined;
        }
        const saved = await this.memberRepo.save(member);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'TEAM_MEMBER_UPDATED',
            message: `Member updated in team: ${memberId}`,
            organizationId,
            resource: `team/${teamId}/member/${memberId}`,
            metadata: {
                teamId,
                memberId,
                updatedFields: Object.keys(data),
            },
        });
        return saved;
    }
    async removeMember(organizationId, teamId, memberId) {
        logger_1.logger.info('TeamService.removeMember', { organizationId, teamId, memberId });
        const member = await this.memberRepo.findOne({
            where: { id: memberId, organizationId, teamId },
        });
        if (!member) {
            throw new apiErrors_1.NotFoundError('Team member');
        }
        const team = await this.findById(organizationId, teamId);
        member.status = 'removed';
        member.leftAt = new Date();
        await this.memberRepo.save(member);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'TEAM_MEMBER_REMOVED',
            message: `Member removed from team: ${member.userId}`,
            organizationId,
            resource: `team/${teamId}/member/${memberId}`,
            metadata: {
                teamId,
                userId: member.userId,
                memberName: member.rank,
            },
        });
        DomainEventBus_1.domainEvents.emit('team:member_removed', {
            teamId,
            organizationId,
            userId: member.userId,
            teamName: team?.name ?? 'Unknown',
            timestamp: new Date().toISOString(),
        });
    }
    async getTeamMembersFiltered(organizationId, filters) {
        const queryBuilder = this.memberRepo
            .createQueryBuilder('member')
            .leftJoinAndSelect('member.user', 'user')
            .leftJoinAndSelect('member.team', 'team')
            .where('member.organizationId = :organizationId', { organizationId });
        if (filters.teamId) {
            queryBuilder.andWhere('member.teamId = :teamId', { teamId: filters.teamId });
        }
        if (filters.userId) {
            queryBuilder.andWhere('member.userId = :userId', { userId: filters.userId });
        }
        if (filters.role) {
            queryBuilder.andWhere('member.role = :role', { role: filters.role });
        }
        if (filters.shipType) {
            queryBuilder.andWhere('member.shipType = :shipType', { shipType: filters.shipType });
        }
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                queryBuilder.andWhere('member.status IN (:...statuses)', { statuses: filters.status });
            }
            else {
                queryBuilder.andWhere('member.status = :status', { status: filters.status });
            }
        }
        if (filters.joinedAfter) {
            queryBuilder.andWhere('member.joinedAt >= :joinedAfter', {
                joinedAfter: filters.joinedAfter,
            });
        }
        if (filters.joinedBefore) {
            queryBuilder.andWhere('member.joinedAt <= :joinedBefore', {
                joinedBefore: filters.joinedBefore,
            });
        }
        if (filters.lastActiveAfter) {
            queryBuilder.andWhere('member.lastActiveAt >= :lastActiveAfter', {
                lastActiveAfter: filters.lastActiveAfter,
            });
        }
        if (filters.lastActiveBefore) {
            queryBuilder.andWhere('member.lastActiveAt <= :lastActiveBefore', {
                lastActiveBefore: filters.lastActiveBefore,
            });
        }
        if (filters.searchTerm) {
            queryBuilder.andWhere('(user.username ILIKE :search OR member.role ILIKE :search OR member.shipType ILIKE :search)', { search: `%${filters.searchTerm}%` });
        }
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);
        const sortBy = filters.sortBy || 'joinedAt';
        const sortOrder = filters.sortOrder || 'DESC';
        queryBuilder.orderBy(`member.${sortBy}`, sortOrder);
        const [data, total] = await queryBuilder.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getTeamMemberById(organizationId, memberId) {
        return this.memberRepo.findOne({
            where: { organizationId, id: memberId },
            relations: ['user', 'team'],
        });
    }
    async findByUser(organizationId, userId) {
        return this.memberRepo.find({
            where: { organizationId, userId },
            relations: ['team'],
            order: { joinedAt: 'DESC' },
        });
    }
    async isMember(organizationId, teamId, userId) {
        const count = await this.memberRepo.count({
            where: { organizationId, teamId, userId },
        });
        return count > 0;
    }
    async getMembership(organizationId, teamId, userId) {
        const membership = await this.memberRepo.findOne({
            where: { organizationId, teamId, userId },
            relations: ['user', 'team'],
        });
        return membership || null;
    }
    async assignTeamToShip(organizationId, teamId, shipId, autoNest = true) {
        logger_1.logger.info('TeamService.assignTeamToShip', { organizationId, teamId, shipId });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        team.assignedShipId = shipId;
        await this.repository.save(team);
        if (autoNest) {
            const crewTeam = await this.repository.findOne({
                where: {
                    organizationId,
                    assignedShipId: shipId,
                    type: 'crew',
                },
            });
            if (crewTeam && crewTeam.id !== teamId) {
                await this.moveTeam(organizationId, teamId, crewTeam.id);
                logger_1.logger.info('TeamService.assignTeamToShip — auto-nested under crew', {
                    teamId,
                    crewTeamId: crewTeam.id,
                    shipId,
                });
            }
        }
        this.invalidateOrgCache(organizationId);
        return (await this.findById(organizationId, teamId));
    }
    async unassignTeamFromShip(organizationId, teamId) {
        logger_1.logger.info('TeamService.unassignTeamFromShip', { organizationId, teamId });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        team.assignedShipId = undefined;
        const saved = await this.repository.save(team);
        this.invalidateOrgCache(organizationId);
        return saved;
    }
    async assignTeamToDivision(organizationId, teamId, divisionId, autoNest = true) {
        logger_1.logger.info('TeamService.assignTeamToDivision', { organizationId, teamId, divisionId });
        const team = await this.findById(organizationId, teamId);
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team');
        }
        const division = await this.findById(organizationId, divisionId);
        if (!division) {
            throw new apiErrors_1.NotFoundError('Division');
        }
        team.assignedDivisionId = divisionId;
        await this.repository.save(team);
        if (autoNest) {
            await this.moveTeam(organizationId, teamId, divisionId);
            logger_1.logger.info('TeamService.assignTeamToDivision — auto-nested under division', {
                teamId,
                divisionId,
                divisionName: division.name,
            });
        }
        this.invalidateOrgCache(organizationId);
        return (await this.findById(organizationId, teamId));
    }
    async populateCrewFromAssignment(organizationId, crewTeamId, shipId) {
        logger_1.logger.info('TeamService.populateCrewFromAssignment', { organizationId, crewTeamId, shipId });
        const crewAssignmentRepo = data_source_1.AppDataSource.getRepository(CrewAssignment_1.CrewAssignment);
        const assignment = await crewAssignmentRepo.findOne({
            where: {
                organizationId,
                shipId,
                status: CrewAssignment_1.AssignmentStatus.ACTIVE,
            },
        });
        if (!assignment) {
            return { added: 0, skipped: 0 };
        }
        const crew = assignment.crew || [];
        let added = 0;
        let skipped = 0;
        for (const member of crew) {
            try {
                await this.addMember(organizationId, crewTeamId, member.userId, 'member', {
                    specialization: member.role,
                });
                added++;
            }
            catch {
                skipped++;
            }
        }
        logger_1.logger.info('TeamService.populateCrewFromAssignment — done', {
            crewTeamId,
            shipId,
            added,
            skipped,
        });
        return { added, skipped };
    }
    async bulkAddMembers(organizationId, teamId, members) {
        if (members.length === 0) {
            throw new apiErrors_1.ValidationError('No members provided for bulk add');
        }
        if (members.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot add more than 100 members in a single bulk operation');
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const created = [];
            for (const memberData of members) {
                const member = this.memberRepo.create({
                    organizationId,
                    teamId,
                    userId: memberData.userId,
                    role: memberData.role || 'member',
                    status: 'active',
                    joinedAt: new Date(),
                    ...(memberData.rank !== undefined && { rank: memberData.rank }),
                    ...(memberData.shipType !== undefined && { shipType: memberData.shipType }),
                    ...(memberData.specialization !== undefined && {
                        specialization: memberData.specialization,
                    }),
                    ...(memberData.certifications !== undefined && {
                        certifications: memberData.certifications,
                    }),
                    ...(memberData.additionalRoles !== undefined && {
                        additionalRoles: memberData.additionalRoles,
                    }),
                });
                const saved = await queryRunner.manager.save(member);
                created.push(saved);
            }
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk added ${created.length} members to team ${teamId}`, { organizationId });
            return created;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk add team members failed, transaction rolled back', {
                error,
                organizationId,
                teamId,
                count: members.length,
            });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async bulkUpdateMembers(organizationId, updates) {
        if (updates.length === 0) {
            throw new apiErrors_1.ValidationError('No updates provided for bulk update');
        }
        if (updates.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot update more than 100 members in a single bulk operation');
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const updated = [];
            for (const { id, data } of updates) {
                const member = await queryRunner.manager.findOne(TeamMember_1.TeamMember, {
                    where: { id, organizationId },
                });
                if (!member) {
                    throw new apiErrors_1.NotFoundError('Team member', id);
                }
                Object.assign(member, data);
                const saved = await queryRunner.manager.save(member);
                updated.push(saved);
            }
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk updated ${updated.length} team members`, { organizationId });
            return updated;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk update team members failed, transaction rolled back', {
                error,
                organizationId,
                count: updates.length,
            });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async bulkDeleteMembers(organizationId, teamId, memberIds) {
        if (memberIds.length === 0) {
            throw new apiErrors_1.ValidationError('No member IDs provided for bulk delete');
        }
        if (memberIds.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot delete more than 100 members in a single bulk operation');
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await queryRunner.manager.update(TeamMember_1.TeamMember, {
                id: (0, typeorm_1.In)(memberIds),
                organizationId,
                teamId,
            }, {
                status: 'removed',
                leftAt: new Date(),
            });
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk soft-deleted ${memberIds.length} team members`, { organizationId, teamId });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk delete team members failed, transaction rolled back', {
                error,
                organizationId,
                count: memberIds.length,
            });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async bulkUpdateStatus(organizationId, teamId, memberIds, status) {
        if (memberIds.length === 0) {
            throw new apiErrors_1.ValidationError('No member IDs provided for bulk status update');
        }
        if (memberIds.length > 100) {
            throw new apiErrors_1.ValidationError('Cannot update status for more than 100 members in a single bulk operation');
        }
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const setData = { status };
            if (status === 'removed') {
                setData.leftAt = new Date();
            }
            await queryRunner.manager
                .createQueryBuilder()
                .update(TeamMember_1.TeamMember)
                .set(setData)
                .where({ id: (0, typeorm_1.In)(memberIds), organizationId, teamId })
                .execute();
            await queryRunner.commitTransaction();
            logger_1.logger.info(`Bulk updated status to ${status} for ${memberIds.length} team members`, {
                organizationId,
                teamId,
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Bulk status update failed, transaction rolled back', {
                error,
                organizationId,
                status,
                count: memberIds.length,
            });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getTeamMemberCount(organizationId, teamId) {
        return this.memberRepo.count({
            where: { organizationId, teamId },
        });
    }
    async getActiveCount(organizationId, teamId) {
        return this.memberRepo.count({
            where: {
                organizationId,
                teamId,
                status: 'active',
            },
        });
    }
    async getMembersByRole(organizationId, teamId) {
        const members = await this.memberRepo.find({
            where: { organizationId, teamId },
            select: ['role'],
        });
        return members.reduce((acc, member) => {
            if (member.role) {
                acc[member.role] = (acc[member.role] || 0) + 1;
            }
            return acc;
        }, {});
    }
    async getMembersByShipType(organizationId, teamId) {
        const members = await this.memberRepo.find({
            where: { organizationId, teamId },
            select: ['shipType'],
        });
        return members.reduce((acc, member) => {
            if (member.shipType) {
                acc[member.shipType] = (acc[member.shipType] || 0) + 1;
            }
            return acc;
        }, {});
    }
    async getTeamStatistics(organizationId, teamId) {
        const members = await this.getTeamMembers(organizationId, teamId);
        const stats = {
            totalMembers: members.length,
            byRole: {},
        };
        for (const member of members) {
            const role = member.role || 'unknown';
            stats.byRole[role] = (stats.byRole[role] || 0) + 1;
        }
        return stats;
    }
    async getUserTeamCount(organizationId, userId) {
        return this.memberRepo.count({
            where: { organizationId, userId },
        });
    }
    async getTeamsByOrg(organizationId) {
        return this.repository.find({
            where: { organizationId },
            order: { level: 'ASC', sortOrder: 'ASC', name: 'ASC' },
        });
    }
    async getTeamById(organizationId, teamId) {
        return this.findById(organizationId, teamId);
    }
    async getRootTeams(organizationId) {
        return this.repository.find({
            where: { organizationId, parentTeamId: (0, typeorm_1.IsNull)() },
            order: { sortOrder: 'ASC', name: 'ASC' },
        });
    }
    async removeUserFromAllTeams(organizationId, userId) {
        logger_1.logger.info('TeamService.removeUserFromAllTeams', { organizationId, userId });
        const activeMembers = await this.memberRepo.find({
            where: { organizationId, userId, status: 'active' },
            relations: ['team'],
        });
        if (activeMembers.length === 0) {
            return 0;
        }
        const now = new Date();
        const timestamp = now.toISOString();
        for (const member of activeMembers) {
            member.status = 'removed';
            member.leftAt = now;
            await this.memberRepo.save(member);
            DomainEventBus_1.domainEvents.emit('team:member_removed', {
                teamId: member.teamId,
                organizationId,
                userId,
                teamName: member.team?.name ?? 'Unknown',
                reason: 'platform_left',
                timestamp,
            });
        }
        return activeMembers.length;
    }
}
exports.TeamService = TeamService;
//# sourceMappingURL=TeamService.js.map