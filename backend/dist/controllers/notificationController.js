"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const NotificationDigestService_1 = require("../services/communication/notifications/NotificationDigestService");
const NotificationPreferencesService_1 = require("../services/communication/notifications/NotificationPreferencesService");
const NotificationService_1 = require("../services/communication/notifications/NotificationService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class NotificationController extends BaseController_1.BaseController {
    notificationService;
    digestService;
    preferencesService;
    constructor() {
        super();
        this.notificationService = new NotificationService_1.NotificationService();
        this.digestService = new NotificationDigestService_1.NotificationDigestService();
        this.preferencesService = new NotificationPreferencesService_1.NotificationPreferencesService();
    }
    sendNotification = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const { type, title, message, recipientIds, channel, data, recipientEmails, priority } = req.body;
            if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
                const sendsToOthers = recipientIds.some((id) => id !== userId);
                if (sendsToOthers) {
                    throw new apiErrors_1.ValidationError('Sending notifications to other users is not yet supported. Use recipientIds with your own userId or omit it.');
                }
            }
            if (channel === 'in-app' || !channel) {
                const results = [];
                const recipients = recipientIds || [userId];
                for (const recipientId of recipients) {
                    const result = await this.notificationService.create({
                        userId: recipientId,
                        type: type || 'info',
                        title,
                        message,
                        data,
                        priority,
                        senderId: userId,
                    });
                    results.push(result);
                }
                this.sendSuccess(res, { message: 'Notifications sent', results }, 201);
            }
            else if (channel === 'discord') {
                const result = await this.notificationService.sendDiscordNotification({
                    subject: title,
                    body: message,
                    recipientIds,
                });
                this.sendSuccess(res, result);
            }
            else if (channel === 'email') {
                const result = await this.notificationService.sendEmailNotification({
                    subject: title,
                    body: message,
                    recipientEmails,
                });
                this.sendSuccess(res, result);
            }
            else {
                throw new apiErrors_1.ValidationError('Unsupported notification channel. Use: in-app, discord, email');
            }
        });
    };
    listNotifications = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const { page, limit } = this.getPaginationParams(req);
            const unreadOnly = (0, queryUtils_1.parseBooleanQuery)(req.query.unreadOnly);
            const type = req.query.type;
            const { data, total } = await this.notificationService.listForUser(userId, {
                page,
                pageSize: limit,
                unreadOnly,
                type,
            });
            const unreadCount = await this.notificationService.getUnreadCount(userId);
            const response = this.createPaginatedResponse(data, total, page, limit);
            return { ...response, unreadCount };
        });
    };
    markAsRead = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const { notificationIds } = req.body;
            if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
                throw new apiErrors_1.ValidationError('notificationIds must be a non-empty array');
            }
            const affected = await this.notificationService.markAsRead(userId, notificationIds);
            logger_1.logger.info('Notifications marked as read', {
                userId,
                requested: notificationIds.length,
                affected,
            });
            this.sendSuccess(res, { message: 'Notifications marked as read', affected });
        });
    };
    markAllAsRead = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const affected = await this.notificationService.markAllAsRead(userId);
            logger_1.logger.info('All notifications marked as read', { userId, affected });
            this.sendSuccess(res, { message: 'All notifications marked as read', affected });
        });
    };
    deleteNotification = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const { notificationId } = req.params;
            const deleted = await this.notificationService.deleteNotification(userId, notificationId);
            if (!deleted) {
                throw new apiErrors_1.ValidationError('Notification not found or already deleted');
            }
            logger_1.logger.info('Notification deleted', { userId, notificationId });
            this.sendMessage(res, 'Notification deleted');
        });
    };
    getPreferences = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const prefs = await this.preferencesService.getOrCreate(userId);
            return {
                muteAll: prefs.muteAll,
                channels: prefs.channels,
                categories: prefs.categories,
                digestFrequency: prefs.digestFrequency,
            };
        });
    };
    updatePreferences = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const { muteAll, channels, categories, digestFrequency } = req.body;
            const prefs = await this.preferencesService.update(userId, {
                muteAll,
                channels,
                categories,
                digestFrequency,
            });
            logger_1.logger.info('Notification preferences updated', { userId });
            return {
                muteAll: prefs.muteAll,
                channels: prefs.channels,
                categories: prefs.categories,
                digestFrequency: prefs.digestFrequency,
            };
        });
    };
    getDigest = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const { digestId } = req.query;
            if (digestId) {
                return this.digestService.getDigest(digestId);
            }
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            return this.digestService.generateDigest(userId, NotificationDigestService_1.DigestFrequency.DAILY, dayAgo, now);
        });
    };
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=notificationController.js.map