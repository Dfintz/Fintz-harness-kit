"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HunterProfileService = exports.HunterProfileAuditAction = void 0;
const data_source_1 = require("../../data-source");
const Bounty_1 = require("../../models/Bounty");
const BountyClaim_1 = require("../../models/BountyClaim");
const HunterProfile_1 = require("../../models/HunterProfile");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const BountyNotificationService_1 = require("./BountyNotificationService");
var HunterProfileAuditAction;
(function (HunterProfileAuditAction) {
    HunterProfileAuditAction["PROFILE_CREATED"] = "PROFILE_CREATED";
    HunterProfileAuditAction["PROFILE_UPDATED"] = "PROFILE_UPDATED";
    HunterProfileAuditAction["STATS_RECALCULATED"] = "STATS_RECALCULATED";
    HunterProfileAuditAction["RANK_CHANGED"] = "RANK_CHANGED";
})(HunterProfileAuditAction || (exports.HunterProfileAuditAction = HunterProfileAuditAction = {}));
class HunterProfileService {
    profileRepository;
    claimRepository;
    bountyRepository;
    notificationService;
    constructor() {
        this.profileRepository = data_source_1.AppDataSource.getRepository(HunterProfile_1.HunterProfile);
        this.claimRepository = data_source_1.AppDataSource.getRepository(BountyClaim_1.BountyClaim);
        this.bountyRepository = data_source_1.AppDataSource.getRepository(Bounty_1.Bounty);
        this.notificationService = new BountyNotificationService_1.BountyNotificationService();
    }
    logProfileAudit(action, profile, performedById, performedByName, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: performedById,
            username: performedByName,
            resource: `hunter-profile/${profile.id}`,
            action,
            message: `Hunter profile ${action}: ${profile.userName || profile.userId}`,
            metadata: {
                profileId: profile.id,
                userId: profile.userId,
                ...details,
            },
        });
        logger_1.logger.debug('Hunter profile audit logged', {
            action,
            profileId: profile.id,
            performedBy: performedByName,
        });
    }
    async getOrCreateProfile(organizationId, userId, userName) {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_RE.test(userId)) {
            throw new apiErrors_1.ValidationError(`Invalid user ID format: expected UUID`);
        }
        let profile = await this.profileRepository.findOne({
            where: { userId, organizationId },
        });
        if (!profile) {
            profile = this.profileRepository.create({
                userId,
                userName,
                organizationId,
                totalBountiesCompleted: 0,
                totalBountiesClaimed: 0,
                totalBountiesAbandoned: 0,
                totalBountiesRejected: 0,
                totalRewardsEarned: 0,
                successRate: 0,
                averageCompletionTimeMinutes: 0,
                rank: HunterProfile_1.HunterRank.ROOKIE,
                reputationScore: 0,
                killBountiesCompleted: 0,
                captureBountiesCompleted: 0,
                intelBountiesCompleted: 0,
                transportBountiesCompleted: 0,
                rescueBountiesCompleted: 0,
                customBountiesCompleted: 0,
                currentStreak: 0,
                longestStreak: 0,
            });
            profile = await this.profileRepository.save(profile);
            this.logProfileAudit(HunterProfileAuditAction.PROFILE_CREATED, profile, userId, userName || userId);
            logger_1.logger.info(`Hunter profile created: ${profile.id} for user ${userId}`);
        }
        else if (userName && profile.userName !== userName) {
            profile.userName = userName;
            profile = await this.profileRepository.save(profile);
        }
        return profile;
    }
    async getProfileByUserId(organizationId, userId) {
        return this.profileRepository.findOne({
            where: { userId, organizationId },
        });
    }
    async getProfileById(profileId) {
        return this.profileRepository.findOne({
            where: { id: profileId },
        });
    }
    applySpecializationCounts(profile, completedClaims) {
        profile.killBountiesCompleted = 0;
        profile.captureBountiesCompleted = 0;
        profile.intelBountiesCompleted = 0;
        profile.transportBountiesCompleted = 0;
        profile.rescueBountiesCompleted = 0;
        profile.customBountiesCompleted = 0;
        for (const claim of completedClaims) {
            if (!claim.bounty) {
                continue;
            }
            switch (claim.bounty.bountyType) {
                case Bounty_1.BountyType.KILL:
                    profile.killBountiesCompleted++;
                    break;
                case Bounty_1.BountyType.CAPTURE:
                    profile.captureBountiesCompleted++;
                    break;
                case Bounty_1.BountyType.INTEL:
                    profile.intelBountiesCompleted++;
                    break;
                case Bounty_1.BountyType.TRANSPORT:
                    profile.transportBountiesCompleted++;
                    break;
                case Bounty_1.BountyType.RESCUE:
                    profile.rescueBountiesCompleted++;
                    break;
                case Bounty_1.BountyType.CUSTOM:
                    profile.customBountiesCompleted++;
                    break;
            }
        }
    }
    calculateAvgCompletionMinutes(completedClaims) {
        let totalMs = 0;
        let count = 0;
        for (const claim of completedClaims) {
            if (claim.claimedAt && claim.completedAt) {
                totalMs += claim.completedAt.getTime() - claim.claimedAt.getTime();
                count++;
            }
        }
        return count > 0 ? Math.round(totalMs / count / (1000 * 60)) : 0;
    }
    async updateHunterStats(organizationId, userId, userName) {
        const profile = await this.getOrCreateProfile(organizationId, userId, userName);
        const previousRank = profile.rank;
        const statusCounts = await this.claimRepository
            .createQueryBuilder('c')
            .select('c.status', 'status')
            .addSelect('COUNT(*)::int', 'count')
            .where('c."hunterId" = :userId', { userId })
            .andWhere('c."organizationId" = :orgId', { orgId: organizationId })
            .groupBy('c.status')
            .getRawMany();
        const statusMap = new Map(statusCounts.map(r => [r.status, r.count]));
        const totalClaimed = statusCounts.reduce((sum, r) => sum + r.count, 0);
        const completedCount = statusMap.get(BountyClaim_1.BountyClaimStatus.COMPLETED) ?? 0;
        const abandonedCount = statusMap.get(BountyClaim_1.BountyClaimStatus.ABANDONED) ?? 0;
        const rejectedCount = statusMap.get(BountyClaim_1.BountyClaimStatus.REJECTED) ?? 0;
        profile.totalBountiesClaimed = totalClaimed;
        profile.totalBountiesCompleted = completedCount;
        profile.totalBountiesAbandoned = abandonedCount;
        profile.totalBountiesRejected = rejectedCount;
        const totalAttempts = completedCount + abandonedCount + rejectedCount;
        profile.successRate =
            totalAttempts > 0 ? Math.round((completedCount / totalAttempts) * 100 * 100) / 100 : 0;
        const rewardStats = await this.claimRepository
            .createQueryBuilder('c')
            .innerJoin('c.bounty', 'b')
            .select('COALESCE(SUM(b."rewardAmount"), 0)', 'totalRewards')
            .addSelect('AVG(EXTRACT(EPOCH FROM (c."completedAt" - c."claimedAt")) / 60)::int', 'avgMinutes')
            .addSelect('MAX(c."completedAt")', 'lastCompletedAt')
            .where('c."hunterId" = :userId', { userId })
            .andWhere('c."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('c.status = :completed', { completed: BountyClaim_1.BountyClaimStatus.COMPLETED })
            .andWhere('c."completedAt" IS NOT NULL')
            .getRawOne();
        profile.totalRewardsEarned = Number(rewardStats?.totalRewards ?? 0);
        profile.averageCompletionTimeMinutes = rewardStats?.avgMinutes ?? 0;
        if (rewardStats?.lastCompletedAt) {
            profile.lastBountyCompletedAt = new Date(rewardStats.lastCompletedAt);
        }
        const typeCounts = await this.claimRepository
            .createQueryBuilder('c')
            .innerJoin('c.bounty', 'b')
            .select('b."bountyType"', 'bountyType')
            .addSelect('COUNT(*)::int', 'count')
            .where('c."hunterId" = :userId', { userId })
            .andWhere('c."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('c.status = :completed', { completed: BountyClaim_1.BountyClaimStatus.COMPLETED })
            .groupBy('b."bountyType"')
            .getRawMany();
        const typeMap = new Map(typeCounts.map(r => [r.bountyType, r.count]));
        profile.killBountiesCompleted = typeMap.get(Bounty_1.BountyType.KILL) ?? 0;
        profile.captureBountiesCompleted = typeMap.get(Bounty_1.BountyType.CAPTURE) ?? 0;
        profile.intelBountiesCompleted = typeMap.get(Bounty_1.BountyType.INTEL) ?? 0;
        profile.transportBountiesCompleted = typeMap.get(Bounty_1.BountyType.TRANSPORT) ?? 0;
        profile.rescueBountiesCompleted = typeMap.get(Bounty_1.BountyType.RESCUE) ?? 0;
        profile.customBountiesCompleted = typeMap.get(Bounty_1.BountyType.CUSTOM) ?? 0;
        profile.rank = this.calculateRank(profile);
        profile.reputationScore = this.calculateReputationScore(profile);
        const updatedProfile = await this.profileRepository.save(profile);
        this.logProfileAudit(HunterProfileAuditAction.STATS_RECALCULATED, updatedProfile, userId, userName || userId, {
            totalCompleted: profile.totalBountiesCompleted,
            successRate: profile.successRate,
            rank: profile.rank,
        });
        if (updatedProfile.rank !== previousRank) {
            this.logProfileAudit(HunterProfileAuditAction.RANK_CHANGED, updatedProfile, userId, userName || userId, { previousRank, newRank: updatedProfile.rank });
            this.notificationService.notifyHunterRankPromotion(updatedProfile, previousRank, updatedProfile.rank);
        }
        logger_1.logger.info(`Hunter stats updated: ${profile.id}, completed: ${profile.totalBountiesCompleted}, rank: ${profile.rank}`);
        return updatedProfile;
    }
    calculateRank(profile) {
        const { totalBountiesCompleted, successRate } = profile;
        if (totalBountiesCompleted >= 100 && successRate >= 90) {
            return HunterProfile_1.HunterRank.LEGENDARY;
        }
        else if (totalBountiesCompleted >= 50 && successRate >= 85) {
            return HunterProfile_1.HunterRank.ELITE;
        }
        else if (totalBountiesCompleted >= 25 && successRate >= 75) {
            return HunterProfile_1.HunterRank.VETERAN;
        }
        else if (totalBountiesCompleted >= 10 && successRate >= 60) {
            return HunterProfile_1.HunterRank.HUNTER;
        }
        else if (totalBountiesCompleted >= 3) {
            return HunterProfile_1.HunterRank.APPRENTICE;
        }
        return HunterProfile_1.HunterRank.ROOKIE;
    }
    calculateReputationScore(profile) {
        let score = profile.totalBountiesCompleted * 10;
        if (profile.successRate >= 90) {
            score += 100;
        }
        else if (profile.successRate >= 75) {
            score += 50;
        }
        else if (profile.successRate >= 50) {
            score += 25;
        }
        score += profile.currentStreak * 5;
        score += profile.longestStreak * 2;
        if (profile.totalRewardsEarned > 0) {
            score += Math.floor(Math.log10(Number(profile.totalRewardsEarned)) * 10);
        }
        score -= profile.totalBountiesAbandoned * 5;
        score -= profile.totalBountiesRejected * 3;
        return Math.max(0, score);
    }
    calculatePrimarySpecialization(profile) {
        const specializations = [
            { type: 'kill', count: profile.killBountiesCompleted },
            { type: 'capture', count: profile.captureBountiesCompleted },
            { type: 'intel', count: profile.intelBountiesCompleted },
            { type: 'transport', count: profile.transportBountiesCompleted },
            { type: 'rescue', count: profile.rescueBountiesCompleted },
            { type: 'custom', count: profile.customBountiesCompleted },
        ];
        const maxSpec = specializations.reduce((max, spec) => (spec.count > max.count ? spec : max), {
            type: 'none',
            count: 0,
        });
        return maxSpec.count > 0 ? maxSpec.type : 'generalist';
    }
    async getLeaderboard(organizationId, sortBy = 'completed', limit = 10) {
        let orderField;
        switch (sortBy) {
            case 'rewards':
                orderField = 'totalRewardsEarned';
                break;
            case 'successRate':
                orderField = 'successRate';
                break;
            case 'reputation':
                orderField = 'reputationScore';
                break;
            case 'completed':
            default:
                orderField = 'totalBountiesCompleted';
                break;
        }
        const profiles = await this.profileRepository.find({
            where: { organizationId },
            order: { [orderField]: 'DESC' },
            take: limit,
        });
        return profiles.map(profile => ({
            userId: profile.userId,
            userName: profile.userName,
            totalBountiesCompleted: profile.totalBountiesCompleted,
            totalRewardsEarned: Number(profile.totalRewardsEarned),
            successRate: Number(profile.successRate),
            rank: profile.rank,
            reputationScore: profile.reputationScore,
            primarySpecialization: this.calculatePrimarySpecialization(profile),
        }));
    }
    async getHunterHistory(organizationId, userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [claims, total] = await this.claimRepository.findAndCount({
            where: { hunterId: userId, organizationId },
            relations: ['bounty'],
            order: { claimedAt: 'DESC' },
            skip,
            take: limit,
        });
        const history = claims.map(claim => ({
            bountyId: claim.bountyId,
            bountyTitle: claim.bounty?.title || 'Unknown Bounty',
            bountyType: claim.bounty?.bountyType || Bounty_1.BountyType.CUSTOM,
            status: claim.status,
            rewardAmount: claim.bounty?.rewardAmount,
            claimedAt: claim.claimedAt,
            completedAt: claim.completedAt,
        }));
        return {
            history,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getAnalyticsSummary(organizationId) {
        const profiles = await this.profileRepository.find({
            where: { organizationId },
        });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeHunters = profiles.filter(p => p.lastBountyCompletedAt && p.lastBountyCompletedAt > thirtyDaysAgo).length;
        const totalBountiesCompleted = profiles.reduce((sum, p) => sum + p.totalBountiesCompleted, 0);
        const totalRewardsPaid = profiles.reduce((sum, p) => sum + Number(p.totalRewardsEarned), 0);
        const profilesWithActivity = profiles.filter(p => p.totalBountiesClaimed > 0);
        const averageSuccessRate = profilesWithActivity.length > 0
            ? profilesWithActivity.reduce((sum, p) => sum + Number(p.successRate), 0) /
                profilesWithActivity.length
            : 0;
        const topHunters = await this.getLeaderboard(organizationId, 'completed', 5);
        const bountyTypeBreakdown = {
            kill: profiles.reduce((sum, p) => sum + p.killBountiesCompleted, 0),
            capture: profiles.reduce((sum, p) => sum + p.captureBountiesCompleted, 0),
            intel: profiles.reduce((sum, p) => sum + p.intelBountiesCompleted, 0),
            transport: profiles.reduce((sum, p) => sum + p.transportBountiesCompleted, 0),
            rescue: profiles.reduce((sum, p) => sum + p.rescueBountiesCompleted, 0),
            custom: profiles.reduce((sum, p) => sum + p.customBountiesCompleted, 0),
        };
        return {
            totalHunters: profiles.length,
            activeHunters,
            totalBountiesCompleted,
            totalRewardsPaid,
            averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
            topHunters,
            bountyTypeBreakdown,
        };
    }
    async getProfileCount(organizationId) {
        return this.profileRepository.count({
            where: { organizationId },
        });
    }
}
exports.HunterProfileService = HunterProfileService;
//# sourceMappingURL=HunterProfileService.js.map