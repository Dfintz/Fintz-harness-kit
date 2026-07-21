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
 * Status of the mirrored event
 */
export enum MirroredActivityStatus {
  /** Mirror is active and syncing RSVPs */
  ACTIVE = 'active',
  /** Mirror is paused (e.g., source event updated, awaiting re-sync) */
  PAUSED = 'paused',
  /** Mirror was cancelled by the source or target server admin */
  CANCELLED = 'cancelled',
  /** Source event has ended or been deleted */
  EXPIRED = 'expired',
}

/**
 * MirroredActivity entity
 *
 * Tracks when an event is mirrored from one Discord server to another.
 * Part of Wave 1.8 — Event Mirroring.
 *
 * Features:
 * - Links source activity to mirror instances across guilds
 * - Tracks Discord message IDs for embed updates
 * - Mirror key authentication for cross-org mirroring
 * - Bidirectional RSVP sync via BotIPCService (Redis pub/sub)
 * - Max 5 mirrors per source event enforced at service layer
 *
 * Flow:
 * 1. Source org creates event → `/events mirror <eventId>` in target server
 * 2. Mirror record created linking source ↔ target
 * 3. Event embed posted in target server channel
 * 4. RSVP on either server triggers IPC sync to update both embeds
 */
@Entity('mirrored_activities')
@Index('idx_mirrored_source', ['sourceActivityId'])
@Index('idx_mirrored_mirror', ['mirrorActivityId'])
@Index('idx_mirrored_guild', ['mirrorGuildId'])
@Index('idx_mirrored_status', ['status'])
export class MirroredActivity extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ==================== SOURCE INFO ====================

  /** Activity ID of the original event (in the source org) */
  @Column()
  sourceActivityId!: string;

  /** Discord guild ID where the source event lives */
  @Column()
  sourceGuildId!: string;

  /** Organization ID that owns the source event */
  @Column()
  sourceOrganizationId!: string;

  // ==================== MIRROR INFO ====================

  /** Activity ID of the mirrored copy (in the target org), if created */
  @Column({ nullable: true })
  mirrorActivityId?: string;

  /** Discord guild ID where the mirror lives */
  @Column()
  mirrorGuildId!: string;

  /** Discord channel ID where the mirror embed is posted */
  @Column()
  mirrorChannelId!: string;

  /** Discord message ID of the mirrored event embed */
  @Column({ nullable: true })
  mirrorMessageId?: string;

  // ==================== AUTHENTICATION ====================

  /** Mirror key for cross-server authentication (hashed) */
  @Column({ type: 'varchar', nullable: true })
  mirrorKey?: string;

  // ==================== SYNC STATE ====================

  /** Current status of the mirror */
  @Column({
    type: 'enum',
    enum: MirroredActivityStatus,
    default: MirroredActivityStatus.ACTIVE,
  })
  status!: MirroredActivityStatus;

  /** Whether RSVP sync is currently enabled */
  @Column({ type: 'boolean', default: true })
  syncEnabled!: boolean;

  /** Timestamp of the last successful RSVP sync */
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  // ==================== METADATA ====================

  /** Extensible metadata (e.g., auto-mirror config, sync stats) */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // ==================== TIMESTAMPS ====================

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== HELPER METHODS ====================

  /** Check if this mirror is actively syncing */
  isActive(): boolean {
    return this.status === MirroredActivityStatus.ACTIVE && this.syncEnabled;
  }

  /** Check if this mirror can be synced */
  canSync(): boolean {
    return (
      this.status === MirroredActivityStatus.ACTIVE &&
      this.syncEnabled &&
      !!this.mirrorMessageId
    );
  }
}
