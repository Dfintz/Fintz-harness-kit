import { AppDataSource } from '../../data-source';
import { Activity, ActivityParticipant } from '../../models/Activity';
import { ActivityParticipantStatus } from '../../models/ActivityParticipant';
import { Team } from '../../models/Team';
import { TeamMember } from '../../models/TeamMember';
import { NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { ActivityEventService } from '../activity/ActivityEventService';
import { ActivityParticipantService } from '../activity/ActivityParticipantService';
import { ActivityService } from '../activity/ActivityService';
import { AvailabilityService } from '../calendar/AvailabilityService';
import { NotificationResult, NotificationService } from '../communication';
import { DiscordService, getDiscordService } from '../discord/DiscordService';
import { UserService } from '../user/UserService';

interface ActivityTeamBreakdown {
  teamId: string;
  teamName: string;
  teamType: string;
  memberCount: number;
}

/**
 * Discord message result
 */
interface DiscordMessageResult {
  id: string;
  channelId: string;
  content: string;
}

export interface AggregatorWarning {
  code: string;
  stage: 'event' | 'notification' | 'discord' | 'attendance' | 'participant';
  message: string;
  details?: Record<string, unknown>;
}

interface NotificationDispatchResult {
  notifications: NotificationResult[];
  total: number;
  failed: number;
}

/**
 * Activity creation parameters
 */
export interface CreateActivityWithParticipantsParams {
  organizationId: string;
  activityData: {
    title: string;
    description?: string;
    activityType: string;
    scheduledStartDate: Date;
    scheduledEndDate?: Date;
    maxParticipants?: number;
    creatorId: string;
    [key: string]: unknown;
  };
  participantIds?: string[];
  notifyParticipants?: boolean;
  postToDiscord?: boolean;
  discordChannelId?: string;
}

/**
 * Activity completion parameters
 */
export interface CompleteActivityParams {
  organizationId: string;
  activityId: string;
  completedById: string;
  outcome?: 'success' | 'failed' | 'cancelled';
  summary?: string;
  participantReports?: {
    userId: string;
    attended: boolean;
    contribution?: string;
  }[];
  notifyParticipants?: boolean;
}

/**
 * Personal activity completion parameters (no organization scope)
 */
export interface CompletePersonalActivityParams {
  activity: Activity;
  completedById: string;
  outcome?: 'success' | 'failed' | 'cancelled';
  summary?: string;
  participantReports?: {
    userId: string;
    attended: boolean;
    contribution?: string;
  }[];
  notifyParticipants?: boolean;
}

/**
 * Activity Aggregator Service
 *
 * Handles complex multi-service operations for activities:
 * - Creating activities with participants and notifications
 * - Completing activities with attendance tracking
 * - Cancelling activities with cleanup
 * - Activity lifecycle management
 */
export class ActivityAggregatorService {
  private readonly activityService: ActivityService;
  private readonly participantService: ActivityParticipantService;
  private readonly eventService: ActivityEventService;
  private readonly notificationService: NotificationService;
  private readonly discordService: DiscordService;
  private readonly userService: UserService;
  private readonly availabilityService: AvailabilityService;

  constructor() {
    this.activityService = new ActivityService();
    this.participantService = new ActivityParticipantService();
    this.eventService = new ActivityEventService();
    this.notificationService = new NotificationService(undefined, undefined);
    this.discordService = getDiscordService();
    this.userService = new UserService();
    this.availabilityService = new AvailabilityService();
  }

  private getErrorLogContext(error: unknown): { message: string; name?: string; stack?: string } {
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

    if (
      typeof error === 'number' ||
      typeof error === 'boolean' ||
      error === null ||
      error === undefined
    ) {
      let message = `${error}`;
      if (error === null) {
        message = 'null';
      } else if (error === undefined) {
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

  private getAttendanceFlagFromNotes(notes?: string): boolean | undefined {
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

  private addWarning(warnings: AggregatorWarning[], warning: AggregatorWarning): void {
    warnings.push(warning);
    logger.warn('Activity aggregator completed with warning', warning);
  }

  private async recordCreationEvent(
    params: CreateActivityWithParticipantsParams,
    activity: Activity,
    warnings: AggregatorWarning[]
  ): Promise<void> {
    try {
      await this.eventService.create(params.organizationId, {
        activity: { id: activity.id },
        eventType: 'created',
        userId: params.activityData.creatorId,
        description: `Activity "${params.activityData.title}" created`,
        timestamp: new Date(),
      } as Record<string, unknown>);
    } catch (error: unknown) {
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

  private async postCreateDiscordAnnouncement(
    params: CreateActivityWithParticipantsParams,
    activityId: string,
    warnings: AggregatorWarning[]
  ): Promise<void> {
    if (!params.postToDiscord || !params.discordChannelId) {
      return;
    }

    try {
      const messageContent = `📅 New Activity: **${params.activityData.title}**\n${params.activityData.description ?? 'No description'}\nType: ${params.activityData.activityType}`;
      await this.discordService.sendMessage(params.discordChannelId, messageContent);
      logger.info('Discord message posted', { channelId: params.discordChannelId });
    } catch (error: unknown) {
      logger.error('Failed to post to Discord', {
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

  private async addParticipantsToActivity(
    params: CreateActivityWithParticipantsParams,
    activity: Activity,
    warnings: AggregatorWarning[]
  ): Promise<{ activity: Activity; participants: ActivityParticipant[] }> {
    const participants: ActivityParticipant[] = [];

    if (!params.participantIds || params.participantIds.length === 0) {
      return { activity, participants };
    }

    let currentActivity = activity;
    for (const userId of params.participantIds) {
      let user: Awaited<ReturnType<UserService['getUserById']>>;
      try {
        user = await this.userService.getUserById(userId);
      } catch (error: unknown) {
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
        logger.warn(`User ${userId} not found, skipping participant`);
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
        const { activity: updatedActivity } = await this.participantService.joinActivity(
          currentActivity.id,
          {
            userId: user.id,
            userName: user.username || user.email,
            organizationId: params.organizationId,
          }
        );

        const addedParticipant = await this.participantService.getParticipant(
          currentActivity.id,
          userId
        );
        if (addedParticipant) {
          participants.push(addedParticipant);
        }

        currentActivity = updatedActivity;
      } catch (error: unknown) {
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
      logger.info('Participants added', { count: participants.length });
    }

    return {
      activity: currentActivity,
      participants,
    };
  }

  /**
   * Create activity with participants and notifications via best-effort orchestration
   */
  async createActivityWithParticipants(params: CreateActivityWithParticipantsParams): Promise<{
    activity: Activity;
    participants: ActivityParticipant[];
    notifications: NotificationResult[];
    warnings: AggregatorWarning[];
    discordMessage?: DiscordMessageResult;
    availabilityConflicts?: Array<{ userId: string; available: boolean }>;
  }> {
    try {
      // This flow coordinates multiple services and side effects, so it is intentionally
      // best-effort orchestration rather than a single DB transaction.

      // 1. Create the activity
      const activityData = {
        ...params.activityData,
        activityType: params.activityData.activityType,
        organizationId: params.organizationId,
      };
      let activity = await this.activityService.create(
        params.organizationId,
        activityData as Record<string, unknown>
      );

      logger.info('Activity created', {
        activityId: activity.id,
        organizationId: params.organizationId,
      });

      // 2. Add participants if provided
      const warnings: AggregatorWarning[] = [];
      const participantJoinResult = await this.addParticipantsToActivity(
        params,
        activity,
        warnings
      );
      activity = participantJoinResult.activity;
      const participants = participantJoinResult.participants;

      // 3. Check participant availability conflicts (advisory, non-blocking)
      const availabilityConflicts = await this.checkAvailabilityConflicts(params);

      // 4. Create activity event
      await this.recordCreationEvent(params, activity, warnings);

      // 5. Send notifications only for participants that were successfully resolved/added
      const participantNotificationResult = await this.sendParticipantNotifications(
        params,
        activity,
        participants.map(participant => participant.userId)
      );
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

      // 6. Post to Discord if requested
      await this.postCreateDiscordAnnouncement(params, activity.id, warnings);

      return {
        activity,
        participants,
        notifications,
        warnings,
        availabilityConflicts,
      };
    } catch (error: unknown) {
      logger.error('Failed to create activity with participants', {
        error: this.getErrorLogContext(error),
      });
      throw error;
    }
  }

  /**
   * Check availability conflicts for participants (advisory, non-blocking)
   */
  private async checkAvailabilityConflicts(
    params: CreateActivityWithParticipantsParams
  ): Promise<Array<{ userId: string; available: boolean }> | undefined> {
    if (
      !params.activityData.scheduledStartDate ||
      !params.participantIds ||
      params.participantIds.length === 0
    ) {
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

      const availMap = await this.availabilityService.getAvailabilityForUsers(
        params.organizationId,
        params.participantIds
      );

      return params.participantIds.map(userId => {
        const slots = availMap.get(userId) ?? [];
        const available = slots.some(
          s => s.dayOfWeek === dayOfWeek && s.startMinute <= startMinute && s.endMinute >= endMinute
        );
        return { userId, available };
      });
    } catch (err: unknown) {
      logger.warn('Failed to check availability conflicts', {
        error: this.getErrorLogContext(err),
      });
      return undefined;
    }
  }

  /**
   * Send notifications to activity participants
   */
  private async sendParticipantNotifications(
    params: CreateActivityWithParticipantsParams,
    activity: Activity,
    participantIds: string[]
  ): Promise<NotificationDispatchResult> {
    if (!params.notifyParticipants || participantIds.length === 0) {
      return {
        notifications: [],
        total: 0,
        failed: 0,
      };
    }

    const notificationPromises = participantIds.map(userId =>
      Promise.resolve().then(() =>
        this.notificationService.create({
          userId,
          type: 'activity_invitation',
          title: 'Activity Invitation',
          message: `You've been invited to: ${params.activityData.title}`,
          data: { activityId: activity.id, organizationId: params.organizationId },
        })
      )
    );

    const results = await Promise.allSettled(notificationPromises);
    const notifications: NotificationResult[] = [];
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          notifications.push(result.value);
        } else {
          failed += 1;
          logger.error('Failed to send notification', {
            userId: participantIds[index],
            error: result.value.error ?? 'Notification service reported failure',
          });
        }
      } else {
        failed += 1;
        logger.error('Failed to send notification', {
          userId: participantIds[index],
          error: this.getErrorLogContext(result.reason),
        });
      }
    });

    logger.info('Notifications sent', {
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

  /**
   * Update participant notes with attendance reports
   * @private
   */
  private async updateParticipantAttendance(
    activityId: string,
    participantReports: Array<{ userId: string; attended: boolean; contribution?: string }>
  ): Promise<{ updatedParticipants: ActivityParticipant[]; failedUserIds: string[] }> {
    const failedUserIds: string[] = [];

    // Persist attendance markers in notes for backward-compatible storage.
    for (const report of participantReports) {
      const attendancePrefix = report.attended ? '[attendance:true]' : '[attendance:false]';
      const notes = report.contribution
        ? `${attendancePrefix} ${report.contribution}`
        : attendancePrefix;

      try {
        const affectedRows = await this.participantService.updateParticipant(
          activityId,
          report.userId,
          {
            notes,
          }
        );

        if (affectedRows === 0) {
          failedUserIds.push(report.userId);
          logger.warn('Participant attendance update skipped; participant not found', {
            activityId,
            userId: report.userId,
          });
        }
      } catch (error: unknown) {
        failedUserIds.push(report.userId);
        logger.error('Participant attendance update failed', {
          activityId,
          userId: report.userId,
          error: this.getErrorLogContext(error),
        });
      }
    }

    let updatedParticipants: ActivityParticipant[] = [];
    try {
      // Reload updated participants from normalized table
      const updatedRows = await this.participantService.getParticipants(activityId);
      updatedParticipants = updatedRows;
    } catch (error: unknown) {
      logger.error('Failed to reload participants after attendance updates', {
        activityId,
        error: this.getErrorLogContext(error),
      });
    }

    logger.info('Participant attendance updated', {
      count: updatedParticipants.length,
      failed: failedUserIds.length,
    });
    return { updatedParticipants, failedUserIds };
  }

  /**
   * Send completion notifications to all participants
   * @private
   */
  private async sendCompletionNotifications(
    activityId: string,
    activityTitle: string,
    outcome?: string
  ): Promise<NotificationDispatchResult> {
    const notifications: NotificationResult[] = [];

    // Fetch participant list from normalized table for notifications
    const participantRows = await this.participantService.getParticipants(activityId);

    // Send all notifications in parallel using Promise.allSettled
    const notificationPromises = participantRows.map(participant =>
      Promise.resolve().then(() =>
        this.notificationService.create({
          userId: participant.userId,
          type: 'activity_completed',
          title: 'Activity Completed',
          message: `Activity "${activityTitle}" has been completed`,
          data: {
            activityId,
            outcome,
          },
        })
      )
    );

    const results = await Promise.allSettled(notificationPromises);
    let failed = 0;

    // Collect successful notifications and log failures
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          notifications.push(result.value);
        } else {
          failed += 1;
          logger.error('Failed to send completion notification', {
            userId: participantRows[index]?.userId,
            error: result.value.error ?? 'Notification service reported failure',
          });
        }
      } else {
        failed += 1;
        logger.error('Failed to send completion notification', {
          userId: participantRows[index]?.userId,
          error: this.getErrorLogContext(result.reason),
        });
      }
    });

    logger.info('Completion notifications sent', {
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

  /**
   * Complete activity with attendance tracking and notifications
   */
  async completeActivity(params: CompleteActivityParams): Promise<{
    activity: Activity;
    updatedParticipants: ActivityParticipant[];
    notifications: NotificationResult[];
    warnings: AggregatorWarning[];
  }> {
    try {
      const warnings: AggregatorWarning[] = [];

      // 1. Update activity status
      const activity = await this.activityService.update(params.organizationId, params.activityId, {
        status: 'completed',
        completedAt: new Date(),
        outcome: params.outcome ?? 'success',
        summary: params.summary,
      } as Record<string, unknown>);

      if (!activity) {
        throw new NotFoundError('Activity');
      }

      logger.info('Activity completed', {
        activityId: params.activityId,
        outcome: params.outcome,
      });

      // 2. Update participant attendance
      let updatedParticipants: ActivityParticipant[] = [];
      if (params.participantReports && params.participantReports.length > 0) {
        const attendanceResult = await this.updateParticipantAttendance(
          params.activityId,
          params.participantReports
        );
        updatedParticipants = attendanceResult.updatedParticipants;

        if (attendanceResult.failedUserIds.length > 0) {
          this.addWarning(warnings, {
            code: 'ATTENDANCE_PARTIAL_FAILURE',
            stage: 'attendance',
            message:
              'Activity completion succeeded but attendance updates failed for one or more participants.',
            details: {
              activityId: params.activityId,
              failedUserIds: attendanceResult.failedUserIds,
            },
          });
        }
      }

      // 3. Create completion event
      try {
        await this.eventService.create(params.organizationId, {
          activity: { id: params.activityId },
          eventType: 'completed',
          userId: params.completedById,
          description: `Activity completed with outcome: ${params.outcome ?? 'success'}`,
          timestamp: new Date(),
        } as Record<string, unknown>);
      } catch (error: unknown) {
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

      // 4. Send completion notifications (parallel for performance)
      let completionNotificationResult: NotificationDispatchResult = {
        notifications: [],
        total: 0,
        failed: 0,
      };
      if (params.notifyParticipants) {
        try {
          completionNotificationResult = await this.sendCompletionNotifications(
            params.activityId,
            activity.title,
            params.outcome
          );
        } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error('Failed to complete activity', {
        error: this.getErrorLogContext(error),
      });
      throw error;
    }
  }

  /**
   * Complete a personal (no-org) activity.
   * Lifecycle completion is written first, then attendance/reporting side effects
   * are applied as best-effort follow-up operations.
   */
  async completePersonalActivity(params: CompletePersonalActivityParams): Promise<{
    activity: Activity;
    updatedParticipants: ActivityParticipant[];
    notifications: NotificationResult[];
    warnings: AggregatorWarning[];
  }> {
    try {
      const warnings: AggregatorWarning[] = [];

      let successRate: number | undefined;
      if (params.outcome === 'success') {
        successRate = 100;
      } else if (params.outcome !== undefined) {
        successRate = 0;
      }

      const completedActivity = await this.eventService.submitCompletionReport(
        params.activity.id,
        {
          actualParticipants: params.activity.currentParticipants,
          successRate,
          notes: params.summary,
          metadata: {
            source: 'personal_complete_full_fallback',
            ...(params.outcome ? { outcome: params.outcome } : {}),
          },
        },
        params.completedById
      );

      let updatedParticipants: ActivityParticipant[] = [];
      if (params.participantReports && params.participantReports.length > 0) {
        const attendanceResult = await this.updateParticipantAttendance(
          params.activity.id,
          params.participantReports
        );
        updatedParticipants = attendanceResult.updatedParticipants;

        if (attendanceResult.failedUserIds.length > 0) {
          this.addWarning(warnings, {
            code: 'ATTENDANCE_PARTIAL_FAILURE',
            stage: 'attendance',
            message:
              'Activity completion succeeded but attendance updates failed for one or more participants.',
            details: {
              activityId: params.activity.id,
              failedUserIds: attendanceResult.failedUserIds,
            },
          });
        }
      } else {
        try {
          updatedParticipants = await this.participantService.getParticipants(params.activity.id);
        } catch (error: unknown) {
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

      let completionNotificationResult: NotificationDispatchResult = {
        notifications: [],
        total: 0,
        failed: 0,
      };

      if (params.notifyParticipants) {
        try {
          completionNotificationResult = await this.sendCompletionNotifications(
            params.activity.id,
            completedActivity.title,
            params.outcome
          );
        } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error('Failed to complete personal activity', {
        activityId: params.activity.id,
        error: this.getErrorLogContext(error),
      });
      throw error;
    }
  }

  /**
   * Cancel activity with cleanup and notifications
   */
  async cancelActivity(
    organizationId: string,
    activityId: string,
    cancelledById: string,
    reason?: string,
    notifyParticipants: boolean = true
  ): Promise<{
    activity: Activity;
    notifications: NotificationResult[];
    warnings: AggregatorWarning[];
  }> {
    try {
      const warnings: AggregatorWarning[] = [];

      // 1. Update activity status
      const activity = await this.eventService.cancelActivityAsSystem(
        organizationId,
        activityId,
        cancelledById,
        reason
      );

      logger.info('Activity cancelled', { activityId, reason });

      // 2. Cancellation is reflected in Activity.status = CANCELLED
      // Preserve original participant RSVP statuses for historical record

      // 3. Create cancellation event
      try {
        await this.eventService.create(organizationId, {
          activity: { id: activityId },
          eventType: 'cancelled',
          userId: cancelledById,
          description: reason ?? 'Activity cancelled',
          timestamp: new Date(),
        } as Record<string, unknown>);
      } catch (error: unknown) {
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

      // 4. Send cancellation notifications (parallel for performance)
      const notifications: NotificationResult[] = [];
      if (notifyParticipants) {
        try {
          // Query participants from normalized table (Phase 4)
          const participantRows = await this.participantService.getParticipants(activityId);

          const notificationPromises = participantRows.map(participant =>
            Promise.resolve().then(() =>
              this.notificationService.create({
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
              })
            )
          );

          const results = await Promise.allSettled(notificationPromises);
          let failedNotifications = 0;

          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              if (result.value.success) {
                notifications.push(result.value);
              } else {
                failedNotifications += 1;
                logger.error('Failed to send cancellation notification', {
                  userId: participantRows[index]?.userId,
                  error: result.value.error ?? 'Notification service reported failure',
                });
              }
            } else {
              failedNotifications += 1;
              logger.error('Failed to send cancellation notification', {
                userId: participantRows[index]?.userId,
                error: this.getErrorLogContext(result.reason),
              });
            }
          });

          logger.info('Cancellation notifications sent', {
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
        } catch (error: unknown) {
          this.addWarning(warnings, {
            code: 'CANCELLATION_NOTIFICATION_DISPATCH_FAILED',
            stage: 'notification',
            message:
              'Activity cancellation succeeded but participant notification dispatch failed.',
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
    } catch (error: unknown) {
      logger.error('Failed to cancel activity', {
        error: this.getErrorLogContext(error),
      });
      throw error;
    }
  }

  /**
   * Get activity with full details (participants, events, etc.)
   */
  async getActivityWithDetails(
    organizationId: string,
    activityId: string
  ): Promise<{
    activity: Activity;
    participants: ActivityParticipant[];
    events: unknown[];
    stats: {
      totalParticipants: number;
      confirmedParticipants: number;
      attendedParticipants: number;
      completionRate: number;
    };
    teamBreakdown?: ActivityTeamBreakdown[];
  }> {
    const activity = await this.activityService.findById(organizationId, activityId);

    if (!activity) {
      throw new NotFoundError('Activity');
    }

    // Participant stats from normalized table (Phase 4)
    const totalParticipants = await this.participantService.getParticipantCount(activityId);
    const confirmedCount = await this.participantService.getParticipantCount(
      activityId,
      ActivityParticipantStatus.ACCEPTED
    );

    const events = await this.eventService.findAll(organizationId, {
      where: {
        activity: { id: activityId } as Record<string, unknown>,
      },
    } as Record<string, unknown>);

    // Load participant data from normalized table for team breakdown
    const participantRows = await this.participantService.getParticipants(activityId);
    const participantUserIds = participantRows.map(p => p.userId);

    const attendanceFlags = participantRows
      .map(participant => this.getAttendanceFlagFromNotes(participant.notes))
      .filter((flag): flag is boolean => typeof flag === 'boolean');

    const attendedParticipants =
      attendanceFlags.length > 0 ? attendanceFlags.filter(Boolean).length : confirmedCount;

    const stats = {
      totalParticipants,
      confirmedParticipants: confirmedCount,
      attendedParticipants,
      completionRate:
        totalParticipants > 0 ? Math.round((confirmedCount / totalParticipants) * 100) : 0,
    };

    // Cross-reference participants with teams
    // Phase 1.4: Use direct teamId FK when available, fall back to participant inference
    let teamBreakdown: ActivityTeamBreakdown[] | undefined;
    try {
      if (activity.teamId) {
        // Direct FK lookup — activity is explicitly assigned to a team
        const teamRepo = AppDataSource.getRepository(Team);
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
      } else {
        // Fallback: infer team membership from participant userIds
        const participantIds = participantUserIds;
        if (participantIds.length > 0) {
          const teamMemberRepo = AppDataSource.getRepository(TeamMember);
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
            .getRawMany<{
              teamId: string;
              teamName: string;
              teamType: string;
              memberCount: string;
            }>();

          if (teamMemberships.length > 0) {
            teamBreakdown = teamMemberships.map(
              (t: { teamId: string; teamName: string; teamType: string; memberCount: string }) => ({
                teamId: t.teamId,
                teamName: t.teamName,
                teamType: t.teamType,
                memberCount: Number.parseInt(t.memberCount, 10),
              })
            );
          }
        }
      }
    } catch (err: unknown) {
      logger.warn('Failed to load team breakdown for activity details', {
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

