/**
 * NotificationSchedulerService
 *
 * Provides notification scheduling capabilities for future delivery.
 * Notifications can be scheduled for a specific time, cancelled, or rescheduled.
 */

import { logger } from '../../../utils/logger';

/**
 * Notification channel types
 */
export type NotificationChannel = 'discord' | 'email' | 'in_app' | 'push';

/**
 * Scheduled notification status
 */
export enum ScheduledNotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * Scheduled notification priority
 */
export enum ScheduledNotificationPriority {
    LOW = 'low',
    NORMAL = 'normal',
    HIGH = 'high',
    URGENT = 'urgent'
}

/**
 * Scheduled notification interface
 */
export interface ScheduledNotification {
    id: string;
    userId: string;
    organizationId?: string;
    subject: string;
    body: string;
    channels: NotificationChannel[];
    scheduledAt: Date;
    priority: ScheduledNotificationPriority;
    status: ScheduledNotificationStatus;
    metadata?: Record<string, unknown>;
    recipientIds?: string[];
    recipientEmails?: string[];
    discordChannelId?: string;
    createdAt: Date;
    updatedAt: Date;
    sentAt?: Date;
    errorMessage?: string;
    retryCount: number;
    maxRetries: number;
}

/**
 * Create scheduled notification params
 */
export interface CreateScheduledNotificationParams {
    userId: string;
    organizationId?: string;
    subject: string;
    body: string;
    channels: NotificationChannel[];
    scheduledAt: Date;
    priority?: ScheduledNotificationPriority;
    metadata?: Record<string, unknown>;
    recipientIds?: string[];
    recipientEmails?: string[];
    discordChannelId?: string;
    maxRetries?: number;
}

/**
 * Scheduled notification filters
 */
export interface ScheduledNotificationFilters {
    userId?: string;
    organizationId?: string;
    status?: ScheduledNotificationStatus;
    priority?: ScheduledNotificationPriority;
    channels?: NotificationChannel[];
    scheduledAfter?: Date;
    scheduledBefore?: Date;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    dueInNextHour: number;
    dueInNext24Hours: number;
}

/**
 * NotificationSchedulerService
 *
 * Manages scheduling notifications for future delivery with support for:
 * - Scheduling notifications for specific times
 * - Cancelling scheduled notifications
 * - Rescheduling notifications
 * - Retrieving due notifications for processing
 * - Statistics and monitoring
 */
export class NotificationSchedulerService {
    private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
    private idCounter: number = 0;

    constructor() {
        logger.info('NotificationSchedulerService initialized');
    }

    /**
     * Generate unique ID for scheduled notification
     */
    private generateId(): string {
        this.idCounter++;
        return `sched_${Date.now()}_${this.idCounter}`;
    }

    /**
     * Schedule a notification for future delivery
     */
    async scheduleNotification(
        params: CreateScheduledNotificationParams
    ): Promise<ScheduledNotification> {
        // Validate scheduled time is in the future
        if (params.scheduledAt <= new Date()) {
            throw new Error('Scheduled time must be in the future');
        }

        // Validate required fields
        if (!params.userId) {
            throw new Error('User ID is required');
        }
        if (!params.subject || !params.body) {
            throw new Error('Subject and body are required');
        }
        if (!params.channels || params.channels.length === 0) {
            throw new Error('At least one notification channel is required');
        }

        const notification: ScheduledNotification = {
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

        logger.info(`Scheduled notification ${notification.id} for ${params.scheduledAt.toISOString()}`);

        return notification;
    }

    /**
     * Get a scheduled notification by ID
     */
    async getScheduledNotification(id: string): Promise<ScheduledNotification | null> {
        return this.scheduledNotifications.get(id) || null;
    }

    /**
     * Get scheduled notifications with optional filters
     */
    async getScheduledNotifications(
        filters?: ScheduledNotificationFilters
    ): Promise<ScheduledNotification[]> {
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
                notifications = notifications.filter(n =>
                    filterChannels.some(c => n.channels.includes(c))
                );
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

        // Sort by scheduledAt ascending
        notifications.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

        return notifications;
    }

    /**
     * Get due notifications (scheduled time has passed and still pending)
     */
    async getDueNotifications(): Promise<ScheduledNotification[]> {
        const now = new Date();
        return Array.from(this.scheduledNotifications.values()).filter(
            n => n.status === ScheduledNotificationStatus.PENDING && n.scheduledAt <= now
        );
    }

    /**
     * Cancel a scheduled notification
     */
    async cancelScheduledNotification(id: string): Promise<ScheduledNotification> {
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

        logger.info(`Cancelled scheduled notification ${id}`);

        return notification;
    }

    /**
     * Reschedule a notification to a new time
     */
    async rescheduleNotification(id: string, newScheduledAt: Date): Promise<ScheduledNotification> {
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

        logger.info(`Rescheduled notification ${id} to ${newScheduledAt.toISOString()}`);

        return notification;
    }

    /**
     * Mark a notification as sent
     */
    async markAsSent(id: string): Promise<ScheduledNotification> {
        const notification = this.scheduledNotifications.get(id);
        if (!notification) {
            throw new Error('Scheduled notification not found');
        }

        notification.status = ScheduledNotificationStatus.SENT;
        notification.sentAt = new Date();
        notification.updatedAt = new Date();
        this.scheduledNotifications.set(id, notification);

        logger.info(`Marked notification ${id} as sent`);

        return notification;
    }

    /**
     * Mark a notification as failed
     */
    async markAsFailed(id: string, errorMessage: string): Promise<ScheduledNotification> {
        const notification = this.scheduledNotifications.get(id);
        if (!notification) {
            throw new Error('Scheduled notification not found');
        }

        notification.retryCount++;
        notification.errorMessage = errorMessage;
        notification.updatedAt = new Date();

        // Only mark as failed if max retries exceeded
        if (notification.retryCount >= notification.maxRetries) {
            notification.status = ScheduledNotificationStatus.FAILED;
            logger.warn(`Notification ${id} failed after ${notification.retryCount} retries: ${errorMessage}`);
        } else {
            logger.info(`Notification ${id} retry ${notification.retryCount}/${notification.maxRetries}: ${errorMessage}`);
        }

        this.scheduledNotifications.set(id, notification);

        return notification;
    }

    /**
     * Get scheduler statistics
     */
    async getStats(): Promise<SchedulerStats> {
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
            dueInNextHour: notifications.filter(
                n => n.status === ScheduledNotificationStatus.PENDING &&
                    n.scheduledAt > now &&
                    n.scheduledAt <= oneHourFromNow
            ).length,
            dueInNext24Hours: notifications.filter(
                n => n.status === ScheduledNotificationStatus.PENDING &&
                    n.scheduledAt > now &&
                    n.scheduledAt <= twentyFourHoursFromNow
            ).length
        };
    }

    /**
     * Delete old completed notifications (cleanup)
     */
    async cleanupOldNotifications(olderThanDays: number = 30): Promise<number> {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        const entries = Array.from(this.scheduledNotifications.entries());
        for (const [id, notification] of entries) {
            if (
                (notification.status === ScheduledNotificationStatus.SENT ||
                    notification.status === ScheduledNotificationStatus.CANCELLED ||
                    notification.status === ScheduledNotificationStatus.FAILED) &&
                notification.updatedAt < cutoffDate
            ) {
                this.scheduledNotifications.delete(id);
                deletedCount++;
            }
        }

        logger.info(`Cleaned up ${deletedCount} old scheduled notifications`);
        return deletedCount;
    }

    /**
     * Cancel all pending notifications for a user
     */
    async cancelUserNotifications(userId: string): Promise<number> {
        let cancelledCount = 0;

        const entries = Array.from(this.scheduledNotifications.entries());
        for (const [id, notification] of entries) {
            if (
                notification.userId === userId &&
                notification.status === ScheduledNotificationStatus.PENDING
            ) {
                notification.status = ScheduledNotificationStatus.CANCELLED;
                notification.updatedAt = new Date();
                this.scheduledNotifications.set(id, notification);
                cancelledCount++;
            }
        }

        logger.info(`Cancelled ${cancelledCount} scheduled notifications for user ${userId}`);
        return cancelledCount;
    }

    /**
     * Cancel all pending notifications for an organization
     */
    async cancelOrganizationNotifications(organizationId: string): Promise<number> {
        let cancelledCount = 0;

        const entries = Array.from(this.scheduledNotifications.entries());
        for (const [id, notification] of entries) {
            if (
                notification.organizationId === organizationId &&
                notification.status === ScheduledNotificationStatus.PENDING
            ) {
                notification.status = ScheduledNotificationStatus.CANCELLED;
                notification.updatedAt = new Date();
                this.scheduledNotifications.set(id, notification);
                cancelledCount++;
            }
        }

        logger.info(`Cancelled ${cancelledCount} scheduled notifications for organization ${organizationId}`);
        return cancelledCount;
    }

    /**
     * Get notifications due for retry
     */
    async getRetryableNotifications(): Promise<ScheduledNotification[]> {
        return Array.from(this.scheduledNotifications.values()).filter(
            n =>
                n.status === ScheduledNotificationStatus.PENDING &&
                n.retryCount > 0 &&
                n.retryCount < n.maxRetries
        );
    }

    /**
     * Clear all notifications (mainly for testing)
     */
    clearAll(): void {
        this.scheduledNotifications.clear();
        this.idCounter = 0;
    }
}

