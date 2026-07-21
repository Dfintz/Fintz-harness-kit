import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

// ==================== ENUMS ====================

/**
 * Lifecycle of a loot pool.
 *
 * OPEN        -> leader is still adding items / configuring rules
 * LOCKED      -> claiming / bidding window is open to participants
 * DISTRIBUTED -> winners resolved, payouts/awards applied (terminal)
 * PARTIALLY_DISTRIBUTED -> distribution completed with one or more settlement failures (terminal)
 * CANCELLED   -> pool abandoned, no payouts (terminal)
 */
export enum LootPoolStatus {
  OPEN = 'open',
  LOCKED = 'locked',
  DISTRIBUTED = 'distributed',
  PARTIALLY_DISTRIBUTED = 'partially_distributed',
  CANCELLED = 'cancelled',
}

/**
 * How the loot is divided amongst the participants who were active.
 *
 * NEED_GREED   -> per-item: NEED beats GREED, random roll breaks ties
 * RANDOM_ROLL  -> per-item: random roll amongst all interested participants
 * AUEC_BID     -> per-item: highest aUEC bid wins; the bid is paid into the org pool
 * EVEN_SPLIT   -> no per-item contest; total value is split across participants
 * LEADER_ASSIGN-> the mission leader manually assigns each item
 */
export enum LootDistributionMethod {
  NEED_GREED = 'need_greed',
  RANDOM_ROLL = 'random_roll',
  AUEC_BID = 'auec_bid',
  EVEN_SPLIT = 'even_split',
  LEADER_ASSIGN = 'leader_assign',
}

/**
 * Optional rule configuration set by the mission leader.
 */
export interface LootPoolRules {
  /** Cap on how many items a single participant may win (e.g. "one item each"). */
  maxItemsPerParticipant?: number;
  /**
   * For EVEN_SPLIT: when true, instead of awarding items, the total value is
   * paid out from the org credit pool and shared between the participants.
   */
  shareTotalPayout?: boolean;
  /** Per ParticipantRole weighting for EVEN_SPLIT shares (defaults to equal). */
  roleWeights?: Record<string, number>;
  /** Only participants with these roles are eligible to claim (empty = everyone). */
  eligibleRoles?: string[];
  /** ISO timestamp after which bids/claims are closed. */
  closesAt?: string;
  /** Minimum bid increment for AUEC_BID. */
  minBidIncrement?: number;
  /** Free-form leader notes shown to participants. */
  notes?: string;
}

// ==================== ENTITY ====================

/**
 * LootPool Entity Model
 *
 * A pool of looted gear / components / commodities collected during a mission.
 * A pool is anchored to an Activity (which tracks "who was active" via
 * activity_participants) and optionally references a Mission and/or LFG session.
 *
 * The mission leader configures the distribution method and rules; eligible
 * participants then claim or bid on items, and the leader distributes the pool.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('loot_pools')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'activityId'])
export class LootPool extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Activity this loot was earned in — the source of eligible participants. */
  @Column({ type: 'uuid' })
  activityId!: string;

  /** Optional linked mission. */
  @Column({ type: 'uuid', nullable: true })
  missionId?: string;

  /** Optional linked LFG session id (Redis-backed, so stored as plain string). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  lfgSessionId?: string;

  @Column({
    type: 'enum',
    enum: LootPoolStatus,
    default: LootPoolStatus.OPEN,
  })
  status!: LootPoolStatus;

  @Column({
    type: 'enum',
    enum: LootDistributionMethod,
    default: LootDistributionMethod.NEED_GREED,
  })
  distributionMethod!: LootDistributionMethod;

  @Column({ type: 'jsonb', nullable: true })
  rules?: LootPoolRules;

  /** Cached sum of all item totalValue (recomputed on item changes). */
  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  totalValue!: number;

  @Column({ type: 'varchar', length: 10, default: 'aUEC' })
  currency!: string;

  /** The mission leader who owns this pool (defaults to the activity leader). */
  @Column({ type: 'varchar' })
  leaderId!: string;

  @Column({ type: 'varchar' })
  createdBy!: string;

  /** When the pool was distributed (status -> DISTRIBUTED). */
  @Column({ type: 'timestamp', nullable: true })
  distributedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
