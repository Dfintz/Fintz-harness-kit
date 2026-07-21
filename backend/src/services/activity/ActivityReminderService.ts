import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';
import {
  ActivityReminder,
  DeliveryStatus,
  ReminderChannel,
  ReminderType,
} from '../../models/ActivityReminder';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';
import { NotificationService } from '../communication';

/**
 * Parameters for creating a reminder
 */
export interface CreateReminderParams {
  activityId?: string; // Primary field name (Activity domain)
  eventId?: string; // Legacy field name (Event domain, deprecated)
  reminderType: ReminderType;
  channel: ReminderChannel;
  scheduledTime?: Date; // Optional, will be calculated if not provided
  recipientUserIds?: string[];
  recipientEmails?: string[];
  discordChannelId?: string;
  messageTemplate?: string;
  createdBy?: string;
}

/**
 * Reminder statistics
 */
export interface ReminderStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
}

/**
 * Result of processing due reminders
 */
export interface ProcessRemindersResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * ActivityReminderService
 *
 * Manages reminders for activities (primarily EVENT type activities).
 * Migrated from EventReminderService as part of Activity domain consolidation.
 *
 * Responsibilities:
 * - Create and manage reminders for activities
 * - Send due reminders via configured channels
 * - Track reminder delivery status
 * - Retry failed reminders
 *
 * @author GitHub Copilot
 * @since Activity Domain Consolidation (Q4 2025)
 */
export class ActivityReminderService {
  private reminderRepository: Repository<ActivityReminder>;
  private activityRepository: Repository<Activity>;
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.reminderRepository = AppDataSource.getRepository(ActivityReminder);
    this.activityRepository = AppDataSource.getRepository(Activity);
    this.notificationService = notificationService;
  }

  /**
   * Get activity data for reminder context
   * @param activityId - The Activity ID
   * @returns Activity data formatted for reminder use, or null if not found
   */
  private async getActivityData(activityId: string): Promise<{
    id: string;
    title: string;
    date: Date;
    location: string;
    organizationId?: string;
    description?: string;
    organizerId?: string;
  } | null> {
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (activity) {
      return {
        id: activity.id,
        title: activity.title,
        date: activity.scheduledStartDate || new Date(),
        location: activity.location || 'TBD',
        organizationId: activity.organizationId ?? undefined,
        description: activity.description,
        organizerId: activity.creatorId,
      };
    }

    return null;
  }

  /**
   * Create automated reminders for an activity
   * @param activityId - Activity ID to create reminders for
   * @param reminderTypes - Array of reminder types to create
   * @param channel - Delivery channel(s) for reminders
   * @param recipientUserIds - Optional list of user IDs to receive reminders
   * @param recipientEmails - Optional list of emails to receive reminders
   */
  async createActivityReminders(
    activityId: string,
    reminderTypes: ReminderType[],
    channel: ReminderChannel,
    recipientUserIds?: string[],
    recipientEmails?: string[]
  ): Promise<ActivityReminder[]> {
    const activity = await this.getActivityData(activityId);
    if (!activity) {
      throw new NotFoundError('Activity');
    }

    const reminders: ActivityReminder[] = [];

    for (const reminderType of reminderTypes) {
      const scheduledTime = this.calculateReminderTime(activity.date, reminderType);

      // Don't create reminder if it's in the past
      if (scheduledTime <= new Date()) {
        logger.warn(`Skipping past reminder for activity ${activityId}: ${reminderType}`);
        continue;
      }

      const reminder = await this.createReminder({
        activityId,
        reminderType,
        channel,
        scheduledTime,
        recipientUserIds,
        recipientEmails,
        messageTemplate: this.getDefaultMessageTemplate(reminderType),
        createdBy: activity.organizerId,
      });

      reminders.push(reminder);
    }

    return reminders;
  }

  /**
   * Create a single reminder
   * @param params - Reminder creation parameters
   */
  async createReminder(params: CreateReminderParams): Promise<ActivityReminder> {
    // Support both activityId (new) and eventId (legacy) parameter names
    const targetId = params.activityId || params.eventId;
    if (!targetId) {
      throw new ValidationError('Activity ID is required (use activityId or eventId)');
    }

    const activity = await this.getActivityData(targetId);
    if (!activity) {
      throw new NotFoundError('Activity');
    }

    const scheduledTime =
      params.scheduledTime || this.calculateReminderTime(activity.date, params.reminderType);

    const reminder = this.reminderRepository.create({
      activityId: targetId, // ActivityReminder model uses activityId field
      reminderType: params.reminderType,
      channel: params.channel,
      scheduledTime,
      recipientUserIds: params.recipientUserIds,
      recipientEmails: params.recipientEmails,
      discordChannelId: params.discordChannelId,
      messageTemplate:
        params.messageTemplate || this.getDefaultMessageTemplate(params.reminderType),
      // Note: Field names (eventTitle, eventDate, eventLocation) maintained for backward compatibility
      // with existing message templates and notification system
      messageVariables: {
        eventTitle: activity.title,
        eventDate: activity.date.toLocaleString(),
        eventLocation: activity.location,
        timeUntil: this.getTimeUntilText(scheduledTime, activity.date),
      },
      deliveryStatus: DeliveryStatus.PENDING,
      isEnabled: true,
      createdBy: params.createdBy,
    });

    const savedReminder = await this.reminderRepository.save(reminder);

    logger.info('Created activity reminder', {
      reminderId: savedReminder.id,
      activityId: targetId,
      organizationId: activity.organizationId,
      reminderType: params.reminderType,
      channel: params.channel,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'ACTIVITY_REMINDER_CREATED',
      message: `Created ${params.reminderType} reminder for activity ${targetId}`,
      organizationId: activity.organizationId,
      userId: params.createdBy,
      resource: `activity/${targetId}/reminder/${savedReminder.id}`,
      metadata: {
        reminderId: savedReminder.id,
        activityId: targetId,
        reminderType: params.reminderType,
        channel: params.channel,
      },
    });

    return savedReminder;
  }

  /**
   * Process and send all due reminders
   */
  async processDueReminders(): Promise<ProcessRemindersResult> {
    const dueReminders = await this.reminderRepository
      .createQueryBuilder('reminder')
      .where('reminder.scheduledTime <= :now', { now: new Date() })
      .andWhere('reminder.deliveryStatus = :status', { status: DeliveryStatus.PENDING })
      .andWhere('reminder.isEnabled = :enabled', { enabled: true })
      .getMany();

    const results: ProcessRemindersResult = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const reminder of dueReminders) {
      try {
        await this.sendReminder(reminder);
        results.sent++;
      } catch (error: unknown) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Reminder ${reminder.id}: ${errorMessage}`);
        logger.error(`Failed to send reminder ${reminder.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Send a specific reminder
   * @param reminder - The reminder to send
   */
  async sendReminder(reminder: ActivityReminder): Promise<void> {
    const activity = await this.getActivityData(reminder.activityId);
    if (!activity) {
      throw new NotFoundError('Activity');
    }

    const message = {
      subject: `Reminder: ${activity.title}`,
      body: reminder.getFormattedMessage(),
      embed: this.notificationService.createEventReminderEmbed(
        activity.title,
        activity.date,
        activity.location,
        this.getTimeUntilText(new Date(), activity.date),
        activity.description
      ),
      recipientIds: reminder.recipientUserIds,
      recipientEmails: reminder.recipientEmails,
    };

    try {
      const channels: ('discord' | 'email')[] = [];
      if (
        reminder.channel === ReminderChannel.DISCORD ||
        reminder.channel === ReminderChannel.BOTH
      ) {
        channels.push('discord');
      }
      if (reminder.channel === ReminderChannel.EMAIL || reminder.channel === ReminderChannel.BOTH) {
        channels.push('email');
      }

      const results = await this.notificationService.sendMultiChannelNotification(
        message,
        channels,
        reminder.discordChannelId
      );

      // Check if any delivery succeeded
      const anySuccess = results.some(r => r.success);

      if (anySuccess) {
        reminder.deliveryStatus = DeliveryStatus.SENT;
        reminder.sentAt = new Date();
      } else {
        reminder.deliveryStatus = DeliveryStatus.FAILED;
        reminder.errorMessage = results
          .map(r => r.error)
          .filter(e => e)
          .join('; ');
        reminder.retryCount++;
        reminder.lastRetryAt = new Date();
      }

      await this.reminderRepository.save(reminder);

      logger.info('Processed activity reminder delivery', {
        reminderId: reminder.id,
        activityId: reminder.activityId,
        deliveryStatus: reminder.deliveryStatus,
      });

      auditService.log({
        category: AuditCategory.ACTIVITY,
        action: 'ACTIVITY_REMINDER_DELIVERY_UPDATED',
        message: `Updated reminder ${reminder.id} delivery status to ${reminder.deliveryStatus}`,
        resource: `activity/${reminder.activityId}/reminder/${reminder.id}`,
        metadata: {
          reminderId: reminder.id,
          activityId: reminder.activityId,
          deliveryStatus: reminder.deliveryStatus,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reminder.deliveryStatus = DeliveryStatus.FAILED;
      reminder.errorMessage = errorMessage;
      reminder.retryCount++;
      reminder.lastRetryAt = new Date();
      await this.reminderRepository.save(reminder);

      logger.info('Marked activity reminder delivery as failed', {
        reminderId: reminder.id,
        activityId: reminder.activityId,
      });

      auditService.log({
        category: AuditCategory.ACTIVITY,
        action: 'ACTIVITY_REMINDER_DELIVERY_FAILED',
        message: `Marked reminder ${reminder.id} as failed`,
        resource: `activity/${reminder.activityId}/reminder/${reminder.id}`,
        metadata: {
          reminderId: reminder.id,
          activityId: reminder.activityId,
        },
      });

      throw error;
    }
  }

  /**
   * Retry failed reminders
   * @returns Number of reminders successfully retried
   */
  async retryFailedReminders(): Promise<number> {
    const failedReminders = await this.reminderRepository
      .createQueryBuilder('reminder')
      .where('reminder.deliveryStatus = :status', { status: DeliveryStatus.FAILED })
      .andWhere('reminder.retryCount < :maxRetries', { maxRetries: 3 })
      .andWhere('reminder.isEnabled = :enabled', { enabled: true })
      .getMany();

    let retriedCount = 0;
    for (const reminder of failedReminders) {
      try {
        await this.sendReminder(reminder);
        retriedCount++;
      } catch (error: unknown) {
        logger.error(`Retry failed for reminder ${reminder.id}:`, error);
      }
    }

    return retriedCount;
  }

  /**
   * Get reminders for an activity
   * @param activityId - Activity ID
   */
  async getActivityReminders(activityId: string): Promise<ActivityReminder[]> {
    return this.reminderRepository.find({
      where: { activityId },
      order: { scheduledTime: 'ASC' },
    });
  }

  /**
   * Cancel a specific reminder
   * @param reminderId - Reminder ID to cancel
   */
  async cancelReminder(reminderId: string): Promise<void> {
    const reminder = await this.reminderRepository.findOne({ where: { id: reminderId } });
    if (!reminder) {
      throw new NotFoundError('Reminder');
    }

    reminder.deliveryStatus = DeliveryStatus.CANCELLED;
    reminder.isEnabled = false;
    await this.reminderRepository.save(reminder);

    logger.info('Cancelled activity reminder', {
      reminderId,
      activityId: reminder.activityId,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'ACTIVITY_REMINDER_CANCELLED',
      message: `Cancelled reminder ${reminderId}`,
      resource: `activity/${reminder.activityId}/reminder/${reminder.id}`,
      metadata: {
        reminderId,
        activityId: reminder.activityId,
      },
    });
  }

  /**
   * Cancel all reminders for an activity
   * @param activityId - Activity ID
   * @returns Number of cancelled reminders
   */
  async cancelActivityReminders(activityId: string): Promise<number> {
    const reminders = await this.getActivityReminders(activityId);
    let cancelledCount = 0;

    for (const reminder of reminders) {
      if (reminder.deliveryStatus === DeliveryStatus.PENDING) {
        await this.cancelReminder(reminder.id);
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Reschedule a reminder
   * @param reminderId - Reminder ID
   * @param newTime - New scheduled time
   */
  async rescheduleReminder(reminderId: string, newTime: Date): Promise<ActivityReminder> {
    const reminder = await this.reminderRepository.findOne({ where: { id: reminderId } });
    if (!reminder) {
      throw new NotFoundError('Reminder');
    }

    if (reminder.deliveryStatus !== DeliveryStatus.PENDING) {
      throw new ConflictError('Can only reschedule pending reminders');
    }

    reminder.scheduledTime = newTime;
    const savedReminder = await this.reminderRepository.save(reminder);

    logger.info('Rescheduled activity reminder', {
      reminderId,
      activityId: reminder.activityId,
      newTime,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'ACTIVITY_REMINDER_RESCHEDULED',
      message: `Rescheduled reminder ${reminderId}`,
      resource: `activity/${reminder.activityId}/reminder/${reminder.id}`,
      metadata: {
        reminderId,
        activityId: reminder.activityId,
        newTime,
      },
    });

    return savedReminder;
  }

  /**
   * Get reminder statistics
   * @param activityId - Optional activity ID to filter by
   */
  async getReminderStats(activityId?: string): Promise<ReminderStats> {
    const query = this.reminderRepository.createQueryBuilder('reminder');

    if (activityId) {
      query.where('reminder.activityId = :activityId', { activityId });
    }

    const reminders = await query.getMany();

    return {
      total: reminders.length,
      pending: reminders.filter(r => r.deliveryStatus === DeliveryStatus.PENDING).length,
      sent: reminders.filter(r => r.deliveryStatus === DeliveryStatus.SENT).length,
      failed: reminders.filter(r => r.deliveryStatus === DeliveryStatus.FAILED).length,
      cancelled: reminders.filter(r => r.deliveryStatus === DeliveryStatus.CANCELLED).length,
    };
  }

  /**
   * Get reminders for an activity
   * @param activityId - Activity ID to get reminders for
   */
  async getReminders(activityId: string) {
    const reminders = await this.reminderRepository.find({
      where: { activityId },
      order: { scheduledTime: 'ASC' },
    });
    return reminders;
  }

  /**
   * Calculate reminder time based on activity date
   */
  private calculateReminderTime(activityDate: Date, reminderType: ReminderType): Date {
    const activityTime = new Date(activityDate);

    switch (reminderType) {
      case ReminderType.ONE_DAY_BEFORE:
        return new Date(activityTime.getTime() - 24 * 60 * 60 * 1000);
      case ReminderType.ONE_HOUR_BEFORE:
        return new Date(activityTime.getTime() - 60 * 60 * 1000);
      case ReminderType.THIRTY_MINUTES_BEFORE:
        return new Date(activityTime.getTime() - 30 * 60 * 1000);
      default:
        return activityTime;
    }
  }

  /**
   * Get human-readable time until event text
   */
  private getTimeUntilText(from: Date, to: Date): string {
    const diff = to.getTime() - from.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Get default message template for reminder type
   *
   * Note: Template placeholders use legacy field names ({{eventTitle}}, {{eventDate}}, {{eventLocation}})
   * for backward compatibility with the EventReminder model's messageVariables schema.
   * The message text itself refers to "activity" for consistency with the unified domain.
   */
  private getDefaultMessageTemplate(reminderType: ReminderType): string {
    switch (reminderType) {
      case ReminderType.ONE_DAY_BEFORE:
        return '🔔 **Reminder:** The activity "{{eventTitle}}" is scheduled for tomorrow at {{eventDate}}!\n\n📍 Location: {{eventLocation}}\n⏳ Time until activity: {{timeUntil}}\n\nMake sure you\'re prepared and ready!';
      case ReminderType.ONE_HOUR_BEFORE:
        return '⏰ **1 Hour Warning:** The activity "{{eventTitle}}" starts in 1 hour!\n\n📍 Location: {{eventLocation}}\n⏳ Time until activity: {{timeUntil}}\n\nGet ready!';
      case ReminderType.THIRTY_MINUTES_BEFORE:
        return '🚨 **30 Minute Warning:** The activity "{{eventTitle}}" starts in 30 minutes!\n\n📍 Location: {{eventLocation}}\n⏳ Time until activity: {{timeUntil}}\n\nFinal preparations!';
      default:
        return '🔔 Reminder for activity "{{eventTitle}}" at {{eventDate}}';
    }
  }

  // ==================== LEGACY COMPATIBILITY ====================
  // These methods provide backward compatibility with EventReminderService

  /**
   * @deprecated Use createActivityReminders instead
   */
  async createEventReminders(
    eventId: string,
    reminderTypes: ReminderType[],
    channel: ReminderChannel,
    recipientUserIds?: string[],
    recipientEmails?: string[]
  ): Promise<ActivityReminder[]> {
    logger.warn(
      'EventReminderService.createEventReminders is deprecated. Use ActivityReminderService.createActivityReminders instead.'
    );
    return this.createActivityReminders(
      eventId,
      reminderTypes,
      channel,
      recipientUserIds,
      recipientEmails
    );
  }

  /**
   * @deprecated Use getActivityReminders instead
   */
  async getEventReminders(eventId: string): Promise<ActivityReminder[]> {
    logger.warn(
      'EventReminderService.getEventReminders is deprecated. Use ActivityReminderService.getActivityReminders instead.'
    );
    return this.getActivityReminders(eventId);
  }

  /**
   * @deprecated Use cancelActivityReminders instead
   */
  async cancelEventReminders(eventId: string): Promise<number> {
    logger.warn(
      'EventReminderService.cancelEventReminders is deprecated. Use ActivityReminderService.cancelActivityReminders instead.'
    );
    return this.cancelActivityReminders(eventId);
  }
}

// Re-export for backward compatibility
export { ActivityReminder, DeliveryStatus, ReminderChannel, ReminderType };
