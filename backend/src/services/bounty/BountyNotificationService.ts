import { Bounty } from '../../models/Bounty';
import { BountyClaim } from '../../models/BountyClaim';
import { HunterProfile, HunterRank } from '../../models/HunterProfile';
import { logger } from '../../utils/logger';
import {
  sendOrganizationNotification,
  sendUserNotification,
} from '../../websocket/controllers/notificationWebSocketController';

import { formatHunterRankPromotion } from './hunterRankMilestones';

/**
 * Notification Types for Bounty System
 */
export enum BountyNotificationType {
  BOUNTY_CREATED = 'bounty_created',
  BOUNTY_CLAIMED = 'bounty_claimed',
  BOUNTY_SUBMITTED = 'bounty_submitted',
  BOUNTY_APPROVED = 'bounty_approved',
  BOUNTY_REJECTED = 'bounty_rejected',
  BOUNTY_PAID = 'bounty_paid',
  BOUNTY_CANCELLED = 'bounty_cancelled',
  BOUNTY_EXPIRED = 'bounty_expired',
  HUNTER_RANK_CHANGED = 'hunter_rank_changed',
}

/**
 * BountyNotificationService
 *
 * Phase 3: Handles notifications for bounty status changes
 * Sends real-time notifications to bounty creators, hunters, and organization members.
 */
export class BountyNotificationService {
  /**
   * Notify when a bounty is created
   */
  notifyBountyCreated(bounty: Bounty): void {
    try {
      // Notify organization about new bounty
      sendOrganizationNotification(bounty.organizationId, {
        type: 'info',
        title: '🎯 New Bounty Posted',
        message: `A new bounty "${bounty.title}" has been posted with a reward of ${bounty.rewardAmount?.toLocaleString() || 'negotiable'} aUEC.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_CREATED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          bountyType: bounty.bountyType,
          rewardAmount: bounty.rewardAmount,
        },
        actionUrl: `/bounties/${bounty.id}`,
      });

      logger.debug('Sent bounty created notification', { bountyId: bounty.id });
    } catch (error: unknown) {
      logger.error('Failed to send bounty created notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify bounty creator when their bounty is claimed
   */
  notifyBountyClaimed(bounty: Bounty, claim: BountyClaim): void {
    try {
      // Notify bounty creator
      sendUserNotification(bounty.createdBy, {
        type: 'info',
        title: '🔔 Bounty Claimed',
        message: `Your bounty "${bounty.title}" has been claimed by ${claim.hunterName || 'a hunter'}.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_CLAIMED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          claimId: claim.id,
          hunterId: claim.hunterId,
          hunterName: claim.hunterName,
        },
        actionUrl: `/bounties/${bounty.id}`,
      });

      logger.debug('Sent bounty claimed notification to creator', {
        bountyId: bounty.id,
        creatorId: bounty.createdBy,
        hunterId: claim.hunterId,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty claimed notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify bounty creator when evidence is submitted for review
   */
  notifyBountySubmitted(bounty: Bounty, claim: BountyClaim): void {
    try {
      // Notify bounty creator about pending review
      sendUserNotification(bounty.createdBy, {
        type: 'info',
        title: '📤 Bounty Submission Ready for Review',
        message: `${claim.hunterName || 'A hunter'} has submitted evidence for bounty "${bounty.title}". Please review and approve or reject.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_SUBMITTED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          claimId: claim.id,
          hunterId: claim.hunterId,
          hunterName: claim.hunterName,
        },
        actionUrl: `/bounties/${bounty.id}/review`,
      });

      logger.debug('Sent bounty submission notification to creator', {
        bountyId: bounty.id,
        creatorId: bounty.createdBy,
        hunterId: claim.hunterId,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty submission notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify hunter when their claim is approved
   */
  notifyBountyApproved(bounty: Bounty, claim: BountyClaim, verifierName: string): void {
    try {
      // Notify hunter about approval
      sendUserNotification(claim.hunterId, {
        type: 'success',
        title: '✅ Bounty Approved!',
        message: `Congratulations! Your completion of bounty "${bounty.title}" has been approved by ${verifierName}. Reward: ${bounty.rewardAmount?.toLocaleString() || 'negotiable'} aUEC.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_APPROVED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          claimId: claim.id,
          rewardAmount: bounty.rewardAmount,
          rewardType: bounty.rewardType,
          verifierName,
        },
        actionUrl: `/bounties/${bounty.id}`,
      });

      // Also notify organization
      sendOrganizationNotification(bounty.organizationId, {
        type: 'success',
        title: '🏆 Bounty Completed',
        message: `${claim.hunterName || 'A hunter'} has successfully completed bounty "${bounty.title}".`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_APPROVED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          hunterId: claim.hunterId,
          hunterName: claim.hunterName,
        },
      });

      logger.debug('Sent bounty approved notifications', {
        bountyId: bounty.id,
        hunterId: claim.hunterId,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty approved notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify a hunter (and their organization) when a bounty rank-up promotes
   * them to a higher tier. Best-effort and promotion-only: a non-promotion
   * transition (demotion / no change) produces no notification, because
   * {@link formatHunterRankPromotion} returns null for it — so a stray
   * RANK_CHANGED for a demotion never sends a celebratory message.
   */
  notifyHunterRankPromotion(
    profile: HunterProfile,
    previousRank: HunterRank,
    newRank: HunterRank
  ): void {
    const celebration = formatHunterRankPromotion(previousRank, newRank);
    if (!celebration) {
      return;
    }

    try {
      // Recognise the promoted hunter directly.
      sendUserNotification(profile.userId, {
        type: 'success',
        title: '🎖️ Hunter Rank Up!',
        message: celebration,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.HUNTER_RANK_CHANGED,
          hunterId: profile.userId,
          hunterName: profile.userName,
          previousRank,
          newRank,
        },
        actionUrl: `/bounty/profile/${profile.userId}`,
      });

      // Celebrate the promotion org-wide (mirrors the bounty-approved fanfare).
      sendOrganizationNotification(profile.organizationId, {
        type: 'success',
        title: '🎖️ Hunter Promoted',
        message: `${profile.userName ?? 'A hunter'} has been promoted to ${newRank}.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.HUNTER_RANK_CHANGED,
          hunterId: profile.userId,
          hunterName: profile.userName,
          previousRank,
          newRank,
        },
      });

      logger.debug('Sent hunter rank promotion notifications', {
        hunterId: profile.userId,
        previousRank,
        newRank,
      });
    } catch (error: unknown) {
      logger.error('Failed to send hunter rank promotion notification', {
        hunterId: profile.userId,
        error,
      });
    }
  }

  /**
   * Notify hunter when their claim is rejected
   */
  notifyBountyRejected(
    bounty: Bounty,
    claim: BountyClaim,
    verifierName: string,
    reason?: string
  ): void {
    try {
      const reasonText = reason ? ` Reason: ${reason}` : '';

      // Notify hunter about rejection
      sendUserNotification(claim.hunterId, {
        type: 'warning',
        title: '❌ Bounty Rejected',
        message: `Your submission for bounty "${bounty.title}" was rejected by ${verifierName}.${reasonText} You may submit again with additional evidence.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_REJECTED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          claimId: claim.id,
          reason,
          verifierName,
        },
        actionUrl: `/bounties/${bounty.id}`,
      });

      logger.debug('Sent bounty rejected notification', {
        bountyId: bounty.id,
        hunterId: claim.hunterId,
        reason,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty rejected notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify hunter when bounty is paid
   */
  notifyBountyPaid(bounty: Bounty, claim: BountyClaim, paymentReference?: string): void {
    try {
      const refText = paymentReference ? ` (Ref: ${paymentReference})` : '';

      // Notify hunter about payment
      sendUserNotification(claim.hunterId, {
        type: 'success',
        title: '💰 Bounty Reward Paid!',
        message: `Your reward of ${bounty.rewardAmount?.toLocaleString() || 'the agreed amount'} aUEC for bounty "${bounty.title}" has been paid.${refText}`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_PAID,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          claimId: claim.id,
          rewardAmount: bounty.rewardAmount,
          paymentReference,
        },
        actionUrl: `/bounties/${bounty.id}`,
      });

      logger.debug('Sent bounty paid notification', {
        bountyId: bounty.id,
        hunterId: claim.hunterId,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty paid notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify hunter when bounty is cancelled
   */
  notifyBountyCancelled(bounty: Bounty, claim?: BountyClaim, reason?: string): void {
    try {
      const reasonText = reason ? ` Reason: ${reason}` : '';

      // If there's an active claim, notify the hunter
      if (claim) {
        sendUserNotification(claim.hunterId, {
          type: 'warning',
          title: '🚫 Bounty Cancelled',
          message: `Bounty "${bounty.title}" has been cancelled by the creator.${reasonText}`,
          category: 'fleet',
          data: {
            notificationType: BountyNotificationType.BOUNTY_CANCELLED,
            bountyId: bounty.id,
            bountyTitle: bounty.title,
            claimId: claim.id,
            reason,
          },
        });
      }

      // Notify organization
      sendOrganizationNotification(bounty.organizationId, {
        type: 'info',
        title: '🚫 Bounty Cancelled',
        message: `Bounty "${bounty.title}" has been cancelled.${reasonText}`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_CANCELLED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          reason,
        },
      });

      logger.debug('Sent bounty cancelled notification', {
        bountyId: bounty.id,
        hunterId: claim?.hunterId,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty cancelled notification', { bountyId: bounty.id, error });
    }
  }

  /**
   * Notify about bounty expiration
   */
  notifyBountyExpired(bounty: Bounty, claim?: BountyClaim): void {
    try {
      // Notify creator
      sendUserNotification(bounty.createdBy, {
        type: 'info',
        title: '⏰ Bounty Expired',
        message: `Your bounty "${bounty.title}" has expired.`,
        category: 'fleet',
        data: {
          notificationType: BountyNotificationType.BOUNTY_EXPIRED,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
        },
        actionUrl: `/bounties/${bounty.id}`,
      });

      // If there was an active claim, notify the hunter
      if (claim) {
        sendUserNotification(claim.hunterId, {
          type: 'info',
          title: '⏰ Bounty Expired',
          message: `Bounty "${bounty.title}" that you claimed has expired.`,
          category: 'fleet',
          data: {
            notificationType: BountyNotificationType.BOUNTY_EXPIRED,
            bountyId: bounty.id,
            bountyTitle: bounty.title,
            claimId: claim.id,
          },
        });
      }

      logger.debug('Sent bounty expired notifications', {
        bountyId: bounty.id,
        creatorId: bounty.createdBy,
        hunterId: claim?.hunterId,
      });
    } catch (error: unknown) {
      logger.error('Failed to send bounty expired notification', { bountyId: bounty.id, error });
    }
  }
}

