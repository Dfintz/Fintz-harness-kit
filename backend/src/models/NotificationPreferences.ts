import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './User';

// ============================================================================
// Channel & Category Types
// ============================================================================

/**
 * Per-channel toggle shape. Each channel can be independently enabled/disabled.
 */
export interface NotificationChannels {
  /** In-app (bell icon, notification center). Always available. */
  inApp: boolean;
  /** Email delivery. */
  email: boolean;
  /** Discord DM / channel message. */
  discord: boolean;
}

/**
 * Per-category toggle shape. Each category maps to a group of notification types.
 */
export interface NotificationCategories {
  /** Fleet-related: created, deployed, dissolved, ship assignments. */
  fleet: boolean;
  /** Activity-related: invitations, completed, cancelled. */
  activity: boolean;
  /** Organization-related: announcements, member joins/leaves, role changes. */
  organization: boolean;
  /** Trade-related: trade operations, route status. */
  trade: boolean;
  /** Social: contact requests, messages. */
  social: boolean;
  /** Security: login alerts, password changes, 2FA. */
  security: boolean;
  /** LFG: new LFG posts, group status, matchmaking suggestions. */
  lfg: boolean;
  /** System: maintenance, updates, admin notices. */
  system: boolean;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CHANNELS: NotificationChannels = {
  inApp: true,
  email: false,
  discord: true,
};

export const DEFAULT_CATEGORIES: NotificationCategories = {
  fleet: true,
  activity: true,
  organization: true,
  trade: true,
  social: true,
  security: true,
  lfg: true,
  system: true,
};

// ============================================================================
// Entity
// ============================================================================

/**
 * NotificationPreferences — Per-user channel/category notification toggles.
 *
 * Persists the user's notification delivery preferences. Created lazily on
 * first access with sensible defaults. The `muteAll` flag is a master kill
 * switch that suppresses all non-system notifications regardless of
 * individual channel/category settings.
 */
@Entity('notification_preferences')
export class NotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** One preferences row per user (unique). */
  @Column({ type: 'varchar', unique: true })
  @Index({ unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  /**
   * Master mute toggle. When true, all non-system notifications are suppressed
   * regardless of individual channel/category settings.
   */
  @Column({ type: 'boolean', default: false })
  muteAll!: boolean;

  /**
   * Channel toggles — which delivery channels the user wants.
   * Stored as JSONB for flexibility; defaults applied in getter.
   */
  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_CHANNELS)}'` })
  channels!: NotificationChannels;

  /**
   * Category toggles — which notification categories the user subscribes to.
   * Stored as JSONB for flexibility; defaults applied in getter.
   */
  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_CATEGORIES)}'` })
  categories!: NotificationCategories;

  /**
   * Digest frequency preference.
   * 'none' disables digest emails entirely.
   */
  @Column({ type: 'varchar', length: 10, default: 'daily' })
  digestFrequency!: 'daily' | 'weekly' | 'none';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
