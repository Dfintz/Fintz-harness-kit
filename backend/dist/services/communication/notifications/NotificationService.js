"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const nodemailer_1 = __importDefault(require("nodemailer"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../../config/database");
const Notification_1 = require("../../../models/Notification");
const errorHandler_1 = require("../../../utils/errorHandler");
const logger_1 = require("../../../utils/logger");
const AuditService_1 = require("../../audit/AuditService");
class NotificationService {
    discordClient;
    emailTransporter;
    emailConfig;
    defaultChannelId;
    constructor(discordClient, emailConfig, defaultChannelId) {
        this.discordClient = discordClient;
        this.defaultChannelId = defaultChannelId;
        if (emailConfig) {
            this.emailConfig = emailConfig;
            this.emailTransporter = nodemailer_1.default.createTransport({
                host: emailConfig.host,
                port: emailConfig.port,
                secure: emailConfig.secure,
                auth: emailConfig.auth,
            });
        }
    }
    get notificationRepo() {
        return database_1.AppDataSource.getRepository(Notification_1.Notification);
    }
    async create(data) {
        try {
            const validTypes = Object.values(Notification_1.NotificationType);
            const resolvedType = validTypes.includes(data.type ?? '')
                ? data.type
                : Notification_1.NotificationType.INFO;
            const validPriorities = Object.values(Notification_1.NotificationPriority);
            const resolvedPriority = validPriorities.includes(data.priority ?? '')
                ? data.priority
                : Notification_1.NotificationPriority.NORMAL;
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
            logger_1.logger.info('In-app notification persisted', {
                id: notification.id,
                userId: data.userId,
                type: data.type,
                title: data.title,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
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
        }
        catch (error) {
            logger_1.logger.error('Failed to create in-app notification:', error);
            return {
                success: false,
                channel: 'in-app',
                recipientCount: 0,
                error: (0, errorHandler_1.getErrorMessage)(error),
            };
        }
    }
    async listForUser(userId, options = {}) {
        const page = Math.max(options.page ?? 1, 1);
        const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
        const where = { userId };
        if (options.unreadOnly) {
            where.read = false;
        }
        if (options.type) {
            where.type = options.type;
        }
        const [data, total] = await this.notificationRepo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return { data, total };
    }
    async markAsRead(userId, notificationIds) {
        if (!notificationIds.length) {
            return 0;
        }
        if (notificationIds.length > 100) {
            logger_1.logger.warn('markAsRead called with >100 IDs, truncating', {
                userId,
                requested: notificationIds.length,
            });
            notificationIds = notificationIds.slice(0, 100);
        }
        const result = await this.notificationRepo.update({ id: (0, typeorm_1.In)(notificationIds), userId, read: false }, { read: true, readAt: new Date() });
        logger_1.logger.info('Marked notifications as read', {
            userId,
            requestedCount: notificationIds.length,
            affected: result.affected ?? 0,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ADMIN,
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
    async markAllAsRead(userId) {
        const result = await this.notificationRepo.update({ userId, read: false }, { read: true, readAt: new Date() });
        logger_1.logger.info('Marked all notifications as read', {
            userId,
            affected: result.affected ?? 0,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ADMIN,
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
    async deleteNotification(userId, notificationId) {
        const result = await this.notificationRepo.delete({ id: notificationId, userId });
        logger_1.logger.info('Deleted notification', {
            userId,
            notificationId,
            deleted: (result.affected ?? 0) > 0,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ADMIN,
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
    async getUnreadCount(userId) {
        return this.notificationRepo.count({ where: { userId, read: false } });
    }
    async sendDiscordNotification(message, channelId) {
        try {
            if (!this.discordClient) {
                throw new Error('Discord client not configured');
            }
            const targetChannelId = channelId || this.defaultChannelId;
            if (!targetChannelId) {
                throw new Error('No Discord channel specified');
            }
            const channel = await this.discordClient.channels.fetch(targetChannelId);
            if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
                throw new Error('Invalid Discord channel');
            }
            const content = message.embed ? { embeds: [message.embed] } : message.body;
            await channel.send(content);
            const dmCount = await this.sendDiscordDMs(message);
            logger_1.logger.info('Sent Discord notification', {
                channelId: targetChannelId,
                dmCount,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.DISCORD,
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
        }
        catch (error) {
            logger_1.logger.error('Failed to send Discord notification:', error);
            return {
                success: false,
                channel: 'discord',
                recipientCount: 0,
                error: (0, errorHandler_1.getErrorMessage)(error),
            };
        }
    }
    async sendDiscordDMs(message) {
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
            }
            catch (error) {
                logger_1.logger.error(`Failed to send DM to user ${userId}:`, error);
            }
        }
        return dmCount;
    }
    async sendEmailNotification(message) {
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
            logger_1.logger.info('Sent email notification', {
                recipientCount: message.recipientEmails.length,
                subject: message.subject,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
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
        }
        catch (error) {
            logger_1.logger.error('Failed to send email notification:', error);
            return {
                success: false,
                channel: 'email',
                recipientCount: 0,
                error: (0, errorHandler_1.getErrorMessage)(error),
            };
        }
    }
    async sendMultiChannelNotification(message, channels, channelId) {
        const results = [];
        for (const channel of channels) {
            if (channel === 'discord') {
                const result = await this.sendDiscordNotification(message, channelId);
                results.push(result);
            }
            else if (channel === 'email') {
                const result = await this.sendEmailNotification(message);
                results.push(result);
            }
        }
        return results;
    }
    createEventReminderEmbed(eventTitle, eventDate, eventLocation, timeUntil, additionalInfo) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle(`⏰ Event Reminder: ${(0, shared_types_1.decodeHtmlEntities)(eventTitle)}`)
            .setDescription(`This is a reminder for the upcoming tactical operation.`)
            .addFields({ name: '📅 Date & Time', value: eventDate.toLocaleString(), inline: true }, { name: '📍 Location', value: (0, shared_types_1.decodeHtmlEntities)(eventLocation), inline: true }, { name: '⏳ Time Until Event', value: timeUntil, inline: true })
            .setTimestamp()
            .setFooter({ text: "Make sure you're prepared and ready!" });
        if (additionalInfo) {
            embed.addFields({ name: 'ℹ️ Additional Info', value: (0, shared_types_1.decodeHtmlEntities)(additionalInfo) });
        }
        return embed;
    }
    createAttendanceConfirmationEmbed(eventTitle, eventDate, attendeeCount) {
        return new discord_js_1.EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle(`✅ Attendance Confirmation Required: ${(0, shared_types_1.decodeHtmlEntities)(eventTitle)}`)
            .setDescription(`Please confirm your attendance for the operation that took place.`)
            .addFields({ name: '📅 Event Date', value: eventDate.toLocaleString() }, { name: '👥 Expected Attendees', value: `${attendeeCount}` }, {
            name: '🎯 Action Required',
            value: 'Please use `/attendance confirm` or `/attendance noshow` to update your status.',
        })
            .setTimestamp()
            .setFooter({ text: 'Your attendance tracking helps us plan better!' });
    }
    createConflictWarningEmbed(eventTitle, conflicts) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`⚠️ Event Conflict Detected`)
            .setDescription(`The event "${(0, shared_types_1.decodeHtmlEntities)(eventTitle)}" conflicts with other scheduled events:`)
            .setTimestamp();
        conflicts.forEach((conflict, index) => {
            embed.addFields({
                name: `Conflict ${index + 1}: ${(0, shared_types_1.decodeHtmlEntities)(conflict.eventTitle)}`,
                value: `📅 ${conflict.eventDate.toLocaleString()}`,
            });
        });
        embed.addFields({
            name: '💡 Suggestion',
            value: 'Consider rescheduling one of these events or confirming with participants.',
        });
        return embed;
    }
    escapeHtml(text) {
        return text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
    formatEmailBody(plainText, _embed) {
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
    async testConfiguration() {
        const result = {
            discord: false,
            email: false,
        };
        if (this.discordClient?.isReady()) {
            result.discord = true;
        }
        if (this.emailTransporter) {
            try {
                await this.emailTransporter.verify();
                result.email = true;
            }
            catch (error) {
                logger_1.logger.error('Email configuration test failed:', error);
            }
        }
        return result;
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map