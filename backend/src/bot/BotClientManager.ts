import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';

import { logger } from '../utils/logger';

import { registerRestRateLimitObserver } from './utils/restRateLimitObserver';

/**
 * BotClientManager — Singleton that manages the single Discord.js Client instance.
 *
 * Problem: Previously, `botApp.ts` and `DiscordService.ts` each created their own
 * Client, wasting resources and causing rate-limit contention.
 *
 * Solution: One Client per shard process with merged intents from all consumers:
 *   - botApp.ts needs: Guilds, GuildMessages, MessageContent, GuildVoiceStates, GuildModeration
 *   - DiscordService needs: Guilds, GuildMembers, GuildMessages, MessageContent
 *
 * Wave 1.9 — Bot Architecture Hardening
 */
export class BotClientManager {
  private static instance: BotClientManager | null = null;
  private readonly client: Client;
  private loggedIn = false;
  private loginPromise: Promise<string> | null = null;

  private constructor() {
    // Merge all intents required by any consumer in the application
    this.client = new Client({
      intents: [
        // From botApp.ts
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        // From MessageRelay — needed to receive reaction events for tunnel relay
        GatewayIntentBits.GuildMessageReactions,
        // From DiscordService
        GatewayIntentBits.GuildMembers,
        // From LFG Presence Monitor (auto-LFG) — privileged intent,
        // must also be enabled in Discord Developer Portal
        GatewayIntentBits.GuildPresences,
        // For Discord Scheduled Events (create/update/delete/RSVP sync)
        GatewayIntentBits.GuildScheduledEvents,
      ],
      partials: [
        // From DiscordService — needed for partial message/reaction events
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        // Required for guildMemberUpdate on uncached members (moderation timeout/role detection)
        Partials.GuildMember,
      ],
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ReactionManager: 0,
        GuildMemberManager: { maxSize: 200, keepOverLimit: m => m.id === m.client.user?.id },
        MessageManager: { maxSize: 100 },
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: { interval: 3600, lifetime: 1800 },
      },
      // Emit `invalidRequestWarning` every N invalid (401/403/429) responses so
      // the bot can observe its approach to Cloudflare's 10k-per-10-min ban
      // threshold. Disabled by default in discord.js (interval 0). (BOT-07)
      rest: { invalidRequestWarningInterval: 100 },
    });

    this.client.on('error', error => {
      logger.error('Discord client error:', error);
    });

    this.client.on('warn', warning => {
      logger.warn('Discord client warning:', warning);
    });

    // BOT-07: discord.js already retries/backs off 429s for every managed REST
    // request; this adds the missing structured observability for rate-limit
    // contention and the invalid-request ban risk across all client consumers.
    registerRestRateLimitObserver(this.client.rest);
  }

  /**
   * Get the singleton instance.
   */
  public static getInstance(): BotClientManager {
    BotClientManager.instance ??= new BotClientManager();
    return BotClientManager.instance;
  }

  /**
   * Get the Discord.js Client instance.
   * This is the ONLY Client that should exist per shard process.
   */
  public getClient(): Client {
    return this.client;
  }

  /**
   * Login to Discord. Safe to call multiple times — only logs in once.
   * Resolves when the client is logged in; does not return a token.
   */
  public async login(token: string): Promise<void> {
    if (this.loggedIn) {
      return;
    }

    // Prevent concurrent login attempts
    if (this.loginPromise) {
      await this.loginPromise;
      return;
    }

    this.loginPromise = this.client.login(token);

    try {
      await this.loginPromise;
      this.loggedIn = true;
      logger.info(`✅ BotClientManager: Discord client logged in as ${this.client.user?.tag}`);
    } catch (error) {
      logger.error('❌ BotClientManager: Failed to login to Discord:', error);
      throw error;
    } finally {
      this.loginPromise = null;
    }
  }

  /**
   * Check if the client has logged in and is ready.
   */
  public isReady(): boolean {
    return this.loggedIn && this.client.isReady();
  }

  /**
   * Destroy the client connection. Used for graceful shutdown.
   */
  public async destroy(): Promise<void> {
    if (this.loggedIn) {
      void this.client.destroy();
      this.loggedIn = false;
      logger.info('BotClientManager: Client destroyed');
    }
  }

  /**
   * Reset the singleton (for testing only).
   */
  public static resetInstance(): void {
    if (BotClientManager.instance) {
      BotClientManager.instance.client.removeAllListeners();
      BotClientManager.instance = null;
    }
  }
}
