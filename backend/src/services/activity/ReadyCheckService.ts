import crypto from 'node:crypto';

import {
  ActionRowBuilder,
  AnyThreadChannel,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Message,
  NewsChannel,
  TextChannel,
} from 'discord.js';

import { BotClientManager } from '../../bot/BotClientManager';
import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, ActivityType } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import { User } from '../../models/User';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import {
  emitReadyCheckCancelled,
  emitReadyCheckCompleted,
  emitReadyCheckExpired,
  emitReadyCheckInitiated,
  emitReadyCheckResponse,
} from '../../websocket/controllers/activityWebSocketController';
import { NotificationPreferencesService } from '../communication/notifications/NotificationPreferencesService';
import {
  NotificationContext,
  NotificationRouter,
} from '../communication/notifications/NotificationRouter';
import { discordSettingsService } from '../discord/DiscordSettingsService';

import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';

type ThreadHostChannel = TextChannel | NewsChannel;

/** Stored in Redis — full ready check state */
interface ReadyCheckState {
  id: string;
  activityId: string;
  activityTitle: string;
  organizationId: string;
  initiatedBy: string;
  initiatedByName: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  expiresAt: string;
  durationSeconds: number;
  responses: Record<
    string,
    {
      userId: string;
      userName: string;
      response: 'ready' | 'not_ready' | 'pending';
      respondedAt?: string;
    }
  >;
  totalParticipants: number;
  threadPanel?: {
    channelId: string;
    messageId: string;
    postedAt: string;
  };
  createdAt: string;
  completedAt?: string;
}

const REDIS_KEY_PREFIX = 'ready_check:';
const ACTIVE_CHECK_KEY_PREFIX = 'ready_check_active:';
const DEFAULT_DURATION_SECONDS = 120;
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 600;
export const READY_CHECK_VOTE_READY_PREFIX = 'readycheck_vote_ready_';
export const READY_CHECK_VOTE_NOT_READY_PREFIX = 'readycheck_vote_notready_';

/**
 * ReadyCheckService
 *
 * Manages voice-command-friendly ready checks for fleet operations/activities.
 * Uses Redis for ephemeral storage (ready checks are time-limited, not persisted).
 *
 * Key design decisions:
 * - Redis-backed (not DB) — ready checks are short-lived (30s–10min)
 * - One active ready check per activity at a time
 * - Auto-expires via Redis TTL
 * - Real-time updates via WebSocket
 * - Simple API surface for Wingman AI voice commands
 */
export class ReadyCheckService {
  private readonly activityRepo = AppDataSource.getRepository(Activity);
  private readonly participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
  private readonly userRepo = AppDataSource.getRepository(User);
  private readonly notificationRouter = new NotificationRouter();
  private readonly notificationPreferencesService = new NotificationPreferencesService();

  /**
   * Initiate a ready check for an activity.
   * Only the activity leader/creator can initiate.
   */
  async initiateReadyCheck(
    activityId: string,
    organizationId: string,
    userId: string,
    userName: string,
    durationSeconds: number = DEFAULT_DURATION_SECONDS
  ): Promise<ReadyCheckState> {
    // Validate duration
    if (durationSeconds < MIN_DURATION_SECONDS || durationSeconds > MAX_DURATION_SECONDS) {
      throw new ValidationError(
        `Duration must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds`
      );
    }

    // Load activity (tenant-scoped)
    const activity = await this.activityRepo.findOne({ where: { id: activityId, organizationId } });
    if (!activity) {
      throw new NotFoundError('Activity not found');
    }

    // Verify user is the creator or a leader
    const isCreator = activity.creatorId === userId;
    const isLeader = await this.isLeaderParticipant(activityId, userId);
    if (!isCreator && !isLeader) {
      throw new ForbiddenError('Only the activity creator or a leader can initiate a ready check');
    }

    // Check activity is in a valid state for ready check
    const validStatuses: ActivityStatus[] = [
      ActivityStatus.OPEN,
      ActivityStatus.PLANNING,
      ActivityStatus.RECRUITING,
      ActivityStatus.READY,
    ];
    if (!validStatuses.includes(activity.status)) {
      throw new ValidationError(
        `Cannot initiate ready check for activity in ${activity.status} status`
      );
    }

    // Check no active ready check already exists for this activity
    const existingCheck = await this.getActiveReadyCheck(activityId);
    if (existingCheck?.status === 'pending') {
      throw new ConflictError('A ready check is already active for this activity');
    }

    // Get all accepted participants
    const participants = await this.participantRepo.find({
      where: {
        activityId,
        status: ActivityParticipantStatus.ACCEPTED,
      },
    });

    if (participants.length < 2) {
      throw new ValidationError('Need at least 2 accepted participants to initiate a ready check');
    }

    // Build ready check state
    const readyCheckId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

    const responses: ReadyCheckState['responses'] = {};
    for (const p of participants) {
      responses[p.userId] = {
        userId: p.userId,
        userName: p.userName,
        response: 'pending',
      };
    }

    const readyCheck: ReadyCheckState = {
      id: readyCheckId,
      activityId,
      activityTitle: activity.title,
      organizationId: activity.organizationId ?? '',
      initiatedBy: userId,
      initiatedByName: userName,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      durationSeconds,
      responses,
      totalParticipants: participants.length,
      createdAt: now.toISOString(),
    };

    // Store in Redis with TTL slightly longer than duration (for cleanup)
    const redisTtl = durationSeconds + 60; // extra minute for grace
    await redisClient.set(`${REDIS_KEY_PREFIX}${readyCheckId}`, readyCheck, redisTtl);
    await redisClient.set(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`, readyCheckId, redisTtl);

    // Schedule expiration check
    this.scheduleExpirationCheck(readyCheckId, activityId, durationSeconds);

    // Emit WebSocket event
    emitReadyCheckInitiated(
      readyCheck.organizationId,
      activityId,
      this.toPublicReadyCheck(readyCheck),
      userId
    );

    // Audit log
    activityAuditLogger.log({
      action: ActivityAuditAction.READY_CHECK_INITIATED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: userId,
      performedByName: userName,
      details: {
        readyCheckId,
        durationSeconds,
        totalParticipants: participants.length,
      },
    });

    logger.info(
      `Ready check ${readyCheckId} initiated for activity ${activityId} by ${userName} (${durationSeconds}s)`
    );

    // Notify participants via in-app/websocket channels (fire-and-forget)
    for (const p of participants) {
      if (p.userId !== userId) {
        this.notificationRouter
          .notifyUser({
            context: NotificationContext.READY_CHECK_INITIATED,
            userId: p.userId,
            title: `Ready Check: ${activity.title}`,
            message: `${userName} initiated a ready check. Respond within ${durationSeconds}s.`,
            actionUrl: `/activities/${activityId}`,
            metadata: { activityId, readyCheckId },
          })
          .catch(() => {
            /* notification delivery is best-effort */
          });
      }
    }

    // Discord path: DM first, then mention fallback in the activity thread on DM failures.
    void this.notifyParticipantsViaDiscordWithThreadFallback(readyCheck, participants).catch(
      (error: unknown) => {
        logger.warn('Ready check Discord notification flow failed', {
          readyCheckId,
          activityId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    );

    void this.syncReadyCheckThreadPanel(readyCheck).catch((error: unknown) => {
      logger.warn('Ready check thread panel sync failed on initiate', {
        readyCheckId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return readyCheck;
  }

  /**
   * Respond to a ready check. Voice-command friendly — just "ready" or "not ready".
   */
  async respond(
    activityId: string,
    userId: string,
    userName: string,
    response: 'ready' | 'not_ready'
  ): Promise<ReadyCheckState> {
    const readyCheck = await this.getActiveReadyCheckState(activityId);
    if (!readyCheck) {
      throw new NotFoundError('No active ready check found for this activity');
    }

    if (readyCheck.status !== 'pending') {
      throw new ValidationError(`Ready check is already ${readyCheck.status}`);
    }

    // Verify user is a participant in the ready check
    if (!readyCheck.responses[userId]) {
      throw new ForbiddenError('You are not a participant in this ready check');
    }

    // Check not expired
    if (new Date(readyCheck.expiresAt) < new Date()) {
      await this.expireReadyCheck(readyCheck);
      throw new ValidationError('This ready check has expired');
    }

    const previousResponse = readyCheck.responses[userId].response;
    if (previousResponse === response && readyCheck.responses[userId].respondedAt) {
      return readyCheck;
    }

    // Record response
    readyCheck.responses[userId] = {
      userId,
      userName,
      response,
      respondedAt: new Date().toISOString(),
    };

    // Check if all have responded
    const summary = this.calculateSummary(readyCheck);

    if (summary.pendingCount === 0) {
      readyCheck.status = 'completed';
      readyCheck.completedAt = new Date().toISOString();
    }

    // Update Redis
    const remainingTtl = Math.max(
      1,
      Math.ceil((new Date(readyCheck.expiresAt).getTime() - Date.now()) / 1000) + 60
    );
    await redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, remainingTtl);

    // Emit response event
    emitReadyCheckResponse(
      readyCheck.organizationId,
      activityId,
      {
        ...this.toPublicReadyCheck(readyCheck),
        respondedUserId: userId,
        respondedUserName: userName,
        respondedWith: response,
      },
      userId
    );

    // If completed, emit completion event
    if (readyCheck.status === 'completed') {
      emitReadyCheckCompleted(
        readyCheck.organizationId,
        activityId,
        this.toPublicReadyCheck(readyCheck),
        userId
      );

      activityAuditLogger.log({
        action: ActivityAuditAction.READY_CHECK_COMPLETED,
        activityId,
        activityTitle: readyCheck.activityTitle,
        activityType: ActivityType.OPERATION,
        organizationId: readyCheck.organizationId,
        performedById: 'system',
        performedByName: 'System',
        details: {
          readyCheckId: readyCheck.id,
          readyCount: summary.readyCount,
          notReadyCount: summary.notReadyCount,
          allReady: summary.allReady,
        },
      });
    }

    // Audit the individual response
    activityAuditLogger.log({
      action: ActivityAuditAction.READY_CHECK_RESPONDED,
      activityId,
      activityTitle: readyCheck.activityTitle,
      activityType: ActivityType.OPERATION,
      organizationId: readyCheck.organizationId,
      performedById: userId,
      performedByName: userName,
      details: {
        readyCheckId: readyCheck.id,
        response,
      },
    });

    await this.syncReadyCheckThreadPanel(readyCheck).catch((error: unknown) => {
      logger.warn('Ready check thread panel sync failed on response', {
        readyCheckId: readyCheck.id,
        activityId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return readyCheck;
  }

  /**
   * Get the current active ready check for an activity.
   */
  async getActiveReadyCheck(activityId: string): Promise<ReadyCheckState | null> {
    return this.getActiveReadyCheckState(activityId);
  }

  /**
   * Cancel an active ready check. Only the initiator or activity creator can cancel.
   */
  async cancelReadyCheck(activityId: string, userId: string, userName: string): Promise<void> {
    const readyCheck = await this.getActiveReadyCheckState(activityId);
    if (!readyCheck) {
      throw new NotFoundError('No active ready check found for this activity');
    }

    if (readyCheck.status !== 'pending') {
      throw new ValidationError(`Ready check is already ${readyCheck.status}`);
    }

    // Only initiator or activity creator can cancel
    const activity = await this.activityRepo.findOne({
      where: { id: activityId, organizationId: readyCheck.organizationId },
    });
    if (readyCheck.initiatedBy !== userId && activity?.creatorId !== userId) {
      throw new ForbiddenError('Only the initiator or activity creator can cancel a ready check');
    }

    readyCheck.status = 'cancelled';
    readyCheck.completedAt = new Date().toISOString();

    // Update in Redis (short TTL for cleanup)
    await redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, 60);
    await redisClient.del(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`);

    emitReadyCheckCancelled(readyCheck.organizationId, activityId, userId);

    activityAuditLogger.log({
      action: ActivityAuditAction.READY_CHECK_CANCELLED,
      activityId,
      activityTitle: activity?.title ?? '',
      activityType: (activity?.activityType as ActivityType) ?? ActivityType.OPERATION,
      organizationId: readyCheck.organizationId,
      performedById: userId,
      performedByName: userName,
      details: { readyCheckId: readyCheck.id },
    });

    await this.syncReadyCheckThreadPanel(readyCheck).catch((error: unknown) => {
      logger.warn('Ready check thread panel sync failed on cancel', {
        readyCheckId: readyCheck.id,
        activityId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    logger.info(`Ready check ${readyCheck.id} cancelled for activity ${activityId} by ${userName}`);
  }

  // ==================== PRIVATE HELPERS ====================

  private getReadyCheckDiscordClient(): Client | null {
    try {
      const manager = BotClientManager.getInstance();
      if (!manager.isReady()) {
        return null;
      }
      return manager.getClient();
    } catch (error: unknown) {
      logger.warn('Ready check Discord client unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private buildReadyCheckDmMessage(readyCheck: ReadyCheckState): string {
    const expiresTs = Math.floor(new Date(readyCheck.expiresAt).getTime() / 1000);
    return [
      `🚀 Ready check for **${readyCheck.activityTitle}**`,
      `${readyCheck.initiatedByName} initiated a ready check.`,
      `Respond with the **Yes/No** buttons in the event thread (or \`/readycheck\`) before <t:${expiresTs}:R>.`,
    ].join('\n');
  }

  private buildEventThreadName(activityTitle: string): string {
    const title = `📣 New activity: ${activityTitle}`;
    const cleaned = title.replace(/^[^A-Za-z0-9]+/, '').trim();
    return (cleaned || 'Event discussion').slice(0, 100);
  }

  private async shouldDeliverDiscordActivityNotification(userId: string): Promise<boolean> {
    try {
      return await this.notificationPreferencesService.shouldDeliver(userId, 'discord', 'activity');
    } catch (error: unknown) {
      logger.warn('Ready check notification preference lookup failed; suppressing notification', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async findActivityDiscussionThread(
    channel: ThreadHostChannel,
    activityTitle: string
  ): Promise<AnyThreadChannel | null> {
    const expectedThreadName = this.buildEventThreadName(activityTitle).toLowerCase();
    const titleNeedle = activityTitle.trim().toLowerCase();
    const isMatch = (candidateName: string): boolean => {
      const normalizedName = candidateName.toLowerCase();
      if (normalizedName === expectedThreadName) {
        return true;
      }
      return titleNeedle.length > 0 && normalizedName.includes(titleNeedle);
    };

    try {
      const active = await channel.threads.fetchActive();
      const match = active.threads.find((thread: AnyThreadChannel) => isMatch(thread.name));
      if (match) {
        return match;
      }
    } catch (error: unknown) {
      logger.debug('Failed to search active event threads for ready check fallback', {
        channelId: channel.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const archived = await channel.threads.fetchArchived({
        type: 'public',
        fetchAll: false,
        limit: 100,
      });
      return archived.threads.find((thread: AnyThreadChannel) => isMatch(thread.name)) ?? null;
    } catch (error: unknown) {
      logger.debug('Failed to search archived event threads for ready check fallback', {
        channelId: channel.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async createFallbackEventThread(
    channel: ThreadHostChannel,
    readyCheck: ReadyCheckState
  ): Promise<AnyThreadChannel | null> {
    try {
      const seedMessage = await channel.send({
        content: `🧵 Ready check fallback thread for **${readyCheck.activityTitle}** (\`${readyCheck.activityId}\`).`,
        allowedMentions: { parse: [] },
      });
      return await seedMessage.startThread({
        name: this.buildEventThreadName(readyCheck.activityTitle),
        autoArchiveDuration: 1440,
        reason: `Ready check DM fallback for activity ${readyCheck.activityId}`,
      });
    } catch (error: unknown) {
      logger.warn('Failed to create ready check fallback event thread', {
        activityId: readyCheck.activityId,
        channelId: channel.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async postReadyCheckThreadFallbackMentions(
    client: Client,
    readyCheck: ReadyCheckState,
    failedDiscordIds: readonly string[]
  ): Promise<void> {
    const uniqueFailedIds = Array.from(new Set(failedDiscordIds));
    if (uniqueFailedIds.length === 0) {
      return;
    }

    const expiresTs = Math.floor(new Date(readyCheck.expiresAt).getTime() / 1000);
    const mentionContent = uniqueFailedIds.map(discordId => `<@${discordId}>`).join(' ');
    const fallbackMessage = [
      mentionContent,
      `🚀 Ready check for **${readyCheck.activityTitle}** is active (DM fallback).`,
      `Use the **Yes/No** buttons in this thread (or \`/readycheck\`) before <t:${expiresTs}:R>.`,
    ].join('\n');

    const orgSettings = await discordSettingsService.getOrganizationSettings(
      readyCheck.organizationId
    );
    let deliveredFallbackMention = false;

    for (const settings of orgSettings) {
      const guildId = settings.guildId;
      const channelId = settings.eventSettings?.eventAnnouncementChannelId;
      if (!guildId || !channelId) {
        continue;
      }

      const posted = await this.tryPostThreadFallbackInGuild(
        client,
        readyCheck,
        guildId,
        channelId,
        fallbackMessage,
        uniqueFailedIds
      );
      if (posted) {
        deliveredFallbackMention = true;
        break;
      }
    }

    if (!deliveredFallbackMention) {
      logger.warn('Ready check thread fallback unavailable; no fallback mentions posted', {
        readyCheckId: readyCheck.id,
        activityId: readyCheck.activityId,
        failedDiscordIds: uniqueFailedIds,
      });
    }
  }

  private async tryPostThreadFallbackInGuild(
    client: Client,
    readyCheck: ReadyCheckState,
    guildId: string,
    channelId: string,
    fallbackMessage: string,
    mentionUserIds: readonly string[]
  ): Promise<boolean> {
    try {
      const guild =
        client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) {
        return false;
      }

      const channel =
        guild.channels.cache.get(channelId) ??
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        return false;
      }

      if (
        channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildAnnouncement
      ) {
        return false;
      }

      const threadHost = channel;
      let thread = await this.findActivityDiscussionThread(threadHost, readyCheck.activityTitle);
      thread ??= await this.createFallbackEventThread(threadHost, readyCheck);
      if (!thread) {
        return false;
      }

      await thread.send({
        content: fallbackMessage,
        allowedMentions: { users: [...mentionUserIds] },
      });
      return true;
    } catch (error: unknown) {
      logger.warn('Failed to post ready check thread fallback mention', {
        readyCheckId: readyCheck.id,
        activityId: readyCheck.activityId,
        guildId,
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async notifyParticipantsViaDiscordWithThreadFallback(
    readyCheck: ReadyCheckState,
    participants: readonly ActivityParticipantEntity[]
  ): Promise<void> {
    const client = this.getReadyCheckDiscordClient();
    if (!client) {
      return;
    }

    const recipientIds = participants
      .map(participant => participant.userId)
      .filter(userId => userId !== readyCheck.initiatedBy);
    if (recipientIds.length === 0) {
      return;
    }

    const linkedUsers = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.discordId'])
      .where('user.id IN (:...recipientIds)', { recipientIds })
      .getMany();
    const discordByUserId = new Map(linkedUsers.map(user => [user.id, user.discordId]));
    const failedDiscordIds = new Set<string>();
    const dmMessage = this.buildReadyCheckDmMessage(readyCheck);

    for (const participant of participants) {
      if (participant.userId === readyCheck.initiatedBy) {
        continue;
      }

      const discordId = discordByUserId.get(participant.userId);
      if (!discordId) {
        continue;
      }

      const shouldDeliverDiscord = await this.shouldDeliverDiscordActivityNotification(
        participant.userId
      );
      if (!shouldDeliverDiscord) {
        continue;
      }

      try {
        const discordUser = await client.users.fetch(discordId);
        await discordUser.send(dmMessage);
      } catch (error: unknown) {
        failedDiscordIds.add(discordId);
        logger.warn('Ready check DM delivery failed; attempting thread fallback mention', {
          readyCheckId: readyCheck.id,
          activityId: readyCheck.activityId,
          userId: participant.userId,
          discordId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (failedDiscordIds.size > 0) {
      await this.postReadyCheckThreadFallbackMentions(client, readyCheck, [...failedDiscordIds]);
    }
  }

  private isThreadChannel(channel: unknown): channel is AnyThreadChannel {
    if (!channel || typeof channel !== 'object' || !('type' in channel)) {
      return false;
    }

    const channelType = (channel as { type: ChannelType }).type;
    return (
      channelType === ChannelType.PublicThread ||
      channelType === ChannelType.PrivateThread ||
      channelType === ChannelType.AnnouncementThread
    );
  }

  private formatParticipantList(names: readonly string[]): string {
    if (names.length === 0) {
      return '—';
    }

    const maxNames = 15;
    const lines = names.slice(0, maxNames).map(name => `• ${name}`);
    if (names.length > maxNames) {
      lines.push(`• +${names.length - maxNames} more`);
    }
    return lines.join('\n');
  }

  private getReadyCheckStatusLabel(status: ReadyCheckState['status']): string {
    switch (status) {
      case 'pending':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'expired':
        return 'Expired';
      case 'cancelled':
      default:
        return 'Cancelled';
    }
  }

  private getReadyCheckStatusColor(status: ReadyCheckState['status'], allReady: boolean): number {
    switch (status) {
      case 'pending':
        return 0x3b82f6;
      case 'completed':
        return allReady ? 0x22c55e : 0xf59e0b;
      case 'cancelled':
        return 0xfb923c;
      case 'expired':
      default:
        return 0x6b7280;
    }
  }

  private buildReadyCheckThreadEmbed(readyCheck: ReadyCheckState): EmbedBuilder {
    const summary = this.calculateSummary(readyCheck);
    const responses = Object.values(readyCheck.responses);
    const readyNames = responses
      .filter(response => response.response === 'ready')
      .map(response => response.userName);
    const notReadyNames = responses
      .filter(response => response.response === 'not_ready')
      .map(response => response.userName);
    const pendingNames = responses
      .filter(response => response.response === 'pending')
      .map(response => response.userName);

    const expiresTs = Math.floor(new Date(readyCheck.expiresAt).getTime() / 1000);

    return new EmbedBuilder()
      .setColor(this.getReadyCheckStatusColor(readyCheck.status, summary.allReady))
      .setTitle(`🚀 Ready Check: ${readyCheck.activityTitle}`)
      .setDescription(`${readyCheck.initiatedByName} initiated this ready check.`)
      .addFields(
        {
          name: 'Status',
          value: this.getReadyCheckStatusLabel(readyCheck.status),
          inline: true,
        },
        {
          name: 'Ready',
          value: `${summary.readyCount}/${readyCheck.totalParticipants}`,
          inline: true,
        },
        {
          name: 'Not Ready',
          value: String(summary.notReadyCount),
          inline: true,
        },
        {
          name: 'Pending',
          value: String(summary.pendingCount),
          inline: true,
        },
        {
          name: 'Ends',
          value: `<t:${expiresTs}:R>`,
          inline: true,
        },
        {
          name: 'Ready Participants',
          value: this.formatParticipantList(readyNames),
          inline: false,
        },
        {
          name: 'Not Ready Participants',
          value: this.formatParticipantList(notReadyNames),
          inline: false,
        },
        {
          name: 'Pending Participants',
          value: this.formatParticipantList(pendingNames),
          inline: false,
        }
      )
      .setTimestamp();
  }

  private buildReadyCheckThreadComponents(
    readyCheck: ReadyCheckState
  ): Array<ActionRowBuilder<ButtonBuilder>> {
    const disabled = readyCheck.status !== 'pending';
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${READY_CHECK_VOTE_READY_PREFIX}${readyCheck.activityId}`)
          .setLabel('Yes')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`${READY_CHECK_VOTE_NOT_READY_PREFIX}${readyCheck.activityId}`)
          .setLabel('No')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled)
      ),
    ];
  }

  private async fetchStoredThreadPanelMessage(
    client: Client,
    readyCheck: ReadyCheckState
  ): Promise<{ thread: AnyThreadChannel; message: Message } | null> {
    if (!readyCheck.threadPanel) {
      return null;
    }

    const channel =
      client.channels.cache.get(readyCheck.threadPanel.channelId) ??
      (await client.channels.fetch(readyCheck.threadPanel.channelId).catch(() => null));
    if (!this.isThreadChannel(channel)) {
      return null;
    }

    const message = await channel.messages
      .fetch(readyCheck.threadPanel.messageId)
      .catch(() => null);
    if (!message) {
      return null;
    }

    return { thread: channel, message };
  }

  private async resolveReadyCheckThread(
    client: Client,
    readyCheck: ReadyCheckState
  ): Promise<AnyThreadChannel | null> {
    if (readyCheck.threadPanel?.channelId) {
      const existingThread =
        client.channels.cache.get(readyCheck.threadPanel.channelId) ??
        (await client.channels.fetch(readyCheck.threadPanel.channelId).catch(() => null));
      if (this.isThreadChannel(existingThread)) {
        return existingThread;
      }
    }

    const orgSettings = await discordSettingsService.getOrganizationSettings(
      readyCheck.organizationId
    );

    for (const settings of orgSettings) {
      if (!settings.guildId || !settings.eventSettings?.eventAnnouncementChannelId) {
        continue;
      }

      const guild =
        client.guilds.cache.get(settings.guildId) ??
        (await client.guilds.fetch(settings.guildId).catch(() => null));
      if (!guild) {
        continue;
      }

      const hostChannel =
        guild.channels.cache.get(settings.eventSettings.eventAnnouncementChannelId) ??
        (await guild.channels
          .fetch(settings.eventSettings.eventAnnouncementChannelId)
          .catch(() => null));

      if (
        !hostChannel ||
        (hostChannel.type !== ChannelType.GuildText &&
          hostChannel.type !== ChannelType.GuildAnnouncement)
      ) {
        continue;
      }

      const threadHost = hostChannel;
      let thread = await this.findActivityDiscussionThread(threadHost, readyCheck.activityTitle);
      thread ??= await this.createFallbackEventThread(threadHost, readyCheck);
      if (thread) {
        return thread;
      }
    }

    return null;
  }

  private async syncReadyCheckThreadPanel(readyCheck: ReadyCheckState): Promise<void> {
    const client = this.getReadyCheckDiscordClient();
    if (!client) {
      return;
    }

    const storedPanel = await this.fetchStoredThreadPanelMessage(client, readyCheck);
    const thread =
      storedPanel?.thread ??
      (await this.resolveReadyCheckThread(client, readyCheck).catch(() => null));
    if (!thread) {
      return;
    }

    const embed = this.buildReadyCheckThreadEmbed(readyCheck);
    const components = this.buildReadyCheckThreadComponents(readyCheck);

    if (storedPanel?.message) {
      await storedPanel.message.edit({
        embeds: [embed],
        components,
      });
      return;
    }

    const panelMessage = await thread.send({
      embeds: [embed],
      components,
      allowedMentions: { parse: [] },
    });

    readyCheck.threadPanel = {
      channelId: thread.id,
      messageId: panelMessage.id,
      postedAt: new Date().toISOString(),
    };

    const ttlSeconds =
      readyCheck.status === 'pending'
        ? Math.max(
            60,
            Math.ceil((new Date(readyCheck.expiresAt).getTime() - Date.now()) / 1000) + 60
          )
        : 60;

    await redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, ttlSeconds);
  }

  private async getActiveReadyCheckState(activityId: string): Promise<ReadyCheckState | null> {
    const readyCheckId = await redisClient.get<string>(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`);
    if (!readyCheckId) {
      return null;
    }

    const readyCheck = await redisClient.get<ReadyCheckState>(`${REDIS_KEY_PREFIX}${readyCheckId}`);
    if (!readyCheck) {
      // Clean up stale active pointer
      await redisClient.del(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`);
      return null;
    }

    // Check if expired but not yet marked
    if (readyCheck.status === 'pending' && new Date(readyCheck.expiresAt) < new Date()) {
      await this.expireReadyCheck(readyCheck);
      return { ...readyCheck, status: 'expired' };
    }

    return readyCheck;
  }

  private async isLeaderParticipant(activityId: string, userId: string): Promise<boolean> {
    const participant = await this.participantRepo.findOne({
      where: { activityId, userId },
    });
    if (!participant) {
      return false;
    }
    return ['leader', 'co_leader', 'commander'].includes(participant.role);
  }

  private async expireReadyCheck(readyCheck: ReadyCheckState): Promise<void> {
    readyCheck.status = 'expired';
    readyCheck.completedAt = new Date().toISOString();

    await redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, 60);
    await redisClient.del(`${ACTIVE_CHECK_KEY_PREFIX}${readyCheck.activityId}`);

    await this.syncReadyCheckThreadPanel(readyCheck).catch((error: unknown) => {
      logger.warn('Ready check thread panel sync failed on expiration', {
        readyCheckId: readyCheck.id,
        activityId: readyCheck.activityId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    emitReadyCheckExpired(
      readyCheck.organizationId,
      readyCheck.activityId,
      this.toPublicReadyCheck(readyCheck)
    );

    activityAuditLogger.log({
      action: ActivityAuditAction.READY_CHECK_EXPIRED,
      activityId: readyCheck.activityId,
      activityTitle: readyCheck.activityTitle,
      activityType: ActivityType.OPERATION,
      organizationId: readyCheck.organizationId,
      performedById: 'system',
      performedByName: 'System',
      details: {
        readyCheckId: readyCheck.id,
        ...this.calculateSummary(readyCheck),
      },
    });

    logger.info(`Ready check ${readyCheck.id} expired for activity ${readyCheck.activityId}`);
  }

  private scheduleExpirationCheck(
    readyCheckId: string,
    activityId: string,
    durationSeconds: number
  ): void {
    const expirationTimer = setTimeout(async () => {
      try {
        const readyCheck = await redisClient.get<ReadyCheckState>(
          `${REDIS_KEY_PREFIX}${readyCheckId}`
        );
        if (readyCheck?.status === 'pending') {
          await this.expireReadyCheck(readyCheck);
        }
      } catch (error: unknown) {
        logger.error(`Error checking ready check expiration for ${readyCheckId}:`, error);
      }
    }, durationSeconds * 1000);

    // Prevent ready-check timers from keeping Jest/Node process alive.
    if (typeof expirationTimer.unref === 'function') {
      expirationTimer.unref();
    }
  }

  private calculateSummary(readyCheck: ReadyCheckState): {
    readyCount: number;
    notReadyCount: number;
    pendingCount: number;
    allReady: boolean;
  } {
    const responses = Object.values(readyCheck.responses);
    const readyCount = responses.filter(r => r.response === 'ready').length;
    const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
    const pendingCount = responses.filter(r => r.response === 'pending').length;
    return {
      readyCount,
      notReadyCount,
      pendingCount,
      allReady: readyCount === readyCheck.totalParticipants,
    };
  }

  /** Convert internal state to public API shape */
  private toPublicReadyCheck(state: ReadyCheckState): Record<string, unknown> {
    const summary = this.calculateSummary(state);
    return {
      id: state.id,
      activityId: state.activityId,
      organizationId: state.organizationId,
      initiatedBy: state.initiatedBy,
      initiatedByName: state.initiatedByName,
      status: state.status,
      expiresAt: state.expiresAt,
      durationSeconds: state.durationSeconds,
      responses: Object.values(state.responses),
      totalParticipants: state.totalParticipants,
      readyCount: summary.readyCount,
      notReadyCount: summary.notReadyCount,
      pendingCount: summary.pendingCount,
      createdAt: state.createdAt,
      completedAt: state.completedAt,
    };
  }
}

