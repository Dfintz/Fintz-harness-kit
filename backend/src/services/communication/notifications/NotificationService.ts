import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import nodemailer from 'nodemailer';
import { FindOptionsWhere, In, Repository } from 'typeorm';

import { AppDataSource } from '../../../config/database';
import { Notification, NotificationPriority, NotificationType } from '../../../models/Notification';
import { getErrorMessage } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';
import { AuditCategory, auditService } from '../../audit/AuditService';

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

/**
 * In-app notification creation data
 */
export interface CreateInAppNotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: string;
  senderId?: string;
}

/**
 * Service for sending notifications via Discord, Email, and In-App (persisted).
 */
export class NotificationService {
  private readonly discordClient?: Client;
  private readonly emailTransporter?: nodemailer.Transporter;
  private readonly emailConfig?: EmailConfig;
  private readonly defaultChannelId?: string;

  constructor(discordClient?: Client, emailConfig?: EmailConfig, defaultChannelId?: string) {
    this.discordClient = discordClient;
    this.defaultChannelId = defaultChannelId;

    if (emailConfig) {
      this.emailConfig = emailConfig;
      this.emailTransporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
      });
    }
  }

  /** Lazily resolved repository — avoids import-time AppDataSource access. */
  private get notificationRepo(): Repository<Notification> {
    return AppDataSource.getRepository(Notification);
  }

  // ---------------------------------------------------------------------------
  // In-App Notification CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create and persist an in-app notification for a user.
   */
  async create(data: CreateInAppNotificationData): Promise<NotificationResult> {
    try {
      // Validate type against the enum — fall back to INFO for unknown values
      const validTypes = Object.values(NotificationType) as string[];
      const resolvedType = validTypes.includes(data.type ?? '')
        ? (data.type as NotificationType)
        : NotificationType.INFO;

      const validPriorities = Object.values(NotificationPriority) as string[];
      const resolvedPriority = validPriorities.includes(data.priority ?? '')
        ? (data.priority as NotificationPriority)
        : NotificationPriority.NORMAL;

      const notification = this.notificationRepo.create({
        userId: data.userId,
        type: resolvedType,
        title: data.title,
        message: data.message,
        data: data.data ?? null,
        priority: resolvedPriority,
        senderId: data.senderId ?? null,
        read: false,
      });
      await this.notificationRepo.save(notification);

      logger.info('In-app notification persisted', {
        id: notification.id,
        userId: data.userId,
        type: data.type,
        title: data.title,
      });

      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'IN_APP_NOTIFICATION_CREATED',
        message: `Created in-app notification ${notification.id}`,
        userId: data.senderId,
        resource: `notification/${notification.id}`,
        metadata: {
          notificationId: notification.id,
          recipientUserId: data.userId,
          type: resolvedType,
          priority: resolvedPriority,
        },
      });

      return {
        success: true,
        channel: 'in-app',
        recipientCount: 1,
        notificationId: notification.id,
      };
    } catch (error: unknown) {
      logger.error('Failed to create in-app notification:', error);
      return {
        success: false,
        channel: 'in-app',
        recipientCount: 0,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * List notifications for a user with pagination and optional filters.
   */
  async listForUser(
    userId: string,
    options: { page?: number; pageSize?: number; unreadOnly?: boolean; type?: string } = {}
  ): Promise<{ data: Notification[]; total: number }> {
    const page = Math.max(options.page ?? 1, 1);
    const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);

    const where: FindOptionsWhere<Notification> = { userId };
    if (options.unreadOnly) {
      where.read = false;
    }
    if (options.type) {
      where.type = options.type as Notification['type'];
    }

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { data, total };
  }

  /**
   * Mark specific notifications as read (scoped to owner).
   * Limit to 100 IDs per call to prevent oversized SQL IN clauses.
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<number> {
    if (!notificationIds.length) {
      return 0;
    }
    if (notificationIds.length > 100) {
      logger.warn('markAsRead called with >100 IDs, truncating', {
        userId,
        requested: notificationIds.length,
      });
      notificationIds = notificationIds.slice(0, 100);
    }

    const result = await this.notificationRepo.update(
      { id: In(notificationIds), userId, read: false },
      { read: true, readAt: new Date() }
    );

    logger.info('Marked notifications as read', {
      userId,
      requestedCount: notificationIds.length,
      affected: result.affected ?? 0,
    });

    auditService.log({
      category: AuditCategory.ADMIN,
      action: 'NOTIFICATIONS_MARKED_READ',
      message: `Marked ${result.affected ?? 0} notifications as read for user ${userId}`,
      userId,
      resource: 'notification',
      metadata: {
        affected: result.affected ?? 0,
        requestedCount: notificationIds.length,
      },
    });

    return result.affected ?? 0;
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepo.update(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    logger.info('Marked all notifications as read', {
      userId,
      affected: result.affected ?? 0,
    });

    auditService.log({
      category: AuditCategory.ADMIN,
      action: 'ALL_NOTIFICATIONS_MARKED_READ',
      message: `Marked all notifications as read for user ${userId}`,
      userId,
      resource: 'notification',
      metadata: {
        affected: result.affected ?? 0,
      },
    });

    return result.affected ?? 0;
  }

  /**
   * Delete a notification (scoped to owner).
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.notificationRepo.delete({ id: notificationId, userId });

    logger.info('Deleted notification', {
      userId,
      notificationId,
      deleted: (result.affected ?? 0) > 0,
    });

    auditService.log({
      category: AuditCategory.ADMIN,
      action: 'NOTIFICATION_DELETED',
      message: `Deleted notification ${notificationId} for user ${userId}`,
      userId,
      resource: `notification/${notificationId}`,
      metadata: {
        affected: result.affected ?? 0,
      },
    });

    return (result.affected ?? 0) > 0;
  }

  /**
   * Get unread count for a user (useful for badge display).
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { userId, read: false } });
  }

  /**
   * Send Discord notification
   */
  async sendDiscordNotification(
    message: NotificationMessage,
    channelId?: string
  ): Promise<NotificationResult> {
    try {
      if (!this.discordClient) {
        throw new Error('Discord client not configured');
      }

      const targetChannelId = channelId || this.defaultChannelId;
      if (!targetChannelId) {
        throw new Error('No Discord channel specified');
      }

      const channel = await this.discordClient.channels.fetch(targetChannelId);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error('Invalid Discord channel');
      }

      const content = message.embed ? { embeds: [message.embed] } : message.body;
      await channel.send(content);

      const dmCount = await this.sendDiscordDMs(message);

      logger.info('Sent Discord notification', {
        channelId: targetChannelId,
        dmCount,
      });

      auditService.log({
        category: AuditCategory.DISCORD,
        action: 'DISCORD_NOTIFICATION_SENT',
        message: `Sent Discord notification to channel ${targetChannelId}`,
        resource: `discord/channel/${targetChannelId}`,
        metadata: {
          dmCount,
          recipientIdCount: message.recipientIds?.length ?? 0,
        },
      });

      return {
        success: true,
        channel: 'discord',
        recipientCount: dmCount,
      };
    } catch (error: unknown) {
      logger.error('Failed to send Discord notification:', error);
      return {
        success: false,
        channel: 'discord',
        recipientCount: 0,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Send Discord DMs to specified recipients
   */
  private async sendDiscordDMs(message: NotificationMessage): Promise<number> {
    if (!this.discordClient || !message.recipientIds?.length) {
      return 0;
    }

    let dmCount = 0;
    const content = message.embed ? { embeds: [message.embed] } : message.body;

    for (const userId of message.recipientIds) {
      try {
        const user = await this.discordClient.users.fetch(userId);
        await user.send(content);
        dmCount++;
      } catch (error: unknown) {
        logger.error(`Failed to send DM to user ${userId}:`, error);
      }
    }

    return dmCount;
  }

  /**
   * Send Email notification
   */
  async sendEmailNotification(message: NotificationMessage): Promise<NotificationResult> {
    try {
      if (!this.emailTransporter || !this.emailConfig) {
        throw new Error('Email transporter not configured');
      }

      if (!message.recipientEmails || message.recipientEmails.length === 0) {
        throw new Error('No email recipients specified');
      }

      const mailOptions = {
        from: this.emailConfig.from,
        to: message.recipientEmails.join(', '),
        subject: message.subject,
        text: message.body,
        html: this.formatEmailBody(message.body, message.embed),
      };

      const _info = await this.emailTransporter.sendMail(mailOptions);

      logger.info('Sent email notification', {
        recipientCount: message.recipientEmails.length,
        subject: message.subject,
      });

      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'EMAIL_NOTIFICATION_SENT',
        message: `Sent email notification with subject \"${message.subject}\"`,
        resource: 'notification/email',
        metadata: {
          recipientCount: message.recipientEmails.length,
        },
      });

      return {
        success: true,
        channel: 'email',
        recipientCount: message.recipientEmails.length,
      };
    } catch (error: unknown) {
      logger.error('Failed to send email notification:', error);
      return {
        success: false,
        channel: 'email',
        recipientCount: 0,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Send notification via both channels
   */
  async sendMultiChannelNotification(
    message: NotificationMessage,
    channels: ('discord' | 'email')[],
    channelId?: string
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      if (channel === 'discord') {
        const result = await this.sendDiscordNotification(message, channelId);
        results.push(result);
      } else if (channel === 'email') {
        const result = await this.sendEmailNotification(message);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Create event reminder embed
   */
  createEventReminderEmbed(
    eventTitle: string,
    eventDate: Date,
    eventLocation: string,
    timeUntil: string,
    additionalInfo?: string
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle(`⏰ Event Reminder: ${decodeHtmlEntities(eventTitle)}`)
      .setDescription(`This is a reminder for the upcoming tactical operation.`)
      .addFields(
        { name: '📅 Date & Time', value: eventDate.toLocaleString(), inline: true },
        { name: '📍 Location', value: decodeHtmlEntities(eventLocation), inline: true },
        { name: '⏳ Time Until Event', value: timeUntil, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Make sure you're prepared and ready!" });

    if (additionalInfo) {
      embed.addFields({ name: 'ℹ️ Additional Info', value: decodeHtmlEntities(additionalInfo) });
    }

    return embed;
  }

  /**
   * Create attendance confirmation embed
   */
  createAttendanceConfirmationEmbed(
    eventTitle: string,
    eventDate: Date,
    attendeeCount: number
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`✅ Attendance Confirmation Required: ${decodeHtmlEntities(eventTitle)}`)
      .setDescription(`Please confirm your attendance for the operation that took place.`)
      .addFields(
        { name: '📅 Event Date', value: eventDate.toLocaleString() },
        { name: '👥 Expected Attendees', value: `${attendeeCount}` },
        {
          name: '🎯 Action Required',
          value: 'Please use `/attendance confirm` or `/attendance noshow` to update your status.',
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Your attendance tracking helps us plan better!' });
  }

  /**
   * Create conflict warning embed
   */
  createConflictWarningEmbed(
    eventTitle: string,
    conflicts: Array<{ eventTitle: string; eventDate: Date }>
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`⚠️ Event Conflict Detected`)
      .setDescription(
        `The event "${decodeHtmlEntities(eventTitle)}" conflicts with other scheduled events:`
      )
      .setTimestamp();

    conflicts.forEach((conflict, index) => {
      embed.addFields({
        name: `Conflict ${index + 1}: ${decodeHtmlEntities(conflict.eventTitle)}`,
        value: `📅 ${conflict.eventDate.toLocaleString()}`,
      });
    });

    embed.addFields({
      name: '💡 Suggestion',
      value: 'Consider rescheduling one of these events or confirming with participants.',
    });

    return embed;
  }

  /**
   * Escape HTML special characters to prevent XSS in email bodies.
   */
  private escapeHtml(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /**
   * Format email body with HTML
   */
  private formatEmailBody(plainText: string, _embed?: EmbedBuilder): string {
    const safeText = this.escapeHtml(plainText);
    const html = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #00d9ff; color: white; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .field { margin: 10px 0; padding: 10px; background: white; border-left: 4px solid #00d9ff; }
                .field-name { font-weight: bold; color: #00d9ff; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Star Citizen Fleet Manager</h1>
                </div>
                <div class="content">
                    ${safeText.replaceAll('\n', '<br>')}
                </div>
                <div class="footer">
                    <p>This is an automated notification from Star Citizen Fleet Manager.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;

    return html;
  }

  /**
   * Test notification configuration
   */
  async testConfiguration(): Promise<{ discord: boolean; email: boolean }> {
    const result = {
      discord: false,
      email: false,
    };

    // Test Discord
    if (this.discordClient?.isReady()) {
      result.discord = true;
    }

    // Test Email
    if (this.emailTransporter) {
      try {
        await this.emailTransporter.verify();
        result.email = true;
      } catch (error: unknown) {
        logger.error('Email configuration test failed:', error);
      }
    }

    return result;
  }
}
