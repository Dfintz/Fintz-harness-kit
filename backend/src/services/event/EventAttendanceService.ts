import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity, ActivityType } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import {
  AttendanceStatus,
  EventAttendanceConfirmation,
} from '../../models/EventAttendanceConfirmation';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';
import { TenantService } from '../base/TenantService';
import { NotificationService } from '../communication';

export interface AttendanceRecord {
  userId: string;
  organizationId: string;
  status: AttendanceStatus;
  actualRole?: string;
  checkInTime?: Date;
  checkOutTime?: Date;
  notes?: string;
  confirmedBy?: string;
}

export interface AttendanceStats {
  total: number;
  attended: number;
  noShow: number;
  late: number;
  earlyDeparture: number;
  pending: number;
  attendanceRate: number;
}

export interface UserAttendanceHistory {
  userId: string;
  totalEvents: number;
  attended: number;
  noShows: number;
  late: number;
  excusedAbsences: number;
  reliabilityScore: number;
  averageRating?: number;
}

/**
 * Service for post-event attendance confirmation and tracking
 * Updated to work with Activity system (type: EVENT)
 *
 * Multi-tenancy: Extends TenantService for automatic tenant isolation
 */
export class AttendanceConfirmationService extends TenantService<EventAttendanceConfirmation> {
  private activityRepository: Repository<Activity>;
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    const confirmationRepository = AppDataSource.getRepository(EventAttendanceConfirmation);
    super(confirmationRepository);
    this.activityRepository = AppDataSource.getRepository(Activity);
    this.notificationService = notificationService;
  }

  /**
   * Initialize attendance tracking for an activity (EVENT type)
   */
  async initializeActivityAttendance(activityId: string): Promise<EventAttendanceConfirmation[]> {
    const activity = await this.activityRepository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Only track attendance for EVENT type activities
    if (activity.activityType !== ActivityType.EVENT) {
      throw new Error('Attendance tracking is only available for EVENT type activities');
    }

    const confirmations: EventAttendanceConfirmation[] = [];

    // Query accepted participants from normalized table (Phase 4)
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    const acceptedParticipants = await participantRepo.find({
      where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
      select: ['userId', 'role'],
    });

    for (const participant of acceptedParticipants) {
      const confirmation = this.repository.create({
        eventId: activityId,
        userId: participant.userId,
        organizationId: activity.organizationId ?? '',
        status: AttendanceStatus.PENDING_CONFIRMATION,
        rsvpStatus: 'accepted',
        rsvpRole: participant.role,
      });

      confirmations.push(await this.repository.save(confirmation));
    }

    logger.info(
      `Initialized attendance tracking for activity ${activityId} with ${confirmations.length} confirmations`
    );

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_ATTENDANCE_TRACKING_INITIALIZED',
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

  /**
   * Record attendance for a user with tenant scoping
   */
  async recordAttendance(
    eventId: string,
    record: AttendanceRecord
  ): Promise<EventAttendanceConfirmation> {
    // Find existing confirmation scoped to organization
    let confirmation = await this.repository.findOne({
      where: { eventId, userId: record.userId, organizationId: record.organizationId },
    });

    if (!confirmation) {
      confirmation = this.repository.create({
        eventId,
        userId: record.userId,
        organizationId: record.organizationId,
        rsvpStatus: 'accepted',
      });
    }

    // Update fields
    confirmation.status = record.status;
    confirmation.actualRole = record.actualRole;
    confirmation.checkInTime = record.checkInTime;
    confirmation.checkOutTime = record.checkOutTime;
    confirmation.notes = record.notes;
    confirmation.confirmedBy = record.confirmedBy;
    confirmation.confirmedAt = new Date();

    // Calculate duration if check in/out times provided
    if (confirmation.checkInTime && confirmation.checkOutTime) {
      const diff = confirmation.checkOutTime.getTime() - confirmation.checkInTime.getTime();
      confirmation.durationMinutes = Math.round(diff / (1000 * 60));
    }

    const savedConfirmation = await this.repository.save(confirmation);

    logger.info('Recorded event attendance', {
      eventId,
      userId: record.userId,
      organizationId: record.organizationId,
      status: record.status,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_ATTENDANCE_RECORDED',
      message: `Recorded attendance for user ${record.userId} in event ${eventId}`,
      organizationId: record.organizationId,
      userId: record.confirmedBy,
      resource: `activity/${eventId}/attendance/${record.userId}`,
      metadata: {
        eventId,
        attendeeUserId: record.userId,
        status: record.status,
      },
    });

    return savedConfirmation;
  }

  /**
   * Get all attendance confirmations for a given activity within an organization
   */
  async getAttendanceRecordsForActivity(
    eventId: string,
    organizationId: string
  ): Promise<EventAttendanceConfirmation[]> {
    return this.repository.find({ where: { eventId, organizationId } });
  }

  /**
   * Confirm attendance (user attended) with required organizationId
   */
  async confirmAttendance(
    eventId: string,
    userId: string,
    organizationId: string,
    actualRole?: string,
    confirmedBy?: string
  ): Promise<EventAttendanceConfirmation> {
    return this.recordAttendance(eventId, {
      userId,
      organizationId,
      status: AttendanceStatus.ATTENDED,
      actualRole,
      confirmedBy: confirmedBy || userId,
      checkInTime: new Date(), // Default to now
    });
  }

  /**
   * Mark as no-show with required organizationId
   */
  async markNoShow(
    eventId: string,
    userId: string,
    organizationId: string,
    excused: boolean = false,
    reason?: string,
    markedBy?: string
  ): Promise<EventAttendanceConfirmation> {
    const confirmation = await this.recordAttendance(eventId, {
      userId,
      organizationId,
      status: AttendanceStatus.NO_SHOW,
      notes: reason,
      confirmedBy: markedBy,
    });

    confirmation.excusedAbsence = excused;
    confirmation.absenceReason = reason;

    const savedConfirmation = await this.repository.save(confirmation);

    logger.info('Marked event attendee as no-show', {
      eventId,
      userId,
      organizationId,
      excused,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_ATTENDANCE_NO_SHOW_MARKED',
      message: `Marked user ${userId} as no-show for event ${eventId}`,
      organizationId,
      userId: markedBy,
      resource: `activity/${eventId}/attendance/${userId}`,
      metadata: {
        eventId,
        attendeeUserId: userId,
        excused,
      },
    });

    return savedConfirmation;
  }

  /**
   * Send attendance confirmation requests
   */
  async sendConfirmationRequests(activityId: string): Promise<number> {
    const activity = await this.activityRepository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Only send for past activities
    if (!activity.scheduledEndDate || activity.scheduledEndDate > new Date()) {
      throw new Error('Cannot request confirmation for future or ongoing activities');
    }

    const confirmations = await this.repository.find({
      where: { eventId: activityId, status: AttendanceStatus.PENDING_CONFIRMATION },
    });

    let sentCount = 0;

    for (const confirmation of confirmations) {
      if (!confirmation.notificationSent) {
        try {
          await this.sendConfirmationRequest(confirmation, activity);
          confirmation.notificationSent = true;
          await this.repository.save(confirmation);
          sentCount++;
        } catch (error: unknown) {
          logger.error(`Failed to send confirmation request to ${confirmation.userId}:`, error);
        }
      }
    }

    logger.info(`Sent ${sentCount} attendance confirmation requests for activity ${activityId}`);

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_ATTENDANCE_CONFIRMATION_REQUESTS_SENT',
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

  /**
   * Send individual confirmation request
   */
  private async sendConfirmationRequest(
    confirmation: EventAttendanceConfirmation,
    activity: Activity
  ): Promise<void> {
    const participantCount = activity.currentParticipants ?? 0;

    const message = {
      subject: `Attendance Confirmation: ${activity.title}`,
      body: `Please confirm your attendance for the event "${activity.title}" that took place on ${activity.scheduledEndDate?.toLocaleString()}.\n\nUse the /attendance command in Discord to confirm your status.`,
      embed: this.notificationService.createAttendanceConfirmationEmbed(
        activity.title,
        activity.scheduledEndDate || new Date(),
        participantCount
      ),
      recipientIds: [confirmation.userId],
    };

    await this.notificationService.sendDiscordNotification(message);
  }

  /**
   * Auto-confirm no-shows for old activities
   */
  async autoConfirmNoShows(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const activities = await this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.activityType = :type', { type: ActivityType.EVENT })
      .andWhere('activity.scheduledEndDate < :cutoff', { cutoff: cutoffDate })
      .getMany();

    let confirmedCount = 0;

    for (const activity of activities) {
      const pendingConfirmations = await this.repository.find({
        where: {
          eventId: activity.id,
          status: AttendanceStatus.PENDING_CONFIRMATION,
        },
      });

      for (const confirmation of pendingConfirmations) {
        confirmation.status = AttendanceStatus.NO_SHOW;
        confirmation.autoConfirmed = true;
        confirmation.confirmedAt = new Date();
        confirmation.confirmedBy = 'system';
        await this.repository.save(confirmation);
        confirmedCount++;
      }
    }

    logger.info(
      `Auto-confirmed ${confirmedCount} no-shows for activities older than ${daysOld} days`
    );

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_ATTENDANCE_NO_SHOWS_AUTO_CONFIRMED',
      message: `Auto-confirmed ${confirmedCount} no-shows for activities older than ${daysOld} days`,
      metadata: {
        confirmedCount,
        daysOld,
      },
    });

    return confirmedCount;
  }

  /**
   * Get attendance stats for an activity
   */
  async getActivityAttendanceStats(eventId: string): Promise<AttendanceStats> {
    const confirmations = await this.repository.find({
      where: { eventId },
    });

    const stats: AttendanceStats = {
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
        case AttendanceStatus.ATTENDED:
          stats.attended++;
          break;
        case AttendanceStatus.NO_SHOW:
          stats.noShow++;
          break;
        case AttendanceStatus.LATE:
          stats.late++;
          break;
        case AttendanceStatus.EARLY_DEPARTURE:
          stats.earlyDeparture++;
          break;
        case AttendanceStatus.PENDING_CONFIRMATION:
          stats.pending++;
          break;
      }
    }

    // Calculate attendance rate (attended + late + early departure)
    const actuallyAttended = stats.attended + stats.late + stats.earlyDeparture;
    stats.attendanceRate = stats.total > 0 ? Math.round((actuallyAttended / stats.total) * 100) : 0;

    return stats;
  }

  /**
   * Get user's attendance history
   * @param userId - The user ID to get history for
   * @param monthsBack - Number of months to look back (default: 6)
   * @param organizationId - Organization ID for tenant isolation (required)
   * @returns UserAttendanceHistory with statistics
   * @note Uses createdAt for date filtering (which is never null due to @CreateDateColumn) rather than confirmedAt (which may be null for pending confirmations)
   */
  async getUserAttendanceHistory(
    userId: string,
    monthsBack: number = 6,
    organizationId: string
  ): Promise<UserAttendanceHistory> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const queryBuilder = this.repository
      .createQueryBuilder('confirmation')
      .where('confirmation.userId = :userId', { userId })
      .andWhere('confirmation.createdAt >= :startDate', { startDate });

    // Filter by organizationId for tenant isolation (always applied)
    queryBuilder.andWhere('confirmation.organizationId = :organizationId', { organizationId });

    const confirmations = await queryBuilder.getMany();

    const history: UserAttendanceHistory = {
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
      if (confirmation.status === AttendanceStatus.ATTENDED) {
        history.attended++;
      } else if (confirmation.status === AttendanceStatus.NO_SHOW) {
        if (confirmation.excusedAbsence) {
          history.excusedAbsences++;
        } else {
          history.noShows++;
        }
      } else if (confirmation.status === AttendanceStatus.LATE) {
        history.late++;
      }

      // Calculate average rating
      if (confirmation.performanceRating?.reliability) {
        totalRating += confirmation.performanceRating.reliability;
        ratingCount++;
      }
    }

    // Calculate reliability score
    if (history.totalEvents > 0) {
      const reliableEvents = history.attended + history.late;
      history.reliabilityScore = Math.round((reliableEvents / history.totalEvents) * 100);
    }

    // Calculate average rating
    if (ratingCount > 0) {
      history.averageRating = totalRating / ratingCount;
    }

    return history;
  }

  /**
   * Add performance rating
   */
  async addPerformanceRating(
    confirmationId: string,
    rating: {
      reliability?: number;
      skillLevel?: number;
      teamwork?: number;
      comments?: string;
    },
    _ratedBy: string
  ): Promise<EventAttendanceConfirmation> {
    const confirmation = await this.repository.findOne({
      where: { id: confirmationId },
    });

    if (!confirmation) {
      throw new Error('Confirmation record not found');
    }

    confirmation.performanceRating = rating;
    confirmation.feedbackFromOrganizer = rating.comments;

    const savedConfirmation = await this.repository.save(confirmation);

    logger.info('Added performance rating to event attendance confirmation', {
      confirmationId,
      eventId: confirmation.eventId,
      userId: confirmation.userId,
      organizationId: confirmation.organizationId,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_ATTENDANCE_PERFORMANCE_RATING_ADDED',
      message: `Added performance rating to attendance confirmation ${confirmationId}`,
      organizationId: confirmation.organizationId,
      userId: _ratedBy,
      resource: `activity/${confirmation.eventId}/attendance/${confirmation.userId}`,
      metadata: {
        confirmationId,
        eventId: confirmation.eventId,
        attendeeUserId: confirmation.userId,
      },
    });

    return savedConfirmation;
  }

  /**
   * Get attendance leaderboard
   */
  async getAttendanceLeaderboard(
    organizationId: string,
    monthsBack: number = 3,
    limit: number = 10
  ): Promise<UserAttendanceHistory[]> {
    // Get all activities (EVENT type) for the organization
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const activities = await this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.organizationId = :organizationId', { organizationId })
      .andWhere('activity.activityType = :type', { type: ActivityType.EVENT })
      .andWhere('activity.scheduledEndDate >= :startDate', { startDate })
      .getMany();

    const activityIds = activities.map((a: Activity) => a.id);

    if (activityIds.length === 0) {
      return [];
    }

    // Get all confirmations for these activities
    const confirmations = await this.repository
      .createQueryBuilder('confirmation')
      .where('confirmation.eventId IN (:...activityIds)', { activityIds })
      .getMany();

    // Group by user
    const userStats = new Map<string, UserAttendanceHistory>();

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
      // @ts-expect-error - Strict mode compatibility
      stats.totalEvents++;

      if (confirmation.status === AttendanceStatus.ATTENDED) {
        // @ts-expect-error - Strict mode compatibility
        stats.attended++;
      } else if (confirmation.status === AttendanceStatus.NO_SHOW) {
        if (confirmation.excusedAbsence) {
          // @ts-expect-error - Strict mode compatibility
          stats.excusedAbsences++;
        } else {
          // @ts-expect-error - Strict mode compatibility
          stats.noShows++;
        }
      } else if (confirmation.status === AttendanceStatus.LATE) {
        // @ts-expect-error - Strict mode compatibility
        stats.late++;
      }
    }

    // Calculate reliability scores
    const leaderboard: UserAttendanceHistory[] = [];
    for (const [_userId, stats] of userStats) {
      const reliableEvents = stats.attended + stats.late;
      stats.reliabilityScore =
        stats.totalEvents > 0 ? Math.round((reliableEvents / stats.totalEvents) * 100) : 0;
      leaderboard.push(stats);
    }

    // Sort by reliability score and return top users
    return leaderboard
      .sort((a, b) => {
        if (a.reliabilityScore !== b.reliabilityScore) {
          return b.reliabilityScore - a.reliabilityScore;
        }
        return b.totalEvents - a.totalEvents;
      })
      .slice(0, limit);
  }

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(activityId: string): Promise<{
    activity: Activity;
    stats: AttendanceStats;
    attendees: Array<{
      userId: string;
      status: AttendanceStatus;
      rsvpRole?: string;
      actualRole?: string;
      attendanceScore: number;
    }>;
  }> {
    const activity = await this.activityRepository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new Error('Activity not found');
    }

    const stats = await this.getActivityAttendanceStats(activityId);
    const confirmations = await this.repository.find({
      where: { eventId: activityId },
    });

    const attendees = confirmations.map((c: EventAttendanceConfirmation) => ({
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
