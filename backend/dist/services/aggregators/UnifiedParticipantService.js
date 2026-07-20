"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedParticipantService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const data_source_1 = require("../../data-source");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const logger_1 = require("../../utils/logger");
const ActivityService_1 = require("../activity/ActivityService");
const JobApplicationService_1 = require("../organization/JobApplicationService");
const LFGSessionService_1 = require("../social/LFGSessionService");
const TeamService_1 = require("../team/TeamService");
class UnifiedParticipantService {
    teamService;
    activityService;
    jobApplicationService;
    lfgSessionService;
    constructor(teamService, activityService, jobApplicationService, lfgSessionService) {
        this.teamService = teamService ?? new TeamService_1.TeamService();
        this.activityService = activityService ?? new ActivityService_1.ActivityService();
        this.jobApplicationService = jobApplicationService ?? new JobApplicationService_1.JobApplicationService();
        this.lfgSessionService = lfgSessionService ?? new LFGSessionService_1.LFGSessionService();
    }
    async getUserParticipationSummary(query) {
        const { userId, systems } = query;
        const enabledSystems = systems ?? ['team', 'activity', 'job', 'lfg'];
        const systemResults = await Promise.allSettled(enabledSystems.map(system => this.getSystemParticipation(system, query)));
        const systemParticipations = systemResults.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            logger_1.logger.warn(`Failed to fetch ${enabledSystems[index]} participation for user ${userId}`, {
                error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
            return {
                system: enabledSystems[index],
                participants: [],
                error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            };
        });
        return this.buildSummary(userId, systemParticipations);
    }
    async getSystemParticipation(system, query) {
        switch (system) {
            case 'team':
                return this.getTeamParticipation(query);
            case 'activity':
                return this.getActivityParticipation(query);
            case 'job':
                return this.getJobParticipation(query);
            case 'lfg':
                return this.getLfgParticipation(query);
        }
    }
    async getTeamParticipation(query) {
        const { userId, organizationId } = query;
        if (!organizationId) {
            return { system: 'team', participants: [] };
        }
        const members = await this.teamService.findByUser(organizationId, userId);
        const participants = members.map(member => TeamService_1.TeamService.toParticipantInfo(member));
        return { system: 'team', participants };
    }
    async getActivityParticipation(query) {
        const { userId, organizationIds } = query;
        const orgIds = organizationIds ?? (query.organizationId ? [query.organizationId] : []);
        const participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
        const qb = participantRepo
            .createQueryBuilder('ap')
            .innerJoinAndSelect('ap.activity', 'activity')
            .where('ap."userId" = :userId', { userId });
        if (orgIds.length > 0) {
            qb.andWhere('activity."organizationId" IN (:...orgIds)', { orgIds });
        }
        const participantRows = await qb.getMany();
        const participants = participantRows.map(row => {
            const roles = (0, shared_types_1.mapActivityRoleToSystemRoles)(row.role);
            const status = (0, shared_types_1.mapActivityStatusToParticipantStatus)(row.status);
            const act = row.activity;
            return {
                userId: row.userId,
                organizationId: row.organizationId ?? act?.organizationId ?? '',
                username: row.userName,
                roles,
                status,
                joinedAt: row.joinedAt,
                source: 'manual',
                metadata: {
                    activityId: row.activityId,
                    activityTitle: act?.title,
                    activityType: act?.activityType,
                    role: row.role,
                    shipType: row.shipType,
                    crewPosition: row.crewPosition,
                },
            };
        });
        return { system: 'activity', participants };
    }
    async getJobParticipation(query) {
        const { userId } = query;
        const applications = await this.jobApplicationService.getApplicationsByUser(userId);
        const participants = applications.map(app => JobApplicationService_1.JobApplicationService.toParticipantInfo(app));
        return { system: 'job', participants };
    }
    async getLfgParticipation(query) {
        const { userId } = query;
        const [userSessions, hostedSessions] = await Promise.all([
            this.lfgSessionService.getUserSessions(userId),
            this.lfgSessionService.getHostedSessions(userId),
        ]);
        const sessionMap = new Map();
        for (const session of [...userSessions, ...hostedSessions]) {
            sessionMap.set(session.id, session);
        }
        const participants = Array.from(sessionMap.values()).map(session => LFGSessionService_1.LFGSessionService.toParticipantInfo(userId, session));
        return { system: 'lfg', participants };
    }
    buildSummary(userId, systems) {
        const allParticipants = systems.flatMap(s => s.participants);
        const roleSet = new Set();
        let activeCount = 0;
        let pendingCount = 0;
        for (const p of allParticipants) {
            for (const role of p.roles) {
                roleSet.add(role);
            }
            if (p.status === 'active') {
                activeCount++;
            }
            if (p.status === 'pending' || p.status === 'invited' || p.status === 'waitlisted') {
                pendingCount++;
            }
        }
        return {
            userId,
            totalParticipations: allParticipants.length,
            systems,
            activeCount,
            pendingCount,
            allRoles: Array.from(roleSet),
        };
    }
}
exports.UnifiedParticipantService = UnifiedParticipantService;
//# sourceMappingURL=UnifiedParticipantService.js.map