"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityAggregatorService = void 0;
const data_source_1 = require("../../data-source");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const Team_1 = require("../../models/Team");
const TeamMember_1 = require("../../models/TeamMember");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const ActivityEventService_1 = require("../activity/ActivityEventService");
const ActivityParticipantService_1 = require("../activity/ActivityParticipantService");
const ActivityService_1 = require("../activity/ActivityService");
const AvailabilityService_1 = require("../calendar/AvailabilityService");
const communication_1 = require("../communication");
const DiscordService_1 = require("../discord/DiscordService");
const UserService_1 = require("../user/UserService");
class ActivityAggregatorService {
    activityService;
    participantService;
    eventService;
    notificationService;
    discordService;
    userService;
    availabilityService;
    constructor() {
        this.activityService = new ActivityService_1.ActivityService();
        this.participantService = new ActivityParticipantService_1.ActivityParticipantService();
        this.eventService = new ActivityEventService_1.ActivityEventService();
        this.notificationService = new communication_1.NotificationService(undefined, undefined);
        this.discordService = (0, DiscordService_1.getDiscordService)();
        this.userService = new UserService_1.UserService();
        this.availabilityService = new AvailabilityService_1.AvailabilityService();
    }
    getErrorLogContext(error) {
        if (error instanceof Error) {
            return {
                message: error.message,
                name: error.name,
                stack: error.stack,
            };
        }
        if (typeof error === 'string') {
            return {
                message: error,
            };
        }
        if (typeof error === 'number' ||
            typeof error === 'boolean' ||
            error === null ||
            error === undefined) {
            let message = `${error}`;
            if (error === null) {
                message = 'null';
            }
            else if (error === undefined) {
                message = 'undefined';
            }
            return {
                message,
            };
        }
        return {
            message: 'Non-Error throwable',
        };
    }
    getAttendanceFlagFromNotes(notes) {
        if (!notes) {
            return undefined;
        }
        if (notes.startsWith('[attendance:true]')) {
            return true;
        }
        if (notes.startsWith('[attendance:false]')) {
            return false;
        }
        return undefined;
    }
    addWarning(warnings, warning) {
        warnings.push(warning);
        logger_1.logger.warn('Activity aggregator completed with warning', warning);
    }
    async recordCreationEvent(params, activity, warnings) {
        try {
            await this.eventService.create(params.organizationId, {
                activity: { id: activity.id },
                eventType: 'created',
                userId: params.activityData.creatorId,
                description: `Activity "${params.activityData.title}" created`,
                timestamp: new Date(),
            });
        }
        catch (error) {
            this.addWarning(warnings, {
                code: 'ACTIVITY_EVENT_CREATE_FAILED',
                stage: 'event',
                message: 'Activity was created but event audit entry could not be recorded.',
                details: {
                    activityId: activity.id,
                    error: this.getErrorLogContext(error),
                },
            });
        }
    }
    async postCreateDiscordAnnouncement(params, activityId, warnings) {
        if (!params.postToDiscord || !params.discordChannelId) {
            return;
        }
        try {
            const messageContent = `📅 New Activity: **${params.activityData.title}**\n${params.activityData.description ?? 'No description'}\nType: ${params.activityData.activityType}`;
            await this.discordService.sendMessage(params.discordChannelId, messageContent);
            logger_1.logger.info('Discord message posted', { channelId: params.discordChannelId });
        }
        catch (error) {
            logger_1.logger.error('Failed to post to Discord', {
                error: this.getErrorLogContext(error),
            });
            this.addWarning(warnings, {
                code: 'DISCORD_POST_FAILED',
                stage: 'discord',
                message: 'Activity was created but Discord announcement failed.',
                details: {
                    activityId,
                    channelId: params.discordChannelId,
                    error: this.getErrorLogContext(error),
                },
            });
        }
    }
    async addParticipantsToActivity(params, activity, warnings) {
        const participants = [];
        if (!params.participantIds || params.participantIds.length === 0) {
            return { activity, participants };
        }
        let currentActivity = activity;
        for (const userId of params.participantIds) {
            let user;
            try {
                user = await this.userService.getUserById(userId);
            }
            catch (error) {
                this.addWarning(warnings, {
                    code: 'PARTICIPANT_RESOLUTION_FAILED',
                    stage: 'participant',
                    message: `Participant ${userId} could not be resolved.`,
                    details: {
                        activityId: currentActivity.id,
                        userId,
                        error: this.getErrorLogContext(error),
                    },
                });
                continue;
            }
            if (!user) {
                logger_1.logger.warn(`User ${userId} not found, skipping participant`);
                this.addWarning(warnings, {
                    code: 'PARTICIPANT_NOT_FOUND',
                    stage: 'participant',
                    message: `Participant ${userId} was not found.`,
                    details: {
                        activityId: currentActivity.id,
                        userId,
                    },
                });
                continue;
            }
            try {
                const { activity: updatedActivity } = await this.participantService.joinActivity(currentActivity.id, {
                    userId: user.id,
                    userName: user.username || user.email,
                    organizationId: params.organizationId,
                });
                const addedParticipant = await this.participantService.getParticipant(currentActivity.id, userId);
                if (addedParticipant) {
                    participants.push(addedParticipant);
                }
                currentActivity = updatedActivity;
            }
            catch (error) {
                this.addWarning(warnings, {
                    code: 'PARTICIPANT_JOIN_FAILED',
                    stage: 'participant',
                    message: `Participant ${userId} could not be added.`,
                    details: {
                        activityId: currentActivity.id,
                        userId,
                        error: this.getErrorLogContext(error),
                    },
                });
                continue;
            }
        }
        if (participants.length > 0) {
            logger_1.logger.info('Participants added', { count: participants.length });
        }
        return {
            activity: currentActivity,
            participants,
        };
    }
    async createActivityWithParticipants(params) {
        try {
            const activityData = {
                ...params.activityData,
                activityType: params.activityData.activityType,
                organizationId: params.organizationId,
            };
            let activity = await this.activityService.create(params.organizationId, activityData);
            logger_1.logger.info('Activity created', {
                activityId: activity.id,
                organizationId: params.organizationId,
            });
            const warnings = [];
            const participantJoinResult = await this.addParticipantsToActivity(params, activity, warnings);
            activity = participantJoinResult.activity;
            const participants = participantJoinResult.participants;
            const availabilityConflicts = await this.checkAvailabilityConflicts(params);
            await this.recordCreationEvent(params, activity, warnings);
            const participantNotificationResult = await this.sendParticipantNotifications(params, activity, participants.map(participant => participant.userId));
            const { notifications } = participantNotificationResult;
            if (participantNotificationResult.failed > 0) {
                this.addWarning(warnings, {
                    code: 'PARTICIPANT_NOTIFICATION_PARTIAL_FAILURE',
                    stage: 'notification',
                    message: 'Activity was created, but one or more participant notifications failed.',
                    details: {
                        activityId: activity.id,
                        failed: participantNotificationResult.failed,
                        total: participantNotificationResult.total,
                    },
                });
            }
            await this.postCreateDiscordAnnouncement(params, activity.id, warnings);
            return {
                activity,
                participants,
                notifications,
                warnings,
                availabilityConflicts,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to create activity with participants', {
                error: this.getErrorLogContext(error),
            });
            throw error;
        }
    }
    async checkAvailabilityConflicts(params) {
        if (!params.activityData.scheduledStartDate ||
            !params.participantIds ||
            params.participantIds.length === 0) {
            return undefined;
        }
        try {
            const startDate = params.activityData.scheduledStartDate;
            const dayOfWeek = startDate.getDay();
            const startMinute = startDate.getHours() * 60 + startDate.getMinutes();
            const endDate = params.activityData.scheduledEndDate;
            const endMinute = endDate
                ? endDate.getHours() * 60 + endDate.getMinutes()
                : Math.min(startMinute + 60, 1440);
            const availMap = await this.availabilityService.getAvailabilityForUsers(params.organizationId, params.participantIds);
            return params.participantIds.map(userId => {
                const slots = availMap.get(userId) ?? [];
                const available = slots.some(s => s.dayOfWeek === dayOfWeek && s.startMinute <= startMinute && s.endMinute >= endMinute);
                return { userId, available };
            });
        }
        catch (err) {
            logger_1.logger.warn('Failed to check availability conflicts', {
                error: this.getErrorLogContext(err),
            });
            return undefined;
        }
    }
    async sendParticipantNotifications(params, activity, participantIds) {
        if (!params.notifyParticipants || participantIds.length === 0) {
            return {
                notifications: [],
                total: 0,
                failed: 0,
            };
        }
        const notificationPromises = participantIds.map(userId => Promise.resolve().then(() => this.notificationService.create({
            userId,
            type: 'activity_invitation',
            title: 'Activity Invitation',
            message: `You've been invited to: ${params.activityData.title}`,
            data: { activityId: activity.id, organizationId: params.organizationId },
        })));
        const results = await Promise.allSettled(notificationPromises);
        const notifications = [];
        let failed = 0;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (result.value.success) {
                    notifications.push(result.value);
                }
                else {
                    failed += 1;
                    logger_1.logger.error('Failed to send notification', {
                        userId: participantIds[index],
                        error: result.value.error ?? 'Notification service reported failure',
                    });
                }
            }
            else {
                failed += 1;
                logger_1.logger.error('Failed to send notification', {
                    userId: participantIds[index],
                    error: this.getErrorLogContext(result.reason),
                });
            }
        });
        logger_1.logger.info('Notifications sent', {
            count: notifications.length,
            total: participantIds.length,
            failed,
        });
        return {
            notifications,
            total: participantIds.length,
            failed,
        };
    }
    async updateParticipantAttendance(activityId, participantReports) {
        const failedUserIds = [];
        for (const report of participantReports) {
            const attendancePrefix = report.attended ? '[attendance:true]' : '[attendance:false]';
            const notes = report.contribution
                ? `${attendancePrefix} ${report.contribution}`
                : attendancePrefix;
            try {
                const affectedRows = await this.participantService.updateParticipant(activityId, report.userId, {
                    notes,
                });
                if (affectedRows === 0) {
                    failedUserIds.push(report.userId);
                    logger_1.logger.warn('Participant attendance update skipped; participant not found', {
                        activityId,
                        userId: report.userId,
                    });
                }
            }
            catch (error) {
                failedUserIds.push(report.userId);
                logger_1.logger.error('Participant attendance update failed', {
                    activityId,
                    userId: report.userId,
                    error: this.getErrorLogContext(error),
                });
            }
        }
        let updatedParticipants = [];
        try {
            const updatedRows = await this.participantService.getParticipants(activityId);
            updatedParticipants = updatedRows;
        }
        catch (error) {
            logger_1.logger.error('Failed to reload participants after attendance updates', {
                activityId,
                error: this.getErrorLogContext(error),
            });
        }
        logger_1.logger.info('Participant attendance updated', {
            count: updatedParticipants.length,
            failed: failedUserIds.length,
        });
        return { updatedParticipants, failedUserIds };
    }
    async sendCompletionNotifications(activityId, activityTitle, outcome) {
        const notifications = [];
        const participantRows = await this.participantService.getParticipants(activityId);
        const notificationPromises = participantRows.map(participant => Promise.resolve().then(() => this.notificationService.create({
            userId: participant.userId,
            type: 'activity_completed',
            title: 'Activity Completed',
            message: `Activity "${activityTitle}" has been completed`,
            data: {
                activityId,
                outcome,
            },
        })));
        const results = await Promise.allSettled(notificationPromises);
        let failed = 0;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (result.value.success) {
                    notifications.push(result.value);
                }
                else {
                    failed += 1;
                    logger_1.logger.error('Failed to send completion notification', {
                        userId: participantRows[index]?.userId,
                        error: result.value.error ?? 'Notification service reported failure',
                    });
                }
            }
            else {
                failed += 1;
                logger_1.logger.error('Failed to send completion notification', {
                    userId: participantRows[index]?.userId,
                    error: this.getErrorLogContext(result.reason),
                });
            }
        });
        logger_1.logger.info('Completion notifications sent', {
            count: notifications.length,
            total: participantRows.length,
            failed,
        });
        return {
            notifications,
            total: participantRows.length,
            failed,
        };
    }
    async completeActivity(params) {
        try {
            const warnings = [];
            const activity = await this.activityService.update(params.organizationId, params.activityId, {
                status: 'completed',
                completedAt: new Date(),
                outcome: params.outcome ?? 'success',
                summary: params.summary,
            });
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Activity');
            }
            logger_1.logger.info('Activity completed', {
                activityId: params.activityId,
                outcome: params.outcome,
            });
            let updatedParticipants = [];
            if (params.participantReports && params.participantReports.length > 0) {
                const attendanceResult = await this.updateParticipantAttendance(params.activityId, params.participantReports);
                updatedParticipants = attendanceResult.updatedParticipants;
                if (attendanceResult.failedUserIds.length > 0) {
                    this.addWarning(warnings, {
                        code: 'ATTENDANCE_PARTIAL_FAILURE',
                        stage: 'attendance',
                        message: 'Activity completion succeeded but attendance updates failed for one or more participants.',
                        details: {
                            activityId: params.activityId,
                            failedUserIds: attendanceResult.failedUserIds,
                        },
                    });
                }
            }
            try {
                await this.eventService.create(params.organizationId, {
                    activity: { id: params.activityId },
                    eventType: 'completed',
                    userId: params.completedById,
                    description: `Activity completed with outcome: ${params.outcome ?? 'success'}`,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                this.addWarning(warnings, {
                    code: 'ACTIVITY_EVENT_COMPLETE_FAILED',
                    stage: 'event',
                    message: 'Activity completion was saved but event audit entry failed.',
                    details: {
                        activityId: params.activityId,
                        error: this.getErrorLogContext(error),
                    },
                });
            }
            let completionNotificationResult = {
                notifications: [],
                total: 0,
                failed: 0,
            };
            if (params.notifyParticipants) {
                try {
                    completionNotificationResult = await this.sendCompletionNotifications(params.activityId, activity.title, params.outcome);
                }
                catch (error) {
                    this.addWarning(warnings, {
                        code: 'COMPLETION_NOTIFICATION_DISPATCH_FAILED',
                        stage: 'notification',
                        message: 'Activity completion succeeded but participant notification dispatch failed.',
                        details: {
                            activityId: params.activityId,
                            error: this.getErrorLogContext(error),
                        },
                    });
                }
            }
            if (completionNotificationResult.failed > 0) {
                this.addWarning(warnings, {
                    code: 'COMPLETION_NOTIFICATION_PARTIAL_FAILURE',
                    stage: 'notification',
                    message: 'Activity completion succeeded but one or more notifications failed.',
                    details: {
                        activityId: params.activityId,
                        failed: completionNotificationResult.failed,
                        total: completionNotificationResult.total,
                    },
                });
            }
            return {
                activity,
                updatedParticipants,
                notifications: completionNotificationResult.notifications,
                warnings,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to complete activity', {
                error: this.getErrorLogContext(error),
            });
            throw error;
        }
    }
    async completePersonalActivity(params) {
        try {
            const warnings = [];
            let successRate;
            if (params.outcome === 'success') {
                successRate = 100;
            }
            else if (params.outcome !== undefined) {
                successRate = 0;
            }
            const completedActivity = await this.eventService.submitCompletionReport(params.activity.id, {
                actualParticipants: params.activity.currentParticipants,
                successRate,
                notes: params.summary,
                metadata: {
                    source: 'personal_complete_full_fallback',
                    ...(params.outcome ? { outcome: params.outcome } : {}),
                },
            }, params.completedById);
            let updatedParticipants = [];
            if (params.participantReports && params.participantReports.length > 0) {
                const attendanceResult = await this.updateParticipantAttendance(params.activity.id, params.participantReports);
                updatedParticipants = attendanceResult.updatedParticipants;
                if (attendanceResult.failedUserIds.length > 0) {
                    this.addWarning(warnings, {
                        code: 'ATTENDANCE_PARTIAL_FAILURE',
                        stage: 'attendance',
                        message: 'Activity completion succeeded but attendance updates failed for one or more participants.',
                        details: {
                            activityId: params.activity.id,
                            failedUserIds: attendanceResult.failedUserIds,
                        },
                    });
                }
            }
            else {
                try {
                    updatedParticipants = await this.participantService.getParticipants(params.activity.id);
                }
                catch (error) {
                    this.addWarning(warnings, {
                        code: 'ATTENDANCE_PARTIAL_FAILURE',
                        stage: 'attendance',
                        message: 'Activity completion succeeded but participant reload failed.',
                        details: {
                            activityId: params.activity.id,
                            error: this.getErrorLogContext(error),
                        },
                    });
                }
            }
            let completionNotificationResult = {
                notifications: [],
                total: 0,
                failed: 0,
            };
            if (params.notifyParticipants) {
                try {
                    completionNotificationResult = await this.sendCompletionNotifications(params.activity.id, completedActivity.title, params.outcome);
                }
                catch (error) {
                    this.addWarning(warnings, {
                        code: 'COMPLETION_NOTIFICATION_DISPATCH_FAILED',
                        stage: 'notification',
                        message: 'Activity completion succeeded but participant notification dispatch failed.',
                        details: {
                            activityId: params.activity.id,
                            error: this.getErrorLogContext(error),
                        },
                    });
                }
            }
            if (completionNotificationResult.failed > 0) {
                this.addWarning(warnings, {
                    code: 'COMPLETION_NOTIFICATION_PARTIAL_FAILURE',
                    stage: 'notification',
                    message: 'Activity completion succeeded but one or more notifications failed.',
                    details: {
                        activityId: params.activity.id,
                        failed: completionNotificationResult.failed,
                        total: completionNotificationResult.total,
                    },
                });
            }
            return {
                activity: completedActivity,
                updatedParticipants,
                notifications: completionNotificationResult.notifications,
                warnings,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to complete personal activity', {
                activityId: params.activity.id,
                error: this.getErrorLogContext(error),
            });
            throw error;
        }
    }
    async cancelActivity(organizationId, activityId, cancelledById, reason, notifyParticipants = true) {
        try {
            const warnings = [];
            const activity = await this.eventService.cancelActivityAsSystem(organizationId, activityId, cancelledById, reason);
            logger_1.logger.info('Activity cancelled', { activityId, reason });
            try {
                await this.eventService.create(organizationId, {
                    activity: { id: activityId },
                    eventType: 'cancelled',
                    userId: cancelledById,
                    description: reason ?? 'Activity cancelled',
                    timestamp: new Date(),
                });
            }
            catch (error) {
                this.addWarning(warnings, {
                    code: 'ACTIVITY_EVENT_CANCEL_FAILED',
                    stage: 'event',
                    message: 'Activity cancellation was saved but event audit entry failed.',
                    details: {
                        activityId,
                        error: this.getErrorLogContext(error),
                    },
                });
            }
            const notifications = [];
            if (notifyParticipants) {
                try {
                    const participantRows = await this.participantService.getParticipants(activityId);
                    const notificationPromises = participantRows.map(participant => Promise.resolve().then(() => this.notificationService.create({
                        userId: participant.userId,
                        type: 'activity_cancelled',
                        title: 'Activity Cancelled',
                        message: reason
                            ? `Activity "${activity.title}" has been cancelled: ${reason}`
                            : `Activity "${activity.title}" has been cancelled`,
                        data: {
                            activityId,
                            reason,
                        },
                    })));
                    const results = await Promise.allSettled(notificationPromises);
                    let failedNotifications = 0;
                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            if (result.value.success) {
                                notifications.push(result.value);
                            }
                            else {
                                failedNotifications += 1;
                                logger_1.logger.error('Failed to send cancellation notification', {
                                    userId: participantRows[index]?.userId,
                                    error: result.value.error ?? 'Notification service reported failure',
                                });
                            }
                        }
                        else {
                            failedNotifications += 1;
                            logger_1.logger.error('Failed to send cancellation notification', {
                                userId: participantRows[index]?.userId,
                                error: this.getErrorLogContext(result.reason),
                            });
                        }
                    });
                    logger_1.logger.info('Cancellation notifications sent', {
                        count: notifications.length,
                        total: participantRows.length,
                        failed: failedNotifications,
                    });
                    if (failedNotifications > 0) {
                        this.addWarning(warnings, {
                            code: 'CANCELLATION_NOTIFICATION_PARTIAL_FAILURE',
                            stage: 'notification',
                            message: 'Activity cancellation succeeded but one or more notifications failed.',
                            details: {
                                activityId,
                                failed: failedNotifications,
                                total: participantRows.length,
                            },
                        });
                    }
                }
                catch (error) {
                    this.addWarning(warnings, {
                        code: 'CANCELLATION_NOTIFICATION_DISPATCH_FAILED',
                        stage: 'notification',
                        message: 'Activity cancellation succeeded but participant notification dispatch failed.',
                        details: {
                            activityId,
                            error: this.getErrorLogContext(error),
                        },
                    });
                }
            }
            return {
                activity,
                notifications,
                warnings,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to cancel activity', {
                error: this.getErrorLogContext(error),
            });
            throw error;
        }
    }
    async getActivityWithDetails(organizationId, activityId) {
        const activity = await this.activityService.findById(organizationId, activityId);
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        const totalParticipants = await this.participantService.getParticipantCount(activityId);
        const confirmedCount = await this.participantService.getParticipantCount(activityId, ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED);
        const events = await this.eventService.findAll(organizationId, {
            where: {
                activity: { id: activityId },
            },
        });
        const participantRows = await this.participantService.getParticipants(activityId);
        const participantUserIds = participantRows.map(p => p.userId);
        const attendanceFlags = participantRows
            .map(participant => this.getAttendanceFlagFromNotes(participant.notes))
            .filter((flag) => typeof flag === 'boolean');
        const attendedParticipants = attendanceFlags.length > 0 ? attendanceFlags.filter(Boolean).length : confirmedCount;
        const stats = {
            totalParticipants,
            confirmedParticipants: confirmedCount,
            attendedParticipants,
            completionRate: totalParticipants > 0 ? Math.round((confirmedCount / totalParticipants) * 100) : 0,
        };
        let teamBreakdown;
        try {
            if (activity.teamId) {
                const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
                const assignedTeam = await teamRepo
                    .createQueryBuilder('team')
                    .where('team.id = :teamId', { teamId: activity.teamId })
                    .andWhere('team.organizationId = :organizationId', { organizationId })
                    .getOne();
                if (assignedTeam) {
                    teamBreakdown = [
                        {
                            teamId: assignedTeam.id,
                            teamName: assignedTeam.name,
                            teamType: assignedTeam.type,
                            memberCount: participantRows.length,
                        },
                    ];
                }
            }
            else {
                const participantIds = participantUserIds;
                if (participantIds.length > 0) {
                    const teamMemberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
                    const teamMemberships = await teamMemberRepo
                        .createQueryBuilder('tm')
                        .innerJoin('tm.team', 'team')
                        .select('team.id', 'teamId')
                        .addSelect('team.name', 'teamName')
                        .addSelect('team.type', 'teamType')
                        .addSelect('COUNT(DISTINCT tm.userId)', 'memberCount')
                        .where('tm.organizationId = :organizationId', { organizationId })
                        .andWhere('tm.userId IN (:...userIds)', { userIds: participantIds })
                        .andWhere('tm.status = :status', { status: 'active' })
                        .groupBy('team.id')
                        .addGroupBy('team.name')
                        .addGroupBy('team.type')
                        .getRawMany();
                    if (teamMemberships.length > 0) {
                        teamBreakdown = teamMemberships.map((t) => ({
                            teamId: t.teamId,
                            teamName: t.teamName,
                            teamType: t.teamType,
                            memberCount: Number.parseInt(t.memberCount, 10),
                        }));
                    }
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to load team breakdown for activity details', {
                activityId,
                organizationId,
                error: this.getErrorLogContext(err),
            });
        }
        return {
            activity,
            participants: participantRows,
            events,
            stats,
            teamBreakdown,
        };
    }
}
exports.ActivityAggregatorService = ActivityAggregatorService;
//# sourceMappingURL=ActivityAggregatorService.js.map