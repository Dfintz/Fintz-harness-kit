import type { FederationMemberStatus } from '@sc-fleet-manager/shared-types';
import { Client, TextChannel } from 'discord.js';

import { BotClientManager } from '../../bot/BotClientManager';
import { buildPollButtons, buildPollEmbed } from '../../bot/embeds/pollEmbed';
import { AppDataSource } from '../../data-source';
import { FederationMember } from '../../models/FederationMember';
import { Poll, PollStatus } from '../../models/Poll';
import {
  PollDiscordMirror,
  PollMirrorScope,
  PollMirrorStatus,
} from '../../models/PollDiscordMirror';
import { ConflictError, NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { GuildOrganizationService } from '../discord/GuildOrganizationService';

import type { PollResults } from './PollService';

// ==================== DTOs ====================

export interface MirrorToGuildDTO {
  guildId: string;
  channelId: string;
}

export interface MirrorToFederationDTO {
  federationId: string;
  channelId?: string;
}

// ==================== SERVICE ====================

/**
 * DiscordPollService
 *
 * Manages Discord mirrors for polls — posting embeds, updating them on vote,
 * closing them when polls end, and multi-server federation broadcasting.
 *
 * Each mirror is tracked in poll_discord_mirrors so embeds can be updated live.
 */
export class DiscordPollService {
  private readonly mirrorRepository = AppDataSource.getRepository(PollDiscordMirror);
  private readonly federationMemberRepository = AppDataSource.getRepository(FederationMember);
  private readonly guildOrgService: GuildOrganizationService;

  constructor() {
    this.guildOrgService = GuildOrganizationService.getInstance();
  }

  // ==================== MIRROR TO GUILD ====================

  /**
   * Post a poll embed to a specific Discord guild/channel.
   */
  async mirrorPollToGuild(
    poll: Poll,
    organizationId: string,
    dto: MirrorToGuildDTO,
    scope: PollMirrorScope = PollMirrorScope.ORGANIZATION,
    federationId?: string
  ): Promise<PollDiscordMirror> {
    // Only active polls can be mirrored
    if (poll.status !== PollStatus.ACTIVE) {
      throw new ConflictError('Only active polls can be mirrored to Discord');
    }

    // Check for existing mirror to this guild
    const existing = await this.mirrorRepository.findOne({
      where: { pollId: poll.id, guildId: dto.guildId },
    });
    if (existing) {
      throw new ConflictError('Poll is already mirrored to this guild');
    }

    // Create mirror record
    const mirror = this.mirrorRepository.create({
      pollId: poll.id,
      organizationId,
      scope,
      federationId,
      guildId: dto.guildId,
      channelId: dto.channelId,
      status: PollMirrorStatus.PENDING,
    });
    await this.mirrorRepository.save(mirror);

    // Attempt delivery
    await this.deliverMirror(mirror, poll);

    return mirror;
  }

  // ==================== MIRROR TO FEDERATION ====================

  /**
   * Broadcast a poll to all guilds in a federation.
   * Resolves federation members → their organizations → their Discord guilds → sends to each.
   */
  async mirrorPollToFederation(
    poll: Poll,
    organizationId: string,
    dto: MirrorToFederationDTO
  ): Promise<PollDiscordMirror[]> {
    // Get all active federation members
    const members = await this.federationMemberRepository.find({
      where: { federationId: dto.federationId, status: 'active' as FederationMemberStatus },
    });

    if (members.length === 0) {
      throw new ConflictError('No active members found in this federation');
    }

    const mirrors: PollDiscordMirror[] = [];

    for (const member of members) {
      // Resolve guilds for each member organization
      const guilds = await this.guildOrgService.getGuildsForOrganization(
        member.organizationId,
        true
      );

      for (const guild of guilds) {
        try {
          const channelId = dto.channelId;
          if (!channelId) {
            logger.warn(
              `No channel ID provided for federation broadcast to guild ${guild.guildId}, skipping`
            );
            continue;
          }

          const mirror = await this.mirrorPollToGuild(
            poll,
            organizationId,
            {
              guildId: guild.guildId,
              channelId,
            },
            PollMirrorScope.FEDERATION,
            dto.federationId
          );
          mirrors.push(mirror);
        } catch (err: unknown) {
          // Skip duplicates and continue
          logger.warn(
            `Failed to mirror poll ${poll.id} to guild ${guild.guildId}: ${
              err instanceof Error ? err.message : 'Unknown error'
            }`
          );
        }
      }
    }

    logger.info(
      `Federation broadcast: poll ${poll.id} mirrored to ${mirrors.length} guild(s) in federation ${dto.federationId}`
    );

    return mirrors;
  }

  // ==================== UPDATE ALL MIRRORS (live status) ====================

  /**
   * Update all active mirrors for a poll with current results.
   * Called after each vote or status change.
   */
  async updateAllMirrors(poll: Poll, results: PollResults | null): Promise<void> {
    const mirrors = await this.mirrorRepository.find({
      where: { pollId: poll.id, status: PollMirrorStatus.ACTIVE },
    });

    if (mirrors.length === 0) {
      return;
    }

    const client = this.getClient();
    if (!client) {
      return;
    }

    for (const mirror of mirrors) {
      try {
        await this.updateMirrorEmbed(client, mirror, poll, results);
      } catch (err: unknown) {
        logger.warn(
          `Failed to update mirror ${mirror.id} for poll ${poll.id}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      }
    }
  }

  // ==================== CLOSE ALL MIRRORS ====================

  /**
   * Close all active mirrors for a poll — disable buttons, show final results.
   */
  async closeAllMirrors(poll: Poll, results: PollResults | null): Promise<void> {
    const mirrors = await this.mirrorRepository.find({
      where: { pollId: poll.id, status: PollMirrorStatus.ACTIVE },
    });

    if (mirrors.length === 0) {
      return;
    }

    const client = this.getClient();
    if (!client) {
      return;
    }

    for (const mirror of mirrors) {
      try {
        await this.updateMirrorEmbed(client, mirror, poll, results);
        mirror.status = PollMirrorStatus.CLOSED;
        mirror.lastUpdatedAt = new Date();
        await this.mirrorRepository.save(mirror);
      } catch (err: unknown) {
        logger.warn(
          `Failed to close mirror ${mirror.id} for poll ${poll.id}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      }
    }

    logger.info(`Closed ${mirrors.length} mirror(s) for poll ${poll.id}`);
  }

  // ==================== LIST / DELETE ====================

  async getMirrorsForPoll(pollId: string, organizationId: string): Promise<PollDiscordMirror[]> {
    return this.mirrorRepository.find({
      where: { pollId, organizationId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteMirror(mirrorId: string, organizationId: string): Promise<void> {
    const mirror = await this.mirrorRepository.findOne({
      where: { id: mirrorId, organizationId },
    });
    if (!mirror) {
      throw new NotFoundError('Mirror');
    }

    // Try to delete the Discord message
    if (mirror.messageId && mirror.channelId) {
      try {
        const client = this.getClient();
        if (client) {
          const channel = await client.channels.fetch(mirror.channelId).catch(() => null);
          if (channel?.isTextBased()) {
            const msg = await (channel as TextChannel).messages
              .fetch(mirror.messageId)
              .catch(() => null);
            if (msg) {
              await msg.delete().catch(() => null);
            }
          }
        }
      } catch {
        // Best-effort cleanup
      }
    }

    await this.mirrorRepository.remove(mirror);
  }

  // ==================== INTERNAL ====================

  /**
   * Deliver the initial embed to Discord.
   */
  private async deliverMirror(mirror: PollDiscordMirror, poll: Poll): Promise<void> {
    const client = this.getClient();
    if (!client) {
      mirror.status = PollMirrorStatus.FAILED;
      mirror.errorMessage = 'Discord client not available';
      await this.mirrorRepository.save(mirror);
      return;
    }

    try {
      // Resolve channel
      const channel = await client.channels.fetch(mirror.channelId ?? '').catch(() => null);
      if (!channel?.isTextBased()) {
        // Internal delivery signal only — caught by this method's own catch below,
        // which records mirror.status = FAILED. It never propagates to the HTTP
        // layer, so it stays a plain Error rather than a typed ApiError.
        throw new Error(`Channel ${mirror.channelId ?? 'unknown'} not found or not text-based`);
      }

      const textChannel = channel as TextChannel;

      // Build embed + buttons
      const isClosed = poll.status === PollStatus.CLOSED || poll.status === PollStatus.CANCELLED;
      const embed = buildPollEmbed(poll);
      const components = buildPollButtons(poll.id, poll.options, isClosed);

      // Send
      const sent = await textChannel.send({ embeds: [embed], components });

      // Update mirror with message info
      mirror.messageId = sent.id;
      mirror.channelId = textChannel.id;
      mirror.status = PollMirrorStatus.ACTIVE;
      mirror.deliveredAt = new Date();
      mirror.lastUpdatedAt = new Date();
      mirror.errorMessage = undefined;
      await this.mirrorRepository.save(mirror);

      logger.info(
        `Poll ${poll.id} mirrored to guild ${mirror.guildId} channel ${mirror.channelId} (msg: ${sent.id})`
      );
    } catch (err: unknown) {
      mirror.status = PollMirrorStatus.FAILED;
      mirror.retryCount += 1;
      mirror.errorMessage = err instanceof Error ? err.message : 'Unknown delivery error';
      await this.mirrorRepository.save(mirror);

      logger.error(`Failed to deliver poll mirror ${mirror.id}: ${mirror.errorMessage}`);
    }
  }

  /**
   * Edit an existing embed with updated results.
   */
  private async updateMirrorEmbed(
    client: Client,
    mirror: PollDiscordMirror,
    poll: Poll,
    results: PollResults | null
  ): Promise<void> {
    if (!mirror.messageId || !mirror.channelId) {
      return;
    }

    const channel = await client.channels.fetch(mirror.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      return;
    }

    const textChannel = channel as TextChannel;
    const msg = await textChannel.messages.fetch(mirror.messageId).catch(() => null);
    if (!msg) {
      return;
    }

    const isClosed = poll.status === PollStatus.CLOSED || poll.status === PollStatus.CANCELLED;
    const embed = buildPollEmbed(poll, results ?? undefined);
    const components = buildPollButtons(poll.id, poll.options, isClosed);

    await msg.edit({ embeds: [embed], components });

    mirror.lastUpdatedAt = new Date();
    await this.mirrorRepository.save(mirror);
  }

  /**
   * Get the Discord client (best-effort, may be null during startup or in tests).
   */
  private getClient(): Client | null {
    try {
      return BotClientManager.getInstance().getClient();
    } catch {
      logger.debug('DiscordPollService: Bot client not available');
      return null;
    }
  }
}

