import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from 'typeorm';

/**
 * Hunter Rank - Based on performance and completion history
 */
export enum HunterRank {
    ROOKIE = 'rookie',
    APPRENTICE = 'apprentice',
    HUNTER = 'hunter',
    VETERAN = 'veteran',
    ELITE = 'elite',
    LEGENDARY = 'legendary'
}

/**
 * Hunter Profile Entity
 * 
 * Tracks bounty hunter statistics and performance for Phase 4 analytics.
 * Each hunter has a profile per organization (multi-tenant).
 */
@Entity('hunter_profiles')
@Index(['userId', 'organizationId'], { unique: true })
@Index(['organizationId', 'totalBountiesCompleted'])
@Index(['organizationId', 'totalRewardsEarned'])
@Index(['organizationId', 'reputationScore'])
export class HunterProfile {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ length: 100, nullable: true })
    userName?: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    // Bounty Statistics
    @Column({ type: 'integer', default: 0 })
    totalBountiesCompleted!: number;

    @Column({ type: 'integer', default: 0 })
    totalBountiesClaimed!: number;

    @Column({ type: 'integer', default: 0 })
    totalBountiesAbandoned!: number;

    @Column({ type: 'integer', default: 0 })
    totalBountiesRejected!: number;

    // Reward Statistics
    @Column({ type: 'bigint', default: 0 })
    totalRewardsEarned!: number;

    // Performance Metrics
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    successRate!: number;

    @Column({ type: 'integer', default: 0 })
    averageCompletionTimeMinutes!: number;

    // Rank and Reputation
    @Column({
        type: 'varchar',
        length: 50,
        default: HunterRank.ROOKIE
    })
    rank!: HunterRank;

    @Column({ type: 'integer', default: 0 })
    reputationScore!: number;

    // Specializations - Track by bounty type
    @Column({ type: 'integer', default: 0 })
    killBountiesCompleted!: number;

    @Column({ type: 'integer', default: 0 })
    captureBountiesCompleted!: number;

    @Column({ type: 'integer', default: 0 })
    intelBountiesCompleted!: number;

    @Column({ type: 'integer', default: 0 })
    transportBountiesCompleted!: number;

    @Column({ type: 'integer', default: 0 })
    rescueBountiesCompleted!: number;

    @Column({ type: 'integer', default: 0 })
    customBountiesCompleted!: number;

    // Activity Tracking
    @Column({ type: 'timestamp', nullable: true })
    lastBountyCompletedAt?: Date;

    @Column({ type: 'integer', default: 0 })
    currentStreak!: number;

    @Column({ type: 'integer', default: 0 })
    longestStreak!: number;

    // Timestamps
    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    // Computed properties
    get isActive(): boolean {
        if (!this.lastBountyCompletedAt) {
            return false;
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return this.lastBountyCompletedAt > thirtyDaysAgo;
    }

    get primarySpecialization(): string {
        const specializations = [
            { type: 'kill', count: this.killBountiesCompleted },
            { type: 'capture', count: this.captureBountiesCompleted },
            { type: 'intel', count: this.intelBountiesCompleted },
            { type: 'transport', count: this.transportBountiesCompleted },
            { type: 'rescue', count: this.rescueBountiesCompleted },
            { type: 'custom', count: this.customBountiesCompleted }
        ];
        
        const maxSpec = specializations.reduce((max, spec) => 
            spec.count > max.count ? spec : max, 
            { type: 'none', count: 0 }
        );
        
        return maxSpec.count > 0 ? maxSpec.type : 'generalist';
    }
}
