import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * RSI Sync Schedule Entity
 *
 * Stores sync configuration per organization for automatic scheduling.
 * Part of Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging.
 *
 * Features:
 * - Configurable sync intervals
 * - Enable/disable automatic sync
 * - Track last and next sync times
 * - Discord notification preferences
 */
@Entity('rsi_sync_schedules')
@Index('IDX_rsi_sync_schedules_org_id', ['organizationId'], { unique: true })
@Index('IDX_rsi_sync_schedules_enabled', ['isEnabled'])
@Index('IDX_rsi_sync_schedules_next_sync', ['nextSyncAt'])
export class RsiSyncSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Organization this schedule belongs to
   */
  @Column('uuid')
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * RSI Organization Spectrum ID for sync
   */
  @Column({ type: 'varchar', length: 50 })
  rsiOrgSid!: string;

  /**
   * Discord guild ID for role assignments
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  guildId?: string;

  /**
   * Whether automatic sync is enabled
   */
  @Column({ type: 'boolean', default: false })
  isEnabled!: boolean;

  /**
   * Sync interval in minutes (minimum 15 minutes)
   */
  @Column({ type: 'int', default: 60 })
  intervalMinutes!: number;

  /**
   * Last successful sync timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  /**
   * Next scheduled sync timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  nextSyncAt?: Date;

  /**
   * Number of consecutive failures
   */
  @Column({ type: 'int', default: 0 })
  consecutiveFailures!: number;

  /**
   * Last error message if sync failed
   */
  @Column({ type: 'text', nullable: true })
  lastErrorMessage?: string;

  /**
   * Whether to send Discord notifications for changes
   */
  @Column({ type: 'boolean', default: true })
  notifyOnChanges!: boolean;

  /**
   * Whether to send Discord notifications for errors
   */
  @Column({ type: 'boolean', default: true })
  notifyOnErrors!: boolean;

  /**
   * Discord channel ID for notifications
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  notificationChannelId?: string;

  /**
   * Whether to remove roles when user leaves org
   */
  @Column({ type: 'boolean', default: true })
  removeRolesOnLeave!: boolean;

  /**
   * How to handle affiliates: 'include', 'exclude', 'special_role'
   */
  @Column({ type: 'varchar', length: 20, default: 'include' })
  affiliateHandling!: string;

  /**
   * Special role ID for affiliates (if affiliateHandling is 'special_role')
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  affiliateRoleId?: string;

  /**
   * Maximum consecutive failures before auto-disable
   */
  @Column({ type: 'int', default: 5 })
  maxConsecutiveFailures!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Check if the schedule is due for sync
   */
  isDueForSync(): boolean {
    if (!this.isEnabled) {
      return false;
    }

    if (!this.nextSyncAt) {
      return true; // Never synced, due now
    }

    return new Date() >= this.nextSyncAt;
  }

  /**
   * Calculate the next sync time based on interval
   */
  calculateNextSyncTime(): Date {
    return new Date(Date.now() + this.intervalMinutes * 60 * 1000);
  }

  /**
   * Mark sync as successful
   */
  markSyncSuccess(): void {
    this.lastSyncAt = new Date();
    this.nextSyncAt = this.calculateNextSyncTime();
    this.consecutiveFailures = 0;
    this.lastErrorMessage = undefined;
  }

  /**
   * Mark sync as failed
   */
  markSyncFailed(errorMessage: string): void {
    this.consecutiveFailures++;
    this.lastErrorMessage = errorMessage;
    this.nextSyncAt = this.calculateNextSyncTime();

    // Auto-disable if too many consecutive failures
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.isEnabled = false;
    }
  }

  /**
   * Check if schedule has been auto-disabled due to failures
   */
  isAutoDisabled(): boolean {
    return !this.isEnabled && this.consecutiveFailures >= this.maxConsecutiveFailures;
  }

  /**
   * Re-enable schedule after auto-disable
   */
  reEnable(): void {
    this.isEnabled = true;
    this.consecutiveFailures = 0;
    this.lastErrorMessage = undefined;
    this.nextSyncAt = new Date(); // Sync immediately
  }

  /**
   * Get status summary
   */
  getStatus(): {
    enabled: boolean;
    isDue: boolean;
    lastSync: Date | null;
    nextSync: Date | null;
    failures: number;
    autoDisabled: boolean;
  } {
    return {
      enabled: this.isEnabled,
      isDue: this.isDueForSync(),
      lastSync: this.lastSyncAt || null,
      nextSync: this.nextSyncAt || null,
      failures: this.consecutiveFailures,
      autoDisabled: this.isAutoDisabled(),
    };
  }

  /** Valid sync interval options in minutes */
  static readonly VALID_INTERVALS = [360, 720, 1440] as const;

  /**
   * Validate the interval (must be 6h, 12h, or 24h)
   */
  static validateInterval(minutes: number): boolean {
    return (RsiSyncSchedule.VALID_INTERVALS as readonly number[]).includes(minutes);
  }

  /**
   * Get human-readable interval
   */
  getIntervalDisplay(): string {
    if (this.intervalMinutes < 60) {
      return `${this.intervalMinutes} minutes`;
    }
    const hours = Math.floor(this.intervalMinutes / 60);
    const mins = this.intervalMinutes % 60;
    if (mins === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${hours}h ${mins}m`;
  }
}
