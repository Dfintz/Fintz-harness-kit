import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReputationCategory {
  COMMUNICATION = 'communication',
  TEAMWORK = 'teamwork',
  SKILL = 'skill',
  RELIABILITY = 'reliability',
  LEADERSHIP = 'leadership',
}

/**
 * Represents a reputation rating given by one user to another after an LFG session
 */
@Entity('lfg_reputation_ratings')
@Index(['userId', 'raterId'], { unique: true })
export class LFGReputationRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  sessionId: string; // LFGGroupHistory ID

  @Column()
  @Index()
  userId: string; // User being rated

  @Column()
  @Index()
  raterId: string; // User giving the rating

  @Column('int')
  overallRating: number; // 1-5 stars

  @Column('simple-json', { nullable: true })
  categoryRatings?: {
    [ReputationCategory.COMMUNICATION]?: number; // 1-5
    [ReputationCategory.TEAMWORK]?: number; // 1-5
    [ReputationCategory.SKILL]?: number; // 1-5
    [ReputationCategory.RELIABILITY]?: number; // 1-5
    [ReputationCategory.LEADERSHIP]?: number; // 1-5
  };

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ default: false })
  isPositive: boolean; // Quick flag for positive/negative

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Check if rating is positive (4-5 stars)
   */
  isPositiveRating(): boolean {
    return this.overallRating >= 4;
  }

  /**
   * Get average category rating
   */
  getAverageCategoryRating(): number {
    if (!this.categoryRatings) {
      return this.overallRating;
    }

    const ratings = Object.values(this.categoryRatings);
    if (ratings.length === 0) {
      return this.overallRating;
    }

    const sum = ratings.reduce((acc, val) => acc + (val || 0), 0);
    return sum / ratings.length;
  }

  /**
   * Get rating summary
   */
  getSummary(): {
    overall: number;
    isPositive: boolean;
    categories: number;
    hasComment: boolean;
  } {
    return {
      overall: this.overallRating,
      isPositive: this.isPositiveRating(),
      categories: this.categoryRatings ? Object.keys(this.categoryRatings).length : 0,
      hasComment: !!this.comment,
    };
  }
}
