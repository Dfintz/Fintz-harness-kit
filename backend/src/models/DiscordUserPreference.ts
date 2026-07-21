import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-user Discord notification preferences.
 *
 * Each row represents a user's preference for a specific Discord guild.
 * User-level preferences override guild-level defaults set by admins.
 *
 * Composite PK: (userId, guildId).
 */
@Entity('discord_user_preferences')
@Index(['userId', 'guildId'], { unique: true })
export class DiscordUserPreference {
  @PrimaryColumn()
  userId!: string;

  @PrimaryColumn()
  guildId!: string;

  /** Master toggle — if false, no DMs sent regardless of other flags */
  @Column({ type: 'boolean', default: true })
  dmEnabled!: boolean;

  /** Opt in to smart LFG ping DMs */
  @Column({ type: 'boolean', default: true })
  lfgPingOptIn!: boolean;

  /** Opt in to event reminder DMs */
  @Column({ type: 'boolean', default: true })
  eventReminderOptIn!: boolean;

  /** Opt in to ticket-related DMs */
  @Column({ type: 'boolean', default: true })
  ticketDmOptIn!: boolean;

  /** Opt in to recruitment-related DMs */
  @Column({ type: 'boolean', default: true })
  recruitmentDmOptIn!: boolean;

  /** Opt in to moderation alert DMs */
  @Column({ type: 'boolean', default: true })
  moderationAlertOptIn!: boolean;

  /**
   * When true, bot responses (panels, results, confirmations) are sent
   * via DM instead of as ephemeral messages in the channel.
   * Default false — ephemeral in-channel is the standard behaviour.
   */
  @Column({ type: 'boolean', default: false })
  botResponseViaDm!: boolean;

  /** User's timezone (IANA format, e.g. 'America/New_York') */
  @Column({ type: 'varchar', nullable: true })
  timezone?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
