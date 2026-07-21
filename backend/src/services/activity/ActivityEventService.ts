import { In, LessThanOrEqual } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, ParticipantRole, RouteWaypoint } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import { VoiceChannelType } from '../../types';
import {
  ActivityNotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';
import { NotificationService, VoiceChannelService } from '../communication';
import { domainEvents } from '../shared/DomainEventBus';

import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';
import { ActivityReminderService } from './ActivityReminderService';

export interface CompletionReportDTO {
  actualDuration?: number;
  actualParticipants?: number;
  successRate?: number;
  creditsEarned?: number;
  reputationEarned?: number;
  notes?: string;
  screenshots?: string[];
  metadata?: Record<string, unknown>;
}

export interface VoiceChannelOptions {
  createVoiceChannel?: boolean;
  voiceChannelTemplate?: string;
  voiceChannelLimit?: number;
  voiceChannelBitrate?: number;
}

export interface DiscordEventCancellationResult {
  activityId: string;
  organizationId: string;
  participantCount: number;
  cancelledAt: string;
  wasCancelled: boolean;
}

interface CancellationLifecycleOptions {
  reason?: string;
  cancelledById: string;
  performedByName: string;
  source?: string;
  clearDiscordEventId?: boolean;
}

/**
 * ActivityEventService
 *
 * Handles event lifecycle and completion for activities
 * Phase 4.1 - Domain Separation
 *
 * Responsibilities:
 * - Activity status management and lifecycle
 * - Event completion and reporting
 * - Voice channel integration
 * - Route planning and waypoint management
 *
 * @author GitHub Copilot
 * @since October 2025
 */
export class ActivityEventService extends TenantService<Activity> {
  private readonly voiceChannelService: VoiceChannelService;
  private readonly participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
  private reminderService: ActivityReminderService | null = null;

  constructor() {
    super(AppDataSource.getRepository(Activity));
    this.voiceChannelService = VoiceChannelService.getInstance();
  }

  /**
   * Lazily resolve the reminder service. Constructed on first use (only when an
   * activity is cancelled) so importing this service never eagerly builds the
   * reminder/notification stack.
   */
  private getReminderService(): ActivityReminderService {
    this.reminderService ??= new ActivityReminderService(new NotificationService());
    return this.reminderService;
  }

  /**
   * Get user name from activity for audit logging
   */
  private async getUserNameFromActivity(activity: Activity, userId: string): Promise<string> {
    // Check if user is the creator
    if (activity.creatorId === userId && activity.creatorName) {
      return activity.creatorName;
    }
    // Check normalized participant table (indexed lookup)
    const participant = await this.participantRepo
      .createQueryBuilder('participant')
      .select(['participant.userName'])
      .where('participant.activityId = :activityId', { activityId: activity.id })
      .andWhere('participant.userId = :userId', { userId })
      .getOne();
    if (participant?.userName) {
      return participant.userName;
    }
    // Fallback to userId
    return userId;
  }

  private async findActivityById(
    activityId: string,
    organizationId?: string
  ): Promise<Activity | null> {
    const query = this.repository
      .createQueryBuilder('activity')
      .where('activity.id = :activityId', { activityId });

    if (organizationId) {
      query.andWhere('activity.organizationId = :organizationId', { organizationId });
    }

    return query.getOne();
  }

  private canStartFromStatus(status: ActivityStatus): boolean {
    return [
      ActivityStatus.DRAFT,
      ActivityStatus.OPEN,
      ActivityStatus.PLANNING,
      ActivityStatus.RECRUITING,
      ActivityStatus.READY,
    ].includes(status);
  }

  private async applyCancellationLifecycle(
    activity: Activity,
    options: CancellationLifecycleOptions
  ): Promise<{ activity: Activity; wasCancelled: boolean; cancelledAt: Date }> {
    const cancelledAt = new Date();
    const organizationId = activity.organizationId ?? '';

    // Re-evaluate the terminal-status guard against a freshly row-locked copy so two
    // concurrent cancellations (or a cancel racing another state transition) cannot both
    // perform the transition and double-fire the audit log / domain event (ACT-02). The
    // read-check-write happens under a pessimistic_write lock; side effects run after commit.
    const {
      activity: updatedActivity,
      wasCancelled,
      previousStatus,
    } = await this.withEntityLock(activity.id, async (locked, queryRunner) => {
      const activityRepo = queryRunner.manager.getRepository(Activity);

      if (
        locked.status === ActivityStatus.CANCELLED ||
        locked.status === ActivityStatus.COMPLETED
      ) {
        if (options.clearDiscordEventId && locked.discordEventId) {
          locked.discordEventId = undefined;
          locked.updatedAt = cancelledAt;
          const saved = await activityRepo.save(locked);
          return { activity: saved, wasCancelled: false, previousStatus: locked.status };
        }

        return { activity: locked, wasCancelled: false, previousStatus: locked.status };
      }

      const priorStatus = locked.status;
      locked.status = ActivityStatus.CANCELLED;
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

    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_CANCELLED,
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

    domainEvents.emit('activity:cancelled', {
      activityId: updatedActivity.id,
      organizationId,
      reason: options.reason,
      participantCount: updatedActivity.currentParticipants ?? 0,
      timestamp: cancelledAt.toISOString(),
    });

    logger.info(
      `Activity ${updatedActivity.id} cancelled by ${options.cancelledById}. Reason: ${options.reason ?? 'No reason provided'}`
    );

    // Cancel any pending reminders so they don't fire for a now-cancelled event.
    // Best-effort: the cancellation itself has already committed, so a reminder
    // failure must not fail (or roll back) the cancellation.
    try {
      await this.getReminderService().cancelActivityReminders(updatedActivity.id);
    } catch (error: unknown) {
      logger.warn(`Failed to cancel reminders for cancelled activity ${updatedActivity.id}`, error);
    }

    return { activity: updatedActivity, wasCancelled: true, cancelledAt };
  }

  // ==================== VOICE CHANNEL MANAGEMENT ====================

  /**
   * Create voice channel for activity
   */
  async createVoiceChannelForActivity(
    activityId: string,
    guildId: string,
    creatorUserId: string,
    options: VoiceChannelOptions
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    try {
      const channelName = `${activity.title} - ${activity.activityType}`;
      const channel = this.voiceChannelService.createChannel(
        channelName,
        guildId,
        `temp_${Date.now()}`,
        creatorUserId,
        VoiceChannelType.ACTIVITY,
        {
          userLimit: options.voiceChannelLimit ?? activity.maxParticipants ?? 10,
          eventId: activityId,
        }
      );

      // Link voice channel to activity
      activity.voiceChannelId = channel.id;
      activity.voiceChannelName = channel.name;
      activity.updatedAt = new Date();

      const updatedActivity = await this.repository.save(activity);

      // Log audit event
      activityAuditLogger.log({
        action: ActivityAuditAction.VOICE_CHANNEL_CREATED,
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

      logger.info(`Voice channel created for activity ${activityId}: ${channel.id}`);
      return updatedActivity;
    } catch (error: unknown) {
      logger.error(`Failed to create voice channel for activity ${activityId}:`, error);
      throw new BadRequestError('Failed to create voice channel for activity');
    }
  }

  /**
   * Link existing voice channel to activity
   */
  async linkVoiceChannel(
    activityId: string,
    channelId: string,
    _guildId: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    try {
      // Verify channel exists
      const channel = this.voiceChannelService.getChannel(channelId);
      if (!channel) {
        throw new NotFoundError('Voice channel');
      }

      activity.voiceChannelId = channelId;
      activity.voiceChannelName = channel.name;
      activity.updatedAt = new Date();

      const updatedActivity = await this.repository.save(activity);

      // Log audit event
      activityAuditLogger.log({
        action: ActivityAuditAction.VOICE_CHANNEL_LINKED,
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

      logger.info(`Voice channel ${channelId} linked to activity ${activityId}`);
      return updatedActivity;
    } catch (error: unknown) {
      logger.error(`Failed to link voice channel to activity ${activityId}:`, error);
      throw new BadRequestError('Failed to link voice channel to activity');
    }
  }

  // ==================== ROUTE PLANNING ====================

  /**
   * Add route plan to activity
   */
  async addRoutePlan(
    activityId: string,
    routePlan: RouteWaypoint[],
    userId: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if user has permission (creator or participant)
    const isCreator = activity.creatorId === userId;
    const participantCount = isCreator
      ? 1
      : await this.participantRepo.count({ where: { activityId, userId } });

    if (!isCreator && participantCount === 0) {
      throw new ForbiddenError('Only activity creator or participants can modify route plan');
    }

    // Validate route plan
    if (routePlan.length === 0) {
      throw new ValidationError('Route plan cannot be empty');
    }

    activity.routePlan = routePlan;
    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.ROUTE_ADDED,
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

    logger.info(`Route plan added to activity ${activityId} by ${userId}`);
    return updatedActivity;
  }

  /**
   * Update specific waypoint in route
   */
  async updateWaypoint(
    activityId: string,
    waypointIndex: number,
    waypoint: Partial<RouteWaypoint>,
    userId: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if user has permission
    const isCreator = activity.creatorId === userId;
    const hasAccess =
      isCreator || (await this.participantRepo.count({ where: { activityId, userId } })) > 0;

    if (!hasAccess) {
      throw new ForbiddenError('Only activity creator or participants can modify route plan');
    }

    if (!activity.routePlan || waypointIndex < 0 || waypointIndex >= activity.routePlan.length) {
      throw new ValidationError('Invalid waypoint index');
    }

    // Update waypoint
    Object.assign(activity.routePlan[waypointIndex], waypoint);
    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.WAYPOINT_UPDATED,
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

    logger.info(`Waypoint ${waypointIndex} updated in activity ${activityId} by ${userId}`);
    return updatedActivity;
  }

  // ==================== COMPLETION AND REPORTING ====================

  /**
   * Submit completion report for activity
   */
  async submitCompletionReport(
    activityId: string,
    report: CompletionReportDTO,
    userId: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Only creator or participants can submit completion reports
    const isCreator = activity.creatorId === userId;
    const hasAccess =
      isCreator || (await this.participantRepo.count({ where: { activityId, userId } })) > 0;

    if (!hasAccess) {
      throw new ForbiddenError(
        'Only activity creator or participants can submit completion report'
      );
    }

    const completedAt = new Date();
    const { activity: updatedActivity, skippedByConcurrentCompletion } = await this.withEntityLock(
      activity.id,
      async (locked, queryRunner) => {
        const activityRepo = queryRunner.manager.getRepository(Activity);

        // ACT-02: if this request observed a non-completed row but a concurrent request
        // already completed it before we acquired the lock, treat this as an idempotent
        // no-op to avoid double transition side effects.
        if (
          activity.status !== ActivityStatus.COMPLETED &&
          locked.status === ActivityStatus.COMPLETED
        ) {
          return {
            activity: locked,
            skippedByConcurrentCompletion: true,
          };
        }

        locked.status = ActivityStatus.COMPLETED;
        locked.actualDuration = report.actualDuration;
        locked.actualParticipants = report.actualParticipants ?? locked.currentParticipants;
        locked.completedAt = completedAt;
        locked.updatedAt = completedAt;

        // Spread-and-replace to ensure TypeORM detects the JSONB change.
        // See /memories/repo/typeorm-jsonb-pitfall.md
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
      }
    );

    if (skippedByConcurrentCompletion) {
      return updatedActivity;
    }

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.COMPLETION_REPORT_SUBMITTED,
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

    logger.info(`Completion report submitted for activity ${activityId} by ${userId}`);
    return updatedActivity;
  }

  /**
   * Start activity (change status to active)
   */
  async startActivity(activityId: string, userId: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Only creator can start activity
    if (activity.creatorId !== userId) {
      throw new ForbiddenError('Only activity creator can start the activity');
    }

    // Can only start pre-launch lifecycle states
    if (!this.canStartFromStatus(activity.status)) {
      throw new ValidationError('Activity cannot be started in its current status');
    }

    const startedAt = new Date();
    const {
      activity: updatedActivity,
      wasStarted,
      previousStatus,
    } = await this.withEntityLock(activity.id, async (locked, queryRunner) => {
      const activityRepo = queryRunner.manager.getRepository(Activity);

      if (locked.status === ActivityStatus.IN_PROGRESS) {
        return {
          activity: locked,
          wasStarted: false,
          previousStatus: locked.status,
        };
      }

      if (!this.canStartFromStatus(locked.status)) {
        throw new ValidationError('Activity cannot be started in its current status');
      }

      const priorStatus = locked.status;
      locked.status = ActivityStatus.IN_PROGRESS;
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

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_STARTED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: userId,
      performedByName: await this.getUserNameFromActivity(activity, userId),
      details: {
        previousStatus,
        newStatus: ActivityStatus.IN_PROGRESS,
        startedAt,
      },
    });

    logger.info(`Activity ${activityId} started by ${userId}`);
    return updatedActivity;
  }

  /**
   * Cancel activity
   */
  async cancelActivity(
    activityId: string,
    userId: string,
    reason?: string,
    organizationId?: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId, organizationId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Only creator can cancel activity
    if (activity.creatorId !== userId) {
      throw new ForbiddenError('Only activity creator can cancel the activity');
    }

    // Cannot cancel completed activities
    if (activity.status === ActivityStatus.COMPLETED) {
      throw new ValidationError('Cannot cancel a completed activity');
    }

    const { activity: updatedActivity } = await this.applyCancellationLifecycle(activity, {
      reason,
      cancelledById: userId,
      performedByName: await this.getUserNameFromActivity(activity, userId),
    });

    return updatedActivity;
  }

  /**
   * Cancel an activity from internal orchestration paths where creator ownership
   * has already been validated by the caller's workflow.
   */
  async cancelActivityAsSystem(
    organizationId: string,
    activityId: string,
    cancelledById: string,
    reason?: string
  ): Promise<Activity> {
    const activity = await this.repository
      .createQueryBuilder('activity')
      .where('activity.id = :activityId', { activityId })
      .andWhere('activity.organizationId = :organizationId', { organizationId })
      .getOne();

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (activity.status === ActivityStatus.COMPLETED) {
      throw new ValidationError('Cannot cancel a completed activity');
    }

    const { activity: updatedActivity } = await this.applyCancellationLifecycle(activity, {
      reason,
      cancelledById,
      performedByName: await this.getUserNameFromActivity(activity, cancelledById),
      source: 'system_orchestration',
    });

    return updatedActivity;
  }

  /**
   * Cancel an activity when the linked Discord scheduled event is cancelled/deleted.
   * Uses canonical ActivityEventService lifecycle handling so audit metadata and
   * domain events stay aligned with app-initiated cancellations.
   */
  async cancelFromDiscordEvent(
    discordEventId: string,
    reason: string
  ): Promise<DiscordEventCancellationResult | null> {
    const activity = await this.repository
      .createQueryBuilder('activity')
      .where('activity.discordEventId = :discordEventId', { discordEventId })
      .getOne();

    if (!activity) {
      return null;
    }

    const {
      activity: updatedActivity,
      wasCancelled,
      cancelledAt,
    } = await this.applyCancellationLifecycle(activity, {
      reason,
      cancelledById: 'system:discord',
      performedByName: 'Discord Scheduled Event',
      source: 'discord_scheduled_event',
      clearDiscordEventId: true,
    });

    const organizationId = updatedActivity.organizationId ?? '';

    if (wasCancelled) {
      logger.info(
        `Activity ${updatedActivity.id} cancelled via Discord scheduled event ${discordEventId}. Reason: ${reason}`
      );
    }

    return {
      activityId: updatedActivity.id,
      organizationId,
      participantCount: updatedActivity.currentParticipants ?? 0,
      cancelledAt: cancelledAt.toISOString(),
      wasCancelled,
    };
  }

  /**
   * Reschedule activity
   */
  async rescheduleActivity(
    activityId: string,
    newStartDate: Date,
    userId: string,
    newEndDate?: Date,
    rescheduleReason?: string
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Only creator can reschedule
    if (userId && activity.creatorId !== userId) {
      throw new ForbiddenError('Only activity creator can reschedule the activity');
    }

    // Cannot reschedule completed or cancelled activities
    if (
      activity.status === ActivityStatus.COMPLETED ||
      activity.status === ActivityStatus.CANCELLED
    ) {
      throw new ValidationError('Cannot reschedule a completed or cancelled activity');
    }

    // Store previous dates for history and audit
    const previousStartDate = activity.scheduledStartDate;
    const previousEndDate = activity.scheduledEndDate;

    activity.scheduledStartDate = newStartDate;
    if (newEndDate) {
      activity.scheduledEndDate = newEndDate;
    }
    activity.updatedAt = new Date();

    // Store reschedule history
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
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

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_RESCHEDULED,
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

    // Emit domain event so listeners (e.g. Discord scheduled-event sync) can react.
    domainEvents.emit('activity:rescheduled', {
      activityId,
      organizationId: activity.organizationId ?? '',
      previousStartDate: previousStartDate ? previousStartDate.toISOString() : undefined,
      newStartDate: newStartDate.toISOString(),
      newEndDate: newEndDate ? newEndDate.toISOString() : undefined,
      reason: rescheduleReason,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Activity ${activityId} rescheduled to ${newStartDate.toISOString()}`);
    return updatedActivity;
  }

  // ==================== EVENT AUTOMATION ====================

  /**
   * Auto-start activities that are scheduled to begin
   */
  async autoStartScheduledActivities(): Promise<number> {
    const now = new Date();
    const activities = await this.repository.find({
      where: {
        status: In([
          ActivityStatus.OPEN,
          ActivityStatus.PLANNING,
          ActivityStatus.RECRUITING,
          ActivityStatus.READY,
        ]),
        scheduledStartDate: LessThanOrEqual(now),
      },
    });

    let startedCount = 0;
    for (const activity of activities) {
      try {
        await this.startActivity(activity.id, activity.creatorId);
        startedCount++;
      } catch (error: unknown) {
        logger.error(`Failed to auto-start activity ${activity.id}:`, error);
      }
    }

    if (startedCount > 0) {
      logger.info(`Auto-started ${startedCount} scheduled activities`);
    }

    return startedCount;
  }

  /**
   * Auto-complete activities that have passed their end time
   */
  async autoCompleteOverdueActivities(): Promise<number> {
    const now = new Date();
    const overdueHours = 2; // Auto-complete activities that are 2 hours overdue
    const overdueTime = new Date(now.getTime() - overdueHours * 60 * 60 * 1000);

    const activities = await this.repository.find({
      where: {
        status: ActivityStatus.IN_PROGRESS,
        scheduledEndDate: LessThanOrEqual(overdueTime),
      },
    });

    let completedCount = 0;
    for (const activity of activities) {
      try {
        await this.submitCompletionReport(
          activity.id,
          {
            notes: 'Auto-completed due to overdue status',
            metadata: { autoCompleted: true, autoCompletedAt: now },
          },
          activity.creatorId
        );
        completedCount++;
      } catch (error: unknown) {
        logger.error(`Failed to auto-complete activity ${activity.id}:`, error);
      }
    }

    if (completedCount > 0) {
      logger.info(`Auto-completed ${completedCount} overdue activities`);
    }

    return completedCount;
  }

  // ==================== WAITLIST & RSVP OPERATIONS ====================

  /**
   * Join waitlist when activity is full
   */
  async joinWaitlist(activityId: string, userId: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (!activity.isFull) {
      throw new ValidationError(
        'Activity is not full - please join directly instead of joining waitlist'
      );
    }

    if (activity.waitlist.includes(userId)) {
      throw new ConflictError('You are already on the waitlist for this activity');
    }

    const alreadyJoined = (await this.participantRepo.count({ where: { activityId, userId } })) > 0;
    if (alreadyJoined) {
      throw new ConflictError('You are already a participant in this activity');
    }

    // Spread-and-replace to ensure TypeORM detects the simple-json change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.waitlist = [...activity.waitlist, userId];

    const saved = await this.repository.save(activity);
    logger.info(`User ${userId} added to waitlist for activity ${activityId}`);

    return saved;
  }

  /**
   * Leave waitlist
   */
  async leaveWaitlist(activityId: string, userId: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const index = activity.waitlist.indexOf(userId);
    if (index === -1) {
      throw new ValidationError('You are not on the waitlist');
    }

    // Spread-and-replace to ensure TypeORM detects the simple-json change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.waitlist = activity.waitlist.filter((_, i) => i !== index);

    const saved = await this.repository.save(activity);
    logger.info(`User ${userId} removed from waitlist for activity ${activityId}`);

    return saved;
  }

  /**
   * Promote from waitlist when slot becomes available
   */
  async promoteFromWaitlist(activityId: string, userId?: string): Promise<Activity> {
    const activity = await this.findActivityById(activityId);
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (activity.waitlist.length === 0) {
      throw new ValidationError('Waitlist is empty');
    }

    const nextUserId = userId ?? activity.waitlist[0];
    const index = activity.waitlist.indexOf(nextUserId);

    if (index === -1) {
      throw new NotFoundError('User on waitlist');
    }

    // Spread-and-replace to ensure TypeORM detects the simple-json change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.waitlist = activity.waitlist.filter((_, i) => i !== index);

    // Add participant via normalized table (Phase 4)
    const newRow = this.participantRepo.create({
      activityId,
      userId: nextUserId,
      userName: 'Waitlist User',
      role: ParticipantRole.MEMBER,
      status: ActivityParticipantStatus.STANDBY,
      joinedAt: new Date(),
    });
    await this.participantRepo.save(newRow);
    activity.currentParticipants = (activity.currentParticipants || 0) + 1;

    const saved = await this.repository.save(activity);
    logger.info(`User ${nextUserId} promoted from waitlist for activity ${activityId}`);

    return saved;
  }

  /**
   * Update RSVP status for event participants
   */
  async updateRSVPStatus(
    activityId: string,
    userId: string,
    status: 'accepted' | 'declined' | 'standby',
    role?: ParticipantRole
  ): Promise<Activity> {
    const activity = await this.findActivityById(activityId);
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Verify participant exists via normalized table
    const exists = await this.participantRepo.count({ where: { activityId, userId } });
    if (exists === 0) {
      throw new NotFoundError('Participant');
    }

    // Update status (and optionally role) in normalized table
    const updateFields: Record<string, unknown> = { status };
    if (role) {
      updateFields.role = role;
    }
    await this.participantRepo.update({ activityId, userId }, updateFields);

    // Recount accepted participants from normalized table
    activity.currentParticipants = await this.participantRepo.count({
      where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
    });

    const saved = await this.repository.save(activity);

    logger.info(`RSVP updated for user ${userId} in activity ${activityId}: ${status}`);

    activityAuditLogger.log({
      action: ActivityAuditAction.PARTICIPANT_ROLE_CHANGED,
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
