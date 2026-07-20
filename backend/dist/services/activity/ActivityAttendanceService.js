"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventAttendanceConfirmation = exports.AttendanceStatus = exports.ActivityAttendanceService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const EventAttendanceConfirmation_1 = require("../../models/EventAttendanceConfirmation");
Object.defineProperty(exports, "AttendanceStatus", { enumerable: true, get: function () { return EventAttendanceConfirmation_1.AttendanceStatus; } });
Object.defineProperty(exports, "EventAttendanceConfirmation", { enumerable: true, get: function () { return EventAttendanceConfirmation_1.EventAttendanceConfirmation; } });
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const TenantService_1 = require("../base/TenantService");
class ActivityAttendanceService extends TenantService_1.TenantService {
    activityRepository;
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    notificationService;
    constructor(notificationService) {
        const confirmationRepository = data_source_1.AppDataSource.getRepository(EventAttendanceConfirmation_1.EventAttendanceConfirmation);
        super(confirmationRepository);
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        this.notificationService = notificationService;
    }
    async initializeActivityAttendance(activityId) {
        const activity = await this.activityRepository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.activityType !== Activity_1.ActivityType.EVENT) {
            throw new apiErrors_1.ValidationError('Attendance tracking is only available for EVENT type activities');
        }
        const confirmations = [];
        const acceptedParticipants = await this.participantRepo.find({
            where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
            select: ['userId', 'role'],
        });
        for (const participant of acceptedParticipants) {
            const confirmation = this.repository.create({
                eventId: activityId,
                userId: participant.userId,
                organizationId: activity.organizationId ?? '',
                status: EventAttendanceConfirmation_1.AttendanceStatus.PENDING_CONFIRMATION,
                rsvpStatus: 'accepted',
                rsvpRole: participant.role,
            });
            confirmations.push(await this.repository.save(confirmation));
        }
        logger_1.logger.info(`Initialized attendance tracking for activity ${activityId} with ${confirmations.length} confirmations`);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ATTENDANCE_TRACKING_INITIALIZED',
            message: `Initialized attendance tracking for activity ${activityId}`,
            organizationId: activity.organizationId ?? undefined,
            resource: `activity/${activityId}/attendance`,
            metadata: {
                activityId,
                confirmationCount: confirmations.length,
            },
        });
        return confirmations;
    }
    async recordAttendance(organizationId, activityId, record) {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId, organizationId },
        });
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity', activityId);
        }
        let confirmation = await this.repository.findOne({
            where: { eventId: activityId, userId: record.userId, organizationId },
        });
        if (!confirmation) {
            confirmation = this.repository.create({
                eventId: activityId,
                userId: record.userId,
                organizationId,
                rsvpStatus: 'accepted',
            });
        }
        confirmation.status = record.status;
        confirmation.actualRole = record.actualRole;
        confirmation.checkInTime = record.checkInTime;
        confirmation.checkOutTime = record.checkOutTime;
        confirmation.notes = record.notes;
        confirmation.confirmedBy = record.confirmedBy;
        confirmation.confirmedAt = new Date();
        if (confirmation.checkInTime && confirmation.checkOutTime) {
            const diff = confirmation.checkOutTime.getTime() - confirmation.checkInTime.getTime();
            confirmation.durationMinutes = Math.round(diff / (1000 * 60));
        }
        const savedConfirmation = await this.repository.save(confirmation);
        logger_1.logger.info('Recorded activity attendance', {
            organizationId,
            activityId,
            userId: record.userId,
            status: record.status,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ATTENDANCE_RECORDED',
            message: `Recorded attendance for user ${record.userId} in activity ${activityId}`,
            organizationId,
            userId: record.confirmedBy,
            resource: `activity/${activityId}/attendance/${record.userId}`,
            metadata: {
                activityId,
                attendeeUserId: record.userId,
                status: record.status,
            },
        });
        return savedConfirmation;
    }
    async confirmAttendance(activityId, userId, actualRole, confirmedBy) {
        const activity = await this.activityRepository.findOne({ where: { id: activityId } });
        if (!activity?.organizationId) {
            throw new apiErrors_1.NotFoundError('Activity', activityId);
        }
        return this.recordAttendance(activity.organizationId, activityId, {
            userId,
            status: EventAttendanceConfirmation_1.AttendanceStatus.ATTENDED,
            actualRole,
            confirmedBy: confirmedBy || userId,
            checkInTime: new Date(),
        });
    }
    async markNoShow(activityId, userId, excused = false, reason, markedBy) {
        const activity = await this.activityRepository.findOne({ where: { id: activityId } });
        if (!activity?.organizationId) {
            throw new apiErrors_1.NotFoundError('Activity', activityId);
        }
        const confirmation = await this.recordAttendance(activity.organizationId, activityId, {
            userId,
            status: EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW,
            notes: reason,
            confirmedBy: markedBy,
        });
        confirmation.excusedAbsence = excused;
        confirmation.absenceReason = reason;
        const savedConfirmation = await this.repository.save(confirmation);
        logger_1.logger.info('Marked activity attendee as no-show', {
            activityId,
            userId,
            organizationId: confirmation.organizationId,
            excused,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ATTENDANCE_NO_SHOW_MARKED',
            message: `Marked user ${userId} as no-show for activity ${activityId}`,
            organizationId: confirmation.organizationId,
            userId: markedBy,
            resource: `activity/${activityId}/attendance/${userId}`,
            metadata: {
                activityId,
                attendeeUserId: userId,
                excused,
            },
        });
        return savedConfirmation;
    }
    async sendConfirmationRequests(activityId) {
        const activity = await this.activityRepository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (!activity.scheduledEndDate || activity.scheduledEndDate > new Date()) {
            throw new apiErrors_1.ValidationError('Cannot request confirmation for future or ongoing activities');
        }
        const confirmations = await this.repository.find({
            where: { eventId: activityId, status: EventAttendanceConfirmation_1.AttendanceStatus.PENDING_CONFIRMATION },
        });
        let sentCount = 0;
        for (const confirmation of confirmations) {
            if (!confirmation.notificationSent) {
                try {
                    await this.sendConfirmationRequest(confirmation, activity);
                    confirmation.notificationSent = true;
                    await this.repository.save(confirmation);
                    sentCount++;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to send confirmation request to ${confirmation.userId}:`, error);
                }
            }
        }
        logger_1.logger.info(`Sent ${sentCount} attendance confirmation requests for activity ${activityId}`);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ATTENDANCE_CONFIRMATION_REQUESTS_SENT',
            message: `Sent ${sentCount} attendance confirmation requests for activity ${activityId}`,
            organizationId: activity.organizationId ?? undefined,
            resource: `activity/${activityId}/attendance`,
            metadata: {
                activityId,
                sentCount,
            },
        });
        return sentCount;
    }
    async sendConfirmationRequest(confirmation, activity) {
        const participantCount = activity.currentParticipants ?? 0;
        const message = {
            subject: `Attendance Confirmation: ${activity.title}`,
            body: `Please confirm your attendance for the activity "${activity.title}" that took place on ${activity.scheduledEndDate?.toLocaleString()}.\n\nUse the /attendance command in Discord to confirm your status.`,
            embed: this.notificationService.createAttendanceConfirmationEmbed(activity.title, activity.scheduledEndDate || new Date(), participantCount),
            recipientIds: [confirmation.userId],
        };
        await this.notificationService.sendDiscordNotification(message);
    }
    async autoConfirmNoShows(daysOld = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const activities = await this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.activityType = :type', { type: Activity_1.ActivityType.EVENT })
            .andWhere('activity.scheduledEndDate < :cutoff', { cutoff: cutoffDate })
            .getMany();
        let confirmedCount = 0;
        for (const activity of activities) {
            const pendingConfirmations = await this.repository.find({
                where: {
                    eventId: activity.id,
                    status: EventAttendanceConfirmation_1.AttendanceStatus.PENDING_CONFIRMATION,
                },
            });
            for (const confirmation of pendingConfirmations) {
                confirmation.status = EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW;
                confirmation.autoConfirmed = true;
                confirmation.confirmedAt = new Date();
                confirmation.confirmedBy = 'system';
                await this.repository.save(confirmation);
                confirmedCount++;
            }
        }
        logger_1.logger.info(`Auto-confirmed ${confirmedCount} no-shows for activities older than ${daysOld} days`);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ATTENDANCE_NO_SHOWS_AUTO_CONFIRMED',
            message: `Auto-confirmed ${confirmedCount} no-shows for activities older than ${daysOld} days`,
            metadata: {
                confirmedCount,
                daysOld,
            },
        });
        return confirmedCount;
    }
    async getActivityAttendanceStats(activityId) {
        const confirmations = await this.repository.find({
            where: { eventId: activityId },
        });
        const stats = {
            total: confirmations.length,
            attended: 0,
            noShow: 0,
            late: 0,
            earlyDeparture: 0,
            pending: 0,
            attendanceRate: 0,
        };
        for (const confirmation of confirmations) {
            switch (confirmation.status) {
                case EventAttendanceConfirmation_1.AttendanceStatus.ATTENDED:
                    stats.attended++;
                    break;
                case EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW:
                    stats.noShow++;
                    break;
                case EventAttendanceConfirmation_1.AttendanceStatus.LATE:
                    stats.late++;
                    break;
                case EventAttendanceConfirmation_1.AttendanceStatus.EARLY_DEPARTURE:
                    stats.earlyDeparture++;
                    break;
                case EventAttendanceConfirmation_1.AttendanceStatus.PENDING_CONFIRMATION:
                    stats.pending++;
                    break;
            }
        }
        const actuallyAttended = stats.attended + stats.late + stats.earlyDeparture;
        stats.attendanceRate = stats.total > 0 ? Math.round((actuallyAttended / stats.total) * 100) : 0;
        return stats;
    }
    async getAttendedEventCount(organizationId, userId) {
        return this.repository.count({
            where: { organizationId, userId, status: EventAttendanceConfirmation_1.AttendanceStatus.ATTENDED },
        });
    }
    async getUserAttendanceHistory(userId, monthsBack = 6, organizationId) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const queryBuilder = this.repository
            .createQueryBuilder('confirmation')
            .where('confirmation.userId = :userId', { userId })
            .andWhere('confirmation.createdAt >= :startDate', { startDate });
        if (organizationId) {
            queryBuilder.andWhere('confirmation.organizationId = :organizationId', { organizationId });
        }
        const confirmations = await queryBuilder.getMany();
        const history = {
            userId,
            totalEvents: confirmations.length,
            attended: 0,
            noShows: 0,
            late: 0,
            excusedAbsences: 0,
            reliabilityScore: 100,
        };
        let totalRating = 0;
        let ratingCount = 0;
        for (const confirmation of confirmations) {
            if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.ATTENDED) {
                history.attended++;
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW) {
                if (confirmation.excusedAbsence) {
                    history.excusedAbsences++;
                }
                else {
                    history.noShows++;
                }
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.LATE) {
                history.late++;
            }
            if (confirmation.performanceRating?.reliability) {
                totalRating += confirmation.performanceRating.reliability;
                ratingCount++;
            }
        }
        if (history.totalEvents > 0) {
            const reliableEvents = history.attended + history.late;
            history.reliabilityScore = Math.round((reliableEvents / history.totalEvents) * 100);
        }
        if (ratingCount > 0) {
            history.averageRating = totalRating / ratingCount;
        }
        return history;
    }
    async addPerformanceRating(confirmationId, rating, _ratedBy) {
        const confirmation = await this.repository.findOne({
            where: { id: confirmationId },
        });
        if (!confirmation) {
            throw new apiErrors_1.NotFoundError('Confirmation record');
        }
        confirmation.performanceRating = rating;
        confirmation.feedbackFromOrganizer = rating.comments;
        const savedConfirmation = await this.repository.save(confirmation);
        logger_1.logger.info('Added performance rating to activity attendance confirmation', {
            confirmationId,
            activityId: confirmation.eventId,
            userId: confirmation.userId,
            organizationId: confirmation.organizationId,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_ATTENDANCE_PERFORMANCE_RATING_ADDED',
            message: `Added performance rating to attendance confirmation ${confirmationId}`,
            organizationId: confirmation.organizationId,
            userId: _ratedBy,
            resource: `activity/${confirmation.eventId}/attendance/${confirmation.userId}`,
            metadata: {
                confirmationId,
                activityId: confirmation.eventId,
                attendeeUserId: confirmation.userId,
            },
        });
        return savedConfirmation;
    }
    async getAttendanceLeaderboard(organizationId, monthsBack = 3, limit = 10) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const activities = await this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.organizationId = :organizationId', { organizationId })
            .andWhere('activity.activityType = :type', { type: Activity_1.ActivityType.EVENT })
            .andWhere('activity.scheduledEndDate >= :startDate', { startDate })
            .getMany();
        const activityIds = activities.map((a) => a.id);
        if (activityIds.length === 0) {
            return [];
        }
        const confirmations = await this.repository
            .createQueryBuilder('confirmation')
            .where('confirmation.eventId IN (:...activityIds)', { activityIds })
            .getMany();
        const userStats = new Map();
        for (const confirmation of confirmations) {
            if (!userStats.has(confirmation.userId)) {
                userStats.set(confirmation.userId, {
                    userId: confirmation.userId,
                    totalEvents: 0,
                    attended: 0,
                    noShows: 0,
                    late: 0,
                    excusedAbsences: 0,
                    reliabilityScore: 0,
                });
            }
            const stats = userStats.get(confirmation.userId);
            if (!stats) {
                continue;
            }
            stats.totalEvents++;
            if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.ATTENDED) {
                stats.attended++;
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW) {
                if (confirmation.excusedAbsence) {
                    stats.excusedAbsences++;
                }
                else {
                    stats.noShows++;
                }
            }
            else if (confirmation.status === EventAttendanceConfirmation_1.AttendanceStatus.LATE) {
                stats.late++;
            }
        }
        const leaderboard = [];
        for (const [_userId, stats] of userStats) {
            const reliableEvents = stats.attended + stats.late;
            stats.reliabilityScore =
                stats.totalEvents > 0 ? Math.round((reliableEvents / stats.totalEvents) * 100) : 0;
            leaderboard.push(stats);
        }
        return leaderboard
            .sort((a, b) => {
            if (a.reliabilityScore !== b.reliabilityScore) {
                return b.reliabilityScore - a.reliabilityScore;
            }
            return b.totalEvents - a.totalEvents;
        })
            .slice(0, limit);
    }
    async generateAttendanceReport(activityId) {
        const activity = await this.activityRepository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const stats = await this.getActivityAttendanceStats(activityId);
        const confirmations = await this.repository.find({
            where: { eventId: activityId },
        });
        const attendees = confirmations.map((c) => ({
            userId: c.userId,
            status: c.status,
            rsvpRole: c.rsvpRole,
            actualRole: c.actualRole,
            attendanceScore: c.getAttendanceScore(),
        }));
        return {
            activity,
            stats,
            attendees,
        };
    }
}
exports.ActivityAttendanceService = ActivityAttendanceService;
//# sourceMappingURL=ActivityAttendanceService.js.map