import { randomInt } from 'crypto';

import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';

import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

const REDIS_PREFIX = 'bot:giveaway:';

/**
 * Giveaway entry
 */
export interface GiveawayEntry {
  userId: string;
  username: string;
  enteredAt: Date;
}

/**
 * Active giveaway
 */
export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  winners: number;
  requiredRoleId?: string;
  endsAt: Date;
  entries: GiveawayEntry[];
  ended: boolean;
  winnerIds: string[];
}

/**
 * Options for creating a new giveaway
 */
export interface CreateGiveawayOptions {
  guildId: string;
  channelId: string;
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  winners: number;
  durationMinutes: number;
  requiredRoleId?: string;
}

/**
 * Giveaway Service
 *
 * Manages random-draw giveaways with optional role requirements,
 * entry tracking, automatic ending, and winner selection.
 */
export class GiveawayService {
  private static instance: GiveawayService;
  private client: Client | null = null;
  private readonly giveaways = new Map<string, Giveaway>();
  private readonly timerIds = new Map<string, NodeJS.Timeout>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();
  private idCounter = 0;
  private static readonly MAX_GIVEAWAYS_PER_GUILD = 50;
  private static readonly CLEANUP_DELAY_MS = 60 * 60 * 1000; // 1 hour after ended

  static getInstance(): GiveawayService {
    if (!GiveawayService.instance) {
      GiveawayService.instance = new GiveawayService();
    }
    return GiveawayService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
    this.loadFromRedis().catch(err =>
      logger.warn('GiveawayService: Failed to load persisted giveaways from Redis', err)
    );
    logger.info('GiveawayService initialized');
  }

  /**
   * Load persisted giveaways from Redis and re-create timers
   */
  private async loadFromRedis(): Promise<void> {
    const keys = await cache.keys(`${REDIS_PREFIX}*`);
    if (!keys.length) {
      return;
    }

    let loaded = 0;
    for (const key of keys) {
      const data = await cache.get<Giveaway>(key);
      if (!data) {
        continue;
      }

      // Restore Date objects from JSON
      data.endsAt = new Date(data.endsAt);
      data.entries = (data.entries || []).map(e => ({
        ...e,
        enteredAt: new Date(e.enteredAt),
      }));

      this.giveaways.set(data.id, data);
      loaded++;

      if (!data.ended) {
        const remaining = data.endsAt.getTime() - Date.now();
        if (remaining <= 0) {
          // Already expired while offline — end immediately
          this.endGiveaway(data.id).catch(err =>
            logger.warn('GiveawayService: Failed to auto-end expired giveaway on load', err)
          );
        } else {
          // Re-schedule auto-end
          const timer = setTimeout(() => {
            this.endGiveaway(data.id).catch(err => logger.warn('Auto-end giveaway failed:', err));
          }, remaining);
          timer.unref();
          this.timerIds.set(data.id, timer);
        }
      } else {
        // Ended giveaway — schedule cleanup (1 hour from now)
        const cleanupTimer = setTimeout(() => {
          this.giveaways.delete(data.id);
          this.cleanupTimers.delete(data.id);
          cache.del(`${REDIS_PREFIX}${data.id}`).catch(() => {});
        }, GiveawayService.CLEANUP_DELAY_MS);
        cleanupTimer.unref();
        this.cleanupTimers.set(data.id, cleanupTimer);
      }
    }

    if (loaded > 0) {
      logger.info(`GiveawayService: Restored ${loaded} giveaways from Redis`);
    }
  }

  /**
   * Persist a giveaway to Redis
   */
  private async persistGiveaway(giveaway: Giveaway): Promise<void> {
    try {
      await cache.set(`${REDIS_PREFIX}${giveaway.id}`, giveaway);
    } catch (err: unknown) {
      logger.warn('GiveawayService: Failed to persist giveaway to Redis', err);
    }
  }

  /**
   * Remove a giveaway from Redis
   */
  private async unpersistGiveaway(giveawayId: string): Promise<void> {
    try {
      await cache.del(`${REDIS_PREFIX}${giveawayId}`);
    } catch (err: unknown) {
      logger.warn('GiveawayService: Failed to remove giveaway from Redis', err);
    }
  }

  /**
   * Create a new giveaway
   */
  createGiveaway(options: CreateGiveawayOptions): Giveaway | string {
    const {
      guildId,
      channelId,
      hostId,
      hostName,
      title,
      description,
      winners,
      durationMinutes,
      requiredRoleId,
    } = options;

    // Enforce per-guild limit
    const activeCount = Array.from(this.giveaways.values()).filter(
      g => g.guildId === guildId && !g.ended
    ).length;
    if (activeCount >= GiveawayService.MAX_GIVEAWAYS_PER_GUILD) {
      return `Maximum of ${GiveawayService.MAX_GIVEAWAYS_PER_GUILD} active giveaways per server.`;
    }

    this.idCounter += 1;
    const id = `giveaway_${Date.now()}_${this.idCounter}`;

    const giveaway: Giveaway = {
      id,
      guildId,
      channelId,
      messageId: '',
      hostId,
      hostName,
      title,
      description,
      winners: Math.max(1, Math.min(winners, 20)),
      requiredRoleId,
      endsAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      entries: [],
      ended: false,
      winnerIds: [],
    };

    this.giveaways.set(id, giveaway);
    this.persistGiveaway(giveaway).catch(() => {});

    // Schedule auto-end
    const timer = setTimeout(
      () => {
        this.endGiveaway(id).catch(err => logger.warn('Auto-end giveaway failed:', err));
      },
      durationMinutes * 60 * 1000
    );
    timer.unref();
    this.timerIds.set(id, timer);

    return giveaway;
  }

  /**
   * Set the Discord message ID for the giveaway embed
   */
  setMessageId(giveawayId: string, messageId: string): void {
    const g = this.giveaways.get(giveawayId);
    if (g) {
      g.messageId = messageId;
      this.persistGiveaway(g).catch(() => {});
    }
  }

  /**
   * Add an entry (returns error string or null on success)
   */
  async addEntry(
    giveawayId: string,
    userId: string,
    username: string,
    member?: GuildMember
  ): Promise<string | null> {
    const g = this.giveaways.get(giveawayId);
    if (!g) {
      return 'Giveaway not found.';
    }
    if (g.ended) {
      return 'This giveaway has already ended.';
    }

    if (g.entries.some(e => e.userId === userId)) {
      return 'You have already entered this giveaway.';
    }

    if (g.requiredRoleId && member) {
      if (!member.roles.cache.has(g.requiredRoleId)) {
        return `You need the <@&${g.requiredRoleId}> role to enter this giveaway.`;
      }
    }

    g.entries.push({ userId, username, enteredAt: new Date() });
    this.persistGiveaway(g).catch(() => {});
    return null;
  }

  /**
   * End a giveaway and pick winners
   */
  async endGiveaway(giveawayId: string): Promise<string[]> {
    const g = this.giveaways.get(giveawayId);
    if (!g || g.ended) {
      return [];
    }

    g.ended = true;

    // Clear timer
    const timer = this.timerIds.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this.timerIds.delete(giveawayId);
    }

    // Pick random winners
    const pool = [...g.entries];
    const winners: string[] = [];

    for (let i = 0; i < g.winners && pool.length > 0; i++) {
      const idx = randomInt(pool.length);
      winners.push(pool[idx].userId);
      pool.splice(idx, 1);
    }

    g.winnerIds = winners;

    // Persist ended state
    this.persistGiveaway(g).catch(() => {});

    // Update the embed message
    await this.updateGiveawayMessage(g);

    // Schedule cleanup of ended giveaway data after 1 hour
    const cleanupTimer = setTimeout(() => {
      this.giveaways.delete(giveawayId);
      this.cleanupTimers.delete(giveawayId);
      this.unpersistGiveaway(giveawayId).catch(() => {});
    }, GiveawayService.CLEANUP_DELAY_MS);
    cleanupTimer.unref();
    this.cleanupTimers.set(giveawayId, cleanupTimer);

    return winners;
  }

  /**
   * Get a giveaway by ID
   */
  getGiveaway(giveawayId: string): Giveaway | undefined {
    return this.giveaways.get(giveawayId);
  }

  /**
   * List active giveaways for a guild
   */
  listGiveaways(guildId: string): Giveaway[] {
    return Array.from(this.giveaways.values()).filter(g => g.guildId === guildId && !g.ended);
  }

  /**
   * Build giveaway embed
   */
  buildGiveawayEmbed(giveaway: Giveaway): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${decodeHtmlEntities(giveaway.title)}`)
      .setDescription(decodeHtmlEntities(giveaway.description))
      .setColor(giveaway.ended ? 0x95a5a6 : 0xf1c40f)
      .addFields(
        { name: '🏆 Winners', value: `${giveaway.winners}`, inline: true },
        { name: '🎟️ Entries', value: `${giveaway.entries.length}`, inline: true },
        {
          name: '⏰ Ends',
          value: giveaway.ended
            ? '**ENDED**'
            : `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
          inline: true,
        }
      )
      .setFooter({
        text: `Hosted by ${decodeHtmlEntities(giveaway.hostName)} | ID: ${giveaway.id}`,
      })
      .setTimestamp();

    if (giveaway.requiredRoleId) {
      embed.addFields({
        name: '🔒 Required Role',
        value: `<@&${giveaway.requiredRoleId}>`,
        inline: true,
      });
    }

    if (giveaway.ended && giveaway.winnerIds.length > 0) {
      embed.addFields({
        name: '🎊 Winners',
        value: giveaway.winnerIds.map(id => `<@${id}>`).join(', '),
        inline: false,
      });
    } else if (giveaway.ended) {
      embed.addFields({
        name: '🎊 Winners',
        value: 'No valid entries.',
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Build giveaway buttons
   */
  buildGiveawayButtons(giveawayId: string, ended: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveawayId}`)
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎟️')
        .setDisabled(ended)
    );
  }

  private async updateGiveawayMessage(giveaway: Giveaway): Promise<void> {
    if (!this.client || !giveaway.messageId) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(giveaway.channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        return;
      }

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) {
        return;
      }

      const embed = this.buildGiveawayEmbed(giveaway);
      const row = this.buildGiveawayButtons(giveaway.id, giveaway.ended);

      await message.edit({ embeds: [embed], components: [row] });
    } catch (error: unknown) {
      logger.warn('Failed to update giveaway message:', error);
    }
  }

  shutdown(): void {
    for (const timer of this.timerIds.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }

    this.timerIds.clear();
    this.cleanupTimers.clear();
    this.giveaways.clear();
    this.client = null;

    logger.info('GiveawayService shut down');
  }
}

