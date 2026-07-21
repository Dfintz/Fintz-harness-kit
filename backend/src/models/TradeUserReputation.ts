import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Aggregated trading reputation statistics for a user.
 *
 * Mirrors LFGUserReputation but tracks trade route execution metrics:
 * success rate, profit efficiency, consistency, and estimate accuracy.
 *
 * Score formula (from MASTER_IMPROVEMENT_PLAN):
 *   Success rate      30%
 *   Profit efficiency 25%
 *   Consistency       25%
 *   Estimate accuracy 10%
 *   Experience bonus  10%
 *
 * Sprint 20-D
 */
@Entity('trade_user_reputation')
export class TradeUserReputation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  userId!: string;

  // ── Run statistics ──────────────────────────────────────────────
  @Column('int', { default: 0 })
  @Index()
  totalRuns!: number;

  @Column('int', { default: 0 })
  successfulRuns!: number;

  @Column('int', { default: 0 })
  failedRuns!: number;

  @Column('int', { default: 0 })
  abortedRuns!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  successRate!: number; // 0–100

  // ── Profit statistics ───────────────────────────────────────────
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  totalProfitGenerated!: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  avgProfitPerRun!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  avgEstimateAccuracy!: number; // 0–100

  @Column('decimal', { precision: 5, scale: 2, default: 50 })
  profitConsistency!: number; // 0–100 (higher = more consistent)

  // ── Per-route breakdown ─────────────────────────────────────────
  @Column('simple-json', { nullable: true })
  routeStats?: {
    [routeId: string]: {
      runs: number;
      successful: number;
      totalProfit: number;
    };
  };

  // ── Streaks ─────────────────────────────────────────────────────
  @Column('int', { default: 0 })
  currentSuccessStreak!: number;

  @Column('int', { default: 0 })
  longestSuccessStreak!: number;

  // ── Overall score (0–100) ───────────────────────────────────────
  @Column('decimal', { precision: 5, scale: 2, default: 50 })
  @Index()
  overallScore!: number;

  // ── Timestamps ──────────────────────────────────────────────────
  @Column({ nullable: true })
  lastRunAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ── Calculated helpers ──────────────────────────────────────────

  /**
   * Recalculate overall score from components.
   *
   * Weights:
   *   Success rate      30%   (successRate / 100 * 30)
   *   Profit efficiency 25%   (normalized actual-vs-estimated)
   *   Consistency       25%   (profitConsistency / 100 * 25)
   *   Estimate accuracy 10%   (avgEstimateAccuracy / 100 * 10)
   *   Experience bonus  10%   (min(totalRuns / 100, 1) * 10)
   */
  calculateOverallScore(): number {
    const successComponent = (Number(this.successRate) / 100) * 30;
    const efficiencyComponent = (Number(this.avgEstimateAccuracy) / 100) * 25;
    const consistencyComponent = (Number(this.profitConsistency) / 100) * 25;
    const accuracyComponent = (Number(this.avgEstimateAccuracy) / 100) * 10;
    const experienceComponent = Math.min(this.totalRuns / 100, 1) * 10;

    const score =
      successComponent +
      efficiencyComponent +
      consistencyComponent +
      accuracyComponent +
      experienceComponent;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Reputation tier — identical tier names/thresholds as LFGUserReputation.
   */
  getReputationTier(): { tier: string; icon: string; minScore: number } {
    const score = Number(this.overallScore);

    if (score >= 90) {
      return { tier: 'Legendary', icon: '🏆', minScore: 90 };
    }
    if (score >= 80) {
      return { tier: 'Elite', icon: '⭐', minScore: 80 };
    }
    if (score >= 70) {
      return { tier: 'Veteran', icon: '🎖️', minScore: 70 };
    }
    if (score >= 60) {
      return { tier: 'Experienced', icon: '🎯', minScore: 60 };
    }
    if (score >= 50) {
      return { tier: 'Reliable', icon: '✅', minScore: 50 };
    }
    if (score >= 40) {
      return { tier: 'Average', icon: '⚪', minScore: 40 };
    }
    if (score >= 30) {
      return { tier: 'Developing', icon: '🔵', minScore: 30 };
    }
    return { tier: 'Rookie', icon: '🆕', minScore: 0 };
  }

  /**
   * Summary for display (mirrors LFGUserReputation.getSummary).
   */
  getSummary(): {
    userId: string;
    score: number;
    tier: string;
    runs: number;
    successRate: number;
    avgProfit: number;
    streak: number;
  } {
    const tier = this.getReputationTier();
    return {
      userId: this.userId,
      score: Number(this.overallScore),
      tier: `${tier.icon} ${tier.tier}`,
      runs: this.totalRuns,
      successRate: Number(this.successRate),
      avgProfit: Number(this.avgProfitPerRun),
      streak: this.currentSuccessStreak,
    };
  }

  isExperienced(): boolean {
    return this.totalRuns >= 10;
  }

  isHighPerformer(): boolean {
    return Number(this.successRate) >= 80 && this.totalRuns >= 5;
  }
}
