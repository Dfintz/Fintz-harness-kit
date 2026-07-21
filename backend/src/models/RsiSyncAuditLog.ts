import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * Sync type enumeration
 */
export enum SyncType {
  /** Manual sync triggered by a user */
  MANUAL = 'manual',
  /** Automatic scheduled sync */
  SCHEDULED = 'scheduled',
  /** Sync triggered by webhook */
  WEBHOOK = 'webhook',
}

/**
 * Details of changes detected during sync
 */
export interface SyncChangeDetails {
  /** Users who were added to roles */
  rolesAdded?: Array<{
    userId: string;
    discordUserId?: string;
    rsiHandle: string;
    roleId: string;
    roleName?: string;
  }>;
  /** Users who had roles removed */
  rolesRemoved?: Array<{
    userId: string;
    discordUserId?: string;
    rsiHandle: string;
    roleId: string;
    roleName?: string;
  }>;
  /** Users who had rank changes */
  rankChanges?: Array<{
    userId: string;
    rsiHandle: string;
    previousRank: string;
    newRank: string;
  }>;
  /** Users who were removed from the organization */
  removedMembers?: Array<{
    userId: string;
    rsiHandle: string;
    lastKnownRank?: string;
  }>;
  /** Conflicts that were detected and resolved */
  conflicts?: Array<{
    type: string;
    userId?: string;
    rsiHandle?: string;
    description: string;
    resolution: string;
  }>;
  /** Error details */
  errors?: Array<{
    userId?: string;
    rsiHandle?: string;
    error: string;
  }>;
  /** User who triggered the sync (for manual syncs) */
  triggeredBy?: string;
  /** RSI Organization SID */
  rsiOrgSid?: string;
  /** Discord guild ID */
  guildId?: string;
  /** Duration of the sync operation in milliseconds */
  durationMs?: number;

  /** Summary of the member snapshot taken during this sync */
  memberSnapshot?: {
    total: number;
    main: number;
    affiliate: number;
    hidden: number;
    redacted: number;
  };

  /** Delta from the previous sync run */
  delta?: {
    newMembers: Array<{ handle: string; rank?: string; isAffiliate: boolean }>;
    removedMembers: Array<{ handle: string; lastRank?: string }>;
    rankChanges: Array<{ handle: string; oldRank: string; newRank: string }>;
    statusChanges: Array<{
      handle: string;
      field: string;
      oldValue: string;
      newValue: string;
    }>;
  };
}

/**
 * RSI Sync Audit Log Entity
 *
 * Records all sync operations for auditing and troubleshooting.
 * Part of Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging.
 *
 * Features:
 * - Full audit trail of all sync operations
 * - Detailed change tracking
 * - Error logging
 * - Performance metrics
 */
@Entity('rsi_sync_audit_log')
@Index('IDX_rsi_sync_audit_log_org_id', ['organizationId'])
@Index('IDX_rsi_sync_audit_log_sync_type', ['syncType'])
@Index('IDX_rsi_sync_audit_log_synced_at', ['syncedAt'])
@Index('IDX_rsi_sync_audit_log_org_synced_at', ['organizationId', 'syncedAt'])
export class RsiSyncAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization this sync belongs to
   */
  @Column('uuid')
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * Type of sync operation
   */
  @Column({
    type: 'varchar',
    length: 20,
  })
  syncType!: SyncType;

  /**
   * Number of changes detected
   */
  @Column({ type: 'int', default: 0 })
  changesDetected!: number;

  /**
   * Number of changes successfully applied
   */
  @Column({ type: 'int', default: 0 })
  changesApplied!: number;

  /**
   * Number of errors encountered
   */
  @Column({ type: 'int', default: 0 })
  errors!: number;

  /**
   * Detailed information about the sync operation
   */
  @Column({ type: 'jsonb', nullable: true })
  details?: SyncChangeDetails;

  /**
   * Timestamp of when the sync was performed
   */
  @CreateDateColumn()
  syncedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if this sync had errors
   */
  hasErrors(): boolean {
    return this.errors > 0;
  }

  /**
   * Check if this sync detected changes
   */
  hasChanges(): boolean {
    return this.changesDetected > 0;
  }

  /**
   * Check if all changes were applied successfully
   */
  wasFullySuccessful(): boolean {
    return this.changesDetected === this.changesApplied && this.errors === 0;
  }

  /**
   * Get the success rate as a percentage
   */
  getSuccessRate(): number {
    if (this.changesDetected === 0) {
      return 100;
    }
    return Math.round((this.changesApplied / this.changesDetected) * 100);
  }

  /**
   * Get a human-readable summary
   */
  getSummary(): string {
    if (this.changesDetected === 0) {
      return 'No changes detected';
    }

    const parts: string[] = [`${this.changesApplied}/${this.changesDetected} changes applied`];

    if (this.errors > 0) {
      parts.push(`${this.errors} errors`);
    }

    return parts.join(', ');
  }

  /**
   * Get role change count
   */
  getRoleChangeCount(): number {
    if (!this.details) {
      return 0;
    }
    return (this.details.rolesAdded?.length || 0) + (this.details.rolesRemoved?.length || 0);
  }

  /**
   * Get rank change count
   */
  getRankChangeCount(): number {
    return this.details?.rankChanges?.length || 0;
  }

  /**
   * Get removed member count
   */
  getRemovedMemberCount(): number {
    return this.details?.removedMembers?.length || 0;
  }

  /**
   * Get conflict count
   */
  getConflictCount(): number {
    return this.details?.conflicts?.length || 0;
  }

  /**
   * Get duration in seconds
   */
  getDurationSeconds(): number | null {
    if (!this.details?.durationMs) {
      return null;
    }
    return Math.round(this.details.durationMs / 100) / 10; // Round to 1 decimal
  }
}
