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

import { Poll } from './Poll';

// ==================== ENUMS ====================

export enum PollMirrorStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CLOSED = 'closed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PollMirrorScope {
  ORGANIZATION = 'organization',
  FEDERATION = 'federation',
}

// ==================== CONSTANTS ====================

export const MAX_MIRROR_RETRY_COUNT = 3;

// ==================== ENTITY ====================

/**
 * PollDiscordMirror Entity
 *
 * Tracks Discord message mirrors for organization and federation polls.
 * Each record represents one poll embed posted to one Discord channel,
 * supporting multi-server broadcasting and live status updates.
 *
 * When votes are cast, the embed is edited in place to reflect current results.
 * When a poll closes, buttons are disabled and the embed shows final results.
 */
@Entity('poll_discord_mirrors')
@Index(['pollId'])
@Index(['guildId'])
@Index(['status'])
@Index(['organizationId'])
@Index(['pollId', 'guildId'], { unique: true })
export class PollDiscordMirror {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ==================== POLL REFERENCE ====================

  @Column({ type: 'uuid' })
  pollId!: string;

  @ManyToOne(() => Poll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll;

  // ==================== SCOPE ====================

  @Column({ type: 'varchar', length: 20, default: PollMirrorScope.ORGANIZATION })
  scope!: PollMirrorScope;

  /** Federation ID when scope = federation (null for org-scoped mirrors) */
  @Column({ type: 'uuid', nullable: true })
  federationId?: string;

  /** Organization ID that owns this mirror (for tenant scoping) */
  @Column({ type: 'varchar' })
  organizationId!: string;

  // ==================== DISCORD TARGETING ====================

  @Column({ type: 'varchar', length: 20 })
  guildId!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  channelId?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  messageId?: string;

  // ==================== STATUS ====================

  @Column({
    type: 'varchar',
    length: 20,
    default: PollMirrorStatus.PENDING,
  })
  status!: PollMirrorStatus;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  // ==================== TIMESTAMPS ====================

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUpdatedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== COMPUTED ====================

  get isPending(): boolean {
    return this.status === PollMirrorStatus.PENDING;
  }

  get isActive(): boolean {
    return this.status === PollMirrorStatus.ACTIVE;
  }

  get isClosed(): boolean {
    return this.status === PollMirrorStatus.CLOSED;
  }

  get isFailed(): boolean {
    return this.status === PollMirrorStatus.FAILED;
  }

  get canRetry(): boolean {
    return this.status === PollMirrorStatus.FAILED && this.retryCount < MAX_MIRROR_RETRY_COUNT;
  }
}
