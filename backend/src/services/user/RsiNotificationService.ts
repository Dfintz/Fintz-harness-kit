/**
 * RSI Verification Notification Service
 *
 * Sends notifications for RSI verification events via email and Discord.
 * Uses the existing NotificationService infrastructure.
 */

import { logger } from '../../utils/logger';
import {
  NotificationMessage,
  NotificationService,
} from '../communication/notifications/NotificationService';

export interface VerificationSuccessPayload {
  userEmail?: string;
  username: string;
  rsiHandle: string;
  displayName?: string;
  discordUserId?: string;
}

export interface VerificationFailedPayload {
  userEmail?: string;
  username: string;
  rsiHandle: string;
  reason: string;
  discordUserId?: string;
}

export interface RoleSyncPayload {
  userEmail?: string;
  username: string;
  rsiHandle: string;
  organizationName: string;
  rolesAdded: string[];
  rolesRemoved: string[];
  discordUserId?: string;
}

export interface ReviewNeededPayload {
  adminEmail?: string;
  adminDiscordUserId?: string;
  rsiHandle: string;
  organizationName: string;
  reason: string;
  linkId: string;
}

/**
 * Service for sending RSI verification-related notifications
 */
export class RsiNotificationService {
  private readonly notificationService: NotificationService;
  private readonly enabled: boolean;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService ?? new NotificationService();
    this.enabled = process.env.ENABLE_RSI_NOTIFICATIONS !== 'false';
  }

  /**
   * Send notification when RSI verification succeeds
   */
  async sendVerificationSuccess(payload: VerificationSuccessPayload): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const message: NotificationMessage = {
        subject: 'RSI Handle Verified Successfully',
        body: [
          `Hello ${payload.username},`,
          '',
          `Your RSI handle "${payload.rsiHandle}" has been successfully verified.`,
          payload.displayName ? `RSI Display Name: ${payload.displayName}` : '',
          '',
          'Your Discord roles will be automatically synced based on your RSI organization rank.',
          '',
          'You can now remove the verification code from your RSI bio.',
          '',
          '- Star Citizen Fleet Manager',
        ]
          .filter(Boolean)
          .join('\n'),
        recipientEmails: payload.userEmail ? [payload.userEmail] : undefined,
        recipientIds: payload.discordUserId ? [payload.discordUserId] : undefined,
      };

      const channels: ('email' | 'discord')[] = [];
      if (payload.userEmail) {
        channels.push('email');
      }
      if (payload.discordUserId) {
        channels.push('discord');
      }

      if (channels.length > 0) {
        await this.notificationService.sendMultiChannelNotification(message, channels);
      }

      logger.info(`RSI verification success notification sent for ${payload.username}`);
    } catch (error: unknown) {
      // Non-critical - log but don't throw
      logger.error('Failed to send RSI verification success notification:', error);
    }
  }

  /**
   * Send notification when RSI verification fails
   */
  async sendVerificationFailed(payload: VerificationFailedPayload): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const message: NotificationMessage = {
        subject: 'RSI Verification Failed',
        body: [
          `Hello ${payload.username},`,
          '',
          `We were unable to verify your RSI handle "${payload.rsiHandle}".`,
          '',
          `Reason: ${payload.reason}`,
          '',
          'Please ensure:',
          '1. The verification code is in your RSI profile bio',
          '2. You saved your RSI profile changes',
          '3. The verification code has not expired (24 hour limit)',
          '',
          'You can try again from your profile page.',
          '',
          '- Star Citizen Fleet Manager',
        ].join('\n'),
        recipientEmails: payload.userEmail ? [payload.userEmail] : undefined,
        recipientIds: payload.discordUserId ? [payload.discordUserId] : undefined,
      };

      const channels: ('email' | 'discord')[] = [];
      if (payload.userEmail) {
        channels.push('email');
      }
      if (payload.discordUserId) {
        channels.push('discord');
      }

      if (channels.length > 0) {
        await this.notificationService.sendMultiChannelNotification(message, channels);
      }

      logger.info(`RSI verification failure notification sent for ${payload.username}`);
    } catch (error: unknown) {
      logger.error('Failed to send RSI verification failure notification:', error);
    }
  }

  /**
   * Send notification when Discord roles are synced
   */
  async sendRoleSyncNotification(payload: RoleSyncPayload): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const addedList =
        payload.rolesAdded.length > 0
          ? `Added: ${payload.rolesAdded.join(', ')}`
          : 'No roles added';
      const removedList =
        payload.rolesRemoved.length > 0
          ? `Removed: ${payload.rolesRemoved.join(', ')}`
          : 'No roles removed';

      const message: NotificationMessage = {
        subject: `Discord Roles Updated - ${payload.organizationName}`,
        body: [
          `Hello ${payload.username},`,
          '',
          `Your Discord roles for "${payload.organizationName}" have been updated based on your RSI rank.`,
          '',
          `RSI Handle: ${payload.rsiHandle}`,
          addedList,
          removedList,
          '',
          '- Star Citizen Fleet Manager',
        ].join('\n'),
        recipientEmails: payload.userEmail ? [payload.userEmail] : undefined,
        recipientIds: payload.discordUserId ? [payload.discordUserId] : undefined,
      };

      const channels: ('email' | 'discord')[] = [];
      if (payload.userEmail) {
        channels.push('email');
      }
      if (payload.discordUserId) {
        channels.push('discord');
      }

      if (channels.length > 0) {
        await this.notificationService.sendMultiChannelNotification(message, channels);
      }

      logger.info(`Discord role sync notification sent for ${payload.username}`);
    } catch (error: unknown) {
      logger.error('Failed to send Discord role sync notification:', error);
    }
  }

  /**
   * Send notification when a link is flagged for admin review
   */
  async sendReviewNeededNotification(payload: ReviewNeededPayload): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const message: NotificationMessage = {
        subject: `RSI Sync Review Required - ${payload.organizationName}`,
        body: [
          'An RSI sync item requires admin review.',
          '',
          `Organization: ${payload.organizationName}`,
          `RSI Handle: ${payload.rsiHandle}`,
          `Reason: ${payload.reason}`,
          `Link ID: ${payload.linkId}`,
          '',
          'Please visit Organization Settings > RSI Sync to review and resolve this item.',
          '',
          '- Star Citizen Fleet Manager',
        ].join('\n'),
        recipientEmails: payload.adminEmail ? [payload.adminEmail] : undefined,
        recipientIds: payload.adminDiscordUserId ? [payload.adminDiscordUserId] : undefined,
      };

      const channels: ('email' | 'discord')[] = [];
      if (payload.adminEmail) {
        channels.push('email');
      }
      if (payload.adminDiscordUserId) {
        channels.push('discord');
      }

      if (channels.length > 0) {
        await this.notificationService.sendMultiChannelNotification(message, channels);
      }

      logger.info(
        `Review needed notification sent for ${payload.rsiHandle} in ${payload.organizationName}`
      );
    } catch (error: unknown) {
      logger.error('Failed to send review needed notification:', error);
    }
  }
}

