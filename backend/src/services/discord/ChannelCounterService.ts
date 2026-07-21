import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { ChannelType, Client } from 'discord.js';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { ChannelCounter } from '../../models/MemberEngagement';
import { logger } from '../../utils/logger';

/**
 * ChannelCounterService
 * Manages "stat display" channels whose names reflect live guild metrics.
 */
export class ChannelCounterService {
  private static instance: ChannelCounterService;
  private readonly repo: Repository<ChannelCounter>;
  // Cache guild.fetch() results to avoid 500KB+ API calls per counter update cycle
  private readonly guildFetchCache = new Map<
    string,
    { data: import('discord.js').Guild; expiresAt: number }
  >();
  private static readonly GUILD_FETCH_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.repo = AppDataSource.getRepository(ChannelCounter);
  }

  static getInstance(): ChannelCounterService {
    if (!ChannelCounterService.instance) {
      ChannelCounterService.instance = new ChannelCounterService();
    }
    return ChannelCounterService.instance;
  }

  async createCounter(
    guildId: string,
    channelId: string,
    counterType: string,
    nameTemplate: string = '{value}'
  ): Promise<ChannelCounter> {
    const counter = this.repo.create({
      guildId,
      channelId,
      counterType,
      nameTemplate,
      enabled: true,
    });
    return this.repo.save(counter);
  }

  async deleteCounter(guildId: string, channelId: string): Promise<boolean> {
    const result = await this.repo.delete({ guildId, channelId });
    return (result.affected ?? 0) > 0;
  }

  async getCountersForGuild(guildId: string): Promise<ChannelCounter[]> {
    return this.repo.find({ where: { guildId, enabled: true } });
  }

  /**
   * Update all counters for a guild. Call this periodically.
   */
  async updateCounters(client: Client, guildId: string): Promise<void> {
    const counters = await this.getCountersForGuild(guildId);
    if (counters.length === 0) {
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return;
    }

    for (const counter of counters) {
      try {
        const value = await this.resolveCounterValue(guild, counter.counterType);
        const newName = decodeHtmlEntities(counter.nameTemplate).replace('{value}', String(value));

        const channel = await guild.channels.fetch(counter.channelId).catch(() => null);
        if (!channel) {
          logger.warn(`Counter channel ${counter.channelId} not found in guild ${guildId}`);
          continue;
        }

        // Only rename if name actually changed (avoid rate limit waste)
        if (channel.name !== newName) {
          await channel.setName(newName, 'Stat counter update');
        }
      } catch (error: unknown) {
        logger.error(`Failed to update counter ${counter.channelId}:`, error);
      }
    }
  }

  private async resolveCounterValue(
    guild: import('discord.js').Guild,
    counterType: string
  ): Promise<number> {
    switch (counterType) {
      case 'member_count':
        return guild.memberCount;
      case 'online_count': {
        // approximatePresenceCount requires fetching — use cache to avoid repeated 500KB+ calls
        const cached = this.guildFetchCache.get(guild.id);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.data.approximatePresenceCount ?? 0;
        }
        const fetched = await guild.fetch();
        this.guildFetchCache.set(guild.id, {
          data: fetched,
          expiresAt: Date.now() + ChannelCounterService.GUILD_FETCH_TTL_MS,
        });
        return fetched.approximatePresenceCount ?? 0;
      }
      case 'voice_count': {
        let count = 0;
        for (const channel of guild.channels.cache.values()) {
          if (
            channel.type === ChannelType.GuildVoice ||
            channel.type === ChannelType.GuildStageVoice
          ) {
            count += channel.members.size;
          }
        }
        return count;
      }
      default:
        return 0;
    }
  }
}

