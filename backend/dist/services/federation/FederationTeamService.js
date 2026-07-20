"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationTeamService = void 0;
const data_source_1 = require("../../data-source");
const FederationTeam_1 = require("../../models/FederationTeam");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationTeamService {
    static instance;
    teamRepository;
    ambassadorService;
    constructor() {
        this.teamRepository = data_source_1.AppDataSource.getRepository(FederationTeam_1.FederationTeam);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationTeamService.instance) {
            FederationTeamService.instance = new FederationTeamService();
        }
        return FederationTeamService.instance;
    }
    toData(entity) {
        return {
            id: entity.id,
            federationId: entity.federationId,
            name: entity.name,
            description: entity.description,
            type: entity.type,
            leaderId: entity.leaderId,
            leaderName: entity.leaderName,
            leaderOrgId: entity.leaderOrgId,
            members: entity.members ?? [],
            memberCount: entity.members?.length ?? 0,
            status: entity.status,
            maxMembers: entity.maxMembers,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
    async requireHRPermission(federationId, userId) {
        return (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'hr', 'Ambassador HR permission required to manage federation teams');
    }
    async requireViewAccess(federationId, userId) {
        return (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'federation teams');
    }
    async createTeam(federationId, userId, data) {
        await this.requireHRPermission(federationId, userId);
        if (!data.name?.trim() || data.name.trim().length < 2) {
            throw new apiErrors_1.ValidationError('Team name must be at least 2 characters');
        }
        const existing = await this.teamRepository.findOne({
            where: { federationId, name: data.name.trim() },
        });
        if (existing) {
            throw new apiErrors_1.ValidationError(`A team named "${data.name.trim()}" already exists`);
        }
        const team = this.teamRepository.create({
            federationId,
            name: data.name.trim(),
            description: data.description?.trim() ?? null,
            type: data.type ?? 'task_force',
            maxMembers: data.maxMembers ?? 20,
            leaderId: data.leaderId ?? null,
            leaderName: data.leaderName ?? null,
            leaderOrgId: data.leaderOrgId ?? null,
            members: [],
            status: 'active',
        });
        const saved = await this.teamRepository.save(team);
        logger_1.logger.info('Federation team created', {
            federationId,
            teamId: saved.id,
            name: saved.name,
        });
        return this.toData(saved);
    }
    async listTeams(federationId, userId) {
        await this.requireViewAccess(federationId, userId);
        const teams = await this.teamRepository.find({
            where: { federationId },
            order: { createdAt: 'DESC' },
        });
        return teams.map(t => this.toData(t));
    }
    async getTeam(federationId, userId, teamId) {
        await this.requireViewAccess(federationId, userId);
        const team = await this.teamRepository.findOne({
            where: { id: teamId, federationId },
        });
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team', teamId);
        }
        return this.toData(team);
    }
    async updateTeam(federationId, userId, teamId, data) {
        await this.requireHRPermission(federationId, userId);
        const team = await this.teamRepository.findOne({
            where: { id: teamId, federationId },
        });
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team', teamId);
        }
        if (data.name !== undefined) {
            team.name = data.name.trim();
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
        if (data.leaderId !== undefined) {
            team.leaderId = data.leaderId;
        }
        if (data.leaderName !== undefined) {
            team.leaderName = data.leaderName;
        }
        if (data.leaderOrgId !== undefined) {
            team.leaderOrgId = data.leaderOrgId;
        }
        if (data.status !== undefined) {
            team.status = data.status;
        }
        const saved = await this.teamRepository.save(team);
        logger_1.logger.info('Federation team updated', { federationId, teamId });
        return this.toData(saved);
    }
    async addMember(federationId, userId, teamId, member) {
        await this.requireHRPermission(federationId, userId);
        const team = await this.teamRepository.findOne({
            where: { id: teamId, federationId },
        });
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team', teamId);
        }
        if (team.status !== 'active') {
            throw new apiErrors_1.ValidationError('Cannot add members to a disbanded team');
        }
        if (team.members.length >= team.maxMembers) {
            throw new apiErrors_1.ValidationError(`Team is at maximum capacity (${team.maxMembers})`);
        }
        if (team.members.some(m => m.userId === member.userId)) {
            throw new apiErrors_1.ValidationError('User is already a member of this team');
        }
        team.members = [...team.members, member];
        const saved = await this.teamRepository.save(team);
        logger_1.logger.info('Federation team member added', {
            federationId,
            teamId,
            userId: member.userId,
        });
        return this.toData(saved);
    }
    async removeMember(federationId, userId, teamId, memberUserId) {
        await this.requireHRPermission(federationId, userId);
        const team = await this.teamRepository.findOne({
            where: { id: teamId, federationId },
        });
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team', teamId);
        }
        team.members = team.members.filter(m => m.userId !== memberUserId);
        const saved = await this.teamRepository.save(team);
        logger_1.logger.info('Federation team member removed', {
            federationId,
            teamId,
            removedUserId: memberUserId,
        });
        return this.toData(saved);
    }
    async deleteTeam(federationId, userId, teamId) {
        await this.requireHRPermission(federationId, userId);
        const team = await this.teamRepository.findOne({
            where: { id: teamId, federationId },
        });
        if (!team) {
            throw new apiErrors_1.NotFoundError('Team', teamId);
        }
        await this.teamRepository.remove(team);
        logger_1.logger.info('Federation team deleted', { federationId, teamId });
    }
}
exports.FederationTeamService = FederationTeamService;
//# sourceMappingURL=FederationTeamService.js.map