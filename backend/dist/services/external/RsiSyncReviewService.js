"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiSyncReviewService = exports.RsiSyncReviewService = exports.ReviewResolution = exports.ReviewReason = void 0;
const data_source_1 = require("../../data-source");
const RsiUserLink_1 = require("../../models/RsiUserLink");
const logger_1 = require("../../utils/logger");
var ReviewReason;
(function (ReviewReason) {
    ReviewReason["RANK_MISMATCH"] = "rank_mismatch";
    ReviewReason["HANDLE_NOT_FOUND"] = "handle_not_found";
    ReviewReason["MULTIPLE_FAILURES"] = "multiple_failures";
    ReviewReason["MANUAL_FLAG"] = "manual_flag";
    ReviewReason["AFFILIATE_CHANGE"] = "affiliate_change";
    ReviewReason["SUSPICIOUS_ACTIVITY"] = "suspicious_activity";
    ReviewReason["USERNAME_MATCH"] = "username_match";
    ReviewReason["DISCORD_NAME_MATCH"] = "discord_name_match";
})(ReviewReason || (exports.ReviewReason = ReviewReason = {}));
var ReviewResolution;
(function (ReviewResolution) {
    ReviewResolution["APPROVED"] = "approved";
    ReviewResolution["REJECTED"] = "rejected";
    ReviewResolution["RESYNCED"] = "resynced";
    ReviewResolution["REMOVED"] = "removed";
})(ReviewResolution || (exports.ReviewResolution = ReviewResolution = {}));
class RsiSyncReviewService {
    userLinkRepository;
    constructor() {
        this.userLinkRepository = data_source_1.AppDataSource.getRepository(RsiUserLink_1.RsiUserLink);
        logger_1.logger.info('RsiSyncReviewService initialized');
    }
    async getReviewQueue(organizationId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const clampedLimit = Math.min(Math.max(limit, 1), 100);
        const clampedOffset = Math.max(offset, 0);
        const [links, total] = await this.userLinkRepository.findAndCount({
            where: {
                organizationId,
                syncStatus: RsiUserLink_1.SyncStatus.NEEDS_REVIEW,
            },
            order: { updatedAt: 'DESC' },
            take: clampedLimit,
            skip: clampedOffset,
        });
        const items = links.map(link => ({
            id: link.id,
            userId: link.userId,
            rsiHandle: link.rsiHandle,
            syncStatus: link.syncStatus,
            lastKnownRank: link.lastKnownRank ?? null,
            isAffiliate: link.isAffiliate,
            discordUserId: link.discordUserId ?? null,
            reviewReason: link.metadata?.reviewReason ?? null,
            reviewFlaggedAt: link.metadata?.reviewFlaggedAt ?? null,
            lastFailureReason: link.metadata?.lastFailureReason ?? null,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
        }));
        return { items, total };
    }
    async resolveReviewItem(input, adminId) {
        const link = await this.userLinkRepository.findOne({
            where: { id: input.linkId },
        });
        if (!link) {
            return null;
        }
        switch (input.resolution) {
            case ReviewResolution.APPROVED:
                link.markSynced(input.updatedRank ?? link.lastKnownRank ?? undefined);
                break;
            case ReviewResolution.REJECTED:
                link.markFailed(`Rejected by admin: ${input.adminNotes ?? 'No reason provided'}`);
                break;
            case ReviewResolution.RESYNCED:
                link.syncStatus = RsiUserLink_1.SyncStatus.PENDING;
                if (input.updatedRank) {
                    link.lastKnownRank = input.updatedRank;
                }
                break;
            case ReviewResolution.REMOVED:
                link.markRemoved();
                break;
        }
        link.metadata = {
            ...link.metadata,
            lastReviewResolution: input.resolution,
            reviewResolvedBy: adminId,
            reviewResolvedAt: new Date().toISOString(),
            reviewAdminNotes: input.adminNotes ?? null,
        };
        const saved = await this.userLinkRepository.save(link);
        logger_1.logger.info(`Review item ${input.linkId} resolved as ${input.resolution} by ${adminId}`, {
            linkId: input.linkId,
            resolution: input.resolution,
            adminId,
        });
        return saved;
    }
    async flagForReview(linkId, reason, additionalContext) {
        const link = await this.userLinkRepository.findOne({
            where: { id: linkId },
        });
        if (!link) {
            return null;
        }
        link.markNeedsReview(reason);
        if (additionalContext) {
            link.metadata = {
                ...link.metadata,
                ...additionalContext,
            };
        }
        const saved = await this.userLinkRepository.save(link);
        logger_1.logger.info(`Link ${linkId} flagged for review: ${reason}`, {
            linkId,
            reason,
            rsiHandle: link.rsiHandle,
            organizationId: link.organizationId,
        });
        return saved;
    }
    async getReviewStats(organizationId) {
        const pendingItems = await this.userLinkRepository.find({
            where: {
                organizationId,
                syncStatus: RsiUserLink_1.SyncStatus.NEEDS_REVIEW,
            },
            order: { updatedAt: 'ASC' },
        });
        const byReason = {};
        for (const item of pendingItems) {
            const reason = item.metadata?.reviewReason ?? 'unknown';
            byReason[reason] = (byReason[reason] ?? 0) + 1;
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const resolvedCount = await this.userLinkRepository
            .createQueryBuilder('link')
            .where('link.organizationId = :organizationId', { organizationId })
            .andWhere("link.metadata->>'reviewResolvedAt' IS NOT NULL")
            .andWhere("(link.metadata->>'reviewResolvedAt')::timestamp >= :since", {
            since: thirtyDaysAgo.toISOString(),
        })
            .getCount();
        return {
            totalPendingReview: pendingItems.length,
            byReason,
            oldestReviewItem: pendingItems.length > 0 ? pendingItems[0].updatedAt : null,
            resolvedLast30Days: resolvedCount,
        };
    }
    async flagMultipleFailures(organizationId, failureThreshold = 3) {
        const failedLinks = await this.userLinkRepository.find({
            where: {
                organizationId,
                syncStatus: RsiUserLink_1.SyncStatus.FAILED,
            },
        });
        let flagged = 0;
        for (const link of failedLinks) {
            const failureCount = link.metadata?.consecutiveFailures ?? 1;
            if (failureCount >= failureThreshold) {
                link.markNeedsReview(ReviewReason.MULTIPLE_FAILURES);
                link.metadata = {
                    ...link.metadata,
                    consecutiveFailures: failureCount,
                };
                await this.userLinkRepository.save(link);
                flagged++;
            }
        }
        if (flagged > 0) {
            logger_1.logger.info(`Flagged ${flagged} links for review in org ${organizationId} (threshold: ${failureThreshold})`);
        }
        return flagged;
    }
}
exports.RsiSyncReviewService = RsiSyncReviewService;
exports.rsiSyncReviewService = new RsiSyncReviewService();
//# sourceMappingURL=RsiSyncReviewService.js.map