import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { TradeTransaction, TradeTransactionStatus } from '../../../models/TradeTransaction';
import { TradeUserReputation } from '../../../models/TradeUserReputation';
import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/redis';

/**
 * Parameters for recording a trade transaction.
 */
export interface RecordTradeTransactionParams {
  routeId: string;
  userId: string;
  organizationId: string;
  fleetId?: string;
  estimatedProfit: number;
  actualProfit: number;
  durationMinutes: number;
  successStatus?: TradeTransactionStatus;
}

/**
 * Trade reputation leaderboard entry.
 */
export interface TradeReputationLeaderboard {
  userId: string;
  overallScore: number;
  tier: string;
  totalRuns: number;
  successRate: number;
  avgProfit: number;
}

const CACHE_PREFIX = 'trade-rep';
const CACHE_TTL = 300; // 5 minutes, same as ReputationService

/**
 * Trading Reputation Service
 *
 * Manages TradeTransaction recording and TradeUserReputation scoring.
 * Mirrors the LFG reputation pattern from ReputationService.
 *
 * Sprint 20-D
 */
export class TradeReputationService {
  private readonly transactionRepository: Repository<TradeTransaction>;
  private readonly reputationRepository: Repository<TradeUserReputation>;

  constructor(
    transactionRepository?: Repository<TradeTransaction>,
    reputationRepository?: Repository<TradeUserReputation>
  ) {
    this.transactionRepository =
      transactionRepository || AppDataSource.getRepository(TradeTransaction);
    this.reputationRepository =
      reputationRepository || AppDataSource.getRepository(TradeUserReputation);
  }

  // ── Transaction Recording ──────────────────────────────────────

  /**
   * Record a completed trade transaction and update user reputation.
   */
  async recordTransaction(params: RecordTradeTransactionParams): Promise<TradeTransaction> {
    const status = params.successStatus ?? TradeTransactionStatus.COMPLETED;

    const transaction = this.transactionRepository.create({
      routeId: params.routeId,
      userId: params.userId,
      organizationId: params.organizationId,
      fleetId: params.fleetId,
      estimatedProfit: params.estimatedProfit,
      actualProfit: params.actualProfit,
      durationMinutes: params.durationMinutes,
      successStatus: status,
      completedAt: status === TradeTransactionStatus.COMPLETED ? new Date() : undefined,
    });

    const saved = await this.transactionRepository.save(transaction);
    logger.info(
      `Recorded trade transaction ${saved.id} for user ${params.userId} on route ${params.routeId} (${status})`
    );

    // Update reputation asynchronously — fire-and-forget with error logging
    this.updateUserReputation(params.userId).catch(err => {
      logger.error(`Failed to update trade reputation for user ${params.userId}:`, err);
    });

    // Invalidate cached reputation
    await cache.del(`${CACHE_PREFIX}:${params.userId}`);

    return saved;
  }

  /**
   * Get recent transactions for a user, scoped to organization.
   */
  async getUserTransactions(
    userId: string,
    organizationId: string,
    limit = 50
  ): Promise<TradeTransaction[]> {
    return this.transactionRepository.find({
      where: { userId, organizationId },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get transactions for a specific route.
   */
  async getRouteTransactions(
    routeId: string,
    organizationId: string,
    limit = 50
  ): Promise<TradeTransaction[]> {
    return this.transactionRepository.find({
      where: { routeId, organizationId },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  // ── Reputation Queries ─────────────────────────────────────────

  /**
   * Get or create a user's trade reputation profile.
   */
  async getUserReputation(userId: string): Promise<TradeUserReputation> {
    const cacheKey = `${CACHE_PREFIX}:${userId}`;
    const cached = await cache.get<TradeUserReputation>(cacheKey);
    if (cached) {
      // Restore prototype methods on cached plain objects
      return Object.assign(new TradeUserReputation(), cached);
    }

    let reputation = await this.reputationRepository.findOne({
      where: { userId },
    });

    if (!reputation) {
      reputation = this.reputationRepository.create({ userId });
      reputation = await this.reputationRepository.save(reputation);
      logger.info(`Created new trade reputation profile for user ${userId}`);
    }

    await cache.set(cacheKey, reputation, CACHE_TTL);
    return reputation;
  }

  /**
   * Recalculate a user's trade reputation from transaction history.
   */
  async updateUserReputation(userId: string): Promise<TradeUserReputation> {
    const reputation = await this.getUserReputation(userId);

    // Fetch all transactions for this user
    const transactions = await this.transactionRepository.find({
      where: { userId },
      order: { executedAt: 'DESC' },
    });

    if (transactions.length === 0) {
      return reputation;
    }

    // ── Run counts ────────────────────────────────────────────────
    reputation.totalRuns = transactions.length;
    reputation.successfulRuns = transactions.filter(
      t => t.successStatus === TradeTransactionStatus.COMPLETED
    ).length;
    reputation.failedRuns = transactions.filter(
      t => t.successStatus === TradeTransactionStatus.FAILED
    ).length;
    reputation.abortedRuns = transactions.filter(
      t => t.successStatus === TradeTransactionStatus.ABORTED
    ).length;
    reputation.successRate =
      reputation.totalRuns > 0 ? (reputation.successfulRuns / reputation.totalRuns) * 100 : 0;

    // ── Profit stats (completed runs only) ────────────────────────
    const completedTxns = transactions.filter(
      t => t.successStatus === TradeTransactionStatus.COMPLETED
    );

    if (completedTxns.length > 0) {
      const profits = completedTxns.map(t => Number(t.actualProfit));
      reputation.totalProfitGenerated = profits.reduce((a, b) => a + b, 0);
      reputation.avgProfitPerRun = reputation.totalProfitGenerated / completedTxns.length;

      // Estimate accuracy (average across completed runs)
      const accuracies = completedTxns.map(t => t.getEstimateAccuracy());
      reputation.avgEstimateAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

      // Profit consistency: 100 - normalized std deviation (higher = more consistent)
      reputation.profitConsistency = this.calculateConsistency(profits);
    }

    // ── Per-route breakdown ───────────────────────────────────────
    const routeStats: TradeUserReputation['routeStats'] = {};
    for (const t of transactions) {
      if (!routeStats[t.routeId]) {
        routeStats[t.routeId] = { runs: 0, successful: 0, totalProfit: 0 };
      }
      routeStats[t.routeId].runs++;
      if (t.successStatus === TradeTransactionStatus.COMPLETED) {
        routeStats[t.routeId].successful++;
        routeStats[t.routeId].totalProfit += Number(t.actualProfit);
      }
    }
    reputation.routeStats = routeStats;

    // ── Streaks (most-recent first) ───────────────────────────────
    let streak = 0;
    for (const t of transactions) {
      if (t.successStatus === TradeTransactionStatus.COMPLETED) {
        streak++;
      } else {
        break;
      }
    }
    reputation.currentSuccessStreak = streak;
    reputation.longestSuccessStreak = Math.max(reputation.longestSuccessStreak, streak);

    // ── Timestamps ────────────────────────────────────────────────
    reputation.lastRunAt = transactions[0].executedAt;

    // ── Overall score ─────────────────────────────────────────────
    reputation.overallScore = reputation.calculateOverallScore();

    const saved = await this.reputationRepository.save(reputation);

    // Update cache
    await cache.set(`${CACHE_PREFIX}:${userId}`, saved, CACHE_TTL);

    return saved;
  }

  /**
   * Get trade reputation leaderboard.
   */
  async getLeaderboard(limit = 20): Promise<TradeReputationLeaderboard[]> {
    const cacheKey = `${CACHE_PREFIX}:leaderboard`;
    const cached = await cache.get<TradeReputationLeaderboard[]>(cacheKey);
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

    await cache.set(cacheKey, leaderboard, CACHE_TTL);
    return leaderboard;
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Calculate profit consistency (0–100).
   * 100 = perfectly consistent, 0 = wildly inconsistent.
   */
  private calculateConsistency(profits: number[]): number {
    if (profits.length < 2) {
      return 100;
    } // Single run = fully consistent

    const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
    if (mean === 0) {
      return 50;
    }

    const variance = profits.reduce((sum, p) => sum + (p - mean) ** 2, 0) / profits.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation (CV) — normalize by mean
    const cv = stdDev / Math.abs(mean);

    // Map CV to 0–100 score: CV of 0 → 100, CV of 1+ → 0
    const consistency = Math.max(0, Math.min(100, (1 - cv) * 100));
    return Math.round(consistency);
  }
}

// Singleton instance
export const tradeReputationService = new TradeReputationService();

