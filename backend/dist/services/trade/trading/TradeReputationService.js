"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeReputationService = exports.TradeReputationService = void 0;
const data_source_1 = require("../../../data-source");
const TradeTransaction_1 = require("../../../models/TradeTransaction");
const TradeUserReputation_1 = require("../../../models/TradeUserReputation");
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const CACHE_PREFIX = 'trade-rep';
const CACHE_TTL = 300;
class TradeReputationService {
    transactionRepository;
    reputationRepository;
    constructor(transactionRepository, reputationRepository) {
        this.transactionRepository =
            transactionRepository || data_source_1.AppDataSource.getRepository(TradeTransaction_1.TradeTransaction);
        this.reputationRepository =
            reputationRepository || data_source_1.AppDataSource.getRepository(TradeUserReputation_1.TradeUserReputation);
    }
    async recordTransaction(params) {
        const status = params.successStatus ?? TradeTransaction_1.TradeTransactionStatus.COMPLETED;
        const transaction = this.transactionRepository.create({
            routeId: params.routeId,
            userId: params.userId,
            organizationId: params.organizationId,
            fleetId: params.fleetId,
            estimatedProfit: params.estimatedProfit,
            actualProfit: params.actualProfit,
            durationMinutes: params.durationMinutes,
            successStatus: status,
            completedAt: status === TradeTransaction_1.TradeTransactionStatus.COMPLETED ? new Date() : undefined,
        });
        const saved = await this.transactionRepository.save(transaction);
        logger_1.logger.info(`Recorded trade transaction ${saved.id} for user ${params.userId} on route ${params.routeId} (${status})`);
        this.updateUserReputation(params.userId).catch(err => {
            logger_1.logger.error(`Failed to update trade reputation for user ${params.userId}:`, err);
        });
        await redis_1.cache.del(`${CACHE_PREFIX}:${params.userId}`);
        return saved;
    }
    async getUserTransactions(userId, organizationId, limit = 50) {
        return this.transactionRepository.find({
            where: { userId, organizationId },
            order: { executedAt: 'DESC' },
            take: limit,
        });
    }
    async getRouteTransactions(routeId, organizationId, limit = 50) {
        return this.transactionRepository.find({
            where: { routeId, organizationId },
            order: { executedAt: 'DESC' },
            take: limit,
        });
    }
    async getUserReputation(userId) {
        const cacheKey = `${CACHE_PREFIX}:${userId}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return Object.assign(new TradeUserReputation_1.TradeUserReputation(), cached);
        }
        let reputation = await this.reputationRepository.findOne({
            where: { userId },
        });
        if (!reputation) {
            reputation = this.reputationRepository.create({ userId });
            reputation = await this.reputationRepository.save(reputation);
            logger_1.logger.info(`Created new trade reputation profile for user ${userId}`);
        }
        await redis_1.cache.set(cacheKey, reputation, CACHE_TTL);
        return reputation;
    }
    async updateUserReputation(userId) {
        const reputation = await this.getUserReputation(userId);
        const transactions = await this.transactionRepository.find({
            where: { userId },
            order: { executedAt: 'DESC' },
        });
        if (transactions.length === 0) {
            return reputation;
        }
        reputation.totalRuns = transactions.length;
        reputation.successfulRuns = transactions.filter(t => t.successStatus === TradeTransaction_1.TradeTransactionStatus.COMPLETED).length;
        reputation.failedRuns = transactions.filter(t => t.successStatus === TradeTransaction_1.TradeTransactionStatus.FAILED).length;
        reputation.abortedRuns = transactions.filter(t => t.successStatus === TradeTransaction_1.TradeTransactionStatus.ABORTED).length;
        reputation.successRate =
            reputation.totalRuns > 0 ? (reputation.successfulRuns / reputation.totalRuns) * 100 : 0;
        const completedTxns = transactions.filter(t => t.successStatus === TradeTransaction_1.TradeTransactionStatus.COMPLETED);
        if (completedTxns.length > 0) {
            const profits = completedTxns.map(t => Number(t.actualProfit));
            reputation.totalProfitGenerated = profits.reduce((a, b) => a + b, 0);
            reputation.avgProfitPerRun = reputation.totalProfitGenerated / completedTxns.length;
            const accuracies = completedTxns.map(t => t.getEstimateAccuracy());
            reputation.avgEstimateAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
            reputation.profitConsistency = this.calculateConsistency(profits);
        }
        const routeStats = {};
        for (const t of transactions) {
            if (!routeStats[t.routeId]) {
                routeStats[t.routeId] = { runs: 0, successful: 0, totalProfit: 0 };
            }
            routeStats[t.routeId].runs++;
            if (t.successStatus === TradeTransaction_1.TradeTransactionStatus.COMPLETED) {
                routeStats[t.routeId].successful++;
                routeStats[t.routeId].totalProfit += Number(t.actualProfit);
            }
        }
        reputation.routeStats = routeStats;
        let streak = 0;
        for (const t of transactions) {
            if (t.successStatus === TradeTransaction_1.TradeTransactionStatus.COMPLETED) {
                streak++;
            }
            else {
                break;
            }
        }
        reputation.currentSuccessStreak = streak;
        reputation.longestSuccessStreak = Math.max(reputation.longestSuccessStreak, streak);
        reputation.lastRunAt = transactions[0].executedAt;
        reputation.overallScore = reputation.calculateOverallScore();
        const saved = await this.reputationRepository.save(reputation);
        await redis_1.cache.set(`${CACHE_PREFIX}:${userId}`, saved, CACHE_TTL);
        return saved;
    }
    async getLeaderboard(limit = 20) {
        const cacheKey = `${CACHE_PREFIX}:leaderboard`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const reputations = await this.reputationRepository.find({
            where: {},
            order: { overallScore: 'DESC' },
            take: limit,
        });
        const leaderboard = reputations.map(r => {
            const tier = r.getReputationTier();
            return {
                userId: r.userId,
                overallScore: Number(r.overallScore),
                tier: `${tier.icon} ${tier.tier}`,
                totalRuns: r.totalRuns,
                successRate: Number(r.successRate),
                avgProfit: Number(r.avgProfitPerRun),
            };
        });
        await redis_1.cache.set(cacheKey, leaderboard, CACHE_TTL);
        return leaderboard;
    }
    calculateConsistency(profits) {
        if (profits.length < 2) {
            return 100;
        }
        const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
        if (mean === 0) {
            return 50;
        }
        const variance = profits.reduce((sum, p) => sum + (p - mean) ** 2, 0) / profits.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / Math.abs(mean);
        const consistency = Math.max(0, Math.min(100, (1 - cv) * 100));
        return Math.round(consistency);
    }
}
exports.TradeReputationService = TradeReputationService;
exports.tradeReputationService = new TradeReputationService();
//# sourceMappingURL=TradeReputationService.js.map