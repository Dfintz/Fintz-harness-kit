import { ActivityType, Client, GuildMember, Presence, TextChannel } from 'discord.js';

import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { SocialGroupService } from '../../services/social';
import { LFGActivity } from '../../types';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { buildLfgButtons, buildLfgEmbed } from '../embeds/lfgEmbed';

// ─────────────────────────────────────────────────────────────────────────────
// LFG Presence Monitor
//
// Detects when opted-in users start playing a game while in a voice channel
// and automatically creates an LFG listing referencing their current VC (no
// new channel is created).
//
// Privileged Intent Required: GuildPresences must be enabled both in code
// (BotClientManager) and in the Discord Developer Portal.
// ─────────────────────────────────────────────────────────────────────────────

/** Per-user auto-LFG configuration */
export interface AutoLfgPreferences {
  maxPlayers: number;
}

/** Cooldown tracking per user per guild */
interface CooldownEntry {
  lastAutoPost: number;
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between auto-posts per user/guild

/** Redis key prefix for persisted auto-LFG opt-ins (survives bot restarts) */
const LFG_OPTIN_REDIS_PREFIX = 'bot:lfg:autopost:optin:';

// Opt-ins are durable preferences, not ephemeral state. `cache.set` defaults to a
// 300s TTL, so an explicit long TTL is used and refreshed on hydrate (a sliding
// window). An actively-running bot keeps opt-ins alive indefinitely while still
// self-cleaning after prolonged inactivity.
const LFG_OPTIN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

/** Well-known game names mapped to LFG activity types */
const GAME_ACTIVITY_MAP: Record<string, LFGActivity> = {
  'star citizen': LFGActivity.OTHER,
  'star citizen alpha': LFGActivity.OTHER,
  'arena commander': LFGActivity.PVP,
  'star marine': LFGActivity.PVP,
};

function mapGameToActivity(gameName: string): LFGActivity {
  const lower = gameName.toLowerCase();
  for (const [pattern, activity] of Object.entries(GAME_ACTIVITY_MAP)) {
    if (lower.includes(pattern)) {
      return activity;
    }
  }
  return LFGActivity.OTHER;
}

function compositeKey(userId: string, guildId: string): string {
  return `${userId}:${guildId}`;
}

/**
 * Singleton that manages automatic LFG post creation based on Discord
 * presence updates (game activity + voice channel membership).
 */
export class LfgPresenceMonitor {
  private static instance: LfgPresenceMonitor | null = null;

  /** Users who have opted in: key = userId:guildId */
  private readonly optIns: Map<string, AutoLfgPreferences> = new Map();

  /** Cooldown tracker: key = userId:guildId */
  private readonly cooldowns: Map<string, CooldownEntry> = new Map();

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private readonly lfgService = SocialGroupService.getInstance();

  private constructor() {}

  static getInstance(): LfgPresenceMonitor {
    if (!LfgPresenceMonitor.instance) {
      LfgPresenceMonitor.instance = new LfgPresenceMonitor();
      // Schedule periodic cleanup of stale cooldowns every 30 minutes
      LfgPresenceMonitor.instance.cleanupInterval = setInterval(
        () => LfgPresenceMonitor.instance?.cleanupCooldowns(),
        30 * 60_000
      );
      if (typeof LfgPresenceMonitor.instance.cleanupInterval.unref === 'function') {
        LfgPresenceMonitor.instance.cleanupInterval.unref();
      }
    }
    return LfgPresenceMonitor.instance;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.cooldowns.clear();
    this.optIns.clear();
  }

  // ── Opt-in / Opt-out ────────────────────────────────────────────

  optIn(userId: string, guildId: string, prefs: AutoLfgPreferences): void {
    const key = compositeKey(userId, guildId);
    this.optIns.set(key, prefs);
    this.persistOptIn(key, prefs);
  }

  optOut(userId: string, guildId: string): void {
    const key = compositeKey(userId, guildId);
    this.optIns.delete(key);
    this.cooldowns.delete(key);
    this.unpersistOptIn(key);
  }

  isOptedIn(userId: string, guildId: string): boolean {
    return this.optIns.has(compositeKey(userId, guildId));
  }

  // ── Persistence (Redis-backed, survives bot restarts) ───────────

  /**
   * Restore opt-ins from Redis into the in-memory map. Call once at startup
   * (after the bot connects) so auto-LFG opt-ins survive restarts/deploys.
   * The in-memory map remains the runtime source of truth; Redis is a durable
   * mirror. Failures are non-fatal — auto-LFG simply starts with no opt-ins.
   */
  async hydrate(): Promise<void> {
    try {
      const keys = await cache.keys(`${LFG_OPTIN_REDIS_PREFIX}*`);
      let loaded = 0;
      for (const fullKey of keys) {
        const prefs = await cache.get<AutoLfgPreferences>(fullKey);
        if (!prefs) {
          continue;
        }
        const key = fullKey.slice(LFG_OPTIN_REDIS_PREFIX.length);
        this.optIns.set(key, prefs);
        // Refresh the TTL (sliding window) so an actively-running bot keeps it alive.
        this.persistOptIn(key, prefs);
        loaded++;
      }
      if (loaded > 0) {
        logger.info(`LfgPresenceMonitor: Restored ${loaded} auto-LFG opt-ins from Redis`);
      }
    } catch (err: unknown) {
      logger.warn('LfgPresenceMonitor: Failed to hydrate opt-ins from Redis', err);
    }
  }

  /** Write-through an opt-in to Redis (fire-and-forget, best-effort). */
  private persistOptIn(key: string, prefs: AutoLfgPreferences): void {
    cache
      .set(`${LFG_OPTIN_REDIS_PREFIX}${key}`, prefs, LFG_OPTIN_TTL_SECONDS)
      .catch((err: unknown) =>
        logger.warn('LfgPresenceMonitor: Failed to persist opt-in to Redis', err)
      );
  }

  /** Remove a persisted opt-in from Redis (fire-and-forget, best-effort). */
  private unpersistOptIn(key: string): void {
    cache
      .del(`${LFG_OPTIN_REDIS_PREFIX}${key}`)
      .catch((err: unknown) =>
        logger.warn('LfgPresenceMonitor: Failed to remove opt-in from Redis', err)
      );
  }

  // ── Presence handler ────────────────────────────────────────────

  /**
   * Called from `client.on('presenceUpdate')` in botApp.ts.
   *
   * Auto-creates an LFG post when ALL of the following are true:
   *  1. User is opted in for this guild
   *  2. User just started playing a game (wasn't playing before, or different game)
   *  3. User is currently in a voice channel in the same guild
   *  4. Cooldown has expired (1 per hour per user/guild)
   */
  async handlePresenceUpdate(
    oldPresence: Presence | null,
    newPresence: Presence,
    _client: Client
  ): Promise<void> {
    const userId = newPresence.userId;
    const guild = newPresence.guild;
    if (!guild) {
      return;
    }

    const key = compositeKey(userId, guild.id);

    // 1. Check opt-in
    const prefs = this.optIns.get(key);
    if (!prefs) {
      return;
    }

    // 2. Detect game activity start
    const newGame = newPresence.activities.find(a => a.type === ActivityType.Playing);
    if (!newGame) {
      return;
    }

    const oldGame = oldPresence?.activities.find(a => a.type === ActivityType.Playing);
    if (oldGame?.name === newGame.name) {
      // Same game — not a new session start
      return;
    }

    // 3. Check if user is in a voice channel in this guild
    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return; // Cannot resolve member
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return;
    } // Not in a voice channel

    // 4. Cooldown check
    const now = Date.now();
    const cd = this.cooldowns.get(key);
    if (cd && now - cd.lastAutoPost < COOLDOWN_MS) {
      return;
    }

    // ── All conditions met — create auto-LFG post ──

    // Resolve the configured LFG channel for this guild.
    // Priority:
    //   1. lfgNetworkSettings.lfgChannelId   (canonical — captured when /lfg panel was posted)
    //   2. lfgSettings.otherGamesChannelId   (non-default games only)
    //   3. lfgSettings.publicLfgChannelId    (last-resort configured channel)
    //   4. guild.systemChannel               (Discord default)
    //   5. first text channel                (legacy fallback)
    let textChannel: TextChannel | null = null;
    let mentionRoleId: string | undefined;

    try {
      const all = await discordSettingsService.getSettingsByGuildId(guild.id);
      const settings = all?.[0];
      const networkLfg = settings?.lfgNetworkSettings as
        | {
            lfgChannelId?: string;
            autoLfgVoiceChannelScope?: 'all' | 'selected';
            autoLfgAllowedVoiceChannelIds?: string[];
          }
        | undefined;
      const lfg = settings?.lfgSettings;
      const defaultGame = lfg?.defaultGame ?? 'Star Citizen';
      const isNonDefaultGame = newGame.name.toLowerCase() !== defaultGame.toLowerCase();

      const voiceScope = networkLfg?.autoLfgVoiceChannelScope ?? 'all';
      const allowedVoiceChannelIds = Array.isArray(networkLfg?.autoLfgAllowedVoiceChannelIds)
        ? networkLfg.autoLfgAllowedVoiceChannelIds
        : [];
      if (voiceScope === 'selected' && !allowedVoiceChannelIds.includes(voiceChannel.id)) {
        logger.debug('Auto-LFG: user in non-whitelisted voice channel for selected-only scope', {
          guildId: guild.id,
          userId,
          voiceChannelId: voiceChannel.id,
          allowedVoiceChannelCount: allowedVoiceChannelIds.length,
        });
        return;
      }

      // Capture the mention role ID for later use
      mentionRoleId = lfg?.lfgMentionRoleId;

      const candidates: (string | undefined)[] = [
        networkLfg?.lfgChannelId,
        isNonDefaultGame ? lfg?.otherGamesChannelId : undefined,
        lfg?.publicLfgChannelId,
      ];
      for (const id of candidates) {
        if (!id) {
          continue;
        }
        const ch = guild.channels.cache.get(id);
        if (ch && ch.isTextBased() && !ch.isVoiceBased() && !ch.isThread()) {
          textChannel = ch as TextChannel;
          break;
        }
      }
    } catch (err) {
      logger.debug('Auto-LFG: failed to resolve configured LFG channel', {
        guildId: guild.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (!textChannel) {
      logger.warn(
        `Auto-LFG: no configured LFG channel for guild ${guild.id} — falling back to systemChannel`
      );
      textChannel = guild.systemChannel;
      if (!textChannel) {
        const channels = guild.channels.cache.filter(
          (ch): ch is TextChannel => ch.isTextBased() && !ch.isVoiceBased() && !ch.isThread()
        );
        textChannel = channels.first() ?? null;
      }
    }
    if (!textChannel) {
      logger.warn(`Auto-LFG: No text channel available in guild ${guild.id}`);
      return;
    }

    const activity = mapGameToActivity(newGame.name);
    const description = `🤖 Auto-LFG: ${member.displayName} is playing **${newGame.name}** — join the voice chat!`;

    try {
      const post = this.lfgService.createPost(
        activity,
        description,
        userId,
        member.displayName,
        prefs.maxPlayers,
        guild.id,
        textChannel.id,
        60, // 1 hour default
        { voiceChannelId: voiceChannel.id, isAutoLfg: true, game: newGame.name }
      );

      const embed = buildLfgEmbed(post);
      const buttons = buildLfgButtons(post.id);

      // Add role mention if configured
      let content: string | undefined;
      if (mentionRoleId) {
        content = `<@&${mentionRoleId}>`;
      }

      const sentMessage = await textChannel.send({
        content,
        embeds: [embed],
        components: [buttons],
        allowedMentions: mentionRoleId ? { roles: [mentionRoleId] } : undefined,
      });
      this.lfgService.setMessageId(post.id, sentMessage.id);

      // Set cooldown
      this.cooldowns.set(key, { lastAutoPost: now });

      logger.info(
        `🤖 Auto-LFG created for ${member.displayName} in ${guild.name}: ` +
          `${newGame.name} → post ${post.id} (VC: ${voiceChannel.name})`
      );
    } catch (error) {
      logger.error('Auto-LFG post creation failed:', error);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  /** Remove stale cooldowns (called periodically or on demand). */
  cleanupCooldowns(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cooldowns) {
      if (now - entry.lastAutoPost > COOLDOWN_MS * 2) {
        this.cooldowns.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
