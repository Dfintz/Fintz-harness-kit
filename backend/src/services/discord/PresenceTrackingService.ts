import { ActivityType, Client, Presence } from 'discord.js';

import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

/** Redis key prefix for cross-container Discord presence data */
const PRESENCE_REDIS_PREFIX = 'presence:discord:guild:';
/** TTL for Redis presence data (seconds). Bot publishes every 60s, 2x buffer. */
const PRESENCE_REDIS_TTL = 120;

/**
 * A presence snapshot for a user in a guild
 */
export interface PresenceSnapshot {
  userId: string;
  guildId: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  gameName?: string;
  gameDetails?: string;
  timestamp: Date;
}

/**
 * Aggregated game stats for a guild
 */
export interface GuildGameStats {
  guildId: string;
  /** Map of game name → player count */
  currentPlayers: Record<string, number>;
  /** Map of game name → list of user IDs currently playing */
  playersByGame: Record<string, string[]>;
  /** Status counts */
  statusCounts: {
    online: number;
    idle: number;
    dnd: number;
    offline: number;
  };
}

/**
 * Hourly activity data point for heatmaps
 */
export interface ActivityDataPoint {
  hour: number; // 0-23
  dayOfWeek: number; // 0=Sun, 6=Sat
  count: number;
}

/**
 * Historical presence data for a game
 */
export interface GamePresenceHistory {
  gameName: string;
  totalSessions: number;
  uniquePlayers: number;
  hourlyActivity: ActivityDataPoint[];
}

/**
 * Presence Tracking Service
 *
 * Tracks Discord presence (online status) and activity (games played)
 * across guild members. Provides real-time game stats and historical
 * data for dashboard heatmaps and activity analysis.
 */
export class PresenceTrackingService {
  private static instance: PresenceTrackingService;
  private client: Client | null = null;

  /**
   * Rolling window of presence snapshots (capped per guild)
   * Key: guildId, Value: array of recent snapshots
   */
  private readonly history = new Map<string, PresenceSnapshot[]>();
  private static readonly MAX_HISTORY_PER_GUILD = 10000;

  /**
   * Current live presence cache
   * Key: `guildId:userId`, Value: latest snapshot
   */
  private readonly livePresence = new Map<string, PresenceSnapshot>();
  private static readonly MAX_LIVE_PRESENCE = 50000;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private publishInterval: NodeJS.Timeout | null = null;

  private readonly presenceUpdateListener = (
    oldPresence: Presence | null,
    newPresence: Presence
  ): void => {
    this.handlePresenceUpdate(oldPresence, newPresence);
  };

  static getInstance(): PresenceTrackingService {
    if (!PresenceTrackingService.instance) {
      PresenceTrackingService.instance = new PresenceTrackingService();
    }
    return PresenceTrackingService.instance;
  }

  initialize(client: Client): void {
    this.client = client;

    // Listen for presence updates
    client.on('presenceUpdate', this.presenceUpdateListener);

    // Periodic cleanup of stale offline entries (every 30 minutes)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStalePresence();
      },
      30 * 60 * 1000
    );
    this.cleanupInterval.unref();

    // Publish presence counts to Redis every 60s for cross-container access
    this.publishInterval = setInterval(() => {
      void this.publishPresenceToRedis();
    }, 60 * 1000);
    this.publishInterval.unref();

    // Publish immediately on init so backend has data right away
    const bootstrapPublishTimeout = setTimeout(() => void this.publishPresenceToRedis(), 5000);
    bootstrapPublishTimeout.unref();

    logger.info('👁️ PresenceTrackingService initialized');
  }

  /**
   * Stop all background intervals. Called during graceful shutdown.
   */
  shutdown(): void {
    if (this.client) {
      this.client.off('presenceUpdate', this.presenceUpdateListener);
      this.client = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }
    logger.info('👁️ PresenceTrackingService shut down');
  }

  /**
   * Handle a presence update event
   */
  private handlePresenceUpdate(_oldPresence: Presence | null, newPresence: Presence): void {
    if (!newPresence.guild) {
      return;
    }

    const userId = newPresence.userId;
    const guildId = newPresence.guild.id;

    // Find game activity
    const gameActivity = newPresence.activities.find(a => a.type === ActivityType.Playing);

    const snapshot: PresenceSnapshot = {
      userId,
      guildId,
      status: newPresence.status as PresenceSnapshot['status'],
      gameName: gameActivity?.name,
      gameDetails: gameActivity?.details ?? undefined,
      timestamp: new Date(),
    };

    // Update live presence (remove offline users, cap total)
    const key = `${guildId}:${userId}`;
    if (snapshot.status === 'offline') {
      this.livePresence.delete(key);
    } else {
      if (
        !this.livePresence.has(key) &&
        this.livePresence.size >= PresenceTrackingService.MAX_LIVE_PRESENCE
      ) {
        // Evict oldest entry
        const firstKey = this.livePresence.keys().next().value;
        if (firstKey) {
          this.livePresence.delete(firstKey);
        }
      }
      this.livePresence.set(key, snapshot);
    }

    // Add to history
    const guildHistory = this.history.get(guildId) ?? [];
    guildHistory.push(snapshot);

    // Cap history
    if (guildHistory.length > PresenceTrackingService.MAX_HISTORY_PER_GUILD) {
      guildHistory.splice(0, guildHistory.length - PresenceTrackingService.MAX_HISTORY_PER_GUILD);
    }

    this.history.set(guildId, guildHistory);
  }

  /**
   * Get current game stats for a guild
   */
  getCurrentGameStats(guildId: string): GuildGameStats {
    const stats: GuildGameStats = {
      guildId,
      currentPlayers: {},
      playersByGame: {},
      statusCounts: { online: 0, idle: 0, dnd: 0, offline: 0 },
    };

    for (const [key, snapshot] of this.livePresence.entries()) {
      if (!key.startsWith(`${guildId}:`)) {
        continue;
      }

      // Count statuses
      if (snapshot.status in stats.statusCounts) {
        stats.statusCounts[snapshot.status]++;
      }

      // Count game players
      if (snapshot.gameName) {
        const game = snapshot.gameName;
        stats.currentPlayers[game] = (stats.currentPlayers[game] || 0) + 1;

        if (!stats.playersByGame[game]) {
          stats.playersByGame[game] = [];
        }
        stats.playersByGame[game].push(snapshot.userId);
      }
    }

    return stats;
  }

  /**
   * Get activity heatmap data for a guild (last N days)
   */
  getActivityHeatmap(guildId: string, days: number = 7): ActivityDataPoint[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const guildHistory = this.history.get(guildId) ?? [];

    // Build heatmap grid: 7 days × 24 hours
    const grid: Record<string, number> = {};
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        grid[`${d}:${h}`] = 0;
      }
    }

    for (const snapshot of guildHistory) {
      if (snapshot.timestamp.getTime() < cutoff) {
        continue;
      }
      if (snapshot.status === 'offline') {
        continue;
      }

      const h = snapshot.timestamp.getHours();
      const d = snapshot.timestamp.getDay();
      grid[`${d}:${h}`]++;
    }

    const result: ActivityDataPoint[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        result.push({ dayOfWeek: d, hour: h, count: grid[`${d}:${h}`] });
      }
    }

    return result;
  }

  /**
   * Get game presence history (top games by sessions)
   */
  getGamePresenceHistory(guildId: string, days: number = 7): GamePresenceHistory[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const guildHistory = this.history.get(guildId) ?? [];

    const gamesMap = new Map<
      string,
      { sessions: number; uniquePlayers: Set<string>; hourly: ActivityDataPoint[] }
    >();

    for (const snapshot of guildHistory) {
      if (snapshot.timestamp.getTime() < cutoff) {
        continue;
      }
      if (!snapshot.gameName) {
        continue;
      }

      const game = snapshot.gameName;
      if (!gamesMap.has(game)) {
        gamesMap.set(game, {
          sessions: 0,
          uniquePlayers: new Set(),
          hourly: [],
        });
      }

      const entry = gamesMap.get(game)!;
      entry.sessions++;
      entry.uniquePlayers.add(snapshot.userId);
    }

    return Array.from(gamesMap.entries())
      .map(([gameName, data]) => ({
        gameName,
        totalSessions: data.sessions,
        uniquePlayers: data.uniquePlayers.size,
        hourlyActivity: [],
      }))
      .sort((a, b) => b.totalSessions - a.totalSessions)
      .slice(0, 20);
  }

  /**
   * Get member count by status for a guild
   */
  getStatusCounts(guildId: string): GuildGameStats['statusCounts'] {
    return this.getCurrentGameStats(guildId).statusCounts;
  }

  /**
   * Remove stale presence entries (offline for > 1 hour or no update in 24 hours)
   */
  private cleanupStalePresence(): void {
    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [key, snapshot] of this.livePresence.entries()) {
      if (snapshot.timestamp.getTime() < staleThreshold) {
        this.livePresence.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`PresenceTracking: cleaned up ${removed} stale entries`);
    }
  }

  /**
   * Publish per-guild presence counts to Redis so the backend container
   * can read Discord online counts without needing a live bot connection.
   *
   * Writes one key per guild: `presence:discord:guild:{guildId}`
   * Value: `{ online, idle, dnd, total, updatedAt }`
   * TTL: 120 seconds (bot publishes every 60s)
   */
  private async publishPresenceToRedis(): Promise<void> {
    try {
      // Collect unique guild IDs from live presence
      const guildIds = new Set<string>();
      for (const [key] of this.livePresence.entries()) {
        const guildId = key.split(':')[0];
        if (guildId) {
          guildIds.add(guildId);
        }
      }

      if (guildIds.size === 0) {
        return;
      }

      let published = 0;
      for (const guildId of guildIds) {
        const stats = this.getCurrentGameStats(guildId);
        const total = stats.statusCounts.online + stats.statusCounts.idle + stats.statusCounts.dnd;

        await cache.set(
          `${PRESENCE_REDIS_PREFIX}${guildId}`,
          {
            online: stats.statusCounts.online,
            idle: stats.statusCounts.idle,
            dnd: stats.statusCounts.dnd,
            total,
            updatedAt: Date.now(),
          },
          PRESENCE_REDIS_TTL
        );
        published++;
      }

      logger.debug(`PresenceTracking: published presence to Redis for ${published} guilds`);
    } catch (error: unknown) {
      logger.error('PresenceTracking: failed to publish presence to Redis:', error);
    }
  }
}

