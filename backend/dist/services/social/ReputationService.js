"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReputationService = void 0;
const data_source_1 = require("../../data-source");
const LFGReputationRating_1 = require("../../models/LFGReputationRating");
const LFGUserReputation_1 = require("../../models/LFGUserReputation");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const Reputation_1 = require("../../models/Reputation");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const SocialGroupService_1 = require("./SocialGroupService");
class ReputationService {
    ratingRepository;
    userReputationRepository;
    relationshipRepository;
    generalReputationRepository;
    socialGroupService;
    constructor(ratingRepository, reputationRepository, relationshipRepository) {
        this.ratingRepository = ratingRepository || data_source_1.AppDataSource.getRepository(LFGReputationRating_1.LFGReputationRating);
        this.userReputationRepository =
            reputationRepository || data_source_1.AppDataSource.getRepository(LFGUserReputation_1.LFGUserReputation);
        this.relationshipRepository =
            relationshipRepository || data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
        this.generalReputationRepository = data_source_1.AppDataSource.getRepository(Reputation_1.Reputation);
        this.socialGroupService = SocialGroupService_1.SocialGroupService.getInstance();
    }
    async getUnifiedReputation(userId, organizationId) {
        const cacheKey = `reputation:${userId}:${organizationId || 'global'}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for reputation: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.debug(`Cache miss for reputation: ${cacheKey}, fetching from database`);
        const lfgReputation = await this.getUserReputation(userId);
        const tier = lfgReputation.getReputationTier();
        const userReputation = {
            overallScore: lfgReputation.overallScore,
            tier: `${tier.icon} ${tier.tier}`,
            totalSessions: lfgReputation.totalSessions,
            successRate: lfgReputation.successRate,
            averageRating: lfgReputation.averageRating,
        };
        let organizationTrust;
        let avgTrustScore = 50;
        if (organizationId) {
            const relationships = await this.relationshipRepository.find({
                where: { organizationId },
            });
            organizationTrust = relationships.map(rel => ({
                organizationId: rel.targetOrganizationId,
                trustScore: rel.trustScore,
                trustLevel: rel.getTrustLevel(),
                interactionCount: rel.interactionCount,
                sentiment: this.getOverallSentiment(rel),
            }));
            if (relationships.length > 0) {
                avgTrustScore =
                    relationships.reduce((sum, rel) => sum + rel.trustScore, 0) / relationships.length;
            }
        }
        const combinedScore = Math.round(userReputation.overallScore * 0.6 + avgTrustScore * 0.4);
        let reliability;
        if (combinedScore >= 80) {
            reliability = 'Excellent';
        }
        else if (combinedScore >= 60) {
            reliability = 'High';
        }
        else if (combinedScore >= 40) {
            reliability = 'Medium';
        }
        else {
            reliability = 'Low';
        }
        const result = {
            userId,
            userReputation,
            organizationTrust,
            combinedScore,
            reliability,
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
    async getReputationReport(userId, organizationId) {
        const cacheKey = `reputation:report:${userId}:${organizationId || 'global'}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for reputation report: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.debug(`Cache miss for reputation report: ${cacheKey}, fetching from database`);
        const unifiedScore = await this.getUnifiedReputation(userId, organizationId);
        const lfgDetails = await this.getDetailedReputation(userId);
        const recentLfgSessions = lfgDetails.reputation.totalSessions;
        const recentOrgInteractions = organizationId
            ? await this.getRecentInteractionCount(organizationId, 30)
            : 0;
        const recentActivity = {
            lfgSessions: recentLfgSessions,
            organizationInteractions: recentOrgInteractions,
            positiveEvents: lfgDetails.reputation.positiveRatings,
            negativeEvents: lfgDetails.reputation.negativeRatings,
        };
        const { strengths, weaknesses, recommendations } = this.analyzeReputationFactors(lfgDetails, unifiedScore);
        const trend = await this.getReputationTrendAnalysis(userId, organizationId);
        const result = {
            unifiedScore,
            recentActivity,
            strengths,
            weaknesses,
            recommendations,
            trend,
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
    async getReputationTrendAnalysis(userId, _organizationId) {
        const reputation = await this.getUserReputation(userId);
        const recentSuccessRate = reputation.successRate;
        const longestStreak = reputation.longestSuccessStreak;
        const currentStreak = reputation.currentSuccessStreak;
        if (currentStreak >= longestStreak * 0.8) {
            return 'improving';
        }
        else if (recentSuccessRate < 50) {
            return 'declining';
        }
        else {
            return 'stable';
        }
    }
    analyzeReputationFactors(lfgDetails, unifiedScore) {
        const strengths = [];
        const weaknesses = [];
        const recommendations = [];
        const rep = lfgDetails.reputation;
        if (rep.successRate >= 80) {
            strengths.push(`Excellent success rate (${rep.successRate.toFixed(1)}%)`);
        }
        else if (rep.successRate < 50) {
            weaknesses.push(`Low success rate (${rep.successRate.toFixed(1)}%)`);
            recommendations.push('Focus on completing sessions successfully');
        }
        if (rep.averageRating >= 4.5) {
            strengths.push(`Outstanding peer ratings (${rep.averageRating.toFixed(1)}/5)`);
        }
        else if (rep.averageRating < 3) {
            weaknesses.push(`Low peer ratings (${rep.averageRating.toFixed(1)}/5)`);
            recommendations.push('Review feedback and improve collaboration skills');
        }
        if (rep.leadershipSuccessRate >= 75) {
            strengths.push(`Strong leadership record (${rep.leadershipSuccessRate.toFixed(1)}%)`);
        }
        if (rep.currentSuccessStreak >= 5) {
            strengths.push(`Active success streak (${rep.currentSuccessStreak} sessions)`);
        }
        this.analyzeOrgTrust(unifiedScore, strengths, weaknesses, recommendations);
        if (unifiedScore.combinedScore < 50) {
            recommendations.push('Consider taking a break to review and improve', 'Seek mentorship from highly-rated players');
        }
        else if (unifiedScore.combinedScore >= 80) {
            recommendations.push('Maintain current excellence through consistent engagement', 'Consider mentoring newer players');
        }
        return { strengths, weaknesses, recommendations };
    }
    analyzeOrgTrust(unifiedScore, strengths, weaknesses, recommendations) {
        if (!unifiedScore.organizationTrust?.length) {
            return;
        }
        const avgTrust = unifiedScore.organizationTrust.reduce((sum, t) => sum + t.trustScore, 0) / unifiedScore.organizationTrust.length;
        if (avgTrust >= 70) {
            strengths.push(`Strong organizational relationships (avg trust: ${avgTrust.toFixed(0)})`);
        }
        else if (avgTrust < 40) {
            weaknesses.push(`Weak organizational relationships (avg trust: ${avgTrust.toFixed(0)})`);
            recommendations.push('Focus on building positive organizational relationships');
        }
        const negativeRelationships = unifiedScore.organizationTrust.filter((t) => t.trustScore < 30).length;
        if (negativeRelationships > 0) {
            weaknesses.push(`${negativeRelationships} problematic organizational relationship(s)`);
            recommendations.push('Address concerns with organizations showing low trust');
        }
    }
    async compareReputations(userId1, userId2, organizationId) {
        const [rep1, rep2] = await Promise.all([
            this.getUnifiedReputation(userId1, organizationId),
            this.getUnifiedReputation(userId2, organizationId),
        ]);
        const scoreDifference = Math.abs(rep1.combinedScore - rep2.combinedScore);
        const betterUser = rep1.combinedScore > rep2.combinedScore ? userId1 : userId2;
        const categories = [
            {
                category: 'Overall Score',
                user1Score: rep1.combinedScore,
                user2Score: rep2.combinedScore,
                winner: rep1.combinedScore > rep2.combinedScore ? userId1 : userId2,
            },
            {
                category: 'User Reputation',
                user1Score: rep1.userReputation.overallScore,
                user2Score: rep2.userReputation.overallScore,
                winner: rep1.userReputation.overallScore > rep2.userReputation.overallScore ? userId1 : userId2,
            },
            {
                category: 'Success Rate',
                user1Score: rep1.userReputation.successRate,
                user2Score: rep2.userReputation.successRate,
                winner: rep1.userReputation.successRate > rep2.userReputation.successRate ? userId1 : userId2,
            },
            {
                category: 'Peer Rating',
                user1Score: rep1.userReputation.averageRating,
                user2Score: rep2.userReputation.averageRating,
                winner: rep1.userReputation.averageRating > rep2.userReputation.averageRating ? userId1 : userId2,
            },
        ];
        return {
            user1: rep1,
            user2: rep2,
            comparison: {
                scoreDifference,
                betterUser,
                categories,
            },
        };
    }
    async recordReputationEvent(params) {
        if (params.type === 'lfg_rating' && params.userId && params.rating) {
            logger_1.logger.info('LFG rating event recorded', { userId: params.userId, rating: params.rating });
        }
        else if (params.type === 'org_interaction' && params.relationshipId && params.sentiment) {
            logger_1.logger.info('Organization interaction recorded', {
                relationshipId: params.relationshipId,
                sentiment: params.sentiment,
            });
        }
    }
    async getGlobalLeaderboard(limit = 20, organizationId) {
        const lfgLeaderboard = await this.getReputationLeaderboard(limit * 2);
        const CONCURRENCY = 5;
        const combined = [];
        for (let i = 0; i < lfgLeaderboard.length; i += CONCURRENCY) {
            const chunk = lfgLeaderboard.slice(i, i + CONCURRENCY);
            const results = await Promise.all(chunk.map(async (entry) => {
                const unified = await this.getUnifiedReputation(entry.userId, organizationId);
                return {
                    userId: entry.userId,
                    combinedScore: unified.combinedScore,
                    reliability: unified.reliability,
                    userScore: unified.userReputation.overallScore,
                    trustScore: unified.organizationTrust
                        ? unified.organizationTrust.reduce((sum, t) => sum + t.trustScore, 0) /
                            unified.organizationTrust.length
                        : undefined,
                };
            }));
            combined.push(...results);
        }
        const sorted = [...combined].sort((a, b) => b.combinedScore - a.combinedScore);
        return sorted.slice(0, limit);
    }
    async submitRating(params) {
        if (params.userId === params.raterId) {
            throw new Error('Cannot rate yourself');
        }
        if (params.overallRating < 1 || params.overallRating > 5) {
            throw new Error('Overall rating must be between 1 and 5');
        }
        const session = await this.socialGroupService.getSession(params.sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        if (!session.participantIds.includes(params.userId)) {
            throw new Error('User was not in this session');
        }
        if (!session.participantIds.includes(params.raterId)) {
            throw new Error('You were not in this session');
        }
        const existingRating = await this.ratingRepository.findOne({
            where: {
                sessionId: params.sessionId,
                userId: params.userId,
                raterId: params.raterId,
            },
        });
        let rating;
        if (existingRating) {
            existingRating.overallRating = params.overallRating;
            existingRating.categoryRatings = params.categoryRatings;
            existingRating.comment = params.comment;
            existingRating.isPositive = params.overallRating >= 4;
            rating = await this.ratingRepository.save(existingRating);
            logger_1.logger.info(`📝 Updated rating for user ${params.userId} by ${params.raterId}`);
        }
        else {
            rating = this.ratingRepository.create({
                sessionId: params.sessionId,
                userId: params.userId,
                raterId: params.raterId,
                overallRating: params.overallRating,
                categoryRatings: params.categoryRatings,
                comment: params.comment,
                isPositive: params.overallRating >= 4,
            });
            rating = await this.ratingRepository.save(rating);
            logger_1.logger.info(`⭐ New rating submitted for user ${params.userId} by ${params.raterId}`);
        }
        await this.updateUserReputation(params.userId);
        await this.invalidateUserReputation(params.userId);
        return rating;
    }
    async getUserReputation(userId) {
        let reputation = await this.userReputationRepository.findOne({
            where: { userId },
        });
        if (!reputation) {
            reputation = this.userReputationRepository.create({ userId });
            reputation = await this.userReputationRepository.save(reputation);
            logger_1.logger.info(`🆕 Created new reputation profile for user ${userId}`);
        }
        return reputation;
    }
    async updateUserReputation(userId) {
        const reputation = await this.getUserReputation(userId);
        const history = await this.socialGroupService.getUserHistory(userId, 1000);
        const activityStats = await this.socialGroupService.getUserActivityStats(userId);
        reputation.totalSessions = history.length;
        reputation.successfulSessions = history.filter(h => h.wasSuccessful).length;
        reputation.failedSessions = history.length - reputation.successfulSessions;
        reputation.successRate =
            history.length > 0 ? (reputation.successfulSessions / history.length) * 100 : 0;
        reputation.sessionsAsLeader = history.filter(h => h.creatorId === userId).length;
        reputation.successfulLeaderSessions = history.filter(h => h.creatorId === userId && h.wasSuccessful).length;
        reputation.leadershipSuccessRate =
            reputation.sessionsAsLeader > 0
                ? (reputation.successfulLeaderSessions / reputation.sessionsAsLeader) * 100
                : 0;
        let streak = 0;
        for (const entry of history) {
            if (entry.wasSuccessful) {
                streak++;
            }
            else {
                break;
            }
        }
        reputation.currentSuccessStreak = streak;
        reputation.longestSuccessStreak = Math.max(reputation.longestSuccessStreak, streak);
        reputation.activityStats = activityStats;
        const ratings = await this.ratingRepository
            .createQueryBuilder('rating')
            .where('rating.userId = :userId', { userId })
            .getMany();
        reputation.totalRatingsReceived = ratings.length;
        if (ratings.length > 0) {
            const totalRating = ratings.reduce((sum, r) => sum + r.overallRating, 0);
            reputation.averageRating = totalRating / ratings.length;
            reputation.positiveRatings = ratings.filter(r => r.isPositive).length;
            reputation.negativeRatings = ratings.length - reputation.positiveRatings;
            const categoryTotals = {};
            ratings.forEach(rating => {
                if (rating.categoryRatings) {
                    Object.entries(rating.categoryRatings).forEach(([category, value]) => {
                        if (value) {
                            if (!categoryTotals[category]) {
                                categoryTotals[category] = { sum: 0, count: 0 };
                            }
                            categoryTotals[category].sum += value;
                            categoryTotals[category].count++;
                        }
                    });
                }
            });
            const categoryAverages = {};
            Object.entries(categoryTotals).forEach(([category, data]) => {
                categoryAverages[category] = data.sum / data.count;
            });
            reputation.categoryAverages = categoryAverages;
        }
        if (history.length > 0) {
            reputation.lastSessionAt = history[0].completedAt;
        }
        reputation.overallScore = reputation.calculateOverallScore();
        return this.userReputationRepository.save(reputation);
    }
    async getUserRatings(userId, limit = 50) {
        return this.ratingRepository
            .createQueryBuilder('rating')
            .where('rating.userId = :userId', { userId })
            .orderBy('rating.createdAt', 'DESC')
            .limit(limit)
            .getMany();
    }
    async getRatingsGivenByUser(raterId, limit = 50) {
        return this.ratingRepository
            .createQueryBuilder('rating')
            .where('rating.raterId = :raterId', { raterId })
            .orderBy('rating.createdAt', 'DESC')
            .limit(limit)
            .getMany();
    }
    async getSessionRatings(sessionId) {
        return this.ratingRepository.find({
            where: { sessionId },
            order: { createdAt: 'DESC' },
        });
    }
    async hasUserRatedSession(sessionId, userId, raterId) {
        const count = await this.ratingRepository
            .createQueryBuilder('rating')
            .where('rating.sessionId = :sessionId', { sessionId })
            .andWhere('rating.userId = :userId', { userId })
            .andWhere('rating.raterId = :raterId', { raterId })
            .getCount();
        return count > 0;
    }
    async getReputationLeaderboard(limit = 20, minSessions = 5) {
        const reputations = await this.userReputationRepository
            .createQueryBuilder('rep')
            .where('rep.totalSessions >= :minSessions', { minSessions })
            .orderBy('rep.overallScore', 'DESC')
            .limit(limit)
            .getMany();
        return reputations.map(rep => {
            const tier = rep.getReputationTier();
            return {
                userId: rep.userId,
                overallScore: rep.overallScore,
                tier: `${tier.icon} ${tier.tier}`,
                totalSessions: rep.totalSessions,
                successRate: rep.successRate,
                averageRating: rep.averageRating,
            };
        });
    }
    async getCategoryLeaderboard(category, limit = 20) {
        const results = await this.userReputationRepository
            .createQueryBuilder('rep')
            .select('rep.userId', 'userId')
            .addSelect(`CAST(CAST(rep."categoryAverages" AS json)->>:category AS decimal)`, 'categoryAverage')
            .addSelect('rep.totalSessions', 'totalSessions')
            .addSelect('rep.overallScore', 'overallScore')
            .where('rep.totalSessions >= :minSessions', { minSessions: 5 })
            .andWhere('rep."categoryAverages" IS NOT NULL')
            .andWhere(`CAST(rep."categoryAverages" AS json)->>:category IS NOT NULL`)
            .setParameter('category', category)
            .orderBy('categoryAverage', 'DESC')
            .limit(limit)
            .getRawMany();
        return results.map(r => ({
            userId: r.userId,
            categoryAverage: Number(r.categoryAverage),
            totalSessions: r.totalSessions,
            overallScore: Number(r.overallScore),
        }));
    }
    async getPendingRatings(userId) {
        const sessions = await this.socialGroupService.getUserHistory(userId, 20);
        if (sessions.length === 0) {
            return [];
        }
        const sessionIds = sessions.map(s => s.id);
        const existingRatings = await this.ratingRepository
            .createQueryBuilder('rating')
            .select(['rating.sessionId', 'rating.userId'])
            .where('rating.raterId = :userId', { userId })
            .andWhere('rating.sessionId IN (:...sessionIds)', { sessionIds })
            .getMany();
        const ratedSet = new Set(existingRatings.map(r => `${r.sessionId}:${r.userId}`));
        const pending = [];
        for (const session of sessions) {
            const unratedParticipants = session.participantIds.filter(pid => pid !== userId && !ratedSet.has(`${session.id}:${pid}`));
            if (unratedParticipants.length > 0) {
                pending.push({
                    sessionId: session.id,
                    activity: session.activity,
                    completedAt: session.completedAt,
                    participants: unratedParticipants,
                });
            }
        }
        return pending;
    }
    async batchUpdateReputations(userIds) {
        for (const userId of userIds) {
            try {
                await this.updateUserReputation(userId);
            }
            catch (error) {
                logger_1.logger.error(`Error updating reputation for ${userId}:`, error);
            }
        }
        logger_1.logger.info(`✅ Batch updated reputations for ${userIds.length} users`);
    }
    async getDetailedReputation(userId) {
        const reputation = await this.getUserReputation(userId);
        const recentRatings = await this.getUserRatings(userId, 10);
        const categoryBreakdown = reputation.categoryAverages || {};
        const activityStats = reputation.activityStats || {};
        const topActivities = Object.entries(activityStats)
            .map(([activity, stats]) => ({
            activity,
            sessions: stats.sessions,
            averageRating: stats.averageRating,
        }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 3);
        return {
            reputation,
            recentRatings,
            categoryBreakdown,
            topActivities,
        };
    }
    async cleanupOldRatings(daysOld = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await this.ratingRepository
            .createQueryBuilder()
            .delete()
            .where('createdAt < :cutoff', { cutoff: cutoffDate })
            .execute();
        logger_1.logger.info(`🧹 Cleaned up ${result.affected || 0} old LFG ratings`);
        return result.affected || 0;
    }
    getOverallSentiment(relationship) {
        const ratio = relationship.positiveInteractions / (relationship.negativeInteractions + 1);
        if (ratio >= 3) {
            return 'Very Positive';
        }
        if (ratio >= 1.5) {
            return 'Positive';
        }
        if (ratio >= 0.75) {
            return 'Neutral';
        }
        if (ratio >= 0.3) {
            return 'Negative';
        }
        return 'Very Negative';
    }
    async getRecentInteractionCount(organizationId, _days) {
        const relationships = await this.relationshipRepository.find({
            where: { organizationId },
        });
        return relationships.reduce((sum, rel) => sum + rel.interactionCount, 0);
    }
    async invalidateUserReputation(userId) {
        try {
            const pattern = `reputation:*:${userId}:*`;
            const deleted = await redis_1.cache.delPattern(pattern);
            await redis_1.cache.del(`reputation:${userId}:global`);
            await redis_1.cache.del(`reputation:report:${userId}:global`);
            logger_1.logger.info(`Invalidated reputation cache for user ${userId} (${deleted} keys removed)`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to invalidate reputation cache for user ${userId}:`, error);
        }
    }
    async invalidateOrganizationCache(userId, organizationId) {
        try {
            const keys = [
                `reputation:${userId}:${organizationId}`,
                `reputation:report:${userId}:${organizationId}`,
            ];
            await redis_1.cache.del(keys);
            logger_1.logger.info(`Invalidated reputation cache for user ${userId} in org ${organizationId}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to invalidate org cache for user ${userId}, org ${organizationId}:`, error);
        }
    }
    async invalidateAllOrganizationCache(organizationId) {
        try {
            const pattern = `reputation:*:${organizationId}`;
            const deleted = await redis_1.cache.delPattern(pattern);
            logger_1.logger.info(`Invalidated all reputation caches for org ${organizationId} (${deleted} keys removed)`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to invalidate all org caches for ${organizationId}:`, error);
        }
    }
    async refreshUserReputation(userId, organizationId) {
        await this.invalidateUserReputation(userId);
        if (organizationId) {
            await this.invalidateOrganizationCache(userId, organizationId);
        }
        return this.getUnifiedReputation(userId, organizationId);
    }
    async getCacheStats(userId, organizationId) {
        const cacheKey = `reputation:${userId}:${organizationId || 'global'}`;
        const exists = await redis_1.cache.exists(cacheKey);
        const ttl = await redis_1.cache.ttl(cacheKey);
        return {
            exists,
            ttl,
            key: cacheKey,
        };
    }
    async getOrCreateReputation(userId) {
        let reputation = await this.generalReputationRepository.findOne({ where: { userId } });
        if (!reputation) {
            reputation = this.generalReputationRepository.create({
                id: crypto.randomUUID(),
                userId,
                scores: [],
                overallScore: 0,
                history: [],
            });
            await this.generalReputationRepository.save(reputation);
        }
        return reputation;
    }
    async updateScore(userId, category, amount, reason, modifiedBy) {
        const reputation = await this.getOrCreateReputation(userId);
        const categoryScore = reputation.scores.find(s => s.category === category);
        if (categoryScore) {
            categoryScore.score += amount;
            categoryScore.lastUpdated = new Date();
            reputation.scores = [...reputation.scores];
        }
        else {
            reputation.scores = [
                ...reputation.scores,
                { category, score: amount, lastUpdated: new Date() },
            ];
        }
        reputation.history = [
            ...reputation.history,
            {
                reason,
                amount,
                category,
                timestamp: new Date(),
                modifiedBy,
            },
        ];
        reputation.overallScore =
            reputation.scores.reduce((sum, s) => sum + s.score, 0) / (reputation.scores.length || 1);
        await this.generalReputationRepository.save(reputation);
        return reputation;
    }
    async getLeaderboard(pagination, category) {
        const page = pagination.page ?? 1;
        const limit = pagination.limit ?? 20;
        const skip = (page - 1) * limit;
        if (category) {
            const allReputation = await this.generalReputationRepository.find({
                take: 1000,
            });
            const sorted = [...allReputation].sort((a, b) => {
                const aScore = a.scores.find(s => s.category === category)?.score || 0;
                const bScore = b.scores.find(s => s.category === category)?.score || 0;
                return bScore - aScore;
            });
            return {
                data: sorted.slice(skip, skip + limit),
                total: sorted.length,
            };
        }
        const [data, total] = await this.generalReputationRepository.findAndCount({
            order: { overallScore: 'DESC' },
            skip,
            take: limit,
        });
        return { data, total };
    }
}
exports.ReputationService = ReputationService;
//# sourceMappingURL=ReputationService.js.map