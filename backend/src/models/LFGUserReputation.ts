import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Aggregated reputation statistics for a user
 */
@Entity('lfg_user_reputation')
export class LFGUserReputation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  userId: string;

  // Overall Statistics
  @Column('int', { default: 0 })
  @Index()
  totalSessions: number;

  @Column('int', { default: 0 })
  successfulSessions: number;

  @Column('int', { default: 0 })
  failedSessions: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  successRate: number; // Percentage

  // Rating Statistics
  @Column('int', { default: 0 })
  totalRatingsReceived: number;

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  averageRating: number; // 1-5 scale

  @Column('int', { default: 0 })
  positiveRatings: number;

  @Column('int', { default: 0 })
  negativeRatings: number;

  // Category Ratings
  @Column('simple-json', { nullable: true })
  categoryAverages?: {
    communication?: number;
    teamwork?: number;
    skill?: number;
    reliability?: number;
    leadership?: number;
  };

  // Activity-specific stats
  @Column('simple-json', { nullable: true })
  activityStats?: {
    [activity: string]: {
      sessions: number;
      successful: number;
      averageRating: number;
    };
  };

  // Reputation Score (0-100)
  @Column('decimal', { precision: 5, scale: 2, default: 50 })
  @Index()
  overallScore: number;

  // Leadership metrics
  @Column('int', { default: 0 })
  sessionsAsLeader: number;

  @Column('int', { default: 0 })
  successfulLeaderSessions: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  leadershipSuccessRate: number;

  // Streaks
  @Column('int', { default: 0 })
  currentSuccessStreak: number;

  @Column('int', { default: 0 })
  longestSuccessStreak: number;

  // Timestamps
  @Column({ nullable: true })
  lastSessionAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Calculate overall reputation score (0-100)
   */
  calculateOverallScore(): number {
    let score = 50; // Base score

    // Success rate contribution (0-30 points)
    score += (this.successRate / 100) * 30;

    // Average rating contribution (0-25 points)
    if (this.averageRating > 0) {
      score += ((this.averageRating - 1) / 4) * 25; // Scale from 1-5 to 0-25
    }

    // Positive ratio contribution (0-15 points)
    if (this.totalRatingsReceived > 0) {
      const positiveRatio = this.positiveRatings / this.totalRatingsReceived;
      score += positiveRatio * 15;
    }

    // Leadership bonus (0-10 points)
    if (this.sessionsAsLeader > 0) {
      score += (this.leadershipSuccessRate / 100) * 10;
    }

    // Streak bonus (0-10 points)
    if (this.currentSuccessStreak > 0) {
      const streakBonus = Math.min(this.currentSuccessStreak / 10, 1) * 10;
      score += streakBonus;
    }

    // Experience bonus (0-10 points)
    if (this.totalSessions > 0) {
      const experienceBonus = Math.min(this.totalSessions / 100, 1) * 10;
      score += experienceBonus;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Get reputation tier based on score
   */
  getReputationTier(): {
    tier: string;
    icon: string;
    minScore: number;
  } {
    const score = this.overallScore;

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
   * Get reputation summary for display
   */
  getSummary(): {
    userId: string;
    score: number;
    tier: string;
    sessions: number;
    successRate: number;
    averageRating: number;
    streak: number;
  } {
    const tier = this.getReputationTier();
    return {
      userId: this.userId,
      score: this.overallScore,
      tier: `${tier.icon} ${tier.tier}`,
      sessions: this.totalSessions,
      successRate: this.successRate,
      averageRating: this.averageRating,
      streak: this.currentSuccessStreak,
    };
  }

  /**
   * Check if user is experienced (10+ sessions)
   */
  isExperienced(): boolean {
    return this.totalSessions >= 10;
  }

  /**
   * Check if user is highly rated (4.0+ average)
   */
  isHighlyRated(): boolean {
    return this.averageRating >= 4.0 && this.totalRatingsReceived >= 5;
  }

  /**
   * Check if user is a successful leader
   */
  isSuccessfulLeader(): boolean {
    return this.sessionsAsLeader >= 5 && this.leadershipSuccessRate >= 70;
  }
}
