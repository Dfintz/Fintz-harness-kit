"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BountyNotificationService = exports.BountyNotificationType = void 0;
const logger_1 = require("../../utils/logger");
const notificationWebSocketController_1 = require("../../websocket/controllers/notificationWebSocketController");
const hunterRankMilestones_1 = require("./hunterRankMilestones");
var BountyNotificationType;
(function (BountyNotificationType) {
    BountyNotificationType["BOUNTY_CREATED"] = "bounty_created";
    BountyNotificationType["BOUNTY_CLAIMED"] = "bounty_claimed";
    BountyNotificationType["BOUNTY_SUBMITTED"] = "bounty_submitted";
    BountyNotificationType["BOUNTY_APPROVED"] = "bounty_approved";
    BountyNotificationType["BOUNTY_REJECTED"] = "bounty_rejected";
    BountyNotificationType["BOUNTY_PAID"] = "bounty_paid";
    BountyNotificationType["BOUNTY_CANCELLED"] = "bounty_cancelled";
    BountyNotificationType["BOUNTY_EXPIRED"] = "bounty_expired";
    BountyNotificationType["HUNTER_RANK_CHANGED"] = "hunter_rank_changed";
})(BountyNotificationType || (exports.BountyNotificationType = BountyNotificationType = {}));
class BountyNotificationService {
    notifyBountyCreated(bounty) {
        try {
            (0, notificationWebSocketController_1.sendOrganizationNotification)(bounty.organizationId, {
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
            logger_1.logger.debug('Sent bounty created notification', { bountyId: bounty.id });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty created notification', { bountyId: bounty.id, error });
        }
    }
    notifyBountyClaimed(bounty, claim) {
        try {
            (0, notificationWebSocketController_1.sendUserNotification)(bounty.createdBy, {
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
            logger_1.logger.debug('Sent bounty claimed notification to creator', {
                bountyId: bounty.id,
                creatorId: bounty.createdBy,
                hunterId: claim.hunterId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty claimed notification', { bountyId: bounty.id, error });
        }
    }
    notifyBountySubmitted(bounty, claim) {
        try {
            (0, notificationWebSocketController_1.sendUserNotification)(bounty.createdBy, {
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
            logger_1.logger.debug('Sent bounty submission notification to creator', {
                bountyId: bounty.id,
                creatorId: bounty.createdBy,
                hunterId: claim.hunterId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty submission notification', { bountyId: bounty.id, error });
        }
    }
    notifyBountyApproved(bounty, claim, verifierName) {
        try {
            (0, notificationWebSocketController_1.sendUserNotification)(claim.hunterId, {
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
            (0, notificationWebSocketController_1.sendOrganizationNotification)(bounty.organizationId, {
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
            logger_1.logger.debug('Sent bounty approved notifications', {
                bountyId: bounty.id,
                hunterId: claim.hunterId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty approved notification', { bountyId: bounty.id, error });
        }
    }
    notifyHunterRankPromotion(profile, previousRank, newRank) {
        const celebration = (0, hunterRankMilestones_1.formatHunterRankPromotion)(previousRank, newRank);
        if (!celebration) {
            return;
        }
        try {
            (0, notificationWebSocketController_1.sendUserNotification)(profile.userId, {
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
            (0, notificationWebSocketController_1.sendOrganizationNotification)(profile.organizationId, {
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
            logger_1.logger.debug('Sent hunter rank promotion notifications', {
                hunterId: profile.userId,
                previousRank,
                newRank,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send hunter rank promotion notification', {
                hunterId: profile.userId,
                error,
            });
        }
    }
    notifyBountyRejected(bounty, claim, verifierName, reason) {
        try {
            const reasonText = reason ? ` Reason: ${reason}` : '';
            (0, notificationWebSocketController_1.sendUserNotification)(claim.hunterId, {
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
            logger_1.logger.debug('Sent bounty rejected notification', {
                bountyId: bounty.id,
                hunterId: claim.hunterId,
                reason,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty rejected notification', { bountyId: bounty.id, error });
        }
    }
    notifyBountyPaid(bounty, claim, paymentReference) {
        try {
            const refText = paymentReference ? ` (Ref: ${paymentReference})` : '';
            (0, notificationWebSocketController_1.sendUserNotification)(claim.hunterId, {
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
            logger_1.logger.debug('Sent bounty paid notification', {
                bountyId: bounty.id,
                hunterId: claim.hunterId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty paid notification', { bountyId: bounty.id, error });
        }
    }
    notifyBountyCancelled(bounty, claim, reason) {
        try {
            const reasonText = reason ? ` Reason: ${reason}` : '';
            if (claim) {
                (0, notificationWebSocketController_1.sendUserNotification)(claim.hunterId, {
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
            (0, notificationWebSocketController_1.sendOrganizationNotification)(bounty.organizationId, {
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
            logger_1.logger.debug('Sent bounty cancelled notification', {
                bountyId: bounty.id,
                hunterId: claim?.hunterId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty cancelled notification', { bountyId: bounty.id, error });
        }
    }
    notifyBountyExpired(bounty, claim) {
        try {
            (0, notificationWebSocketController_1.sendUserNotification)(bounty.createdBy, {
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
            if (claim) {
                (0, notificationWebSocketController_1.sendUserNotification)(claim.hunterId, {
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
            logger_1.logger.debug('Sent bounty expired notifications', {
                bountyId: bounty.id,
                creatorId: bounty.createdBy,
                hunterId: claim?.hunterId,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send bounty expired notification', { bountyId: bounty.id, error });
        }
    }
}
exports.BountyNotificationService = BountyNotificationService;
//# sourceMappingURL=BountyNotificationService.js.map