import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * Bounty Types - The 6 core bounty categories
 */
export enum BountyType {
  KILL = 'kill',
  CAPTURE = 'capture',
  INTEL = 'intel',
  TRANSPORT = 'transport',
  RESCUE = 'rescue',
  CUSTOM = 'custom',
}

/**
 * Bounty Target Types
 */
export enum BountyTargetType {
  PLAYER = 'player',
  NPC = 'npc',
  SHIP = 'ship',
  LOCATION = 'location',
  ITEM = 'item',
  OTHER = 'other',
}

/**
 * Bounty Reward Types
 */
export enum BountyRewardType {
  CREDITS = 'credits',
  ITEM = 'item',
  REPUTATION = 'reputation',
  MIXED = 'mixed',
  OTHER = 'other',
}

/**
 * Bounty Status - Lifecycle states
 */
export enum BountyStatus {
  ACTIVE = 'active',
  CLAIMED = 'claimed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Bounty Visibility
 */
export enum BountyVisibility {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
  ALLIANCE = 'alliance',
  PRIVATE = 'private',
}

/**
 * Bounty Difficulty
 */
export enum BountyDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
}

/**
 * Target Details interface for structured target information
 */
export interface BountyTargetDetails {
  lastKnownLocation?: string;
  shipType?: string;
  affiliations?: string[];
  threat_level?: string;
  notes?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

/**
 * Bounty Metadata interface for additional data
 */
export interface BountyMetadata {
  evidence?: string[];
  completionNotes?: string;
  verificationNotes?: string;
  paymentReference?: string;
  [key: string]: unknown;
}

/**
 * Bounty Entity Model
 *
 * Core entity for the bounty hunting system supporting 6 bounty types:
 * - Kill: Eliminate a target
 * - Capture: Capture and deliver a target
 * - Intel: Gather and provide information
 * - Transport: Deliver cargo or personnel
 * - Rescue: Rescue and extract a target
 * - Custom: User-defined bounty objectives
 *
 * MULTI-TENANCY: This entity is tenant-scoped - each bounty belongs to an organization.
 * Bounties can be shared with other organizations via the sharedWithOrgs field.
 */
@Entity('bounties')
@Index(['bountyType', 'status'])
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['claimedBy'])
@Index(['expiresAt'])
export class Bounty extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Creator Information
  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ length: 100, nullable: true })
  createdByName?: string;

  // Core Bounty Information
  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  bountyType!: BountyType;

  // Target Information
  @Column({
    type: 'varchar',
    length: 20,
  })
  targetType!: BountyTargetType;

  @Column({ length: 100, nullable: true })
  targetIdentifier?: string;

  @Column({ length: 100, nullable: true })
  targetName?: string;

  @Column({ type: 'jsonb', nullable: true })
  targetDetails?: BountyTargetDetails;

  // Reward Information
  @Column({
    type: 'varchar',
    length: 20,
  })
  rewardType!: BountyRewardType;

  @Column({ type: 'integer', nullable: true })
  rewardAmount?: number;

  @Column({ type: 'text', nullable: true })
  rewardDescription?: string;

  // Status and Lifecycle
  @Column({
    type: 'varchar',
    length: 20,
    default: BountyStatus.ACTIVE,
  })
  status!: BountyStatus;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  difficulty?: BountyDifficulty;

  // Location Information
  @Column({ length: 200, nullable: true })
  location?: string;

  @Column({ length: 100, nullable: true })
  systemLocation?: string;

  // Claim Information
  @Column({ type: 'varchar', nullable: true })
  claimedBy?: string;

  @Column({ length: 100, nullable: true })
  claimedByName?: string;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt?: Date;

  // Completion Information
  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  verifiedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  // Expiration
  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  // Visibility
  @Column({
    type: 'varchar',
    length: 20,
    default: BountyVisibility.ORGANIZATION,
  })
  visibility!: BountyVisibility;

  // Tags and Categorization
  @Column('simple-array', { default: '' })
  tags!: string[];

  // Additional Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: BountyMetadata;

  // Activity System Integration
  @Column({ type: 'uuid', nullable: true })
  linkedActivityId?: string;

  // Timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @VersionColumn()
  version!: number;

  // Computed properties
  get isActive(): boolean {
    return this.status === BountyStatus.ACTIVE;
  }

  get isClaimed(): boolean {
    return this.status === BountyStatus.CLAIMED || this.status === BountyStatus.IN_PROGRESS;
  }

  get isCompleted(): boolean {
    return (
      this.status === BountyStatus.COMPLETED ||
      this.status === BountyStatus.VERIFIED ||
      this.status === BountyStatus.PAID
    );
  }

  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  get canBeClaimed(): boolean {
    return this.status === BountyStatus.ACTIVE && !this.isExpired;
  }

  get hasReward(): boolean {
    return (
      (this.rewardAmount !== undefined && this.rewardAmount > 0) ||
      (this.rewardDescription !== undefined && this.rewardDescription.length > 0)
    );
  }
}
