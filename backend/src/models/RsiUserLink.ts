import { randomInt } from 'crypto';

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';
import { User } from './User';

/**
 * Verification methods for RSI handle linking
 */
export enum VerificationMethod {
  /** Admin manually verifies the link */
  MANUAL = 'manual',
  /** User places a unique code in their RSI bio */
  BIO_CODE = 'bio_code',
  /** Discord username matches RSI handle */
  DISCORD_MATCH = 'discord_match',
}

/**
 * Sync status for user links
 */
export enum SyncStatus {
  /** Pending verification or initial sync */
  PENDING = 'pending',
  /** Successfully synced */
  SYNCED = 'synced',
  /** Sync failed */
  FAILED = 'failed',
  /** User removed from organization */
  REMOVED = 'removed',
  /** Requires admin review (e.g. rank mismatch, unusual changes) */
  NEEDS_REVIEW = 'needs_review',
}

/**
 * RSI User Link Entity
 *
 * Links a platform user to their RSI handle for a specific organization.
 * Enables verification and automatic role synchronization.
 *
 * Phase 3: RSI Role Sync System - User Verification & Synchronization
 *
 * Features:
 * - Multiple verification methods (manual, bio code, Discord match)
 * - Sync status tracking
 * - Affiliate status tracking
 * - Discord integration for role assignment
 */
@Entity('rsi_user_links')
@Unique('UQ_rsi_user_links_user_org', ['userId', 'organizationId'])
@Index('IDX_rsi_user_links_user_id', ['userId'])
@Index('IDX_rsi_user_links_org_id', ['organizationId'])
@Index('IDX_rsi_user_links_rsi_handle', ['rsiHandle'])
@Index('IDX_rsi_user_links_sync_status', ['syncStatus'])
@Index('IDX_rsi_user_links_discord_user_id', ['discordUserId'])
export class RsiUserLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The user this link belongs to
   */
  @Column('varchar')
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /**
   * The organization context for this link
   */
  @Column('varchar')
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * RSI Handle of the linked account
   */
  @Column({ type: 'varchar', length: 100 })
  rsiHandle!: string;

  /**
   * Method used for verification
   */
  @Column({
    type: 'varchar',
    length: 20,
  })
  verificationMethod!: VerificationMethod;

  /**
   * Unique verification code for bio_code method
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  verificationCode?: string;

  /**
   * Timestamp when verification was completed
   */
  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  /**
   * Timestamp of last successful sync
   */
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  /**
   * Current sync status
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: SyncStatus.PENDING,
  })
  syncStatus!: SyncStatus;

  /**
   * Discord user ID for role synchronization
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  discordUserId?: string;

  /**
   * Last known RSI rank for change detection
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  lastKnownRank?: string;

  /**
   * Whether the user is an affiliate of the organization
   */
  @Column({ type: 'boolean', default: false })
  isAffiliate!: boolean;

  /**
   * Additional metadata for the link
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if the link is verified
   */
  isVerified(): boolean {
    return this.verifiedAt !== null && this.verifiedAt !== undefined;
  }

  /**
   * Check if the link has been synced successfully
   */
  isSynced(): boolean {
    return this.syncStatus === SyncStatus.SYNCED;
  }

  /**
   * Check if the link is pending verification
   */
  isPending(): boolean {
    return this.syncStatus === SyncStatus.PENDING;
  }

  /**
   * Check if the user has been removed from the organization
   */
  isRemoved(): boolean {
    return this.syncStatus === SyncStatus.REMOVED;
  }

  /**
   * Check if sync has failed
   */
  hasFailed(): boolean {
    return this.syncStatus === SyncStatus.FAILED;
  }

  /**
   * Check if link needs admin review
   */
  needsReview(): boolean {
    return this.syncStatus === SyncStatus.NEEDS_REVIEW;
  }

  /**
   * Check if the link has a Discord user ID configured
   */
  hasDiscordId(): boolean {
    return !!this.discordUserId && this.discordUserId.length > 0;
  }

  /**
   * Mark the link as verified
   */
  markVerified(): void {
    this.verifiedAt = new Date();
  }

  /**
   * Mark the link as synced
   */
  markSynced(rank?: string, isAffiliate?: boolean): void {
    this.syncStatus = SyncStatus.SYNCED;
    this.lastSyncedAt = new Date();
    if (rank !== undefined) {
      this.lastKnownRank = rank;
    }
    if (isAffiliate !== undefined) {
      this.isAffiliate = isAffiliate;
    }
  }

  /**
   * Mark the link as failed
   */
  markFailed(reason?: string): void {
    this.syncStatus = SyncStatus.FAILED;
    if (reason) {
      this.metadata = {
        ...this.metadata,
        lastFailureReason: reason,
        lastFailureAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Mark the link as removed (user left organization)
   */
  markRemoved(): void {
    this.syncStatus = SyncStatus.REMOVED;
    this.metadata = {
      ...this.metadata,
      removedAt: new Date().toISOString(),
    };
  }

  /**
   * Mark the link as needing admin review
   */
  markNeedsReview(reason?: string): void {
    this.syncStatus = SyncStatus.NEEDS_REVIEW;
    this.metadata = {
      ...this.metadata,
      reviewReason: reason ?? 'Unknown',
      reviewFlaggedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a unique verification code for bio_code method
   */
  static generateVerificationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'SCFM-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(randomInt(chars.length));
    }
    return code;
  }

  /**
   * Get a summary of the link status
   */
  getSummary(): {
    rsiHandle: string;
    isVerified: boolean;
    syncStatus: SyncStatus;
    lastKnownRank: string | null;
    isAffiliate: boolean;
    hasDiscordId: boolean;
  } {
    return {
      rsiHandle: this.rsiHandle,
      isVerified: this.isVerified(),
      syncStatus: this.syncStatus,
      lastKnownRank: this.lastKnownRank ?? null,
      isAffiliate: this.isAffiliate,
      hasDiscordId: this.hasDiscordId(),
    };
  }
}
