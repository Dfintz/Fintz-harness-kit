"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationSchedulerService = exports.ScheduledNotificationPriority = exports.ScheduledNotificationStatus = void 0;
const logger_1 = require("../../../utils/logger");
var ScheduledNotificationStatus;
(function (ScheduledNotificationStatus) {
    ScheduledNotificationStatus["PENDING"] = "pending";
    ScheduledNotificationStatus["SENT"] = "sent";
    ScheduledNotificationStatus["FAILED"] = "failed";
    ScheduledNotificationStatus["CANCELLED"] = "cancelled";
})(ScheduledNotificationStatus || (exports.ScheduledNotificationStatus = ScheduledNotificationStatus = {}));
var ScheduledNotificationPriority;
(function (ScheduledNotificationPriority) {
    ScheduledNotificationPriority["LOW"] = "low";
    ScheduledNotificationPriority["NORMAL"] = "normal";
    ScheduledNotificationPriority["HIGH"] = "high";
    ScheduledNotificationPriority["URGENT"] = "urgent";
})(ScheduledNotificationPriority || (exports.ScheduledNotificationPriority = ScheduledNotificationPriority = {}));
class NotificationSchedulerService {
    scheduledNotifications = new Map();
    idCounter = 0;
    constructor() {
        logger_1.logger.info('NotificationSchedulerService initialized');
    }
    generateId() {
        this.idCounter++;
        return `sched_${Date.now()}_${this.idCounter}`;
    }
    async scheduleNotification(params) {
        if (params.scheduledAt <= new Date()) {
            throw new Error('Scheduled time must be in the future');
        }
        if (!params.userId) {
            throw new Error('User ID is required');
        }
        if (!params.subject || !params.body) {
            throw new Error('Subject and body are required');
        }
        if (!params.channels || params.channels.length === 0) {
            throw new Error('At least one notification channel is required');
        }
        const notification = {
            id: this.generateId(),
            userId: params.userId,
            organizationId: params.organizationId,
            subject: params.subject,
            body: params.body,
            channels: params.channels,
            scheduledAt: params.scheduledAt,
            priority: params.priority || ScheduledNotificationPriority.NORMAL,
            status: ScheduledNotificationStatus.PENDING,
            metadata: params.metadata,
            recipientIds: params.recipientIds,
            recipientEmails: params.recipientEmails,
            discordChannelId: params.discordChannelId,
            createdAt: new Date(),
            updatedAt: new Date(),
            retryCount: 0,
            maxRetries: params.maxRetries ?? 3
        };
        this.scheduledNotifications.set(notification.id, notification);
        logger_1.logger.info(`Scheduled notification ${notification.id} for ${params.scheduledAt.toISOString()}`);
        return notification;
    }
    async getScheduledNotification(id) {
        return this.scheduledNotifications.get(id) || null;
    }
    async getScheduledNotifications(filters) {
        let notifications = Array.from(this.scheduledNotifications.values());
        if (filters) {
            if (filters.userId) {
                notifications = notifications.filter(n => n.userId === filters.userId);
            }
            if (filters.organizationId) {
                notifications = notifications.filter(n => n.organizationId === filters.organizationId);
            }
            if (filters.status) {
                notifications = notifications.filter(n => n.status === filters.status);
            }
            if (filters.priority) {
                notifications = notifications.filter(n => n.priority === filters.priority);
            }
            if (filters.channels && filters.channels.length > 0) {
                const filterChannels = filters.channels;
                notifications = notifications.filter(n => filterChannels.some(c => n.channels.includes(c)));
            }
            if (filters.scheduledAfter) {
                const afterDate = filters.scheduledAfter;
                notifications = notifications.filter(n => n.scheduledAt >= afterDate);
            }
            if (filters.scheduledBefore) {
                const beforeDate = filters.scheduledBefore;
                notifications = notifications.filter(n => n.scheduledAt <= beforeDate);
            }
        }
        notifications.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
        return notifications;
    }
    async getDueNotifications() {
        const now = new Date();
        return Array.from(this.scheduledNotifications.values()).filter(n => n.status === ScheduledNotificationStatus.PENDING && n.scheduledAt <= now);
    }
    async cancelScheduledNotification(id) {
        const notification = this.scheduledNotifications.get(id);
        if (!notification) {
            throw new Error('Scheduled notification not found');
        }
        if (notification.status !== ScheduledNotificationStatus.PENDING) {
            throw new Error(`Cannot cancel notification with status: ${notification.status}`);
        }
        notification.status = ScheduledNotificationStatus.CANCELLED;
        notification.updatedAt = new Date();
        this.scheduledNotifications.set(id, notification);
        logger_1.logger.info(`Cancelled scheduled notification ${id}`);
        return notification;
    }
    async rescheduleNotification(id, newScheduledAt) {
        const notification = this.scheduledNotifications.get(id);
        if (!notification) {
            throw new Error('Scheduled notification not found');
        }
        if (notification.status !== ScheduledNotificationStatus.PENDING) {
            throw new Error(`Cannot reschedule notification with status: ${notification.status}`);
        }
        if (newScheduledAt <= new Date()) {
            throw new Error('New scheduled time must be in the future');
        }
        notification.scheduledAt = newScheduledAt;
        notification.updatedAt = new Date();
        this.scheduledNotifications.set(id, notification);
        logger_1.logger.info(`Rescheduled notification ${id} to ${newScheduledAt.toISOString()}`);
        return notification;
    }
    async markAsSent(id) {
        const notification = this.scheduledNotifications.get(id);
        if (!notification) {
            throw new Error('Scheduled notification not found');
        }
        notification.status = ScheduledNotificationStatus.SENT;
        notification.sentAt = new Date();
        notification.updatedAt = new Date();
        this.scheduledNotifications.set(id, notification);
        logger_1.logger.info(`Marked notification ${id} as sent`);
        return notification;
    }
    async markAsFailed(id, errorMessage) {
        const notification = this.scheduledNotifications.get(id);
        if (!notification) {
            throw new Error('Scheduled notification not found');
        }
        notification.retryCount++;
        notification.errorMessage = errorMessage;
        notification.updatedAt = new Date();
        if (notification.retryCount >= notification.maxRetries) {
            notification.status = ScheduledNotificationStatus.FAILED;
            logger_1.logger.warn(`Notification ${id} failed after ${notification.retryCount} retries: ${errorMessage}`);
        }
        else {
            logger_1.logger.info(`Notification ${id} retry ${notification.retryCount}/${notification.maxRetries}: ${errorMessage}`);
        }
        this.scheduledNotifications.set(id, notification);
        return notification;
    }
    async getStats() {
        const notifications = Array.from(this.scheduledNotifications.values());
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return {
            total: notifications.length,
            pending: notifications.filter(n => n.status === ScheduledNotificationStatus.PENDING).length,
            sent: notifications.filter(n => n.status === ScheduledNotificationStatus.SENT).length,
            failed: notifications.filter(n => n.status === ScheduledNotificationStatus.FAILED).length,
            cancelled: notifications.filter(n => n.status === ScheduledNotificationStatus.CANCELLED).length,
            dueInNextHour: notifications.filter(n => n.status === ScheduledNotificationStatus.PENDING &&
                n.scheduledAt > now &&
                n.scheduledAt <= oneHourFromNow).length,
            dueInNext24Hours: notifications.filter(n => n.status === ScheduledNotificationStatus.PENDING &&
                n.scheduledAt > now &&
                n.scheduledAt <= twentyFourHoursFromNow).length
        };
    }
    async cleanupOldNotifications(olderThanDays = 30) {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        const entries = Array.from(this.scheduledNotifications.entries());
        for (const [id, notification] of entries) {
            if ((notification.status === ScheduledNotificationStatus.SENT ||
                notification.status === ScheduledNotificationStatus.CANCELLED ||
                notification.status === ScheduledNotificationStatus.FAILED) &&
                notification.updatedAt < cutoffDate) {
                this.scheduledNotifications.delete(id);
                deletedCount++;
            }
        }
        logger_1.logger.info(`Cleaned up ${deletedCount} old scheduled notifications`);
        return deletedCount;
    }
    async cancelUserNotifications(userId) {
        let cancelledCount = 0;
        const entries = Array.from(this.scheduledNotifications.entries());
        for (const [id, notification] of entries) {
            if (notification.userId === userId &&
                notification.status === ScheduledNotificationStatus.PENDING) {
                notification.status = ScheduledNotificationStatus.CANCELLED;
                notification.updatedAt = new Date();
                this.scheduledNotifications.set(id, notification);
                cancelledCount++;
            }
        }
        logger_1.logger.info(`Cancelled ${cancelledCount} scheduled notifications for user ${userId}`);
        return cancelledCount;
    }
    async cancelOrganizationNotifications(organizationId) {
        let cancelledCount = 0;
        const entries = Array.from(this.scheduledNotifications.entries());
        for (const [id, notification] of entries) {
            if (notification.organizationId === organizationId &&
                notification.status === ScheduledNotificationStatus.PENDING) {
                notification.status = ScheduledNotificationStatus.CANCELLED;
                notification.updatedAt = new Date();
                this.scheduledNotifications.set(id, notification);
                cancelledCount++;
            }
        }
        logger_1.logger.info(`Cancelled ${cancelledCount} scheduled notifications for organization ${organizationId}`);
        return cancelledCount;
    }
    async getRetryableNotifications() {
        return Array.from(this.scheduledNotifications.values()).filter(n => n.status === ScheduledNotificationStatus.PENDING &&
            n.retryCount > 0 &&
            n.retryCount < n.maxRetries);
    }
    clearAll() {
        this.scheduledNotifications.clear();
        this.idCounter = 0;
    }
}
exports.NotificationSchedulerService = NotificationSchedulerService;
//# sourceMappingURL=NotificationSchedulerService.js.map