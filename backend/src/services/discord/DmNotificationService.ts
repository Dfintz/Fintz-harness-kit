import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { Client, EmbedBuilder } from 'discord.js';
import { LessThanOrEqual, Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { FailedDmDelivery } from '../../models/FailedDmDelivery';
import { logger } from '../../utils/logger';

import { DiscordUserPreferenceService } from './DiscordUserPreferenceService';

/**
 * Notification event types that trigger DMs
 */
export enum DmEventType {
  // Ticket lifecycle
  TICKET_CREATED = 'ticket_created',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_REPLIED = 'ticket_replied',
  TICKET_CLOSED = 'ticket_closed',
  TICKET_ESCALATED = 'ticket_escalated',

  // Recruitment lifecycle
  RECRUITMENT_RECEIVED = 'recruitment_received',
  RECRUITMENT_ACCEPTED = 'recruitment_accepted',
  RECRUITMENT_DENIED = 'recruitment_denied',

  // Event reminders
  EVENT_REMINDER = 'event_reminder',
  EVENT_CANCELLED = 'event_cancelled',

  // LFG
  LFG_PLAYER_JOINED = 'lfg_player_joined',
}

export interface DmNotificationPayload {
  eventType: DmEventType;
  recipientDiscordIds: string[];
  embed: EmbedBuilder;
  /** Optional plain text fallback */
  content?: string;
  /** Guild ID — used to check per-user notification preferences */
  guildId?: string;
}

/**
 * Per-guild DM notification configuration
 */
export interface DmNotificationSettings {
  enabled: boolean;
  ticketCreatedNotify?: boolean;
  ticketAssignedNotify?: boolean;
  ticketRepliedNotify?: boolean;
  ticketClosedNotify?: boolean;
  ticketEscalatedNotify?: boolean;
  ticketTranscriptInDm?: boolean;
  recruitmentReceivedNotify?: boolean;
  recruitmentAcceptedNotify?: boolean;
  recruitmentDeniedNotify?: boolean;
  eventReminderNotify?: boolean;
  lfgJoinNotify?: boolean;
}

export const DEFAULT_DM_NOTIFICATION_SETTINGS: DmNotificationSettings = {
  enabled: true,
  ticketCreatedNotify: true,
  ticketAssignedNotify: true,
  ticketRepliedNotify: false,
  ticketClosedNotify: true,
  ticketEscalatedNotify: true,
  ticketTranscriptInDm: false,
  recruitmentReceivedNotify: true,
  recruitmentAcceptedNotify: true,
  recruitmentDeniedNotify: true,
  eventReminderNotify: true,
  lfgJoinNotify: true,
};

/**
 * Result of a DM notification batch
 */
export interface DmNotificationResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Result of a `retryFailedDms()` pass.
 */
export interface DmRetryResult {
  /** Rows that were past `expiresAt` and dropped without retry. */
  expired: number;
  /** Rows whose retry succeeded (row deleted). */
  succeeded: number;
  /** Rows whose retry failed but will be tried again later. */
  rescheduled: number;
  /** Rows whose retry failed and reached MAX_ATTEMPTS (row deleted). */
  dropped: number;
}

/**
 * Maximum total send attempts (live attempt + persisted retries).
 * After this many failures, the queued row is dropped.
 */
const MAX_ATTEMPTS = 4;

/**
 * Backoff schedule (ms) used by the retry job, indexed by `attemptCount`.
 * - attemptCount 1 (after live failure)  → first retry in 5 min
 * - attemptCount 2 (after first retry failed) → next retry in 30 min
 * - attemptCount 3 (after second retry failed) → next retry in 2 h
 * - attemptCount 4 → dropped (no further retries)
 */
const RETRY_DELAYS_MS: readonly number[] = [
  5 * 60 * 1000, // attemptCount 1 → +5 min
  30 * 60 * 1000, // attemptCount 2 → +30 min
  2 * 60 * 60 * 1000, // attemptCount 3 → +2 h
];

/** Hard TTL on queued rows — 24 h after creation. */
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;

/** Cap `lastError` text to avoid bloating jsonb storage with stack traces. */
const MAX_ERROR_LENGTH = 500;

/** Maximum rows pulled per retry pass — keeps a single tick bounded. */
const RETRY_BATCH_SIZE = 50;

/**
 * DM Notification Service
 *
 * Sends contextual Discord DMs for lifecycle events across
 * tickets, recruitment, events, and LFG systems.
 *
 * Uses fire-and-forget pattern: DM failures are logged but never
 * block the calling operation.
 */
export class DmNotificationService {
  private static instance: DmNotificationService;
  private client: Client | null = null;

  private shouldFailClosedOnPreferenceError(): boolean {
    return process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED === 'true';
  }

  private async filterRecipientsByPreference(
    payload: DmNotificationPayload,
    recipients: string[]
  ): Promise<string[]> {
    if (!payload.guildId || recipients.length === 0) {
      return recipients;
    }

    try {
      const prefService = DiscordUserPreferenceService.getInstance();
      const enabled = await prefService.filterDmEnabled(recipients, payload.guildId);
      const filtered = recipients.length - enabled.size;
      if (filtered > 0) {
        logger.debug(
          `DmNotificationService: Filtered ${filtered} opted-out user(s) for ${payload.eventType}`
        );
      }

      return recipients.filter(id => enabled.has(id));
    } catch {
      if (this.shouldFailClosedOnPreferenceError()) {
        logger.warn(
          'DmNotificationService: Failed to check user preferences, dropping recipients (fail-closed)'
        );
        return [];
      }

      logger.warn('DmNotificationService: Failed to check user preferences, sending to all');
      return recipients;
    }
  }

  private async sendNotificationToRecipient(
    payload: DmNotificationPayload,
    recipientId: string,
    client: Client,
    result: DmNotificationResult
  ): Promise<void> {
    try {
      const user = await client.users.fetch(recipientId);
      await user.send({
        content: payload.content,
        embeds: [payload.embed],
      });
      result.sent++;
    } catch (error: unknown) {
      result.failed++;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to DM ${recipientId}: ${msg}`);
      logger.debug(`DmNotificationService: Could not DM user ${recipientId}:`, error);
      await this.persistFailedDelivery(recipientId, payload, msg);
    }
  }

  static getInstance(): DmNotificationService {
    if (!DmNotificationService.instance) {
      DmNotificationService.instance = new DmNotificationService();
    }
    return DmNotificationService.instance;
  }

  /**
   * Set the Discord client (called once during bot init)
   */
  initialize(client: Client): void {
    this.client = client;
  }

  /**
   * Check if a specific event type is enabled in notification settings
   */
  isEventEnabled(eventType: DmEventType, settings?: DmNotificationSettings): boolean {
    if (!settings?.enabled) {
      return false;
    }

    const eventMap: Record<DmEventType, keyof DmNotificationSettings> = {
      [DmEventType.TICKET_CREATED]: 'ticketCreatedNotify',
      [DmEventType.TICKET_ASSIGNED]: 'ticketAssignedNotify',
      [DmEventType.TICKET_REPLIED]: 'ticketRepliedNotify',
      [DmEventType.TICKET_CLOSED]: 'ticketClosedNotify',
      [DmEventType.TICKET_ESCALATED]: 'ticketEscalatedNotify',
      [DmEventType.RECRUITMENT_RECEIVED]: 'recruitmentReceivedNotify',
      [DmEventType.RECRUITMENT_ACCEPTED]: 'recruitmentAcceptedNotify',
      [DmEventType.RECRUITMENT_DENIED]: 'recruitmentDeniedNotify',
      [DmEventType.EVENT_REMINDER]: 'eventReminderNotify',
      [DmEventType.EVENT_CANCELLED]: 'eventReminderNotify',
      [DmEventType.LFG_PLAYER_JOINED]: 'lfgJoinNotify',
    };

    const key = eventMap[eventType];
    return settings[key] === true;
  }

  /**
   * Send DMs to a list of recipients. Never throws — logs errors internally.
   */
  async sendNotifications(payload: DmNotificationPayload): Promise<DmNotificationResult> {
    const result: DmNotificationResult = { sent: 0, failed: 0, errors: [] };

    if (!this.client) {
      result.errors.push('DmNotificationService: Client not initialized');
      logger.warn('DmNotificationService: Attempted to send DMs before initialization');
      return result;
    }

    const recipients = await this.filterRecipientsByPreference(
      payload,
      payload.recipientDiscordIds
    );

    for (const recipientId of recipients) {
      await this.sendNotificationToRecipient(payload, recipientId, this.client, result);
    }

    if (result.sent > 0) {
      logger.info(
        `DmNotificationService: ${payload.eventType} — sent ${result.sent}, failed ${result.failed}`
      );
    }

    return result;
  }

  // ─── Persistent retry queue ──────────────────────

  /**
   * Lazy accessor for the FailedDmDelivery repository.
   *
   * Returns `null` if the data source isn't initialized (e.g. during unit tests
   * that mock `AppDataSource.getRepository` to return `undefined`). All callers
   * must null-check.
   */
  private getFailedRepo(): Repository<FailedDmDelivery> | null {
    try {
      const repo = AppDataSource.getRepository(FailedDmDelivery);
      return repo ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Persist a failed live send to the retry queue. Never throws — persistence
   * failures degrade silently (the original DM failure has already been logged).
   */
  private async persistFailedDelivery(
    recipientId: string,
    payload: DmNotificationPayload,
    errorMessage: string
  ): Promise<void> {
    const repo = this.getFailedRepo();
    if (!repo) {
      return;
    }

    try {
      const now = Date.now();
      await repo.save(
        repo.create({
          recipientDiscordId: recipientId,
          eventType: payload.eventType,
          guildId: payload.guildId ?? null,
          content: payload.content ?? null,
          embedJson: payload.embed.toJSON() as Record<string, unknown>,
          attemptCount: 1,
          nextRetryAt: new Date(now + RETRY_DELAYS_MS[0]),
          lastError: errorMessage.slice(0, MAX_ERROR_LENGTH),
          expiresAt: new Date(now + QUEUE_TTL_MS),
        })
      );
    } catch (err: unknown) {
      logger.warn(
        `DmNotificationService: Failed to enqueue retry for user ${recipientId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Process due retry-queue rows. Intended to be called from a scheduled job.
   *
   * Behaviour per row:
   *  - If `expiresAt <= now` → delete (counted as `expired`).
   *  - Otherwise re-send the DM.
   *    - Success → delete the row (`succeeded`).
   *    - Failure with `attemptCount + 1 < MAX_ATTEMPTS` → bump `attemptCount`
   *      and reschedule per `RETRY_DELAYS_MS` (`rescheduled`).
   *    - Failure with `attemptCount + 1 >= MAX_ATTEMPTS` → delete the row
   *      (`dropped`).
   *
   * Never throws — all per-row errors are caught and logged.
   */
  async retryFailedDms(): Promise<DmRetryResult> {
    const result: DmRetryResult = { expired: 0, succeeded: 0, rescheduled: 0, dropped: 0 };

    const repo = this.getFailedRepo();
    if (!repo) {
      return result;
    }

    if (!this.client) {
      // Without a client we can't retry. Don't drop rows; the next tick may have one.
      logger.debug('DmNotificationService: Skipping retry pass — Discord client not initialized');
      return result;
    }

    const now = new Date();
    let dueRows: FailedDmDelivery[];
    try {
      dueRows = await repo.find({
        where: { nextRetryAt: LessThanOrEqual(now) },
        order: { nextRetryAt: 'ASC' },
        take: RETRY_BATCH_SIZE,
      });
    } catch (err: unknown) {
      logger.error('DmNotificationService: Failed to query retry queue', err);
      return result;
    }

    for (const row of dueRows) {
      try {
        await this.processRetryRow(row, now, repo, this.client, result);
      } catch (err: unknown) {
        logger.error(`DmNotificationService: Unexpected error processing retry row ${row.id}`, err);
      }
    }

    if (result.succeeded + result.dropped + result.expired > 0) {
      logger.info(
        `DmNotificationService: Retry pass complete — succeeded=${result.succeeded}, rescheduled=${result.rescheduled}, dropped=${result.dropped}, expired=${result.expired}`
      );
    }

    return result;
  }

  /**
   * Handle one row from the retry queue. Extracted from `retryFailedDms` to keep
   * cognitive complexity low. Mutates `result` counters in place.
   */
  private async processRetryRow(
    row: FailedDmDelivery,
    now: Date,
    repo: Repository<FailedDmDelivery>,
    client: Client,
    result: DmRetryResult
  ): Promise<void> {
    if (row.expiresAt.getTime() <= now.getTime()) {
      await repo.delete(row.id);
      result.expired++;
      logger.info(
        `DmNotificationService: Dropping expired DM retry for ${row.recipientDiscordId} (event=${row.eventType}, attempts=${row.attemptCount})`
      );
      return;
    }

    try {
      const user = await client.users.fetch(row.recipientDiscordId);
      const sendPayload: { content?: string; embeds: Record<string, unknown>[] } = {
        embeds: [row.embedJson],
      };
      if (row.content) {
        sendPayload.content = row.content;
      }
      await user.send(sendPayload);

      await repo.delete(row.id);
      result.succeeded++;
      logger.info(
        `DmNotificationService: Retry succeeded for ${row.recipientDiscordId} (event=${row.eventType}, attempts=${row.attemptCount})`
      );
    } catch (sendErr: unknown) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      const nextAttempt = row.attemptCount + 1;

      if (nextAttempt >= MAX_ATTEMPTS) {
        await repo.delete(row.id);
        result.dropped++;
        logger.warn(
          `DmNotificationService: Dropping DM retry for ${row.recipientDiscordId} after ${nextAttempt} attempts (event=${row.eventType}): ${msg}`
        );
        return;
      }

      // nextAttempt is bounded to [2, MAX_ATTEMPTS - 1] = [2, 3] here, so
      // RETRY_DELAYS_MS[nextAttempt - 1] is always defined. Fall back to the
      // last bucket defensively in case MAX_ATTEMPTS / RETRY_DELAYS_MS lengths
      // ever drift apart.
      const lastDelay = RETRY_DELAYS_MS.at(-1) ?? 5 * 60 * 1000;
      const delayMs = RETRY_DELAYS_MS[nextAttempt - 1] ?? lastDelay;
      row.attemptCount = nextAttempt;
      row.nextRetryAt = new Date(now.getTime() + delayMs);
      row.lastError = msg.slice(0, MAX_ERROR_LENGTH);
      await repo.save(row);
      result.rescheduled++;
    }
  }

  // ─── Ticket Embeds ───────────────────────────────

  buildTicketCreatedEmbed(ticketNumber: string, subject: string, category: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('🎫 Ticket Created')
      .setDescription(
        `Your ticket **${decodeHtmlEntities(ticketNumber)}** has been created and is being reviewed.`
      )
      .addFields(
        { name: 'Subject', value: decodeHtmlEntities(subject), inline: false },
        { name: 'Category', value: decodeHtmlEntities(category), inline: true },
        { name: 'Status', value: '`Open`', inline: true }
      )
      .setFooter({ text: 'You will be notified when there are updates.' })
      .setTimestamp();
  }

  buildTicketAssignedEmbed(ticketNumber: string, assigneeName: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎫 Ticket Assigned')
      .setDescription(
        `Your ticket **${decodeHtmlEntities(ticketNumber)}** has been assigned to **${decodeHtmlEntities(assigneeName)}**.`
      )
      .setTimestamp();
  }

  buildTicketRepliedEmbed(
    ticketNumber: string,
    replierName: string,
    preview: string
  ): EmbedBuilder {
    const decodedPreview = decodeHtmlEntities(preview);
    const truncated =
      decodedPreview.length > 200 ? `${decodedPreview.slice(0, 200)}…` : decodedPreview;
    return new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('💬 New Reply on Your Ticket')
      .setDescription(
        `**${decodeHtmlEntities(replierName)}** replied to ticket **${decodeHtmlEntities(ticketNumber)}**:`
      )
      .addFields({ name: 'Message', value: truncated })
      .setTimestamp();
  }

  buildTicketClosedEmbed(
    ticketNumber: string,
    resolution?: string,
    transcriptUrl?: string
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('🎫 Ticket Closed')
      .setDescription(`Your ticket **${decodeHtmlEntities(ticketNumber)}** has been closed.`)
      .setTimestamp();

    if (resolution) {
      embed.addFields({ name: 'Resolution', value: decodeHtmlEntities(resolution) });
    }
    if (transcriptUrl) {
      embed.addFields({ name: 'Transcript', value: `[View transcript](${transcriptUrl})` });
    }

    return embed;
  }

  buildTicketEscalatedEmbed(ticketNumber: string, reason?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle('⚠️ Ticket Escalated')
      .setDescription(
        `Ticket **${decodeHtmlEntities(ticketNumber)}** has been escalated for review.`
      )
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: 'Reason', value: decodeHtmlEntities(reason) });
    }

    return embed;
  }

  // ─── Recruitment Embeds ──────────────────────────

  buildRecruitmentReceivedEmbed(applicantName: string, position?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x00d9ff)
      .setTitle('📋 Application Received')
      .setDescription(
        `Thank you **${decodeHtmlEntities(applicantName)}**, your application has been received and is under review.`
      )
      .setTimestamp();

    if (position) {
      embed.addFields({ name: 'Position', value: decodeHtmlEntities(position), inline: true });
    }
    embed.addFields({ name: 'Status', value: '`Under Review`', inline: true });

    return embed;
  }

  buildRecruitmentAcceptedEmbed(organizationName: string, position?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('✅ Application Accepted')
      .setDescription(
        `Congratulations! Your application to **${decodeHtmlEntities(organizationName)}** has been accepted!`
      )
      .setTimestamp();

    if (position) {
      embed.addFields({ name: 'Position', value: decodeHtmlEntities(position), inline: true });
    }

    return embed;
  }

  buildRecruitmentDeniedEmbed(organizationName: string, reason?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('❌ Application Not Accepted')
      .setDescription(
        `Your application to **${decodeHtmlEntities(organizationName)}** was not accepted at this time.`
      )
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: 'Feedback', value: decodeHtmlEntities(reason) });
    }

    return embed;
  }

  // ─── LFG Embeds ──────────────────────────────────

  buildLfgJoinedEmbed(
    activity: string,
    playerName: string,
    currentPlayers: number,
    maxPlayers: number
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('🎮 Player Joined Your LFG')
      .setDescription(
        `**${decodeHtmlEntities(playerName)}** joined your **${decodeHtmlEntities(activity)}** group!`
      )
      .addFields({
        name: 'Party',
        value: `${currentPlayers}/${maxPlayers} players`,
        inline: true,
      })
      .setTimestamp();
  }
}
