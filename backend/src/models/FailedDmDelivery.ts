import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Persistent retry queue for Discord DM deliveries that failed on the first attempt.
 *
 * Each row represents a single recipient (one DM). When the live `user.send()` call
 * inside `DmNotificationService.sendNotifications` rejects, the failed delivery is
 * persisted here so a background job can retry with exponential backoff
 * (5 min → 30 min → 2 h, then dropped after 4 total attempts).
 *
 * Rows are time-bounded by `expiresAt` (default 24 h) — the retry job cleans up any
 * rows past their TTL regardless of attempt count.
 *
 * The `embed` payload is stored as the discord.js `APIEmbed` JSON shape (i.e. the
 * result of `EmbedBuilder.toJSON()`), so retries can re-send without rebuilding the
 * embed object.
 *
 * Owner: `DmNotificationService` (write on first failure, read/update from job).
 */
@Entity('failed_dm_deliveries')
@Index('IDX_failed_dm_deliveries_nextRetryAt', ['nextRetryAt'])
@Index('IDX_failed_dm_deliveries_expiresAt', ['expiresAt'])
@Index('IDX_failed_dm_deliveries_recipient', ['recipientDiscordId'])
export class FailedDmDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Discord user ID (snowflake) of the intended recipient. */
  @Column({ type: 'varchar' })
  recipientDiscordId!: string;

  /** `DmEventType` value — used for logging/metrics, not behaviour-affecting. */
  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  /**
   * Guild ID associated with the original send (for re-checking per-user opt-out
   * preferences on retry). `null` when the original send had no guild context.
   */
  @Column({ type: 'varchar', nullable: true })
  guildId?: string | null;

  /** Optional plain-text content sent alongside the embed. */
  @Column({ type: 'text', nullable: true })
  content?: string | null;

  /** Serialized `APIEmbed` (output of `EmbedBuilder.toJSON()`). */
  @Column({ type: 'jsonb' })
  embedJson!: Record<string, unknown>;

  /**
   * Total send attempts so far, including the original live attempt that failed.
   * The first persisted row therefore starts at 1.
   */
  @Column({ type: 'int', default: 1 })
  attemptCount!: number;

  /** When the next retry is due. The job picks rows with `nextRetryAt <= now()`. */
  @Column({ type: 'timestamp' })
  nextRetryAt!: Date;

  /** Last error message (truncated to a reasonable length by the service). */
  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  /**
   * Hard expiry — rows past this point are deleted by the retry job regardless of
   * attempt count. Defaults to 24 h after creation.
   */
  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
