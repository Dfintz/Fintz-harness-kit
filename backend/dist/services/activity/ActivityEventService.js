"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityEventService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const types_1 = require("../../types");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
const communication_1 = require("../communication");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
const ActivityReminderService_1 = require("./ActivityReminderService");
class ActivityEventService extends TenantService_1.TenantService {
    voiceChannelService;
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    reminderService = null;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity));
        this.voiceChannelService = communication_1.VoiceChannelService.getInstance();
    }
    getReminderService() {
        this.reminderService ??= new ActivityReminderService_1.ActivityReminderService(new communication_1.NotificationService());
        return this.reminderService;
    }
    async getUserNameFromActivity(activity, userId) {
        if (activity.creatorId === userId && activity.creatorName) {
            return activity.creatorName;
        }
        const participant = await this.participantRepo
            .createQueryBuilder('participant')
            .select(['participant.userName'])
            .where('participant.activityId = :activityId', { activityId: activity.id })
            .andWhere('participant.userId = :userId', { userId })
            .getOne();
        if (participant?.userName) {
            return participant.userName;
        }
        return userId;
    }
    async findActivityById(activityId, organizationId) {
        const query = this.repository
            .createQueryBuilder('activity')
            .where('activity.id = :activityId', { activityId });
        if (organizationId) {
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        return query.getOne();
    }
    canStartFromStatus(status) {
        return [
            Activity_1.ActivityStatus.DRAFT,
            Activity_1.ActivityStatus.OPEN,
            Activity_1.ActivityStatus.PLANNING,
            Activity_1.ActivityStatus.RECRUITING,
            Activity_1.ActivityStatus.READY,
        ].includes(status);
    }
    async applyCancellationLifecycle(activity, options) {
        const cancelledAt = new Date();
        const organizationId = activity.organizationId ?? '';
        const { activity: updatedActivity, wasCancelled, previousStatus, } = await this.withEntityLock(activity.id, async (locked, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            if (locked.status === Activity_1.ActivityStatus.CANCELLED ||
                locked.status === Activity_1.ActivityStatus.COMPLETED) {
                if (options.clearDiscordEventId && locked.discordEventId) {
                    locked.discordEventId = undefined;
                    locked.updatedAt = cancelledAt;
                    const saved = await activityRepo.save(locked);
                    return { activity: saved, wasCancelled: false, previousStatus: locked.status };
                }
                return { activity: locked, wasCancelled: false, previousStatus: locked.status };
            }
            const priorStatus = locked.status;
            locked.status = Activity_1.ActivityStatus.CANCELLED;
            locked.cancelledAt = cancelledAt;
            locked.updatedAt = cancelledAt;
            if (options.clearDiscordEventId) {
                locked.discordEventId = undefined;
            }
            if (options.reason) {
                locked.metadata = {
                    ...locked.metadata,
                    cancellationReason: options.reason,
                    cancelledBy: options.cancelledById,
                };
            }
            const saved = await activityRepo.save(locked);
            return { activity: saved, wasCancelled: true, previousStatus: priorStatus };
        });
        if (!wasCancelled) {
            return { activity: updatedActivity, wasCancelled: false, cancelledAt };
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_CANCELLED,
            activityId: updatedActivity.id,
            activityTitle: updatedActivity.title,
            activityType: updatedActivity.activityType,
            organizationId,
            performedById: options.cancelledById,
            performedByName: options.performedByName,
            details: {
                previousStatus,
                reason: options.reason ?? 'No reason provided',
                cancelledAt,
                ...(options.source ? { source: options.source } : {}),
            },
        });
        DomainEventBus_1.domainEvents.emit('activity:cancelled', {
            activityId: updatedActivity.id,
            organizationId,
            reason: options.reason,
            participantCount: updatedActivity.currentParticipants ?? 0,
            timestamp: cancelledAt.toISOString(),
        });
        logger_1.logger.info(`Activity ${updatedActivity.id} cancelled by ${options.cancelledById}. Reason: ${options.reason ?? 'No reason provided'}`);
        try {
            await this.getReminderService().cancelActivityReminders(updatedActivity.id);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to cancel reminders for cancelled activity ${updatedActivity.id}`, error);
        }
        return { activity: updatedActivity, wasCancelled: true, cancelledAt };
    }
    async createVoiceChannelForActivity(activityId, guildId, creatorUserId, options) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        try {
            const channelName = `${activity.title} - ${activity.activityType}`;
            const channel = this.voiceChannelService.createChannel(channelName, guildId, `temp_${Date.now()}`, creatorUserId, types_1.VoiceChannelType.ACTIVITY, {
                userLimit: options.voiceChannelLimit ?? activity.maxParticipants ?? 10,
                eventId: activityId,
            });
            activity.voiceChannelId = channel.id;
            activity.voiceChannelName = channel.name;
            activity.updatedAt = new Date();
            const updatedActivity = await this.repository.save(activity);
            ActivityAuditLogger_1.activityAuditLogger.log({
                action: ActivityAuditLogger_1.ActivityAuditAction.VOICE_CHANNEL_CREATED,
                activityId,
                activityTitle: activity.title,
                activityType: activity.activityType,
                organizationId: activity.organizationId ?? '',
                performedById: creatorUserId,
                performedByName: activity.creatorName ?? creatorUserId,
                details: {
                    channelId: channel.id,
                    channelName: channel.name,
                    userLimit: options.voiceChannelLimit ?? activity.maxParticipants ?? 10,
                },
            });
            logger_1.logger.info(`Voice channel created for activity ${activityId}: ${channel.id}`);
            return updatedActivity;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create voice channel for activity ${activityId}:`, error);
            throw new apiErrors_1.BadRequestError('Failed to create voice channel for activity');
        }
    }
    async linkVoiceChannel(activityId, channelId, _guildId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        try {
            const channel = this.voiceChannelService.getChannel(channelId);
            if (!channel) {
                throw new apiErrors_1.NotFoundError('Voice channel');
            }
            activity.voiceChannelId = channelId;
            activity.voiceChannelName = channel.name;
            activity.updatedAt = new Date();
            const updatedActivity = await this.repository.save(activity);
            ActivityAuditLogger_1.activityAuditLogger.log({
                action: ActivityAuditLogger_1.ActivityAuditAction.VOICE_CHANNEL_LINKED,
                activityId,
                activityTitle: activity.title,
                activityType: activity.activityType,
                organizationId: activity.organizationId ?? '',
                performedById: 'system',
                performedByName: 'System',
                details: {
                    channelId,
                    channelName: channel.name,
                },
            });
            logger_1.logger.info(`Voice channel ${channelId} linked to activity ${activityId}`);
            return updatedActivity;
        }
        catch (error) {
            logger_1.logger.error(`Failed to link voice channel to activity ${activityId}:`, error);
            throw new apiErrors_1.BadRequestError('Failed to link voice channel to activity');
        }
    }
    async addRoutePlan(activityId, routePlan, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isCreator = activity.creatorId === userId;
        const participantCount = isCreator
            ? 1
            : await this.participantRepo.count({ where: { activityId, userId } });
        if (!isCreator && participantCount === 0) {
            throw new apiErrors_1.ForbiddenError('Only activity creator or participants can modify route plan');
        }
        if (routePlan.length === 0) {
            throw new apiErrors_1.ValidationError('Route plan cannot be empty');
        }
        activity.routePlan = routePlan;
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ROUTE_ADDED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
            details: {
                waypointCount: routePlan.length,
                waypoints: routePlan.map(wp => wp.location),
            },
        });
        logger_1.logger.info(`Route plan added to activity ${activityId} by ${userId}`);
        return updatedActivity;
    }
    async updateWaypoint(activityId, waypointIndex, waypoint, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isCreator = activity.creatorId === userId;
        const hasAccess = isCreator || (await this.participantRepo.count({ where: { activityId, userId } })) > 0;
        if (!hasAccess) {
            throw new apiErrors_1.ForbiddenError('Only activity creator or participants can modify route plan');
        }
        if (!activity.routePlan || waypointIndex < 0 || waypointIndex >= activity.routePlan.length) {
            throw new apiErrors_1.ValidationError('Invalid waypoint index');
        }
        Object.assign(activity.routePlan[waypointIndex], waypoint);
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.WAYPOINT_UPDATED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
            details: {
                waypointIndex,
                updatedFields: Object.keys(waypoint),
            },
        });
        logger_1.logger.info(`Waypoint ${waypointIndex} updated in activity ${activityId} by ${userId}`);
        return updatedActivity;
    }
    async submitCompletionReport(activityId, report, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isCreator = activity.creatorId === userId;
        const hasAccess = isCreator || (await this.participantRepo.count({ where: { activityId, userId } })) > 0;
        if (!hasAccess) {
            throw new apiErrors_1.ForbiddenError('Only activity creator or participants can submit completion report');
        }
        const completedAt = new Date();
        const { activity: updatedActivity, skippedByConcurrentCompletion } = await this.withEntityLock(activity.id, async (locked, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            if (activity.status !== Activity_1.ActivityStatus.COMPLETED &&
                locked.status === Activity_1.ActivityStatus.COMPLETED) {
                return {
                    activity: locked,
                    skippedByConcurrentCompletion: true,
                };
            }
            locked.status = Activity_1.ActivityStatus.COMPLETED;
            locked.actualDuration = report.actualDuration;
            locked.actualParticipants = report.actualParticipants ?? locked.currentParticipants;
            locked.completedAt = completedAt;
            locked.updatedAt = completedAt;
            locked.metadata = {
                ...locked.metadata,
                completionReport: {
                    ...report,
                    submittedBy: userId,
                    submittedAt: completedAt,
                },
            };
            const saved = await activityRepo.save(locked);
            return {
                activity: saved,
                skippedByConcurrentCompletion: false,
            };
        });
        if (skippedByConcurrentCompletion) {
            return updatedActivity;
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.COMPLETION_REPORT_SUBMITTED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
            details: {
                actualDuration: report.actualDuration,
                actualParticipants: report.actualParticipants ?? activity.currentParticipants,
                successRate: report.successRate,
                creditsEarned: report.creditsEarned,
                reputationEarned: report.reputationEarned,
            },
        });
        logger_1.logger.info(`Completion report submitted for activity ${activityId} by ${userId}`);
        return updatedActivity;
    }
    async startActivity(activityId, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.creatorId !== userId) {
            throw new apiErrors_1.ForbiddenError('Only activity creator can start the activity');
        }
        if (!this.canStartFromStatus(activity.status)) {
            throw new apiErrors_1.ValidationError('Activity cannot be started in its current status');
        }
        const startedAt = new Date();
        const { activity: updatedActivity, wasStarted, previousStatus, } = await this.withEntityLock(activity.id, async (locked, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            if (locked.status === Activity_1.ActivityStatus.IN_PROGRESS) {
                return {
                    activity: locked,
                    wasStarted: false,
                    previousStatus: locked.status,
                };
            }
            if (!this.canStartFromStatus(locked.status)) {
                throw new apiErrors_1.ValidationError('Activity cannot be started in its current status');
            }
            const priorStatus = locked.status;
            locked.status = Activity_1.ActivityStatus.IN_PROGRESS;
            locked.startedAt = startedAt;
            locked.updatedAt = startedAt;
            const saved = await activityRepo.save(locked);
            return {
                activity: saved,
                wasStarted: true,
                previousStatus: priorStatus,
            };
        });
        if (!wasStarted) {
            return updatedActivity;
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_STARTED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
            details: {
                previousStatus,
                newStatus: Activity_1.ActivityStatus.IN_PROGRESS,
                startedAt,
            },
        });
        logger_1.logger.info(`Activity ${activityId} started by ${userId}`);
        return updatedActivity;
    }
    async cancelActivity(activityId, userId, reason, organizationId) {
        const activity = await this.findActivityById(activityId, organizationId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.creatorId !== userId) {
            throw new apiErrors_1.ForbiddenError('Only activity creator can cancel the activity');
        }
        if (activity.status === Activity_1.ActivityStatus.COMPLETED) {
            throw new apiErrors_1.ValidationError('Cannot cancel a completed activity');
        }
        const { activity: updatedActivity } = await this.applyCancellationLifecycle(activity, {
            reason,
            cancelledById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
        });
        return updatedActivity;
    }
    async cancelActivityAsSystem(organizationId, activityId, cancelledById, reason) {
        const activity = await this.repository
            .createQueryBuilder('activity')
            .where('activity.id = :activityId', { activityId })
            .andWhere('activity.organizationId = :organizationId', { organizationId })
            .getOne();
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.status === Activity_1.ActivityStatus.COMPLETED) {
            throw new apiErrors_1.ValidationError('Cannot cancel a completed activity');
        }
        const { activity: updatedActivity } = await this.applyCancellationLifecycle(activity, {
            reason,
            cancelledById,
            performedByName: await this.getUserNameFromActivity(activity, cancelledById),
            source: 'system_orchestration',
        });
        return updatedActivity;
    }
    async cancelFromDiscordEvent(discordEventId, reason) {
        const activity = await this.repository
            .createQueryBuilder('activity')
            .where('activity.discordEventId = :discordEventId', { discordEventId })
            .getOne();
        if (!activity) {
            return null;
        }
        const { activity: updatedActivity, wasCancelled, cancelledAt, } = await this.applyCancellationLifecycle(activity, {
            reason,
            cancelledById: 'system:discord',
            performedByName: 'Discord Scheduled Event',
            source: 'discord_scheduled_event',
            clearDiscordEventId: true,
        });
        const organizationId = updatedActivity.organizationId ?? '';
        if (wasCancelled) {
            logger_1.logger.info(`Activity ${updatedActivity.id} cancelled via Discord scheduled event ${discordEventId}. Reason: ${reason}`);
        }
        return {
            activityId: updatedActivity.id,
            organizationId,
            participantCount: updatedActivity.currentParticipants ?? 0,
            cancelledAt: cancelledAt.toISOString(),
            wasCancelled,
        };
    }
    async rescheduleActivity(activityId, newStartDate, userId, newEndDate, rescheduleReason) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (userId && activity.creatorId !== userId) {
            throw new apiErrors_1.ForbiddenError('Only activity creator can reschedule the activity');
        }
        if (activity.status === Activity_1.ActivityStatus.COMPLETED ||
            activity.status === Activity_1.ActivityStatus.CANCELLED) {
            throw new apiErrors_1.ValidationError('Cannot reschedule a completed or cancelled activity');
        }
        const previousStartDate = activity.scheduledStartDate;
        const previousEndDate = activity.scheduledEndDate;
        activity.scheduledStartDate = newStartDate;
        if (newEndDate) {
            activity.scheduledEndDate = newEndDate;
        }
        activity.updatedAt = new Date();
        const rescheduleEntry = {
            oldDate: previousStartDate ?? new Date(),
            newDate: newStartDate,
            previousStartDate,
            previousEndDate,
            newStartDate,
            reason: rescheduleReason ?? 'Rescheduled',
            rescheduledBy: userId,
            rescheduledAt: new Date(),
        };
        const previousHistory = activity.metadata?.rescheduleHistory ?? [];
        activity.metadata = {
            ...activity.metadata,
            rescheduleHistory: [...previousHistory, rescheduleEntry],
        };
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ACTIVITY_RESCHEDULED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
            details: {
                previousStartDate,
                previousEndDate,
                newStartDate,
                newEndDate,
                reason: rescheduleReason ?? 'Rescheduled',
            },
        });
        DomainEventBus_1.domainEvents.emit('activity:rescheduled', {
            activityId,
            organizationId: activity.organizationId ?? '',
            previousStartDate: previousStartDate ? previousStartDate.toISOString() : undefined,
            newStartDate: newStartDate.toISOString(),
            newEndDate: newEndDate ? newEndDate.toISOString() : undefined,
            reason: rescheduleReason,
            timestamp: new Date().toISOString(),
        });
        logger_1.logger.info(`Activity ${activityId} rescheduled to ${newStartDate.toISOString()}`);
        return updatedActivity;
    }
    async autoStartScheduledActivities() {
        const now = new Date();
        const activities = await this.repository.find({
            where: {
                status: (0, typeorm_1.In)([
                    Activity_1.ActivityStatus.OPEN,
                    Activity_1.ActivityStatus.PLANNING,
                    Activity_1.ActivityStatus.RECRUITING,
                    Activity_1.ActivityStatus.READY,
                ]),
                scheduledStartDate: (0, typeorm_1.LessThanOrEqual)(now),
            },
        });
        let startedCount = 0;
        for (const activity of activities) {
            try {
                await this.startActivity(activity.id, activity.creatorId);
                startedCount++;
            }
            catch (error) {
                logger_1.logger.error(`Failed to auto-start activity ${activity.id}:`, error);
            }
        }
        if (startedCount > 0) {
            logger_1.logger.info(`Auto-started ${startedCount} scheduled activities`);
        }
        return startedCount;
    }
    async autoCompleteOverdueActivities() {
        const now = new Date();
        const overdueHours = 2;
        const overdueTime = new Date(now.getTime() - overdueHours * 60 * 60 * 1000);
        const activities = await this.repository.find({
            where: {
                status: Activity_1.ActivityStatus.IN_PROGRESS,
                scheduledEndDate: (0, typeorm_1.LessThanOrEqual)(overdueTime),
            },
        });
        let completedCount = 0;
        for (const activity of activities) {
            try {
                await this.submitCompletionReport(activity.id, {
                    notes: 'Auto-completed due to overdue status',
                    metadata: { autoCompleted: true, autoCompletedAt: now },
                }, activity.creatorId);
                completedCount++;
            }
            catch (error) {
                logger_1.logger.error(`Failed to auto-complete activity ${activity.id}:`, error);
            }
        }
        if (completedCount > 0) {
            logger_1.logger.info(`Auto-completed ${completedCount} overdue activities`);
        }
        return completedCount;
    }
    async joinWaitlist(activityId, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (!activity.isFull) {
            throw new apiErrors_1.ValidationError('Activity is not full - please join directly instead of joining waitlist');
        }
        if (activity.waitlist.includes(userId)) {
            throw new apiErrors_1.ConflictError('You are already on the waitlist for this activity');
        }
        const alreadyJoined = (await this.participantRepo.count({ where: { activityId, userId } })) > 0;
        if (alreadyJoined) {
            throw new apiErrors_1.ConflictError('You are already a participant in this activity');
        }
        activity.waitlist = [...activity.waitlist, userId];
        const saved = await this.repository.save(activity);
        logger_1.logger.info(`User ${userId} added to waitlist for activity ${activityId}`);
        return saved;
    }
    async leaveWaitlist(activityId, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const index = activity.waitlist.indexOf(userId);
        if (index === -1) {
            throw new apiErrors_1.ValidationError('You are not on the waitlist');
        }
        activity.waitlist = activity.waitlist.filter((_, i) => i !== index);
        const saved = await this.repository.save(activity);
        logger_1.logger.info(`User ${userId} removed from waitlist for activity ${activityId}`);
        return saved;
    }
    async promoteFromWaitlist(activityId, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.waitlist.length === 0) {
            throw new apiErrors_1.ValidationError('Waitlist is empty');
        }
        const nextUserId = userId ?? activity.waitlist[0];
        const index = activity.waitlist.indexOf(nextUserId);
        if (index === -1) {
            throw new apiErrors_1.NotFoundError('User on waitlist');
        }
        activity.waitlist = activity.waitlist.filter((_, i) => i !== index);
        const newRow = this.participantRepo.create({
            activityId,
            userId: nextUserId,
            userName: 'Waitlist User',
            role: Activity_1.ParticipantRole.MEMBER,
            status: ActivityParticipant_1.ActivityParticipantStatus.STANDBY,
            joinedAt: new Date(),
        });
        await this.participantRepo.save(newRow);
        activity.currentParticipants = (activity.currentParticipants || 0) + 1;
        const saved = await this.repository.save(activity);
        logger_1.logger.info(`User ${nextUserId} promoted from waitlist for activity ${activityId}`);
        return saved;
    }
    async updateRSVPStatus(activityId, userId, status, role) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const exists = await this.participantRepo.count({ where: { activityId, userId } });
        if (exists === 0) {
            throw new apiErrors_1.NotFoundError('Participant');
        }
        const updateFields = { status };
        if (role) {
            updateFields.role = role;
        }
        await this.participantRepo.update({ activityId, userId }, updateFields);
        activity.currentParticipants = await this.participantRepo.count({
            where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
        });
        const saved = await this.repository.save(activity);
        logger_1.logger.info(`RSVP updated for user ${userId} in activity ${activityId}: ${status}`);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.PARTICIPANT_ROLE_CHANGED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: await this.getUserNameFromActivity(activity, userId),
            details: {
                rsvpStatus: status,
                participantRole: role,
            },
        });
        return saved;
    }
}
exports.ActivityEventService = ActivityEventService;
//# sourceMappingURL=ActivityEventService.js.map