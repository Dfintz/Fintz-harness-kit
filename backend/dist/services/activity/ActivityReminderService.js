"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderType = exports.ReminderChannel = exports.DeliveryStatus = exports.ActivityReminder = exports.ActivityReminderService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityReminder_1 = require("../../models/ActivityReminder");
Object.defineProperty(exports, "ActivityReminder", { enumerable: true, get: function () { return ActivityReminder_1.ActivityReminder; } });
Object.defineProperty(exports, "DeliveryStatus", { enumerable: true, get: function () { return ActivityReminder_1.DeliveryStatus; } });
Object.defineProperty(exports, "ReminderChannel", { enumerable: true, get: function () { return ActivityReminder_1.ReminderChannel; } });
Object.defineProperty(exports, "ReminderType", { enumerable: true, get: function () { return ActivityReminder_1.ReminderType; } });
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
class ActivityReminderService {
    reminderRepository;
    activityRepository;
    notificationService;
    constructor(notificationService) {
        this.reminderRepository = data_source_1.AppDataSource.getRepository(ActivityReminder_1.ActivityReminder);
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        this.notificationService = notificationService;
    }
    async getActivityData(activityId) {
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
    async createActivityReminders(activityId, reminderTypes, channel, recipientUserIds, recipientEmails) {
        const activity = await this.getActivityData(activityId);
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        const reminders = [];
        for (const reminderType of reminderTypes) {
            const scheduledTime = this.calculateReminderTime(activity.date, reminderType);
            if (scheduledTime <= new Date()) {
                logger_1.logger.warn(`Skipping past reminder for activity ${activityId}: ${reminderType}`);
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
    async createReminder(params) {
        const targetId = params.activityId || params.eventId;
        if (!targetId) {
            throw new apiErrors_1.ValidationError('Activity ID is required (use activityId or eventId)');
        }
        const activity = await this.getActivityData(targetId);
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        const scheduledTime = params.scheduledTime || this.calculateReminderTime(activity.date, params.reminderType);
        const reminder = this.reminderRepository.create({
            activityId: targetId,
            reminderType: params.reminderType,
            channel: params.channel,
            scheduledTime,
            recipientUserIds: params.recipientUserIds,
            recipientEmails: params.recipientEmails,
            discordChannelId: params.discordChannelId,
            messageTemplate: params.messageTemplate || this.getDefaultMessageTemplate(params.reminderType),
            messageVariables: {
                eventTitle: activity.title,
                eventDate: activity.date.toLocaleString(),
                eventLocation: activity.location,
                timeUntil: this.getTimeUntilText(scheduledTime, activity.date),
            },
            deliveryStatus: ActivityReminder_1.DeliveryStatus.PENDING,
            isEnabled: true,
            createdBy: params.createdBy,
        });
        const savedReminder = await this.reminderRepository.save(reminder);
        logger_1.logger.info('Created activity reminder', {
            reminderId: savedReminder.id,
            activityId: targetId,
            organizationId: activity.organizationId,
            reminderType: params.reminderType,
            channel: params.channel,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
    async processDueReminders() {
        const dueReminders = await this.reminderRepository
            .createQueryBuilder('reminder')
            .where('reminder.scheduledTime <= :now', { now: new Date() })
            .andWhere('reminder.deliveryStatus = :status', { status: ActivityReminder_1.DeliveryStatus.PENDING })
            .andWhere('reminder.isEnabled = :enabled', { enabled: true })
            .getMany();
        const results = {
            sent: 0,
            failed: 0,
            errors: [],
        };
        for (const reminder of dueReminders) {
            try {
                await this.sendReminder(reminder);
                results.sent++;
            }
            catch (error) {
                results.failed++;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`Reminder ${reminder.id}: ${errorMessage}`);
                logger_1.logger.error(`Failed to send reminder ${reminder.id}:`, error);
            }
        }
        return results;
    }
    async sendReminder(reminder) {
        const activity = await this.getActivityData(reminder.activityId);
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity');
        }
        const message = {
            subject: `Reminder: ${activity.title}`,
            body: reminder.getFormattedMessage(),
            embed: this.notificationService.createEventReminderEmbed(activity.title, activity.date, activity.location, this.getTimeUntilText(new Date(), activity.date), activity.description),
            recipientIds: reminder.recipientUserIds,
            recipientEmails: reminder.recipientEmails,
        };
        try {
            const channels = [];
            if (reminder.channel === ActivityReminder_1.ReminderChannel.DISCORD ||
                reminder.channel === ActivityReminder_1.ReminderChannel.BOTH) {
                channels.push('discord');
            }
            if (reminder.channel === ActivityReminder_1.ReminderChannel.EMAIL || reminder.channel === ActivityReminder_1.ReminderChannel.BOTH) {
                channels.push('email');
            }
            const results = await this.notificationService.sendMultiChannelNotification(message, channels, reminder.discordChannelId);
            const anySuccess = results.some(r => r.success);
            if (anySuccess) {
                reminder.deliveryStatus = ActivityReminder_1.DeliveryStatus.SENT;
                reminder.sentAt = new Date();
            }
            else {
                reminder.deliveryStatus = ActivityReminder_1.DeliveryStatus.FAILED;
                reminder.errorMessage = results
                    .map(r => r.error)
                    .filter(e => e)
                    .join('; ');
                reminder.retryCount++;
                reminder.lastRetryAt = new Date();
            }
            await this.reminderRepository.save(reminder);
            logger_1.logger.info('Processed activity reminder delivery', {
                reminderId: reminder.id,
                activityId: reminder.activityId,
                deliveryStatus: reminder.deliveryStatus,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ACTIVITY,
                action: 'ACTIVITY_REMINDER_DELIVERY_UPDATED',
                message: `Updated reminder ${reminder.id} delivery status to ${reminder.deliveryStatus}`,
                resource: `activity/${reminder.activityId}/reminder/${reminder.id}`,
                metadata: {
                    reminderId: reminder.id,
                    activityId: reminder.activityId,
                    deliveryStatus: reminder.deliveryStatus,
                },
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reminder.deliveryStatus = ActivityReminder_1.DeliveryStatus.FAILED;
            reminder.errorMessage = errorMessage;
            reminder.retryCount++;
            reminder.lastRetryAt = new Date();
            await this.reminderRepository.save(reminder);
            logger_1.logger.info('Marked activity reminder delivery as failed', {
                reminderId: reminder.id,
                activityId: reminder.activityId,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ACTIVITY,
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
    async retryFailedReminders() {
        const failedReminders = await this.reminderRepository
            .createQueryBuilder('reminder')
            .where('reminder.deliveryStatus = :status', { status: ActivityReminder_1.DeliveryStatus.FAILED })
            .andWhere('reminder.retryCount < :maxRetries', { maxRetries: 3 })
            .andWhere('reminder.isEnabled = :enabled', { enabled: true })
            .getMany();
        let retriedCount = 0;
        for (const reminder of failedReminders) {
            try {
                await this.sendReminder(reminder);
                retriedCount++;
            }
            catch (error) {
                logger_1.logger.error(`Retry failed for reminder ${reminder.id}:`, error);
            }
        }
        return retriedCount;
    }
    async getActivityReminders(activityId) {
        return this.reminderRepository.find({
            where: { activityId },
            order: { scheduledTime: 'ASC' },
        });
    }
    async cancelReminder(reminderId) {
        const reminder = await this.reminderRepository.findOne({ where: { id: reminderId } });
        if (!reminder) {
            throw new apiErrors_1.NotFoundError('Reminder');
        }
        reminder.deliveryStatus = ActivityReminder_1.DeliveryStatus.CANCELLED;
        reminder.isEnabled = false;
        await this.reminderRepository.save(reminder);
        logger_1.logger.info('Cancelled activity reminder', {
            reminderId,
            activityId: reminder.activityId,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'ACTIVITY_REMINDER_CANCELLED',
            message: `Cancelled reminder ${reminderId}`,
            resource: `activity/${reminder.activityId}/reminder/${reminder.id}`,
            metadata: {
                reminderId,
                activityId: reminder.activityId,
            },
        });
    }
    async cancelActivityReminders(activityId) {
        const reminders = await this.getActivityReminders(activityId);
        let cancelledCount = 0;
        for (const reminder of reminders) {
            if (reminder.deliveryStatus === ActivityReminder_1.DeliveryStatus.PENDING) {
                await this.cancelReminder(reminder.id);
                cancelledCount++;
            }
        }
        return cancelledCount;
    }
    async rescheduleReminder(reminderId, newTime) {
        const reminder = await this.reminderRepository.findOne({ where: { id: reminderId } });
        if (!reminder) {
            throw new apiErrors_1.NotFoundError('Reminder');
        }
        if (reminder.deliveryStatus !== ActivityReminder_1.DeliveryStatus.PENDING) {
            throw new apiErrors_1.ConflictError('Can only reschedule pending reminders');
        }
        reminder.scheduledTime = newTime;
        const savedReminder = await this.reminderRepository.save(reminder);
        logger_1.logger.info('Rescheduled activity reminder', {
            reminderId,
            activityId: reminder.activityId,
            newTime,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
    async getReminderStats(activityId) {
        const query = this.reminderRepository.createQueryBuilder('reminder');
        if (activityId) {
            query.where('reminder.activityId = :activityId', { activityId });
        }
        const reminders = await query.getMany();
        return {
            total: reminders.length,
            pending: reminders.filter(r => r.deliveryStatus === ActivityReminder_1.DeliveryStatus.PENDING).length,
            sent: reminders.filter(r => r.deliveryStatus === ActivityReminder_1.DeliveryStatus.SENT).length,
            failed: reminders.filter(r => r.deliveryStatus === ActivityReminder_1.DeliveryStatus.FAILED).length,
            cancelled: reminders.filter(r => r.deliveryStatus === ActivityReminder_1.DeliveryStatus.CANCELLED).length,
        };
    }
    async getReminders(activityId) {
        const reminders = await this.reminderRepository.find({
            where: { activityId },
            order: { scheduledTime: 'ASC' },
        });
        return reminders;
    }
    calculateReminderTime(activityDate, reminderType) {
        const activityTime = new Date(activityDate);
        switch (reminderType) {
            case ActivityReminder_1.ReminderType.ONE_DAY_BEFORE:
                return new Date(activityTime.getTime() - 24 * 60 * 60 * 1000);
            case ActivityReminder_1.ReminderType.ONE_HOUR_BEFORE:
                return new Date(activityTime.getTime() - 60 * 60 * 1000);
            case ActivityReminder_1.ReminderType.THIRTY_MINUTES_BEFORE:
                return new Date(activityTime.getTime() - 30 * 60 * 1000);
            default:
                return activityTime;
        }
    }
    getTimeUntilText(from, to) {
        const diff = to.getTime() - from.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days > 1 ? 's' : ''}`;
        }
        else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
        else {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
    }
    getDefaultMessageTemplate(reminderType) {
        switch (reminderType) {
            case ActivityReminder_1.ReminderType.ONE_DAY_BEFORE:
                return '🔔 **Reminder:** The activity "{{eventTitle}}" is scheduled for tomorrow at {{eventDate}}!\n\n📍 Location: {{eventLocation}}\n⏳ Time until activity: {{timeUntil}}\n\nMake sure you\'re prepared and ready!';
            case ActivityReminder_1.ReminderType.ONE_HOUR_BEFORE:
                return '⏰ **1 Hour Warning:** The activity "{{eventTitle}}" starts in 1 hour!\n\n📍 Location: {{eventLocation}}\n⏳ Time until activity: {{timeUntil}}\n\nGet ready!';
            case ActivityReminder_1.ReminderType.THIRTY_MINUTES_BEFORE:
                return '🚨 **30 Minute Warning:** The activity "{{eventTitle}}" starts in 30 minutes!\n\n📍 Location: {{eventLocation}}\n⏳ Time until activity: {{timeUntil}}\n\nFinal preparations!';
            default:
                return '🔔 Reminder for activity "{{eventTitle}}" at {{eventDate}}';
        }
    }
    async createEventReminders(eventId, reminderTypes, channel, recipientUserIds, recipientEmails) {
        logger_1.logger.warn('EventReminderService.createEventReminders is deprecated. Use ActivityReminderService.createActivityReminders instead.');
        return this.createActivityReminders(eventId, reminderTypes, channel, recipientUserIds, recipientEmails);
    }
    async getEventReminders(eventId) {
        logger_1.logger.warn('EventReminderService.getEventReminders is deprecated. Use ActivityReminderService.getActivityReminders instead.');
        return this.getActivityReminders(eventId);
    }
    async cancelEventReminders(eventId) {
        logger_1.logger.warn('EventReminderService.cancelEventReminders is deprecated. Use ActivityReminderService.cancelActivityReminders instead.');
        return this.cancelActivityReminders(eventId);
    }
}
exports.ActivityReminderService = ActivityReminderService;
//# sourceMappingURL=ActivityReminderService.js.map