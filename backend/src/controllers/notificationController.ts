import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  DigestFrequency,
  NotificationDigestService,
} from '../services/communication/notifications/NotificationDigestService';
import { NotificationPreferencesService } from '../services/communication/notifications/NotificationPreferencesService';
import { NotificationService } from '../services/communication/notifications/NotificationService';
import { ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * NotificationController — Handles notification CRUD and delivery
 * Extends BaseController for standardized error handling
 */
export class NotificationController extends BaseController {
  private readonly notificationService: NotificationService;
  private readonly digestService: NotificationDigestService;
  private readonly preferencesService: NotificationPreferencesService;

  constructor() {
    super();
    this.notificationService = new NotificationService();
    this.digestService = new NotificationDigestService();
    this.preferencesService = new NotificationPreferencesService();
  }

  /**
   * POST /api/v2/notifications
   * Send a notification via specified channel (in-app, discord, email)
   */
  public sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req).id;
      const { type, title, message, recipientIds, channel, data, recipientEmails, priority } =
        req.body;

      // Authorization: only allow sending to self unless recipientIds is not provided
      // Sending to other users requires explicit recipientIds and is restricted
      if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
        const sendsToOthers = recipientIds.some((id: string) => id !== userId);
        if (sendsToOthers) {
          throw new ValidationError(
            'Sending notifications to other users is not yet supported. Use recipientIds with your own userId or omit it.'
          );
        }
      }

      if (channel === 'in-app' || !channel) {
        const results = [];
        const recipients: string[] = recipientIds || [userId];

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
      } else if (channel === 'discord') {
        const result = await this.notificationService.sendDiscordNotification({
          subject: title,
          body: message,
          recipientIds,
        });
        this.sendSuccess(res, result);
      } else if (channel === 'email') {
        const result = await this.notificationService.sendEmailNotification({
          subject: title,
          body: message,
          recipientEmails,
        });
        this.sendSuccess(res, result);
      } else {
        throw new ValidationError('Unsupported notification channel. Use: in-app, discord, email');
      }
    });
  };

  /**
   * GET /api/v2/notifications
   * List notifications for the current user with pagination & optional filters.
   *
   * Query params: page, pageSize, unreadOnly, type
   */
  public listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req).id;
      const { page, limit } = this.getPaginationParams(req);
      const unreadOnly = parseBooleanQuery(req.query.unreadOnly);
      const type = req.query.type as string | undefined;

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

  /**
   * POST /api/v2/notifications/mark-read
   * Mark specific notifications as read
   */
  public markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req).id;
      const { notificationIds } = req.body;

      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        throw new ValidationError('notificationIds must be a non-empty array');
      }

      const affected = await this.notificationService.markAsRead(userId, notificationIds);

      logger.info('Notifications marked as read', {
        userId,
        requested: notificationIds.length,
        affected,
      });

      this.sendSuccess(res, { message: 'Notifications marked as read', affected });
    });
  };

  /**
   * POST /api/v2/notifications/mark-all-read
   * Mark all notifications as read for the current user
   */
  public markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req).id;

      const affected = await this.notificationService.markAllAsRead(userId);

      logger.info('All notifications marked as read', { userId, affected });
      this.sendSuccess(res, { message: 'All notifications marked as read', affected });
    });
  };

  /**
   * DELETE /api/v2/notifications/:notificationId
   * Delete a specific notification
   */
  public deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req).id;
      const { notificationId } = req.params;

      const deleted = await this.notificationService.deleteNotification(userId, notificationId);

      if (!deleted) {
        throw new ValidationError('Notification not found or already deleted');
      }

      logger.info('Notification deleted', { userId, notificationId });
      this.sendMessage(res, 'Notification deleted');
    });
  };

  /**
   * GET /api/v2/notifications/preferences/user
   * Get notification preferences for the current user.
   * Creates default preferences on first access.
   */
  public getPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
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

  /**
   * PUT /api/v2/notifications/preferences/user
   * Update notification preferences (partial merge).
   */
  public updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req).id;
      const { muteAll, channels, categories, digestFrequency } = req.body;

      const prefs = await this.preferencesService.update(userId, {
        muteAll,
        channels,
        categories,
        digestFrequency,
      });

      logger.info('Notification preferences updated', { userId });

      return {
        muteAll: prefs.muteAll,
        channels: prefs.channels,
        categories: prefs.categories,
        digestFrequency: prefs.digestFrequency,
      };
    });
  };

  /**
   * GET /api/v2/notifications/digest
   * Get notification digest for the current user
   */
  public getDigest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req).id;
      const { digestId } = req.query;

      if (digestId) {
        return this.digestService.getDigest(digestId as string);
      }

      // Generate a fresh digest for the user
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return this.digestService.generateDigest(userId, DigestFrequency.DAILY, dayAgo, now);
    });
  };
}
