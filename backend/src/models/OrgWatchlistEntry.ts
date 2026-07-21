import {
  FlagSeverity,
  WatchlistReason,
  WatchlistThreatLevel,
} from '@sc-fleet-manager/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';

/**
 * OrgWatchlistEntry
 *
 * An RSI citizen that an org's intel team wants to monitor.
 * When an RSI sync detects that a watchlisted citizen is in a member's
 * contacts or org, a MemberAuditEvent flag can be created.
 *
 * Organization-level relationships are managed via the Relations page.
 * Watchlist entries may reference RSI citizens that are NOT on the platform.
 *
 * Wave 2.1 — Membership Audit & Intel
 */
@Entity('org_watchlist_entries')
@Index(['organizationId', 'rsiHandle'], { unique: true })
@Index(['organizationId', 'reason'])
@Index(['organizationId', 'threatLevel'])
@Index(['rsiHandle'])
export class OrgWatchlistEntry extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * RSI citizen handle (spectrum ID).
   * This is the unique RSI identifier for the citizen.
   */
  @Column({ type: 'varchar', length: 100 })
  rsiHandle!: string;

  /**
   * Display name of the citizen (for UI convenience).
   * May become stale if the citizen renames.
   */
  @Column({ type: 'varchar', length: 255 })
  citizenName!: string;

  /**
   * Why this citizen is on the watchlist.
   */
  @Column({
    type: 'varchar',
    length: 30,
  })
  reason!: WatchlistReason;

  /**
   * Assessed threat level — determines the severity of auto-generated flags
   * when this citizen is encountered.
   */
  @Column({
    type: 'varchar',
    length: 12,
  })
  threatLevel!: WatchlistThreatLevel;

  /**
   * Free-text notes from the intel officer.
   */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  /**
   * User ID of the officer who added this entry.
   */
  @Column({ type: 'uuid' })
  addedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /**
   * Map threat level to a FlagSeverity for auto-generated audit flags.
   * Returns enum values directly for type safety.
   */
  getFlagSeverity(): FlagSeverity {
    const mapping: Record<WatchlistThreatLevel, FlagSeverity> = {
      [WatchlistThreatLevel.LOW]: FlagSeverity.INFO,
      [WatchlistThreatLevel.MODERATE]: FlagSeverity.MEDIUM,
      [WatchlistThreatLevel.HIGH]: FlagSeverity.HIGH,
      [WatchlistThreatLevel.CRITICAL]: FlagSeverity.CRITICAL,
    };
    return mapping[this.threatLevel] ?? FlagSeverity.MEDIUM;
  }

  /**
   * Human-readable summary string.
   */
  getSummary(): string {
    return `${this.citizenName} [${this.rsiHandle}] — ${this.reason} (${this.threatLevel})`;
  }
}
