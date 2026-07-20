"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const apiErrors_1 = require("../../utils/apiErrors");
const cacheInvalidation_1 = require("../../utils/cacheInvalidation");
const crewCalculation_1 = require("../../utils/crewCalculation");
const logger_1 = require("../../utils/logger");
const activityWebSocketController_1 = require("../../websocket/controllers/activityWebSocketController");
const TenantService_1 = require("../base/TenantService");
const communication_1 = require("../communication");
const content_1 = require("../content");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const UserService_1 = require("../user/UserService");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
const ActivityEventService_1 = require("./ActivityEventService");
const ActivityJobService_1 = require("./ActivityJobService");
const ActivityParticipantService_1 = require("./ActivityParticipantService");
const RouteCalculationService_1 = require("./RouteCalculationService");
class ActivityService extends TenantService_1.TenantService {
    voiceChannelService;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity), {
            enableCache: true,
            cacheTTL: 600,
            cacheCheckPeriod: 120,
        });
        this.voiceChannelService = communication_1.VoiceChannelService.getInstance();
    }
    logActivityAudit(entry) {
        ActivityAuditLogger_1.activityAuditLogger.log(entry);
    }
    getActivityAuditLog(options) {
        return ActivityAuditLogger_1.activityAuditLogger.getAuditLog(options);
    }
    getActivityAuditStats(activityId) {
        return ActivityAuditLogger_1.activityAuditLogger.getActivityAuditStats(activityId);
    }
    async createActivity(organizationId, dto) {
        if (dto.crewMembers && dto.crewMembers.length > 0) {
            const validCrewMembers = dto.crewMembers.filter((c) => c !== null && typeof c === 'object' && c.userId !== null && typeof c.userId === 'string');
            if (validCrewMembers.length !== dto.crewMembers.length) {
                throw new apiErrors_1.ValidationError('Crew members contain invalid entries');
            }
            const crewUserIds = validCrewMembers.map(c => c.userId);
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const invalidFormats = crewUserIds.filter(id => !uuidRegex.test(id));
            if (invalidFormats.length > 0) {
                throw new apiErrors_1.ValidationError(`Invalid user ID format: ${invalidFormats.join(', ')}`);
            }
            const uniqueCrewIds = [...new Set(crewUserIds)];
            if (uniqueCrewIds.length !== crewUserIds.length) {
                throw new apiErrors_1.ValidationError(`Duplicate crew members detected (${crewUserIds.length - uniqueCrewIds.length} duplicate(s))`);
            }
            const userService = new UserService_1.UserService();
            const validation = await userService.validateUsersInOrganization(uniqueCrewIds, organizationId);
            if (validation.invalid.length > 0) {
                throw new apiErrors_1.ValidationError(`Crew members not in organization (${validation.invalid.length}): ${validation.invalid.join(', ')}`);
            }
            logger_1.logger.info('Crew verification passed', {
                organizationId,
                crewCount: validation.valid.length,
            });
        }
        const defaultVisibility = organizationId
            ? Activity_1.ActivityVisibility.ORGANIZATION
            : Activity_1.ActivityVisibility.PUBLIC;
        const isRecruitmentType = dto.activityType === Activity_1.ActivityType.RECRUITMENT ||
            dto.activityType === Activity_1.ActivityType.JOB_LISTING;
        const activity = await this.create(organizationId, {
            title: dto.title,
            description: dto.description,
            activityType: dto.activityType,
            status: Activity_1.ActivityStatus.OPEN,
            visibility: dto.visibility ?? defaultVisibility,
            creatorId: dto.creatorId,
            creatorName: dto.creatorName,
            organizationName: dto.organizationName,
            scheduledStartDate: dto.scheduledStartDate,
            scheduledEndDate: dto.scheduledEndDate,
            timezone: dto.timezone,
            estimatedDuration: dto.estimatedDuration,
            location: dto.location,
            systemLocation: dto.systemLocation,
            maxParticipants: dto.maxParticipants,
            minParticipants: dto.minParticipants ?? 1,
            currentParticipants: isRecruitmentType ? 0 : 1,
            roleRequirements: dto.roleRequirements,
            resourceRequirements: dto.resourceRequirements,
            rewardCredits: dto.rewardCredits ?? 0,
            rewardReputation: dto.rewardReputation ?? 0,
            tags: dto.tags ?? [],
            categories: dto.categories ?? [],
            metadata: dto.metadata,
            participants: isRecruitmentType
                ? []
                : [
                    {
                        userId: dto.creatorId,
                        userName: dto.creatorName,
                        organizationId,
                        organizationName: dto.organizationName,
                        role: Activity_1.ParticipantRole.LEADER,
                        status: 'accepted',
                        joinedAt: new Date(),
                    },
                ],
            participatingOrgs: isRecruitmentType
                ? []
                : [
                    {
                        organizationId,
                        organizationName: dto.organizationName,
                        role: 'host',
                        memberCount: 1,
                        status: 'accepted',
                        joinedAt: new Date(),
                    },
                ],
            invitedOrgs: [],
            alliedOrgs: [],
        });
        let savedActivity = await this.repository.save(activity);
        if (!isRecruitmentType) {
            await this.participantService.joinActivity(savedActivity.id, {
                userId: dto.creatorId,
                userName: dto.creatorName,
                organizationId,
                organizationName: dto.organizationName,
                role: Activity_1.ParticipantRole.LEADER,
            });
        }
        if (dto.createVoiceChannel && dto.organizationId) {
            await this.createVoiceChannelForActivity(savedActivity, dto.voiceChannelTemplate, dto.voiceChannelLimit, dto.voiceChannelBitrate);
        }
        if (dto.routePlan && dto.routePlan.length > 0) {
            savedActivity = await this.addRoutePlan(savedActivity.id, dto.creatorId, dto.routePlan);
        }
        if (dto.autoEnrichMining !== false) {
            savedActivity = await this.autoEnrichMiningActivity(savedActivity);
        }
        if ((savedActivity.shipAssignments && savedActivity.shipAssignments.length > 0) ||
            (savedActivity.routePlan && savedActivity.routePlan.length > 0)) {
            savedActivity = await this.routeCalcService.updateActivityRouteData(savedActivity);
            savedActivity = await this.repository.save(savedActivity);
        }
        if (dto.crewMembers && dto.crewMembers.length > 0) {
            try {
                logger_1.logger.info('Activity crew members verified', {
                    activityId: savedActivity.id,
                    crewCount: dto.crewMembers.length,
                    organizationId,
                    createdBy: dto.creatorId,
                    crewIds: dto.crewMembers.map((c) => c.userId),
                });
            }
            catch (auditError) {
                logger_1.logger.error('Crew verification audit logging failed (non-blocking)', {
                    activityId: savedActivity.id,
                    error: auditError instanceof Error ? auditError.message : String(auditError),
                });
            }
        }
        this.logActivityAudit({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_CREATED,
            activityId: savedActivity.id,
            activityTitle: savedActivity.title,
            activityType: savedActivity.activityType,
            organizationId,
            performedById: dto.creatorId,
            performedByName: dto.creatorName,
            details: {
                visibility: savedActivity.visibility,
                maxParticipants: savedActivity.maxParticipants,
                scheduledStartDate: savedActivity.scheduledStartDate,
                timezone: savedActivity.timezone,
                tags: savedActivity.tags,
                hasVoiceChannel: !!dto.createVoiceChannel,
                hasRoutePlan: dto.routePlan && dto.routePlan.length > 0,
                hasShipAssignments: savedActivity.shipAssignments && savedActivity.shipAssignments.length > 0,
                totalCargoCapacity: savedActivity.totalCargoCapacity,
                hasRefuelShip: savedActivity.hasRefuelShip,
            },
        });
        DomainEventBus_1.domainEvents.emit('activity:created', {
            activityId: savedActivity.id,
            organizationId,
            activityType: savedActivity.activityType,
            title: savedActivity.title,
            hostUserId: dto.creatorId,
            scheduledAt: dto.scheduledStartDate?.toISOString(),
            maxParticipants: savedActivity.maxParticipants,
            timezone: savedActivity.timezone,
            description: savedActivity.description,
            location: savedActivity.location,
            estimatedDuration: savedActivity.estimatedDuration,
            discordServerId: savedActivity.metadata?.discordServerId,
            timestamp: new Date().toISOString(),
        });
        logger_1.logger.info(`Created activity: ${savedActivity.id} (${dto.activityType})`);
        (0, cacheInvalidation_1.invalidateActivityCache)(organizationId);
        return savedActivity;
    }
    _participantService;
    get participantService() {
        this._participantService ??= new ActivityParticipantService_1.ActivityParticipantService();
        return this._participantService;
    }
    _routeCalcService;
    get routeCalcService() {
        this._routeCalcService ??= new RouteCalculationService_1.RouteCalculationService();
        return this._routeCalcService;
    }
    async recalculateFleetTotals(activity) {
        const routeData = await this.routeCalcService.calculateRoute(activity.shipAssignments ?? activity.ships ?? [], activity.routePlan);
        activity.totalCargoCapacity = routeData.totalCargoCapacity;
        activity.totalQuantumFuel = routeData.totalQuantumFuel;
        activity.totalQuantumFuelRequired = routeData.totalQuantumFuelRequired;
        activity.maxJumpRange = routeData.maxJumpRange;
        activity.hasRefuelShip = routeData.hasRefuelShip;
    }
    async createVoiceChannelForActivity(activity, templateId, userLimit, bitrate) {
        const expiresAt = activity.scheduledEndDate
            ? new Date(activity.scheduledEndDate.getTime() + 2 * 60 * 60 * 1000)
            : undefined;
        activity.voiceChannel = {
            templateId: templateId ?? 'default',
            autoCreate: true,
            autoDelete: true,
            userLimit: userLimit ?? activity.maxParticipants,
            bitrate,
            expiresAt,
        };
        await this.repository.save(activity);
        logger_1.logger.info(`Configured voice channel for activity: ${activity.id}`);
    }
    async linkVoiceChannel(activityId, channelId, guildId) {
        return this.eventService.linkVoiceChannel(activityId, channelId, guildId);
    }
    async joinActivity(activityId, dto) {
        return this.participantService.joinActivity(activityId, dto);
    }
    static toParticipantInfo(participant) {
        const statusMap = {
            invited: 'invited',
            accepted: 'active',
            declined: 'inactive',
            standby: 'waitlisted',
        };
        return {
            userId: participant.userId,
            organizationId: participant.organizationId,
            username: participant.userName,
            displayName: participant.userName,
            avatar: participant.avatarUrl,
            roles: participant.role === Activity_1.ParticipantRole.LEADER ||
                participant.role === Activity_1.ParticipantRole.CO_LEADER ||
                participant.role === Activity_1.ParticipantRole.COMMANDER
                ? [shared_types_1.SystemRole.ACTIVITY_HOST]
                : [shared_types_1.SystemRole.ACTIVITY_PARTICIPANT],
            primaryRole: participant.role,
            status: statusMap[participant.status],
            joinedAt: participant.joinedAt,
            source: 'manual',
            metadata: {
                shipType: participant.shipType,
                shipName: participant.shipName,
                shipId: participant.shipId,
                crewPosition: participant.crewPosition,
            },
        };
    }
    toParticipantInfo(participant) {
        return ActivityService.toParticipantInfo(participant);
    }
    async leaveActivity(activityId, userId) {
        return this.participantService.leaveActivity(activityId, userId);
    }
    async inviteOrganization(activityId, organizationId, organizationName, invitedBy, role = 'participant') {
        return this.participantService.inviteOrganization(activityId, organizationId, organizationName, invitedBy, role);
    }
    async acceptOrganizationInvite(activityId, organizationId, _acceptedBy) {
        return this.participantService.acceptOrganizationInvite(activityId, organizationId);
    }
    async declineOrganizationInvite(activityId, organizationId) {
        return this.participantService.declineOrganizationInvite(activityId, organizationId);
    }
    applyEnumAndOwnershipFilters(qb, filters) {
        if (!filters.activityType) {
            qb.andWhere('activity.activityType != :excludedType', {
                excludedType: Activity_1.ActivityType.RECRUITMENT,
            });
        }
        if (filters.activityType) {
            if (Array.isArray(filters.activityType)) {
                qb.andWhere('activity.activityType IN (:...types)', { types: filters.activityType });
            }
            else {
                qb.andWhere('activity.activityType = :type', { type: filters.activityType });
            }
        }
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                qb.andWhere('activity.status IN (:...statuses)', { statuses: filters.status });
            }
            else {
                qb.andWhere('activity.status = :status', { status: filters.status });
            }
        }
        if (filters.visibility) {
            qb.andWhere('activity.visibility = :visibility', { visibility: filters.visibility });
        }
        if (filters.organizationId) {
            qb.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
        }
        if (filters.creatorId) {
            qb.andWhere('activity.creatorId = :creatorId', { creatorId: filters.creatorId });
        }
    }
    applyParticipatingOrgsFilter(qb, participatingOrgIds) {
        if (!participatingOrgIds || participatingOrgIds.length === 0) {
            return;
        }
        const orgConditions = participatingOrgIds
            .map((_, index) => `"participatingOrgs" @> :orgFilter${index}`)
            .join(' OR ');
        const parameters = {};
        participatingOrgIds.forEach((orgId, index) => {
            parameters[`orgFilter${index}`] = JSON.stringify([{ organizationId: orgId }]);
        });
        qb.andWhere(`(${orgConditions})`, parameters);
    }
    applyMiscFilters(qb, filters) {
        if (filters.startDate) {
            qb.andWhere('activity.scheduledStartDate >= :startDate', { startDate: filters.startDate });
        }
        if (filters.endDate) {
            qb.andWhere('activity.scheduledStartDate <= :endDate', { endDate: filters.endDate });
        }
        if (filters.tags && filters.tags.length > 0) {
            qb.andWhere('activity.tags && ARRAY[:...tags]', { tags: filters.tags });
        }
        if (filters.categories && filters.categories.length > 0) {
            qb.andWhere('activity.categories && ARRAY[:...categories]', {
                categories: filters.categories,
            });
        }
        if (filters.hasOpenSlots) {
            qb.andWhere('(activity.maxParticipants IS NULL OR activity.currentParticipants < activity.maxParticipants)');
        }
        if (filters.isFeatured) {
            qb.andWhere('activity.isFeatured = :featured', { featured: true });
        }
        if (filters.isUrgent) {
            qb.andWhere('activity.isUrgent = :urgent', { urgent: true });
        }
    }
    applySearchTermFilter(qb, searchTerm) {
        if (!searchTerm) {
            return;
        }
        const isPostgres = qb.connection.options.type === 'postgres';
        if (isPostgres) {
            const sanitized = searchTerm.replaceAll(/[^a-zA-Z0-9\s-]/g, '').trim();
            const words = sanitized.split(/\s+/).filter(w => w.length > 0);
            const tsquery = words.map(w => (w.length >= 2 && w.length <= 3 ? `${w}:*` : w)).join(' & ');
            qb.andWhere(new typeorm_1.Brackets(sq => {
                sq.where(`activity.search_vector @@ to_tsquery('english', :tsquery_actSearch)`, {
                    tsquery_actSearch: tsquery,
                });
                sq.orWhere('activity.tags && ARRAY[:searchTag]', { searchTag: searchTerm });
            }));
            qb.addOrderBy(`ts_rank(activity.search_vector, to_tsquery('english', :tsquery_actSearch))`, 'DESC');
        }
        else {
            qb.andWhere(new typeorm_1.Brackets(sq => {
                sq.where('activity.title ILIKE :search_actSearch', {
                    search_actSearch: `%${searchTerm}%`,
                });
                sq.orWhere('activity.description ILIKE :search_actSearch');
                sq.orWhere('activity.tags && ARRAY[:searchTag]', { searchTag: searchTerm });
            }));
        }
    }
    async searchActivities(filters, page = 1, limit = 20) {
        const queryBuilder = this.repository.createQueryBuilder('activity');
        this.applyEnumAndOwnershipFilters(queryBuilder, filters);
        this.applyParticipatingOrgsFilter(queryBuilder, filters.participatingOrgIds);
        this.applyMiscFilters(queryBuilder, filters);
        this.applySearchTermFilter(queryBuilder, filters.searchTerm);
        const total = await queryBuilder.getCount();
        const skip = (page - 1) * limit;
        if (filters.searchTerm) {
            queryBuilder
                .addOrderBy('activity.scheduledStartDate', 'ASC')
                .addOrderBy('activity.createdAt', 'DESC');
        }
        else {
            queryBuilder
                .orderBy('activity.scheduledStartDate', 'ASC')
                .addOrderBy('activity.createdAt', 'DESC');
        }
        queryBuilder.skip(skip).take(limit);
        const activities = await queryBuilder.getMany();
        return {
            activities,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getActivitiesForUser(userId, userOrgIds, filters) {
        const queryBuilder = this.repository.createQueryBuilder('activity');
        const orgConditions = userOrgIds.length > 0
            ? userOrgIds.map((_, index) => `"participatingOrgs" @> :orgFilter${index}`).join(' OR ')
            : '';
        const whereClause = orgConditions
            ? `(
                activity.creatorId = :userId
                OR activity.visibility = :publicVisibility
                OR activity.organizationId IN (:...orgIds)
                OR ${orgConditions}
            )`
            : `(
                activity.creatorId = :userId
                OR activity.visibility = :publicVisibility
                OR activity.organizationId IN (:...orgIds)
            )`;
        const parameters = {
            userId,
            publicVisibility: Activity_1.ActivityVisibility.PUBLIC,
            orgIds: userOrgIds.length > 0 ? userOrgIds : [''],
        };
        if (userOrgIds.length > 0) {
            userOrgIds.forEach((orgId, index) => {
                parameters[`orgFilter${index}`] = JSON.stringify([{ organizationId: orgId }]);
            });
        }
        queryBuilder.where(whereClause, parameters);
        if (filters?.activityType) {
            queryBuilder.andWhere('activity.activityType = :type', { type: filters.activityType });
        }
        if (filters?.status) {
            if (Array.isArray(filters.status)) {
                queryBuilder.andWhere('activity.status IN (:...statuses)', { statuses: filters.status });
            }
            else {
                queryBuilder.andWhere('activity.status = :status', { status: filters.status });
            }
        }
        queryBuilder
            .orderBy('activity.scheduledStartDate', 'ASC')
            .addOrderBy('activity.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async updateStatus(activityId, status, userId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.creatorId !== userId &&
            !(await this.participantService.isLeader(activityId, userId))) {
            throw new apiErrors_1.ForbiddenError('Only leaders can update status');
        }
        const previousStatus = activity.status;
        activity.status = status;
        if (status === Activity_1.ActivityStatus.IN_PROGRESS && !activity.actualStartDate) {
            activity.actualStartDate = new Date();
        }
        if ((status === Activity_1.ActivityStatus.COMPLETED || status === Activity_1.ActivityStatus.FAILED) &&
            !activity.actualEndDate) {
            activity.actualEndDate = new Date();
        }
        const updated = await this.repository.save(activity);
        logger_1.logger.info(`Activity ${activityId} status updated to: ${status}`, {
            organizationId: activity.organizationId,
            previousStatus,
        });
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_STATUS_CHANGED,
            activityId,
            activityTitle: updated.title,
            activityType: updated.activityType,
            organizationId: updated.organizationId ?? '',
            performedById: userId,
            performedByName: userId,
            details: {
                previousStatus,
                newStatus: status,
                actualStartDate: updated.actualStartDate?.toISOString(),
                actualEndDate: updated.actualEndDate?.toISOString(),
            },
        });
        if (activity.organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        }
        return updated;
    }
    async submitCompletionReport(activityId, report) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        activity.completionReport = {
            submittedBy: report.submittedBy,
            submittedAt: new Date(),
            outcome: report.outcome,
            participantCount: activity.currentParticipants,
            duration: report.duration ??
                (activity.actualEndDate && activity.actualStartDate
                    ? Math.floor((activity.actualEndDate.getTime() - activity.actualStartDate.getTime()) / 60000)
                    : 0),
            creditsEarned: report.creditsEarned ?? activity.rewardCredits,
            reputationEarned: report.reputationEarned ?? activity.rewardReputation,
            objectivesCompleted: report.objectivesCompleted,
            performanceRatings: report.performanceRatings,
            notableEvents: report.notableEvents,
            recommendations: report.recommendations,
        };
        activity.status = Activity_1.ActivityStatus.COMPLETED;
        activity.actualEndDate = activity.actualEndDate ?? new Date();
        const updated = await this.repository.save(activity);
        logger_1.logger.info(`Completion report submitted for activity: ${activityId}`);
        if (activity.organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        }
        return updated;
    }
    async getStatistics(organizationId) {
        const queryBuilder = this.repository.createQueryBuilder('activity');
        if (organizationId) {
            queryBuilder.where(`(activity.organizationId = :orgId OR "participatingOrgs" @> :orgFilter)`, {
                orgId: organizationId,
                orgFilter: JSON.stringify([{ organizationId }]),
            });
        }
        const activities = await queryBuilder.getMany();
        const total = activities.length;
        const active = activities.filter(a => a.status === Activity_1.ActivityStatus.OPEN ||
            a.status === Activity_1.ActivityStatus.IN_PROGRESS ||
            a.status === Activity_1.ActivityStatus.RECRUITING).length;
        const completed = activities.filter(a => a.status === Activity_1.ActivityStatus.COMPLETED).length;
        const successful = activities.filter(a => a.completionReport?.outcome === 'success').length;
        const totalParticipants = activities.reduce((sum, a) => sum + a.currentParticipants, 0);
        const avgParticipants = total > 0 ? totalParticipants / total : 0;
        const successRate = completed > 0 ? (successful / completed) * 100 : 0;
        const byType = activities.reduce((acc, activity) => {
            acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
            return acc;
        }, {});
        const byOrganization = activities.reduce((acc, activity) => {
            if (activity.organizationId) {
                acc[activity.organizationId] = (acc[activity.organizationId] || 0) + 1;
            }
            return acc;
        }, {});
        const totalCreditsRewarded = activities
            .filter(a => a.completionReport)
            .reduce((sum, a) => sum + (a.completionReport?.creditsEarned ?? 0), 0);
        const totalReputationRewarded = activities
            .filter(a => a.completionReport)
            .reduce((sum, a) => sum + (a.completionReport?.reputationEarned ?? 0), 0);
        return {
            totalActivities: total,
            activeActivities: active,
            completedActivities: completed,
            totalParticipants,
            averageParticipants: Math.round(avgParticipants * 10) / 10,
            successRate: Math.round(successRate * 10) / 10,
            byType,
            byOrganization,
            totalCreditsRewarded,
            totalReputationRewarded,
        };
    }
    async canUserAccessActivity(activity, userId, userOrgId) {
        if (activity.visibility === Activity_1.ActivityVisibility.PUBLIC) {
            return true;
        }
        if (activity.creatorId === userId) {
            return true;
        }
        if (await this.participantService.isParticipant(activity.id, userId)) {
            return true;
        }
        if (userOrgId) {
            if (activity.organizationId === userOrgId) {
                return true;
            }
            if ((activity.participatingOrgs ?? []).some(org => org.organizationId === userOrgId && org.status === 'accepted')) {
                return true;
            }
            if ((activity.invitedOrgs ?? []).includes(userOrgId)) {
                return true;
            }
            if ((activity.alliedOrgs ?? []).includes(userOrgId)) {
                return true;
            }
        }
        return false;
    }
    async getActivityById(id) {
        return this.repository.findOne({ where: { id } });
    }
    async updateActivity(id, updates) {
        const activity = await this.repository.findOne({ where: { id } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        logger_1.logger.info(`Updating activity: ${id}`, {
            organizationId: activity.organizationId,
            updateFields: Object.keys(updates),
        });
        const trackedFields = [
            'title',
            'description',
            'location',
            'timezone',
            'estimatedDuration',
            'scheduledStartDate',
            'maxParticipants',
            'shipAssignments',
            'ships',
            'routePlan',
        ];
        const before = new Map(trackedFields.map(f => [f, activity[f]]));
        Object.assign(activity, updates);
        activity.updatedAt = new Date();
        const shouldRecalculateRoute = updates.shipAssignments !== undefined ||
            updates.ships !== undefined ||
            updates.routePlan !== undefined;
        if (shouldRecalculateRoute) {
            await this.routeCalcService.updateActivityRouteData(activity);
        }
        const updated = await this.repository.save(activity);
        logger_1.logger.info(`Activity updated: ${id} (route recalculated: ${shouldRecalculateRoute})`);
        if (activity.organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_UPDATED,
            activityId: id,
            activityTitle: updated.title,
            activityType: updated.activityType,
            organizationId: updated.organizationId ?? '',
            performedById: updated.creatorId,
            performedByName: updated.creatorId,
            details: {
                updatedFields: Object.keys(updates),
                changedFieldCount: Object.keys(updates).length,
            },
        });
        const updatedFields = Array.from(before.keys()).filter(field => before.get(field) !== updated[field]);
        if (updatedFields.length > 0) {
            DomainEventBus_1.domainEvents.emit('activity:updated', {
                activityId: updated.id,
                organizationId: updated.organizationId ?? '',
                updatedFields,
                title: updated.title,
                description: updated.description,
                scheduledAt: updated.scheduledStartDate?.toISOString(),
                timezone: updated.timezone,
                estimatedDuration: updated.estimatedDuration,
                location: updated.location,
                timestamp: new Date().toISOString(),
            });
        }
        return updated;
    }
    broadcastRosterChange(activity) {
        if (!activity.organizationId) {
            return;
        }
        (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        (0, activityWebSocketController_1.emitActivityUpdated)(activity.organizationId, activity);
        DomainEventBus_1.domainEvents.emit('activity:updated', {
            activityId: activity.id,
            organizationId: activity.organizationId,
            updatedFields: ['shipAssignments'],
            title: activity.title,
            description: activity.description,
            scheduledAt: activity.scheduledStartDate?.toISOString(),
            estimatedDuration: activity.estimatedDuration,
            location: activity.location,
            timestamp: new Date().toISOString(),
        });
    }
    async findByBountyId(bountyId) {
        return this.repository.findOne({
            where: { linkedBountyId: bountyId },
        });
    }
    async findByMissionId(missionId) {
        return this.repository.findOne({
            where: { linkedMissionId: missionId },
        });
    }
    async deleteActivity(id, userId) {
        const activity = await this.repository.findOne({ where: { id } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.creatorId !== userId) {
            throw new apiErrors_1.ForbiddenError('Only creator can delete activity');
        }
        if (activity.status === Activity_1.ActivityStatus.IN_PROGRESS) {
            throw new apiErrors_1.ValidationError('Cannot delete activity in progress');
        }
        logger_1.logger.info(`Deleting activity: ${id}`, {
            organizationId: activity.organizationId,
            activityType: activity.activityType,
            creatorId: activity.creatorId,
        });
        if (activity.voiceChannel?.channelId) {
            this.voiceChannelService.deleteChannel(activity.voiceChannel.channelId);
        }
        const discordEventId = activity.discordEventId;
        const organizationId = activity.organizationId;
        await this.repository.remove(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_DELETED,
            activityId: id,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: organizationId ?? '',
            performedById: userId,
            performedByName: userId,
            details: {
                participantCount: activity.currentParticipants,
                hadDiscordEvent: !!discordEventId,
            },
        });
        logger_1.logger.info(`Activity deleted: ${id}`);
        if (organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(organizationId);
        }
        DomainEventBus_1.domainEvents.emit('activity:deleted', {
            activityId: id,
            organizationId: organizationId ?? '',
            discordEventId: discordEventId ?? undefined,
            timestamp: new Date().toISOString(),
        });
    }
    async addShip(activityId, userId, ship) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isParticipant = await this.participantService.isParticipant(activityId, userId);
        if (!isParticipant) {
            throw new apiErrors_1.ValidationError('User is not a participant');
        }
        activity.shipAssignments ??= [];
        if (ship.parentShipId) {
            const parentExists = activity.shipAssignments.some(s => s.shipId === ship.parentShipId || (s.shipName ?? s.shipType) === ship.parentShipId);
            if (!parentExists) {
                throw new apiErrors_1.ValidationError('Parent ship not found in activity');
            }
        }
        const isNested = !!ship.parentShipId;
        const allExistingShips = [...(activity.ships ?? []), ...activity.shipAssignments];
        const isAutoLoaner = !isNested &&
            allExistingShips.some(s => s.ownerId === userId && !s.isLoaner && (s.crewAssigned ?? 0) > 0);
        if (!ship.parentShipId && !isAutoLoaner) {
            await this.participantService.updateParticipant(activityId, userId, {
                shipId: ship.shipId,
                shipType: ship.shipType,
                shipName: ship.shipName,
            });
        }
        const participantRow = await this.participantService.getParticipant(activityId, userId);
        const ownerName = participantRow?.userName ?? userId;
        const ownerAvatarUrl = participantRow?.avatarUrl;
        activity.shipAssignments = [
            ...activity.shipAssignments,
            {
                shipId: ship.shipId,
                shipType: ship.shipType,
                shipName: ship.shipName,
                ownerId: userId,
                ownerName,
                role: ship.role,
                crewCapacity: ship.crewCapacity,
                crewAssigned: isNested || isAutoLoaner ? 0 : 1,
                crewMembers: isNested || isAutoLoaner
                    ? []
                    : [{ userId, userName: ownerName, avatarUrl: ownerAvatarUrl, position: 'pilot' }],
                capabilities: ship.capabilities,
                status: isAutoLoaner ? 'available' : 'assigned',
                isLoaner: isAutoLoaner || undefined,
                contributedBy: isAutoLoaner ? ownerName : undefined,
                contributedByUserId: isAutoLoaner ? userId : undefined,
                parentShipId: ship.parentShipId,
                isTransported: isNested,
                transportType: ship.transportType,
            },
        ];
        const newAssignment = activity.shipAssignments.at(-1);
        if (newAssignment) {
            await this.routeCalcService.enrichShipMetadata([newAssignment]);
            newAssignment.crewSlots ??= (0, shared_types_1.deriveDefaultCrewSlots)(newAssignment.crewCapacity);
        }
        activity.totalCrewCapacity =
            (activity.totalCrewCapacity ?? 0) + (newAssignment?.crewCapacity ?? ship.crewCapacity);
        if (!isNested && !isAutoLoaner) {
            activity.totalCrewAssigned = (activity.totalCrewAssigned ?? 0) + 1;
        }
        await this.recalculateFleetTotals(activity);
        const updated = await this.repository.save(activity);
        logger_1.logger.info(`Ship added to activity ${activityId} by user ${userId}`);
        return updated;
    }
    async loanShips(activityId, userId, userName, ships) {
        if (ships.length === 0) {
            throw new apiErrors_1.ValidationError('At least one ship is required');
        }
        if (ships.length > 20) {
            throw new apiErrors_1.ValidationError('Cannot loan more than 20 ships at once');
        }
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isParticipant = await this.participantService.isParticipant(activityId, userId);
        if (!isParticipant) {
            throw new apiErrors_1.ValidationError('User is not a participant');
        }
        activity.shipAssignments ??= [];
        const addedShipIds = [];
        const newAssignmentsBuffer = [];
        for (const ship of ships) {
            const shipAssignment = {
                shipId: ship.shipId,
                shipType: ship.shipType,
                shipName: ship.shipName,
                ownerId: userId,
                ownerName: userName,
                role: 'other',
                crewCapacity: ship.crewCapacity ?? 1,
                crewAssigned: 0,
                crewMembers: [],
                capabilities: [],
                status: 'available',
                isLoaner: true,
                contributedBy: userName,
                contributedByUserId: userId,
            };
            newAssignmentsBuffer.push(shipAssignment);
            activity.totalCrewCapacity = (activity.totalCrewCapacity ?? 0) + (ship.crewCapacity ?? 1);
            addedShipIds.push(ship.shipId ?? ship.shipType);
        }
        activity.shipAssignments = [...activity.shipAssignments, ...newAssignmentsBuffer];
        const newAssignments = activity.shipAssignments.slice(-ships.length);
        await this.routeCalcService.enrichShipMetadata(newAssignments);
        for (let i = 0; i < newAssignments.length; i++) {
            const original = ships[i].crewCapacity ?? 1;
            const enriched = newAssignments[i].crewCapacity;
            if (enriched > original) {
                activity.totalCrewCapacity = (activity.totalCrewCapacity ?? 0) - original + enriched;
            }
            newAssignments[i].crewSlots ??= (0, shared_types_1.deriveDefaultCrewSlots)(newAssignments[i].crewCapacity);
        }
        await this.recalculateFleetTotals(activity);
        const updated = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.SHIP_ASSIGNED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: userName,
            details: {
                loanedShips: addedShipIds,
                shipCount: ships.length,
                isLoaner: true,
                totalShips: updated.shipAssignments?.length ?? 0,
            },
        });
        logger_1.logger.info(`User ${userId} loaned ${ships.length} ship(s) to activity ${activityId}`);
        return updated;
    }
    async removeOwnedShip(activityId, userId, shipIdentifier, shipIndex) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const isOwnedByUser = (ship) => ship.ownerId === userId || ship.contributedByUserId === userId;
        const matchesIdentifier = (ship) => {
            const compositeKey = `${ship.shipType}::${ship.shipName ?? ''}`;
            return (ship.id === shipIdentifier ||
                ship.shipId === shipIdentifier ||
                ship.ownerId === shipIdentifier ||
                compositeKey === shipIdentifier);
        };
        const ownedShips = allShips.filter(isOwnedByUser);
        let targetShip;
        if (shipIndex !== undefined && shipIndex >= 0) {
            const indexedShip = ownedShips[shipIndex];
            if (indexedShip && matchesIdentifier(indexedShip)) {
                targetShip = indexedShip;
            }
        }
        targetShip ??=
            allShips.find(ship => isOwnedByUser(ship) && matchesIdentifier(ship)) ??
                allShips.find(ship => matchesIdentifier(ship));
        if (!targetShip) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        if (!isOwnedByUser(targetShip)) {
            throw new apiErrors_1.ForbiddenError('You can only remove ships you brought to this event');
        }
        const target = targetShip;
        const parentKeys = new Set([target.id, target.shipId, target.shipName, target.shipType].filter((value) => typeof value === 'string' && value.length > 0));
        const clearParentReference = (ship) => {
            if (!ship.parentShipId || !parentKeys.has(ship.parentShipId)) {
                return ship;
            }
            return {
                ...ship,
                parentShipId: undefined,
                isTransported: false,
                transportType: undefined,
            };
        };
        const removeTargetShip = (ships) => {
            if (!ships || ships.length === 0) {
                return ships;
            }
            const index = ships.indexOf(target);
            if (index === -1) {
                return ships.map(clearParentReference);
            }
            const next = [...ships];
            next.splice(index, 1);
            return next.map(clearParentReference);
        };
        activity.shipAssignments = removeTargetShip(activity.shipAssignments);
        activity.ships = removeTargetShip(activity.ships);
        const removedCrewMembers = target.crewMembers ?? target.crew ?? [];
        const affectedUserIds = new Set(removedCrewMembers.map(member => member.userId));
        affectedUserIds.add(target.ownerId);
        const remainingShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
        const findCrewAssignment = (participantId) => {
            for (const ship of remainingShips) {
                const crewMembers = ship.crewMembers ?? ship.crew ?? [];
                const crewMember = crewMembers.find(member => member.userId === participantId);
                if (crewMember) {
                    return { ship, position: crewMember.position };
                }
            }
            return null;
        };
        await Promise.all([...affectedUserIds].map(async (affectedUserId) => {
            const crewAssignment = findCrewAssignment(affectedUserId);
            if (crewAssignment) {
                await this.participantService.updateParticipant(activityId, affectedUserId, {
                    shipId: crewAssignment.ship.shipId,
                    shipType: crewAssignment.ship.shipType,
                    shipName: crewAssignment.ship.shipName,
                    crewPosition: crewAssignment.position,
                    crewShipId: crewAssignment.ship.shipId,
                });
                return;
            }
            await this.participantService.updateParticipant(activityId, affectedUserId, {
                shipId: null,
                shipType: null,
                shipName: null,
                crewPosition: null,
                crewShipId: null,
            });
        }));
        activity.totalCrewCapacity = remainingShips.reduce((sum, ship) => sum + (ship.crewCapacity ?? ship.maxCrew ?? 0), 0);
        activity.totalCrewAssigned = remainingShips.reduce((sum, ship) => {
            const crewMembers = ship.crewMembers ?? ship.crew ?? [];
            return sum + crewMembers.length;
        }, 0);
        await this.recalculateFleetTotals(activity);
        const updated = await this.repository.save(activity);
        if (activity.organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.SHIP_UNASSIGNED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: target.ownerName || userId,
            details: {
                shipId: target.shipId,
                shipAssignmentId: target.id,
                shipType: target.shipType,
                shipName: target.shipName,
                displacedCrewCount: removedCrewMembers.length,
                totalShips: remainingShips.length,
            },
        });
        logger_1.logger.info(`User ${userId} removed ship ${target.shipType} from activity ${activityId}`);
        return updated;
    }
    async joinShipAsCrew(activityId, userId, userName, shipOwnerId, crewPosition) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const candidateShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
        const shipAssignment = candidateShips.find(s => s.id === shipOwnerId || s.shipId === shipOwnerId) ??
            candidateShips.find(s => s.ownerId === shipOwnerId);
        if (!shipAssignment) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        const existingCrew = shipAssignment.crewMembers ?? shipAssignment.crew ?? [];
        if ((shipAssignment.crewAssigned ?? existingCrew.length) >= shipAssignment.crewCapacity) {
            throw new apiErrors_1.ValidationError('Ship is at full crew capacity');
        }
        if (existingCrew.some(member => member.userId === userId)) {
            throw new apiErrors_1.ValidationError('User is already crew on this ship');
        }
        if (shipAssignment.crewSlots?.length) {
            const wanted = crewPosition.trim().toLowerCase();
            const slot = shipAssignment.crewSlots.find(s => s.role.toLowerCase() === wanted);
            if (!slot) {
                throw new apiErrors_1.ValidationError(`This ship has no ${crewPosition} slot`);
            }
            const filledForRole = existingCrew.filter(member => member.position.trim().toLowerCase() === wanted).length;
            if (filledForRole >= slot.capacity) {
                throw new apiErrors_1.ValidationError(`All ${crewPosition} slots are full`);
            }
        }
        const participantRow = await this.participantService.getParticipant(activityId, userId);
        existingCrew.push({
            userId,
            userName,
            avatarUrl: participantRow?.avatarUrl,
            position: crewPosition,
        });
        shipAssignment.crewMembers = [...existingCrew];
        if (shipAssignment.crew) {
            shipAssignment.crew = [...shipAssignment.crewMembers];
        }
        shipAssignment.crewAssigned = shipAssignment.crewMembers.length;
        if (shipAssignment.currentCrew !== undefined) {
            shipAssignment.currentCrew = shipAssignment.crewAssigned;
        }
        await this.participantService.updateParticipant(activityId, userId, {
            crewPosition,
            crewShipId: shipAssignment.shipId,
            shipName: shipAssignment.shipName,
            shipType: shipAssignment.shipType,
        });
        activity.totalCrewAssigned = (activity.totalCrewAssigned ?? 0) + 1;
        activity.shipAssignments = activity.shipAssignments
            ? [...activity.shipAssignments]
            : activity.shipAssignments;
        activity.ships = activity.ships ? [...activity.ships] : activity.ships;
        const updated = await this.repository.save(activity);
        this.broadcastRosterChange(updated);
        logger_1.logger.info(`User ${userId} joined ship as ${crewPosition} in activity ${activityId}`);
        return updated;
    }
    async leaveShipCrew(activityId, userId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        let removedFrom = false;
        const removeFromCollection = (ships) => {
            if (!ships || removedFrom) {
                return;
            }
            for (const ship of ships) {
                const crewMembers = ship.crewMembers ? [...ship.crewMembers] : [...(ship.crew ?? [])];
                const crewIndex = crewMembers.findIndex(member => member.userId === userId);
                if (crewIndex === -1) {
                    continue;
                }
                crewMembers.splice(crewIndex, 1);
                ship.crewMembers = [...crewMembers];
                if (ship.crew) {
                    ship.crew = [...ship.crewMembers];
                }
                ship.crewAssigned = ship.crewMembers.length;
                if (ship.currentCrew !== undefined) {
                    ship.currentCrew = ship.crewAssigned;
                }
                removedFrom = true;
                return;
            }
        };
        removeFromCollection(activity.shipAssignments);
        removeFromCollection(activity.ships);
        if (!removedFrom) {
            throw new apiErrors_1.ValidationError('User is not crew on any ship in this activity');
        }
        await this.participantService.updateParticipant(activityId, userId, {
            crewPosition: null,
            crewShipId: null,
            shipName: null,
            shipType: null,
        });
        activity.shipAssignments = activity.shipAssignments ? [...activity.shipAssignments] : undefined;
        activity.ships = activity.ships ? [...activity.ships] : undefined;
        activity.totalCrewAssigned = Math.max(0, (activity.totalCrewAssigned ?? 0) - 1);
        const updated = await this.repository.save(activity);
        this.broadcastRosterChange(updated);
        logger_1.logger.info(`User ${userId} left ship crew in activity ${activityId}`);
        return updated;
    }
    async getAvailableCrewPositions(activityId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity?.shipAssignments) {
            return [];
        }
        return activity.shipAssignments
            .filter(ship => ship.crewAssigned < ship.crewCapacity)
            .map(ship => ({
            shipId: ship.shipId,
            shipType: ship.shipType,
            shipName: ship.shipName,
            ownerName: ship.ownerName,
            availableSlots: ship.crewCapacity - ship.crewAssigned,
            capabilities: ship.capabilities,
        }));
    }
    findShipAssignmentByIdentifier(activity, shipIdentifier) {
        const matches = (ship) => {
            const compositeKey = `${ship.shipType}::${ship.shipName ?? ''}`;
            return (ship.id === shipIdentifier ||
                ship.shipId === shipIdentifier ||
                ship.ownerId === shipIdentifier ||
                compositeKey === shipIdentifier);
        };
        return activity.shipAssignments?.find(matches) ?? activity.ships?.find(matches);
    }
    replaceShipAssignment(activity, target, replacement) {
        const swap = (ships) => {
            if (!ships) {
                return ships;
            }
            const index = ships.indexOf(target);
            if (index === -1) {
                return ships;
            }
            const next = [...ships];
            next[index] = replacement;
            return next;
        };
        activity.shipAssignments = swap(activity.shipAssignments);
        activity.ships = swap(activity.ships);
    }
    getShipManagementIdentifier(ship) {
        const identifier = ship.id ?? ship.shipId ?? ship.ownerId;
        const normalized = identifier?.trim();
        return normalized && normalized.length > 0 ? normalized : null;
    }
    async canActorManageShip(activity, ship, actorUserId, knownIsLeader) {
        if (ship.ownerId === actorUserId || ship.contributedByUserId === actorUserId) {
            return true;
        }
        if (activity.creatorId === actorUserId) {
            return true;
        }
        if (typeof knownIsLeader === 'boolean') {
            return knownIsLeader;
        }
        return this.participantService.isLeader(activity.id, actorUserId);
    }
    async getShipManagementCapabilities(activityId, actorUserId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const ships = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
        if (ships.length === 0) {
            return { manageableShipIdentifiers: [] };
        }
        const isCreator = activity.creatorId === actorUserId;
        let isLeaderCache;
        const manageableShipIdentifiers = [];
        for (const ship of ships) {
            const identifier = this.getShipManagementIdentifier(ship);
            if (!identifier) {
                continue;
            }
            if (isCreator || ship.ownerId === actorUserId || ship.contributedByUserId === actorUserId) {
                manageableShipIdentifiers.push(identifier);
                continue;
            }
            if (isLeaderCache === undefined) {
                isLeaderCache = await this.participantService.isLeader(activity.id, actorUserId);
            }
            if (isLeaderCache) {
                manageableShipIdentifiers.push(identifier);
            }
        }
        return { manageableShipIdentifiers: Array.from(new Set(manageableShipIdentifiers)) };
    }
    async assertCanManageShip(activity, ship, actorUserId) {
        if (await this.canActorManageShip(activity, ship, actorUserId)) {
            return;
        }
        throw new apiErrors_1.ForbiddenError('Only the ship owner, activity creator, or a leader can manage passenger slots');
    }
    async assertCanAccessPassengerAndCrewSlots(activity, actorUserId, actionDescription) {
        if (activity.creatorId === actorUserId) {
            return;
        }
        const isParticipant = await this.participantService.isParticipant(activity.id, actorUserId);
        if (isParticipant) {
            return;
        }
        throw new apiErrors_1.ForbiddenError(`Only activity participants can ${actionDescription}`);
    }
    async setPassengerSlots(activityId, actorUserId, shipIdentifier, slots) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const ship = this.findShipAssignmentByIdentifier(activity, shipIdentifier);
        if (!ship) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        await this.assertCanManageShip(activity, ship, actorUserId);
        const existingByRole = new Map((ship.passengers ?? []).map(slot => [slot.role.toLowerCase(), slot]));
        const seen = new Set();
        const next = [];
        for (const slot of slots) {
            const role = slot.role.trim();
            const key = role.toLowerCase();
            if (seen.has(key)) {
                throw new apiErrors_1.ValidationError(`Duplicate passenger role: ${role}`);
            }
            seen.add(key);
            const prior = existingByRole.get(key);
            const filled = prior?.filled ?? 0;
            if (slot.capacity < filled) {
                throw new apiErrors_1.ValidationError(`Cannot set ${role} capacity to ${slot.capacity}; ${filled} already assigned`);
            }
            next.push({
                role,
                capacity: slot.capacity,
                filled,
                assignedUserIds: prior?.assignedUserIds ? [...prior.assignedUserIds] : [],
                assignedUserNames: prior?.assignedUserNames ? [...prior.assignedUserNames] : [],
            });
        }
        for (const slot of ship.passengers ?? []) {
            if (!seen.has(slot.role.toLowerCase()) && slot.filled > 0) {
                throw new apiErrors_1.ValidationError(`Cannot remove passenger role ${slot.role}; ${slot.filled} still assigned`);
            }
        }
        this.replaceShipAssignment(activity, ship, { ...ship, passengers: next });
        const updated = await this.repository.save(activity);
        this.broadcastRosterChange(updated);
        logger_1.logger.info(`Passenger slots updated for ship ${shipIdentifier} in activity ${activityId} by ${actorUserId}`);
        return updated;
    }
    async joinShipAsPassenger(activityId, userId, userName, shipIdentifier, passengerRole) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        await this.assertCanAccessPassengerAndCrewSlots(activity, userId, 'join passenger slots');
        const ship = this.findShipAssignmentByIdentifier(activity, shipIdentifier);
        if (!ship) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        const allShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
        const alreadyAssigned = allShips.some(existingShip => (existingShip.passengers ?? []).some(slot => slot.assignedUserIds?.includes(userId)));
        if (alreadyAssigned) {
            throw new apiErrors_1.ValidationError('User already occupies a passenger seat in this activity');
        }
        const passengers = (ship.passengers ?? []).map(slot => ({
            ...slot,
            assignedUserIds: [...(slot.assignedUserIds ?? [])],
            assignedUserNames: [...(slot.assignedUserNames ?? [])],
        }));
        const slot = passengers.find(candidate => candidate.role.toLowerCase() === passengerRole.trim().toLowerCase());
        if (!slot) {
            throw new apiErrors_1.NotFoundError(`Passenger slot for role "${passengerRole}"`);
        }
        if (slot.filled >= slot.capacity) {
            throw new apiErrors_1.ValidationError('Passenger slot is full');
        }
        slot.filled += 1;
        slot.assignedUserIds = [...(slot.assignedUserIds ?? []), userId];
        slot.assignedUserNames = [...(slot.assignedUserNames ?? []), userName];
        this.replaceShipAssignment(activity, ship, { ...ship, passengers });
        const updated = await this.repository.save(activity);
        this.broadcastRosterChange(updated);
        logger_1.logger.info(`User ${userId} joined as ${passengerRole} passenger in activity ${activityId}`);
        return updated;
    }
    async leaveShipAsPassenger(activityId, userId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        await this.assertCanAccessPassengerAndCrewSlots(activity, userId, 'leave passenger slots');
        const allShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
        const uniqueShips = Array.from(new Set(allShips));
        let removedSeats = 0;
        for (const ship of uniqueShips) {
            if (!ship.passengers?.length) {
                continue;
            }
            let changed = false;
            const next = ship.passengers.map(slot => {
                const ids = slot.assignedUserIds ?? [];
                if (!ids.includes(userId)) {
                    return slot;
                }
                let removedFromSlot = 0;
                const nextIds = [];
                const nextNames = [];
                const names = slot.assignedUserNames ?? [];
                ids.forEach((assignedUserId, index) => {
                    if (assignedUserId === userId) {
                        removedFromSlot += 1;
                        return;
                    }
                    nextIds.push(assignedUserId);
                    if (index < names.length) {
                        nextNames.push(names[index]);
                    }
                });
                if (removedFromSlot === 0) {
                    return slot;
                }
                changed = true;
                removedSeats += removedFromSlot;
                return {
                    ...slot,
                    filled: Math.max(0, slot.filled - removedFromSlot),
                    assignedUserIds: nextIds,
                    assignedUserNames: nextNames,
                };
            });
            if (changed) {
                this.replaceShipAssignment(activity, ship, { ...ship, passengers: next });
            }
        }
        if (removedSeats === 0) {
            throw new apiErrors_1.ValidationError('User is not a passenger on any ship in this activity');
        }
        const updated = await this.repository.save(activity);
        this.broadcastRosterChange(updated);
        logger_1.logger.info(`User ${userId} left passenger slot in activity ${activityId}`);
        return updated;
    }
    async getAvailablePassengerSlots(activityId, actorUserId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (activity && actorUserId) {
            await this.assertCanAccessPassengerAndCrewSlots(activity, actorUserId, 'view passenger slot availability');
        }
        if (!activity?.shipAssignments) {
            return [];
        }
        const results = [];
        for (const ship of activity.shipAssignments) {
            for (const slot of ship.passengers ?? []) {
                const availableSlots = slot.capacity - slot.filled;
                if (availableSlots > 0) {
                    results.push({
                        shipId: ship.shipId,
                        shipType: ship.shipType,
                        shipName: ship.shipName,
                        ownerName: ship.ownerName,
                        role: slot.role,
                        availableSlots,
                    });
                }
            }
        }
        return results;
    }
    async setCrewSlots(activityId, actorUserId, shipIdentifier, slots) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const ship = this.findShipAssignmentByIdentifier(activity, shipIdentifier);
        if (!ship) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        await this.assertCanManageShip(activity, ship, actorUserId);
        const crew = ship.crewMembers ?? ship.crew ?? [];
        const filledByRole = new Map();
        for (const member of crew) {
            const key = member.position.trim().toLowerCase();
            filledByRole.set(key, (filledByRole.get(key) ?? 0) + 1);
        }
        const seen = new Set();
        const next = [];
        for (const slot of slots) {
            const role = slot.role.trim();
            const key = role.toLowerCase();
            if (seen.has(key)) {
                throw new apiErrors_1.ValidationError(`Duplicate crew role: ${role}`);
            }
            seen.add(key);
            const filled = filledByRole.get(key) ?? 0;
            if (slot.capacity < filled) {
                throw new apiErrors_1.ValidationError(`Cannot set ${role} capacity to ${slot.capacity}; ${filled} already assigned`);
            }
            next.push({ role, capacity: slot.capacity });
        }
        for (const [role, filled] of filledByRole) {
            if (filled > 0 && !seen.has(role)) {
                throw new apiErrors_1.ValidationError(`Cannot remove crew role ${role}; ${filled} still assigned`);
            }
        }
        const newCapacity = next.reduce((sum, slot) => sum + slot.capacity, 0);
        const previousCapacity = ship.crewCapacity ?? 0;
        this.replaceShipAssignment(activity, ship, {
            ...ship,
            crewSlots: next,
            crewCapacity: newCapacity,
            maxCrew: ship.maxCrew !== undefined ? newCapacity : ship.maxCrew,
        });
        activity.totalCrewCapacity = Math.max(0, (activity.totalCrewCapacity ?? 0) - previousCapacity + newCapacity);
        const updated = await this.repository.save(activity);
        logger_1.logger.info(`Crew slots updated for ship ${shipIdentifier} in activity ${activityId}`);
        return updated;
    }
    async getCrewSlotAvailability(activityId, actorUserId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (activity && actorUserId) {
            await this.assertCanAccessPassengerAndCrewSlots(activity, actorUserId, 'view crew slot availability');
        }
        if (!activity?.shipAssignments) {
            return [];
        }
        return activity.shipAssignments
            .filter(ship => ship.crewSlots?.length)
            .map(ship => {
            const crew = ship.crewMembers ?? ship.crew ?? [];
            const filledByRole = new Map();
            for (const member of crew) {
                const key = member.position.trim().toLowerCase();
                filledByRole.set(key, (filledByRole.get(key) ?? 0) + 1);
            }
            return {
                shipId: ship.shipId,
                shipType: ship.shipType,
                shipName: ship.shipName,
                ownerName: ship.ownerName,
                slots: (ship.crewSlots ?? []).map(slot => {
                    const filled = filledByRole.get(slot.role.toLowerCase()) ?? 0;
                    return {
                        role: slot.role,
                        capacity: slot.capacity,
                        filled,
                        available: Math.max(0, slot.capacity - filled),
                    };
                }),
            };
        });
    }
    async resolveUserNames(userIds) {
        const map = new Map();
        const unique = Array.from(new Set(userIds));
        if (unique.length === 0) {
            return map;
        }
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
            const users = await data_source_1.AppDataSource.getRepository(User).findBy({ id: (0, typeorm_1.In)(unique) });
            for (const user of users) {
                map.set(user.id, user.username ?? user.rsiHandle ?? user.discordId ?? user.id);
            }
        }
        catch (error) {
            logger_1.logger.warn('resolveUserNames failed, falling back to IDs', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        for (const id of unique) {
            if (!map.has(id)) {
                map.set(id, id);
            }
        }
        return map;
    }
    assertCanCommandFleet(activity, fleet, actorUserId, action) {
        const isFleetLeader = fleet.leaderId === actorUserId || fleet.secondInCommandId === actorUserId;
        const isActivityCreator = activity.creatorId === actorUserId;
        if (!isFleetLeader && !isActivityCreator) {
            throw new apiErrors_1.ForbiddenError(`Only the fleet leader or activity creator can ${action}`);
        }
    }
    async bringFleetToActivity(activityId, actorUserId, fleetId, shipIds) {
        const actorName = (await this.resolveUserNames([actorUserId])).get(actorUserId) ?? actorUserId;
        const { Fleet } = await Promise.resolve().then(() => __importStar(require('../../models/Fleet')));
        const { FleetShip } = await Promise.resolve().then(() => __importStar(require('../../models/FleetShip')));
        const { Ship } = await Promise.resolve().then(() => __importStar(require('../../models/Ship')));
        return data_source_1.AppDataSource.transaction(async (manager) => {
            const activityRepository = manager.getRepository(Activity_1.Activity);
            const activity = await activityRepository.findOne({
                where: { id: activityId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!activity) {
                throw new apiErrors_1.ActivityNotFoundError('activity');
            }
            if (!activity.organizationId) {
                throw new apiErrors_1.ValidationError('Fleet operations require an organization-bound activity');
            }
            const fleet = await manager.getRepository(Fleet).findOne({
                where: { id: fleetId, organizationId: activity.organizationId },
            });
            if (!fleet) {
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            this.assertCanCommandFleet(activity, fleet, actorUserId, 'bring a fleet to this event');
            const joinShipRows = await manager.getRepository(FleetShip).find({
                where: { fleetId: fleet.id },
                select: { shipId: true },
            });
            const fleetShipIds = Array.from(new Set([...joinShipRows.map(row => row.shipId), ...(fleet.shipIds ?? [])].filter((id) => typeof id === 'string' && id.trim().length > 0)));
            const requested = shipIds?.filter(id => id.trim().length > 0) ?? [];
            if (requested.length > 0) {
                const invalid = requested.filter(id => !fleetShipIds.includes(id));
                if (invalid.length > 0) {
                    throw new apiErrors_1.ValidationError('One or more ships do not belong to this fleet');
                }
            }
            const selected = requested.length > 0 ? requested : fleetShipIds;
            if (selected.length === 0) {
                throw new apiErrors_1.ValidationError('This fleet has no ships to bring');
            }
            const ships = await manager.getRepository(Ship).findBy({ id: (0, typeorm_1.In)(selected) });
            if (ships.length === 0) {
                throw new apiErrors_1.NotFoundError('Fleet ships');
            }
            activity.shipAssignments ??= [];
            const existingShipIds = new Set([...(activity.shipAssignments ?? []), ...(activity.ships ?? [])]
                .map(assignment => assignment.shipId)
                .filter((shipId) => typeof shipId === 'string' && shipId.length > 0));
            const shipsToAdd = ships.filter(ship => !existingShipIds.has(ship.id));
            if (shipsToAdd.length === 0) {
                logger_1.logger.info(`Fleet ${fleetId} bring for activity ${activityId} by ${actorUserId} was a no-op; all ships already present`);
                return activity;
            }
            const newAssignments = shipsToAdd.map(ship => {
                const crewCapacity = (0, crewCalculation_1.resolveShipCrew)(ship);
                return {
                    shipId: ship.id,
                    shipType: ship.name,
                    shipName: ship.name,
                    ownerId: actorUserId,
                    ownerName: actorName,
                    role: 'other',
                    crewCapacity,
                    crewAssigned: 0,
                    crewMembers: [],
                    crewSlots: (0, shared_types_1.deriveDefaultCrewSlots)(crewCapacity),
                    capabilities: [],
                    status: 'available',
                    isLoaner: true,
                    contributedBy: actorName,
                    contributedByUserId: actorUserId,
                    fleetId: fleet.id,
                    fleetName: fleet.name,
                };
            });
            activity.shipAssignments = [...activity.shipAssignments, ...newAssignments];
            await this.routeCalcService.enrichShipMetadata(newAssignments);
            for (const assignment of newAssignments) {
                assignment.crewSlots = (0, shared_types_1.deriveDefaultCrewSlots)(assignment.crewCapacity);
                activity.totalCrewCapacity = (activity.totalCrewCapacity ?? 0) + assignment.crewCapacity;
            }
            await this.recalculateFleetTotals(activity);
            const updated = await activityRepository.save(activity);
            logger_1.logger.info(`Fleet ${fleetId} brought ${newAssignments.length} new ship(s) to activity ${activityId} by ${actorUserId}`);
            return updated;
        });
    }
    async inviteFleetMembers(activityId, actorUserId, fleetId, userIds) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (!activity.organizationId) {
            throw new apiErrors_1.ValidationError('Fleet operations require an organization-bound activity');
        }
        const organizationId = activity.organizationId;
        const { Fleet } = await Promise.resolve().then(() => __importStar(require('../../models/Fleet')));
        const fleet = await data_source_1.AppDataSource.getRepository(Fleet).findOne({
            where: { id: fleetId, organizationId },
        });
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet');
        }
        this.assertCanCommandFleet(activity, fleet, actorUserId, 'invite fleet members');
        const members = fleet.members ?? [];
        const requested = userIds?.filter(id => id.trim().length > 0) ?? [];
        if (requested.length > 0) {
            const invalid = requested.filter(id => !members.includes(id));
            if (invalid.length > 0) {
                throw new apiErrors_1.ValidationError('One or more users are not members of this fleet');
            }
        }
        const targets = (requested.length > 0 ? requested : members).filter(id => id !== actorUserId);
        if (targets.length === 0) {
            return { invited: [], skipped: [] };
        }
        const names = await this.resolveUserNames(targets);
        const memberInfos = targets.map(userId => ({
            userId,
            userName: names.get(userId) ?? userId,
            organizationId,
        }));
        return this.participantService.inviteMembers(activityId, memberInfos);
    }
    async bringFleetAndInviteMembers(activityId, actorUserId, fleetId, options) {
        const activity = await this.bringFleetToActivity(activityId, actorUserId, fleetId, options?.shipIds);
        try {
            const inviteResult = await this.inviteFleetMembers(activityId, actorUserId, fleetId, options?.userIds);
            return {
                activity,
                invited: inviteResult.invited,
                skipped: inviteResult.skipped,
                status: 'full',
            };
        }
        catch (error) {
            const inviteError = error instanceof Error ? error.message : 'Failed to invite fleet members after ship bring';
            logger_1.logger.warn('Fleet invite failed after successful fleet ship bring', {
                activityId,
                actorUserId,
                fleetId,
                inviteError,
            });
            return {
                activity,
                invited: [],
                skipped: [],
                status: 'ships_only',
                inviteError,
            };
        }
    }
    async getFleetBringPlan(fleetId) {
        const { Fleet } = await Promise.resolve().then(() => __importStar(require('../../models/Fleet')));
        const { FleetShip } = await Promise.resolve().then(() => __importStar(require('../../models/FleetShip')));
        const { Ship } = await Promise.resolve().then(() => __importStar(require('../../models/Ship')));
        const fleet = await data_source_1.AppDataSource.getRepository(Fleet).findOne({ where: { id: fleetId } });
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Fleet');
        }
        const memberSet = new Set(fleet.members ?? []);
        const rows = await data_source_1.AppDataSource.getRepository(FleetShip).find({
            where: { fleetId },
            select: { shipId: true, assignedBy: true },
        });
        const shipIds = Array.from(new Set(rows.map(row => row.shipId)));
        const ships = shipIds.length > 0 ? await data_source_1.AppDataSource.getRepository(Ship).findBy({ id: (0, typeorm_1.In)(shipIds) }) : [];
        const shipById = new Map(ships.map(ship => [ship.id, ship]));
        const memberShips = new Map();
        const orphanShipIds = [];
        for (const row of rows) {
            const ship = shipById.get(row.shipId);
            if (!ship) {
                continue;
            }
            const owner = row.assignedBy;
            if (!owner || !memberSet.has(owner)) {
                orphanShipIds.push(row.shipId);
                continue;
            }
            const entry = {
                shipId: row.shipId,
                shipName: ship.name,
                maxCrew: (0, crewCalculation_1.resolveShipCrew)(ship),
            };
            const list = memberShips.get(owner) ?? [];
            list.push(entry);
            memberShips.set(owner, list);
        }
        return { fleetName: fleet.name, memberShips, orphanShipIds };
    }
    async setCrewPosition(activityId, actorUserId, targetUserId, shipAssignmentId, crewPosition) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isSelf = actorUserId === targetUserId;
        const isCreator = activity.creatorId === actorUserId;
        const isLeader = !isSelf && !isCreator
            ? await this.participantService.isLeader(activityId, actorUserId)
            : false;
        if (!isSelf && !isCreator && !isLeader) {
            throw new apiErrors_1.ForbiddenError('Only the participant, the activity creator, or a leader can set crew positions');
        }
        const targetParticipant = await this.participantService.getParticipant(activityId, targetUserId);
        if (!targetParticipant) {
            throw new apiErrors_1.NotFoundError('Target participant');
        }
        const ships = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
        const destShip = ships.find(s => s.id === shipAssignmentId || s.shipId === shipAssignmentId);
        if (!destShip) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        const existingOnDest = destShip.crewMembers.find(c => c.userId === targetUserId);
        if (existingOnDest?.position === crewPosition) {
            return activity;
        }
        if (crewPosition === 'pilot' && destShip.ownerId !== targetUserId) {
            throw new apiErrors_1.ValidationError('The pilot slot is reserved for the ship owner');
        }
        const currentPilotOfOwnedShip = ships.find(s => s !== destShip &&
            s.ownerId === targetUserId &&
            s.crewMembers.some(c => c.userId === targetUserId && c.position === 'pilot'));
        if (currentPilotOfOwnedShip) {
            throw new apiErrors_1.ValidationError('Participant is the pilot of their own ship; remove that ship first');
        }
        let removedCount = 0;
        for (const ship of ships) {
            if (ship === destShip) {
                continue;
            }
            const idx = ship.crewMembers.findIndex(c => c.userId === targetUserId);
            if (idx >= 0) {
                ship.crewMembers.splice(idx, 1);
                ship.crewAssigned = Math.max(0, ship.crewAssigned - 1);
                if (ship.crew) {
                    ship.crew = [...ship.crewMembers];
                }
                if (ship.currentCrew !== undefined) {
                    ship.currentCrew = ship.crewAssigned;
                }
                removedCount++;
            }
        }
        if (existingOnDest) {
            existingOnDest.position = crewPosition;
        }
        else {
            if (destShip.crewAssigned >= destShip.crewCapacity) {
                throw new apiErrors_1.ValidationError('Ship is at full crew capacity');
            }
            destShip.crewMembers.push({
                userId: targetUserId,
                userName: targetParticipant.userName ?? 'Unknown',
                avatarUrl: targetParticipant.avatarUrl ?? undefined,
                position: crewPosition,
            });
            destShip.crewAssigned++;
            if (destShip.crew) {
                destShip.crew = [...destShip.crewMembers];
            }
            if (destShip.currentCrew !== undefined) {
                destShip.currentCrew = destShip.crewAssigned;
            }
        }
        activity.shipAssignments = activity.shipAssignments
            ? [...activity.shipAssignments]
            : activity.shipAssignments;
        activity.ships = activity.ships ? [...activity.ships] : activity.ships;
        if (!existingOnDest) {
            const delta = 1 - removedCount;
            activity.totalCrewAssigned = Math.max(0, (activity.totalCrewAssigned ?? 0) + delta);
        }
        await this.participantService.updateParticipant(activityId, targetUserId, {
            crewPosition,
            crewShipId: destShip.shipId,
            shipName: destShip.shipName,
            shipType: destShip.shipType,
        });
        const updated = await this.repository.save(activity);
        this.broadcastRosterChange(updated);
        logger_1.logger.info(`Crew position set: user=${targetUserId} position=${crewPosition} ship=${shipAssignmentId} activity=${activityId} actor=${actorUserId}`);
        return updated;
    }
    async nestShip(activityId, actorUserId, shipAssignmentId, options) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const ships = activity.shipAssignments ?? [];
        const child = ships.find(s => s.id === shipAssignmentId || s.shipId === shipAssignmentId);
        if (!child) {
            throw new apiErrors_1.NotFoundError('Ship in activity');
        }
        const isOwner = child.ownerId === actorUserId;
        const isCreator = activity.creatorId === actorUserId;
        const isLeader = !isOwner && !isCreator
            ? await this.participantService.isLeader(activityId, actorUserId)
            : false;
        if (!isOwner && !isCreator && !isLeader) {
            throw new apiErrors_1.ForbiddenError('Only the ship owner, the activity creator, or a leader can move ships');
        }
        if (options.parentShipId === null) {
            child.parentShipId = undefined;
            child.transportType = undefined;
            child.isTransported = false;
        }
        else {
            const parent = ships.find(s => s.id === options.parentShipId || s.shipId === options.parentShipId);
            if (!parent) {
                throw new apiErrors_1.ValidationError('Parent ship not found in activity');
            }
            if (parent === child) {
                throw new apiErrors_1.ValidationError('A ship cannot be nested inside itself');
            }
            if (parent.parentShipId) {
                throw new apiErrors_1.ValidationError('Cannot nest a ship inside one that is already nested');
            }
            const childId = child.shipId ?? child.id;
            if (childId && this.isDescendantOf(ships, parent, childId)) {
                throw new apiErrors_1.ValidationError('Nesting would create a cycle');
            }
            if (!options.transportType) {
                throw new apiErrors_1.ValidationError('transportType is required when nesting');
            }
            this.validateNestingCapacity(parent, child, options.transportType, ships);
            child.parentShipId = parent.shipId ?? parent.id;
            child.transportType = options.transportType;
            child.isTransported = true;
        }
        activity.shipAssignments = [...ships];
        const updated = await this.repository.save(activity);
        if (activity.organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        }
        logger_1.logger.info(`Ship nesting updated: ship=${shipAssignmentId} parent=${options.parentShipId ?? '(none)'} type=${options.transportType ?? 'none'} activity=${activityId} actor=${actorUserId}`);
        return updated;
    }
    isDescendantOf(ships, candidate, ancestorId) {
        let current = candidate;
        const seen = new Set();
        while (current?.parentShipId) {
            if (current.parentShipId === ancestorId) {
                return true;
            }
            if (seen.has(current.parentShipId)) {
                return false;
            }
            seen.add(current.parentShipId);
            current = ships.find(s => (s.shipId ?? s.id) === current?.parentShipId);
        }
        return false;
    }
    validateNestingCapacity(parent, child, transportType, allShips) {
        if (transportType === 'tractor_beam' || transportType === 'docking_collar') {
            return;
        }
        const parentId = parent.shipId ?? parent.id;
        if (transportType === 'hangar') {
            const hangarSize = parent.metadata?.hangarSize;
            if (!hangarSize) {
                throw new apiErrors_1.ValidationError('Parent ship has no hangar');
            }
            const childSize = child.metadata?.size;
            if (childSize && !this.fitsInHangar(childSize, hangarSize)) {
                throw new apiErrors_1.ValidationError(`Ship size '${childSize}' does not fit in parent hangar '${hangarSize}'`);
            }
            return;
        }
        if (transportType === 'cargo') {
            const cargoSCU = parent.metadata?.vehicleCargoCapacity ?? parent.metadata?.cargoCapacity ?? 0;
            if (cargoSCU <= 0) {
                throw new apiErrors_1.ValidationError('Parent ship has no cargo capacity');
            }
            const existingNestedSCU = allShips
                .filter(s => s !== child && s.parentShipId === parentId && s.transportType === 'cargo')
                .reduce((sum, s) => sum + (s.metadata?.cargoCapacity ?? 0), 0);
            const childSCU = child.metadata?.cargoCapacity ?? 0;
            if (childSCU > 0 && existingNestedSCU + childSCU > cargoSCU) {
                throw new apiErrors_1.ValidationError(`Not enough cargo space (parent: ${cargoSCU} SCU, required: ${existingNestedSCU + childSCU} SCU)`);
            }
        }
    }
    fitsInHangar(childSize, hangarSize) {
        const order = ['snub', 'small', 'medium', 'large', 'capital'];
        const c = order.indexOf(childSize.toLowerCase());
        const h = order.indexOf(hangarSize.toLowerCase());
        if (c === -1 || h === -1) {
            return true;
        }
        return c <= h;
    }
    async addRoutePlan(activityId, userId, waypoints) {
        return this.eventService.addRoutePlan(activityId, waypoints, userId);
    }
    async updateWaypoint(activityId, userId, waypointOrder, updates) {
        return this.eventService.updateWaypoint(activityId, waypointOrder, updates, userId);
    }
    async enrichWithMiningData(activityId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isMining = activity.activityType === Activity_1.ActivityType.OPERATION &&
            (activity.tags.includes('mining') ||
                activity.categories.includes('mining') ||
                activity.location?.toLowerCase().includes('mining'));
        if (!isMining || !activity.location) {
            return activity;
        }
        const miningData = await content_1.RegolithService.getMiningDataSummary(activity.location);
        if (miningData) {
            activity.miningData = {
                ...miningData,
                lastUpdated: new Date(),
            };
            activity.isMiningOperation = true;
            const miningDesc = await content_1.RegolithService.generateMiningDescription(activity.location, activity.systemLocation);
            if (miningDesc) {
                activity.description += miningDesc;
            }
            if (!activity.resourceRequirements || activity.resourceRequirements.length === 0) {
                activity.resourceRequirements = miningData.recommendedShips.map((shipType, _idx) => ({
                    type: 'ship',
                    name: shipType,
                    quantity: 1,
                    provided: 0,
                    requiredCapabilities: ['mining'],
                }));
            }
            logger_1.logger.info(`Mining data enriched for activity ${activityId}`);
        }
        return this.repository.save(activity);
    }
    async autoEnrichMiningActivity(activity) {
        const isMining = activity.activityType === Activity_1.ActivityType.OPERATION &&
            (activity.tags.includes('mining') ||
                activity.categories.includes('mining') ||
                activity.location?.toLowerCase().includes('mining'));
        if (isMining && activity.location) {
            return this.enrichWithMiningData(activity.id);
        }
        return activity;
    }
    _jobService;
    get jobService() {
        this._jobService ??= new ActivityJobService_1.ActivityJobService();
        return this._jobService;
    }
    async submitApplication(activityId, applicationData) {
        return this.jobService.submitApplication(activityId, applicationData);
    }
    async acceptApplication(activityId, applicationId, reviewerId, notes) {
        return this.jobService.acceptApplication(activityId, applicationId, reviewerId, notes);
    }
    async rejectApplication(activityId, applicationId, reviewerId, reason) {
        return this.jobService.rejectApplication(activityId, applicationId, reviewerId, reason);
    }
    async advanceApplicationStage(activityId, applicationId, reviewerId, comment) {
        return this.jobService.advanceApplicationStage(activityId, applicationId, reviewerId, comment);
    }
    async withdrawApplication(activityId, applicationId, applicantId) {
        return this.jobService.withdrawApplication(activityId, applicationId, applicantId);
    }
    async getApplications(activityId, filters) {
        return this.jobService.getApplications(activityId, filters);
    }
    async scheduleInterview(activityId, applicationId, interviewData) {
        return this.jobService.scheduleInterview(activityId, applicationId, interviewData);
    }
    async completeJob(activityId, applicationId, completionData) {
        return this.jobService.completeJob(activityId, applicationId, completionData);
    }
    _eventService;
    get eventService() {
        this._eventService ??= new ActivityEventService_1.ActivityEventService();
        return this._eventService;
    }
    async joinWaitlist(activityId, userId) {
        return this.eventService.joinWaitlist(activityId, userId);
    }
    async leaveWaitlist(activityId, userId) {
        return this.eventService.leaveWaitlist(activityId, userId);
    }
    async promoteFromWaitlist(activityId, userId) {
        return this.eventService.promoteFromWaitlist(activityId, userId);
    }
    async updateRSVPStatus(activityId, userId, status, role) {
        return this.eventService.updateRSVPStatus(activityId, userId, status, role);
    }
    async cloneActivity(activityId, overrides) {
        const original = await this.repository.findOne({ where: { id: activityId } });
        if (!original) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const cloned = this.repository.create({
            ...original,
            id: undefined,
            participants: [],
            currentParticipants: 0,
            waitlist: [],
            applications: [],
            currentApplicants: 0,
            status: Activity_1.ActivityStatus.DRAFT,
            createdAt: undefined,
            updatedAt: undefined,
            actualStartDate: undefined,
            actualEndDate: undefined,
            completionReport: undefined,
            discordEventId: undefined,
            voiceChannelId: undefined,
            voiceChannelName: undefined,
            metadata: {
                ...original.metadata,
                parentEventId: original.id,
                isTemplate: false,
                ...overrides,
            },
            scheduledStartDate: overrides?.scheduledStartDate ?? original.scheduledStartDate,
            scheduledEndDate: overrides?.scheduledEndDate ?? original.scheduledEndDate,
            organizationId: overrides?.organizationId ?? original.organizationId,
        });
        const saved = await this.repository.save(cloned);
        logger_1.logger.info(`Activity ${activityId} cloned to ${saved.id}`);
        return saved;
    }
    async createFromTemplate(templateId, data) {
        const template = await this.repository.findOne({
            where: {
                id: templateId,
                metadata: { isTemplate: true },
            },
        });
        if (!template) {
            throw new apiErrors_1.NotFoundError('Template');
        }
        return this.cloneActivity(templateId, {
            scheduledStartDate: data.scheduledStartDate,
            scheduledEndDate: data.scheduledEndDate,
            organizationId: data.organizationId,
        });
    }
    async getUpcomingActivities(filters) {
        const query = this.repository.createQueryBuilder('activity');
        query.where('activity.scheduledStartDate > :now', { now: new Date() });
        query.andWhere('activity.status NOT IN (:...excludedStatuses)', {
            excludedStatuses: [
                Activity_1.ActivityStatus.DRAFT,
                Activity_1.ActivityStatus.CANCELLED,
                Activity_1.ActivityStatus.COMPLETED,
                Activity_1.ActivityStatus.FAILED,
                Activity_1.ActivityStatus.EXPIRED,
            ],
        });
        if (!filters?.activityType) {
            query.andWhere('activity.activityType != :excludedType', {
                excludedType: Activity_1.ActivityType.RECRUITMENT,
            });
        }
        if (filters?.activityType) {
            query.andWhere('activity.activityType = :type', { type: filters.activityType });
        }
        if (filters?.organizationId) {
            query.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
        }
        if (filters?.startDate) {
            query.andWhere('activity.scheduledStartDate >= :startDate', { startDate: filters.startDate });
        }
        if (filters?.endDate) {
            query.andWhere('activity.scheduledStartDate <= :endDate', { endDate: filters.endDate });
        }
        query.orderBy('activity.scheduledStartDate', 'ASC');
        if (filters?.limit) {
            query.take(filters.limit);
        }
        return query.getMany();
    }
    async completeActivity(activityId, completionData) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        activity.status = Activity_1.ActivityStatus.COMPLETED;
        activity.actualEndDate = new Date();
        activity.completionReport = completionData;
        const updated = await this.repository.save(activity);
        DomainEventBus_1.domainEvents.emit('activity:completed', {
            activityId,
            organizationId: activity.organizationId ?? '',
            participantCount: completionData.participantCount,
            timestamp: new Date().toISOString(),
        });
        logger_1.logger.info(`Activity ${activityId} completed with outcome: ${completionData.outcome}`);
        if (activity.organizationId) {
            (0, cacheInvalidation_1.invalidateActivityCache)(activity.organizationId);
        }
        return updated;
    }
}
exports.ActivityService = ActivityService;
//# sourceMappingURL=ActivityService.js.map