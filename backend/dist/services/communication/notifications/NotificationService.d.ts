import { Client, EmbedBuilder } from 'discord.js';
import { Notification } from '../../../models/Notification';
export interface NotificationMessage {
    subject: string;
    body: string;
    embed?: EmbedBuilder;
    recipientIds?: string[];
    recipientEmails?: string[];
}
export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string;
}
export interface NotificationResult {
    success: boolean;
    channel: 'discord' | 'email' | 'in-app';
    recipientCount: number;
    error?: string;
    notificationId?: string;
}
export interface CreateInAppNotificationData {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    priority?: string;
    senderId?: string;
}
export declare class NotificationService {
    private readonly discordClient?;
    private readonly emailTransporter?;
    private readonly emailConfig?;
    private readonly defaultChannelId?;
    constructor(discordClient?: Client, emailConfig?: EmailConfig, defaultChannelId?: string);
    private get notificationRepo();
    create(data: CreateInAppNotificationData): Promise<NotificationResult>;
    listForUser(userId: string, options?: {
        page?: number;
        pageSize?: number;
        unreadOnly?: boolean;
        type?: string;
    }): Promise<{
        data: Notification[];
        total: number;
    }>;
    markAsRead(userId: string, notificationIds: string[]): Promise<number>;
    markAllAsRead(userId: string): Promise<number>;
    deleteNotification(userId: string, notificationId: string): Promise<boolean>;
    getUnreadCount(userId: string): Promise<number>;
    sendDiscordNotification(message: NotificationMessage, channelId?: string): Promise<NotificationResult>;
    private sendDiscordDMs;
    sendEmailNotification(message: NotificationMessage): Promise<NotificationResult>;
    sendMultiChannelNotification(message: NotificationMessage, channels: ('discord' | 'email')[], channelId?: string): Promise<NotificationResult[]>;
    createEventReminderEmbed(eventTitle: string, eventDate: Date, eventLocation: string, timeUntil: string, additionalInfo?: string): EmbedBuilder;
    createAttendanceConfirmationEmbed(eventTitle: string, eventDate: Date, attendeeCount: number): EmbedBuilder;
    createConflictWarningEmbed(eventTitle: string, conflicts: Array<{
        eventTitle: string;
        eventDate: Date;
    }>): EmbedBuilder;
    private escapeHtml;
    private formatEmailBody;
    testConfiguration(): Promise<{
        discord: boolean;
        email: boolean;
    }>;
}
//# sourceMappingURL=NotificationService.d.ts.map