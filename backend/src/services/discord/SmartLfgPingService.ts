import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
} from 'discord.js';

import { LFGActivity, LFGPost } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Per-guild smart ping configuration (stored in DiscordGuildSettings metadata)
 */
export interface SmartLfgPingSettings {
  /** Whether smart pings are enabled */
  enabled: boolean;
  /** Cooldown between pings to the same user, in hours */
  cooldownHours: number;
  /** Maximum number of members to ping per post */
  maxPingsPerPost: number;
  /** Activity types to ping for (empty = all) */
  activityFilter: LFGActivity[];
  /** Role required for users to receive pings (empty = all) */
  optInRoleId?: string;
}

export const DEFAULT_SMART_LFG_PING_SETTINGS: SmartLfgPingSettings = {
  enabled: false,
  cooldownHours: 8,
  maxPingsPerPost: 5,
  activityFilter: [],
};

/**
 * Smart LFG Ping Service
 *
 * When an LFG post is created, finds online guild members who may be interested
 * and sends them a DM notification with a cooldown to prevent spam.
 *
 * Features:
 * - Per-user cooldown (in-memory, resets on restart — acceptable for anti-spam)
 * - Activity-based filtering
 * - Only pings online / idle members (not DND or offline)
 * - Opt-in via configured role
 * - Max pings per post to avoid mass-DM
 */
export class SmartLfgPingService {
  private static instance: SmartLfgPingService;
  private client: Client | null = null;

  /**
   * Map<"guildId:userId", lastPingedTimestamp>
   * TTL-based cleanup runs periodically
   */
  private readonly cooldowns = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): SmartLfgPingService {
    if (!SmartLfgPingService.instance) {
      SmartLfgPingService.instance = new SmartLfgPingService();
    }
    return SmartLfgPingService.instance;
  }

  initialize(client: Client): void {
    this.client = client;

    // Clean expired cooldowns every 30 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredCooldowns();
      },
      30 * 60 * 1000
    );
    this.cleanupInterval.unref();
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.client = null;
    this.cooldowns.clear();
  }

  /**
   * Notify matching online members about a new LFG post
   */
  async notifyMatchingMembers(post: LFGPost, settings: SmartLfgPingSettings): Promise<number> {
    if (!settings.enabled || !this.client) {
      return 0;
    }

    try {
      const guild = await this.client.guilds.fetch(post.guildId);
      if (!guild) {
        return 0;
      }

      // Filter by activity type if configured
      if (settings.activityFilter.length > 0 && !settings.activityFilter.includes(post.activity)) {
        return 0;
      }

      const candidates = await this.findCandidates(guild, post, settings);
      const pinged = await this.sendPings(candidates, post, guild.name, settings);

      if (pinged > 0) {
        logger.info(
          `SmartLfgPingService: Pinged ${pinged} members for LFG post ${post.id} (${post.activity}) in ${guild.name}`
        );
      }

      return pinged;
    } catch (error: unknown) {
      logger.error('SmartLfgPingService: Error notifying members', error);
      return 0;
    }
  }

  /**
   * Find guild members who are online, not in cooldown, and match criteria
   */
  private async findCandidates(
    guild: Guild,
    post: LFGPost,
    settings: SmartLfgPingSettings
  ): Promise<GuildMember[]> {
    // Ensure members and presences are cached
    await guild.members.fetch({ withPresences: true });

    const candidates: GuildMember[] = [];
    const cooldownMs = settings.cooldownHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const member of guild.members.cache.values()) {
      // Skip bots
      if (member.user.bot) {
        continue;
      }

      // Skip the post creator
      if (member.id === post.creatorId) {
        continue;
      }

      // Skip members already in the post
      if (post.members.includes(member.id)) {
        continue;
      }

      // Check online status — only ping online or idle members
      const status = member.presence?.status;
      if (!status || status === 'offline' || status === 'dnd') {
        continue;
      }

      // Check opt-in role if configured
      if (settings.optInRoleId && !member.roles.cache.has(settings.optInRoleId)) {
        continue;
      }

      // Check cooldown
      const key = `${guild.id}:${member.id}`;
      const lastPinged = this.cooldowns.get(key);
      if (lastPinged && now - lastPinged < cooldownMs) {
        continue;
      }

      candidates.push(member);

      // Stop once we have enough candidates
      if (candidates.length >= settings.maxPingsPerPost) {
        break;
      }
    }

    return candidates;
  }

  /**
   * Send DM pings to the candidate list
   */
  private async sendPings(
    candidates: GuildMember[],
    post: LFGPost,
    guildName: string,
    _settings: SmartLfgPingSettings
  ): Promise<number> {
    let pinged = 0;

    const embed = this.buildPingEmbed(post, guildName);

    const muteButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`lfg_mute_${candidates[0]?.guild.id ?? 'unknown'}`)
        .setLabel('Mute LFG Pings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔇')
    );

    for (const member of candidates) {
      try {
        const user = await this.client!.users.fetch(member.id);
        await user.send({ embeds: [embed], components: [muteButton] });

        // Record cooldown
        this.cooldowns.set(`${member.guild.id}:${member.id}`, Date.now());
        pinged++;
      } catch {
        // DMs may be disabled — non-fatal
        logger.debug(`SmartLfgPingService: Could not DM ${member.user.tag}`);
      }
    }

    return pinged;
  }

  /**
   * Build the notification embed for a new LFG post
   */
  private buildPingEmbed(post: LFGPost, guildName: string): EmbedBuilder {
    const slotsLeft = post.maxPlayers - post.currentPlayers;

    return new EmbedBuilder()
      .setColor(0x00bcd4) // Teal
      .setTitle('🎮 LFG Post — Looking for Players!')
      .setDescription(
        `A new **${decodeHtmlEntities(post.activity)}** group is looking for players in **${guildName}**!`
      )
      .addFields(
        { name: 'Activity', value: decodeHtmlEntities(post.activity), inline: true },
        { name: 'Slots', value: `${slotsLeft} of ${post.maxPlayers} available`, inline: true },
        { name: 'Host', value: decodeHtmlEntities(post.creatorName), inline: true },
        {
          name: 'Description',
          value: decodeHtmlEntities(post.description) || 'No description',
          inline: false,
        }
      )
      .setFooter({
        text: 'Use the LFG post in the server to join • You can opt out of these pings',
      })
      .setTimestamp();
  }

  /**
   * Remove expired cooldowns to prevent memory leaks
   */
  private cleanupExpiredCooldowns(): void {
    // Use worst-case cooldown of 24h for cleanup
    const maxCooldownMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;

    for (const [key, timestamp] of this.cooldowns) {
      if (now - timestamp > maxCooldownMs) {
        this.cooldowns.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`SmartLfgPingService: Cleaned ${cleaned} expired cooldowns`);
    }
  }
}

