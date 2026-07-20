export type NotificationChannel = 'discord' | 'email' | 'in_app' | 'push';
export declare enum ScheduledNotificationStatus {
    PENDING = "pending",
    SENT = "sent",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum ScheduledNotificationPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent"
}
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
export interface ScheduledNotificationFilters {
    userId?: string;
    organizationId?: string;
    status?: ScheduledNotificationStatus;
    priority?: ScheduledNotificationPriority;
    channels?: NotificationChannel[];
    scheduledAfter?: Date;
    scheduledBefore?: Date;
}
export interface SchedulerStats {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    dueInNextHour: number;
    dueInNext24Hours: number;
}
export declare class NotificationSchedulerService {
    private scheduledNotifications;
    private idCounter;
    constructor();
    private generateId;
    scheduleNotification(params: CreateScheduledNotificationParams): Promise<ScheduledNotification>;
    getScheduledNotification(id: string): Promise<ScheduledNotification | null>;
    getScheduledNotifications(filters?: ScheduledNotificationFilters): Promise<ScheduledNotification[]>;
    getDueNotifications(): Promise<ScheduledNotification[]>;
    cancelScheduledNotification(id: string): Promise<ScheduledNotification>;
    rescheduleNotification(id: string, newScheduledAt: Date): Promise<ScheduledNotification>;
    markAsSent(id: string): Promise<ScheduledNotification>;
    markAsFailed(id: string, errorMessage: string): Promise<ScheduledNotification>;
    getStats(): Promise<SchedulerStats>;
    cleanupOldNotifications(olderThanDays?: number): Promise<number>;
    cancelUserNotifications(userId: string): Promise<number>;
    cancelOrganizationNotifications(organizationId: string): Promise<number>;
    getRetryableNotifications(): Promise<ScheduledNotification[]>;
    clearAll(): void;
}
//# sourceMappingURL=NotificationSchedulerService.d.ts.map