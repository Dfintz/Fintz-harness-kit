/**
 * Tunnel Service for Cross-Server Discord Chat
 * Manages tunnel creation, connections, message relaying, moderation, and analytics
 *
 * Inspired by tunnels.gg: code-based linking, rich content relay, bot message support,
 * message persistence, user moderation, and realtime analytics (all free, no tiers)
 */

import crypto from 'node:crypto';

import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  TunnelConnection,
  Tunnel as TunnelEntity,
  TunnelRateLimitConfig,
} from '../../models/Tunnel';
import { TunnelAnalyticsEntry } from '../../models/TunnelAnalyticsEntry';
import { TunnelBan as TunnelBanEntity, TunnelBanType } from '../../models/TunnelBan';
import { TunnelAttachment, TunnelMessage as TunnelMessageEntity } from '../../models/TunnelMessage';
import { logger } from '../../utils/logger';
import { findInBatches } from '../../utils/query';
import { cache } from '../../utils/redis';

// Re-export types for backward compatibility
export type { TunnelAttachment, TunnelBanType, TunnelConnection, TunnelRateLimitConfig };

/**
 * Legacy Tunnel interface for backward compatibility
 */
export interface Tunnel {
  id: string;
  name: string;
  inviteCode?: string;
  creatorGuildId: string;
  creatorChannelId: string;
  isPublic: boolean;
  password?: string;
  createdAt: Date;
  connectedChannels: TunnelConnection[];
  rateLimitConfig?: TunnelRateLimitConfig;
  contentFilterEnabled: boolean;
  allowBotMessages: boolean;
  maxConnectedServers: number;
  organizationId?: string;
}

/**
 * Tunnel message for persistence and relay
 */
export interface TunnelMessageData {
  id: string;
  tunnelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  sourceGuildId?: string;
  sourceChannelId?: string;
  discordMessageId?: string;
  content?: string;
  attachments?: TunnelAttachment[];
  embeds?: Record<string, unknown>[];
  stickerIds?: string[];
  replyToMessageId?: string;
  isBot: boolean;
  wasBlocked?: boolean;
  blockReason?: string;
  isEdited?: boolean;
  editedAt?: Date;
  timestamp: Date;
}

/**
 * Tunnel analytics data
 */
export interface TunnelAnalytics {
  tunnelId: string;
  messagesRelayed: number;
  messagesBlocked: number;
  lastActivity: Date | null;
  peakConnectionCount: number;
  totalUniqueGuilds: number;
  attachmentsRelayed: number;
  reactionsRelayed: number;
  uniqueUserIds: Set<string>;
}

/**
 * System-wide tunnel statistics
 */
export interface TunnelSystemStats {
  totalTunnels: number;
  activeTunnels: number;
  totalConnections: number;
  totalMessagesRelayed: number;
  totalMessagesBlocked: number;
  mostActiveHour: number;
  tunnelsByVisibility: {
    public: number;
    private: number;
  };
  topTunnels: Array<{
    id: string;
    name: string;
    messagesRelayed: number;
    connectionCount: number;
  }>;
}

export class TunnelService {
  private static instance: TunnelService;
  private tunnelRepository: Repository<TunnelEntity> | null = null;
  private messageRepository: Repository<TunnelMessageEntity> | null = null;
  private banRepository: Repository<TunnelBanEntity> | null = null;
  private analyticsRepository: Repository<TunnelAnalyticsEntry> | null = null;
  private readonly cache: Map<string, TunnelEntity>; // In-memory cache for performance
  /** When each cached tunnel was last synced with the DB (tunnel id -> epoch ms). */
  private readonly cacheLoadedAt = new Map<string, number>();
  /**
   * How long a cached tunnel is trusted before the relay lookup re-reads it from the
   * DB. The cache is per-process: every bot shard loads tunnels into its own in-memory
   * map at startup and never observes membership/webhook changes made on other shards.
   * Re-reading after this window bounds that cross-shard staleness and lets relay
   * self-heal once a quiet tunnel becomes active again (the reported symptom of
   * commlink messages not propagating after long inactivity).
   */
  private static readonly CACHE_FRESHNESS_MS = 60_000; // 60 seconds
  private initialized: boolean = false;

  // Analytics tracking (in-memory buffer, flushed to DB periodically)
  private readonly analyticsData: Map<string, TunnelAnalytics> = new Map();
  private readonly hourlyActivity: Map<number, number> = new Map(); // Hour (0-23) -> message count
  private analyticsFlushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cache = new Map();
    // Initialize hourly activity map
    for (let i = 0; i < 24; i++) {
      this.hourlyActivity.set(i, 0);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TunnelService {
    if (!TunnelService.instance) {
      TunnelService.instance = new TunnelService();
    }
    return TunnelService.instance;
  }

  /**
   * Initialize the service with database connection
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.tunnelRepository = AppDataSource.getRepository(TunnelEntity);
      this.messageRepository = AppDataSource.getRepository(TunnelMessageEntity);
      this.banRepository = AppDataSource.getRepository(TunnelBanEntity);
      this.analyticsRepository = AppDataSource.getRepository(TunnelAnalyticsEntry);

      // Load existing tunnels into cache (PERF-03: bounded keyset batches instead
      // of an unbounded full-table scan into memory).
      const tunnelCount = await findInBatches(this.getRepository(), {}, batch => {
        for (const tunnel of batch) {
          this.cacheTunnel(tunnel);
        }
      });

      // Start periodic analytics flush (every hour)
      this.analyticsFlushInterval = setInterval(() => void this.persistAnalytics(), 60 * 60 * 1000);
      this.analyticsFlushInterval.unref();

      this.initialized = true;
      logger.info(`TunnelService initialized with ${tunnelCount} tunnels from database`);
    } catch (error: unknown) {
      logger.error('Failed to initialize TunnelService:', error);
      throw error;
    }
  }

  /**
   * Get the repository, initializing lazily if needed
   */
  private getRepository(): Repository<TunnelEntity> {
    if (!this.tunnelRepository) {
      this.tunnelRepository = AppDataSource.getRepository(TunnelEntity);
      this.initialized = true;
    }
    return this.tunnelRepository;
  }

  private getMessageRepository(): Repository<TunnelMessageEntity> {
    this.messageRepository ??= AppDataSource.getRepository(TunnelMessageEntity);
    return this.messageRepository;
  }

  private getBanRepository(): Repository<TunnelBanEntity> {
    this.banRepository ??= AppDataSource.getRepository(TunnelBanEntity);
    return this.banRepository;
  }

  private getAnalyticsRepository(): Repository<TunnelAnalyticsEntry> {
    this.analyticsRepository ??= AppDataSource.getRepository(TunnelAnalyticsEntry);
    return this.analyticsRepository;
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      // Lazy initialization - try to initialize if not already done
      this.tunnelRepository = AppDataSource.getRepository(TunnelEntity);
      this.initialized = true;
    }
  }

  /**
   * Store a tunnel in the in-memory cache and record when it was synced with the DB,
   * so the relay lookup can detect and refresh stale cross-shard entries.
   */
  private cacheTunnel(tunnel: TunnelEntity): void {
    this.cache.set(tunnel.id, tunnel);
    this.cacheLoadedAt.set(tunnel.id, Date.now());
  }

  /**
   * Create a new tunnel
   */
  public async createTunnel(
    name: string,
    creatorGuildId: string,
    creatorChannelId: string,
    isPublic: boolean = true,
    password?: string,
    options?: {
      rateLimitConfig?: TunnelRateLimitConfig;
      organizationId?: string;
      contentFilterEnabled?: boolean;
      guildName?: string;
      channelName?: string;
    }
  ): Promise<Tunnel> {
    this.ensureInitialized();

    const {
      rateLimitConfig,
      organizationId,
      contentFilterEnabled = true,
      guildName,
      channelName,
    } = options ?? {};

    const id = this.generateTunnelId();
    const repository = this.getRepository();
    const inviteCode = await this.generateInviteCode();

    // Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const tunnel = repository.create({
      id,
      name,
      inviteCode,
      creatorGuildId,
      creatorChannelId,
      isPublic,
      password: hashedPassword,
      connectedChannels: [
        {
          guildId: creatorGuildId,
          channelId: creatorChannelId,
          guildName,
          channelName,
          connectedAt: new Date(),
        },
      ],
      rateLimitConfig,
      contentFilterEnabled,
      allowBotMessages: true,
      maxConnectedServers: 0, // 0 = unlimited
      organizationId,
    });

    const saved = await this.getRepository().save(tunnel);
    this.cache.set(id, saved);

    logger.info(
      `Tunnel created: ${id} (${name}) with invite code ${inviteCode} by guild ${creatorGuildId}`
    );
    return this.toTunnelInterface(saved);
  }

  /**
   * Get tunnel by ID
   */
  public async getTunnel(tunnelId: string): Promise<Tunnel | undefined> {
    this.ensureInitialized();

    // Check cache first
    let tunnel = this.cache.get(tunnelId);

    if (!tunnel) {
      // Load from database
      const found = await this.getRepository().findOne({ where: { id: tunnelId } });
      if (found) {
        tunnel = found;
        this.cache.set(tunnelId, tunnel);
      }
    }

    return tunnel ? this.toTunnelInterface(tunnel) : undefined;
  }

  /**
   * Get tunnel by ID (synchronous - cache only)
   * Use for hot path operations
   */
  public getTunnelSync(tunnelId: string): Tunnel | undefined {
    const tunnel = this.cache.get(tunnelId);
    return tunnel ? this.toTunnelInterface(tunnel) : undefined;
  }

  /**
   * List all public tunnels
   */
  public async listPublicTunnels(): Promise<Tunnel[]> {
    this.ensureInitialized();

    const tunnels = await this.getRepository().find({ where: { isPublic: true } });
    return tunnels.map(t => this.toTunnelInterface(t));
  }

  /**
   * List tunnels for a specific guild, optionally scoped by organization.
   *
   * Broad SQL fetch → precise JS filter.  The SQL uses three OR branches so
   * bot-created tunnels (which may lack organizationId) are always picked up:
   *   1. organizationId matches the caller's org
   *   2. creatorGuildId matches the guild (regardless of organizationId)
   *   3. guild appears somewhere inside the connectedChannels JSON
   */
  public async listGuildTunnels(guildId: string, organizationId?: string): Promise<Tunnel[]> {
    this.ensureInitialized();

    const repository = this.getRepository();

    const qb = repository.createQueryBuilder('tunnel');

    if (organizationId) {
      qb.where('tunnel.organizationId = :organizationId', { organizationId })
        .orWhere('tunnel.creatorGuildId = :guildId', { guildId })
        .orWhere('tunnel.connectedChannels LIKE :guildPattern', {
          guildPattern: `%${guildId}%`,
        });
    } else {
      qb.where('tunnel.creatorGuildId = :guildId', { guildId }).orWhere(
        'tunnel.connectedChannels LIKE :guildPattern',
        { guildPattern: `%${guildId}%` }
      );
    }

    const allTunnels = await qb.getMany();

    return allTunnels
      .filter(
        t =>
          // Org-owned tunnels are always visible to org members
          t.organizationId === organizationId ||
          // Guild-owned or guild-connected tunnels
          t.creatorGuildId === guildId ||
          t.connectedChannels.some(c => c.guildId === guildId)
      )
      .map(t => this.toTunnelInterface(t));
  }

  /**
   * Connect a channel to a tunnel
   */
  public async connectToTunnel(
    tunnelId: string,
    guildId: string,
    channelId: string,
    password?: string,
    guildName?: string,
    channelName?: string
  ): Promise<boolean> {
    this.ensureInitialized();

    // Include password in query to validate against it
    const tunnel = await this.getRepository()
      .createQueryBuilder('tunnel')
      .addSelect('tunnel.password')
      .where('tunnel.id = :id', { id: tunnelId })
      .getOne();

    if (!tunnel) {
      throw new Error('Tunnel not found');
    }

    // Check if password is required and correct
    if (tunnel.password) {
      if (!password) {
        throw new Error('Invalid password');
      }
      const passwordMatch = await bcrypt.compare(password, tunnel.password);
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }
    }

    // Check if already connected
    const alreadyConnected = tunnel.connectedChannels.some(
      c => c.guildId === guildId && c.channelId === channelId
    );

    if (alreadyConnected) {
      throw new Error('Channel already connected to this tunnel');
    }

    // Check max connected servers limit (0 = unlimited)
    if (
      tunnel.maxConnectedServers > 0 &&
      tunnel.connectedChannels.length >= tunnel.maxConnectedServers
    ) {
      throw new Error(
        `This tunnel has reached its maximum of ${tunnel.maxConnectedServers} connected servers`
      );
    }

    // Add connection
    tunnel.connectedChannels.push({
      guildId,
      channelId,
      guildName,
      channelName,
      connectedAt: new Date(),
    });

    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);

    logger.info(`Channel ${channelId} connected to tunnel ${tunnelId}`);
    return true;
  }

  /**
   * Disconnect a channel from a tunnel
   */
  public async disconnectFromTunnel(
    tunnelId: string,
    guildId: string,
    channelId: string
  ): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });

    if (!tunnel) {
      throw new Error('Tunnel not found');
    }

    const initialLength = tunnel.connectedChannels.length;
    tunnel.connectedChannels = tunnel.connectedChannels.filter(
      c => !(c.guildId === guildId && c.channelId === channelId)
    );

    // If no channels left, delete the tunnel
    if (tunnel.connectedChannels.length === 0) {
      await this.getRepository().delete(tunnelId);
      this.cache.delete(tunnelId);
      logger.info(`Tunnel ${tunnelId} deleted (no connections remaining)`);
      return true;
    }

    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);

    logger.info(`Channel ${channelId} disconnected from tunnel ${tunnelId}`);
    return tunnel.connectedChannels.length < initialLength;
  }

  /**
   * Delete a tunnel (creator only)
   */
  public async deleteTunnel(tunnelId: string, guildId: string): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });

    if (!tunnel) {
      throw new Error('Tunnel not found');
    }

    if (tunnel.creatorGuildId !== guildId) {
      throw new Error('Only the creator can delete this tunnel');
    }

    await this.getRepository().delete(tunnelId);
    this.cache.delete(tunnelId);

    logger.info(`Tunnel ${tunnelId} deleted by guild ${guildId}`);
    return true;
  }

  /**
   * Get all connected channels for a tunnel (excluding the source)
   */
  public getConnectedChannels(tunnelId: string, excludeChannelId?: string): TunnelConnection[] {
    const tunnel = this.cache.get(tunnelId);

    if (!tunnel) {
      return [];
    }

    if (excludeChannelId) {
      return tunnel.connectedChannels.filter(c => c.channelId !== excludeChannelId);
    }

    return tunnel.connectedChannels;
  }

  /**
   * Find the raw cached tunnel entity that owns a channel, or undefined.
   * Cache-only (synchronous); callers needing a DB fallback use the async variant.
   */
  private findCachedEntityByChannel(channelId: string): TunnelEntity | undefined {
    for (const tunnel of this.cache.values()) {
      if (tunnel.connectedChannels.some(c => c.channelId === channelId)) {
        return tunnel;
      }
    }
    return undefined;
  }

  /**
   * Find tunnel by channel (cache-first, DB fallback)
   */
  public findTunnelByChannel(channelId: string): Tunnel | undefined {
    const tunnel = this.findCachedEntityByChannel(channelId);
    return tunnel ? this.toTunnelInterface(tunnel) : undefined;
  }

  /**
   * Re-read a single tunnel from the DB and refresh its cache entry. Returns the fresh
   * entity, undefined if it was deleted elsewhere, or the existing cached copy on a
   * transient DB error (so relay degrades gracefully rather than dropping messages).
   */
  private async refreshTunnelFromDb(tunnelId: string): Promise<TunnelEntity | undefined> {
    try {
      const fresh = await this.getRepository().findOne({ where: { id: tunnelId } });
      if (fresh) {
        this.cacheTunnel(fresh);
        return fresh;
      }
      // Tunnel no longer exists (e.g. deleted on another shard) — drop it locally.
      this.cache.delete(tunnelId);
      this.cacheLoadedAt.delete(tunnelId);
      return undefined;
    } catch (error: unknown) {
      logger.error(`Failed to refresh tunnel ${tunnelId} from DB:`, error);
      return this.cache.get(tunnelId);
    }
  }

  /**
   * Find tunnel by channel with async DB fallback.
   * Use this when the cache may be cold (e.g. after a restart before initialize() completes).
   * The DB fallback is throttled to avoid repeated full-table scans for non-tunnel channels.
   */
  private lastCacheRefresh = 0;
  private static readonly CACHE_REFRESH_INTERVAL_MS = 30_000; // 30 seconds

  public async findTunnelByChannelAsync(channelId: string): Promise<Tunnel | undefined> {
    // Cache-first lookup.
    const cached = this.findCachedEntityByChannel(channelId);
    if (cached) {
      // The in-memory cache is per-process: each bot shard loads tunnels once at startup
      // and does not observe membership/webhook changes made on other shards. Trust a
      // cache hit only within the freshness window; once stale, re-read this tunnel from
      // the DB so relay targets reflect the current state. This is what lets a tunnel
      // resume propagating reliably after a period of inactivity.
      const loadedAt = this.cacheLoadedAt.get(cached.id) ?? 0;
      if (Date.now() - loadedAt < TunnelService.CACHE_FRESHNESS_MS) {
        return this.toTunnelInterface(cached);
      }
      const refreshed = await this.refreshTunnelFromDb(cached.id);
      return refreshed ? this.toTunnelInterface(refreshed) : undefined;
    }

    // Throttle DB fallback to avoid repeated full-table scans
    const now = Date.now();
    if (now - this.lastCacheRefresh < TunnelService.CACHE_REFRESH_INTERVAL_MS) {
      return undefined;
    }

    // DB fallback: reload all tunnels and re-populate cache
    try {
      this.lastCacheRefresh = now;
      // PERF-03: bounded keyset batches instead of an unbounded full-table scan.
      // Re-populate the whole cache and capture the first channel match in cursor
      // order without holding every tunnel in memory at once.
      let match: TunnelEntity | undefined;
      await findInBatches(this.getRepository(), {}, batch => {
        for (const tunnel of batch) {
          this.cacheTunnel(tunnel);
          if (!match && tunnel.connectedChannels.some(c => c.channelId === channelId)) {
            match = tunnel;
          }
        }
      });

      if (match) {
        return this.toTunnelInterface(match);
      }
    } catch (error: unknown) {
      logger.error('Failed to load tunnels from DB in findTunnelByChannelAsync:', error);
    }

    return undefined;
  }

  /**
   * Update webhook URL for a connection
   */
  public async updateWebhook(
    tunnelId: string,
    channelId: string,
    webhookUrl: string
  ): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });

    if (!tunnel) {
      return false;
    }

    const connection = tunnel.connectedChannels.find(c => c.channelId === channelId);

    if (connection) {
      connection.webhookUrl = webhookUrl;
      await this.getRepository().save(tunnel);
      this.cache.set(tunnelId, tunnel);
      return true;
    }

    return false;
  }

  /**
   * Update multiple tunnel fields in a single load-save cycle.
   * Prevents race conditions from multiple sequential findOne+save calls.
   */
  public async updateTunnel(
    tunnelId: string,
    updates: {
      name?: string;
      rateLimitConfig?: TunnelRateLimitConfig;
      contentFilterEnabled?: boolean;
      allowBotMessages?: boolean;
      maxConnectedServers?: number;
    }
  ): Promise<Tunnel | undefined> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return undefined;
    }

    // Build a partial update object with only the fields that were explicitly provided.
    // Using repository.update() ensures boolean `false` and numeric `0` are persisted
    // correctly (avoids potential issues with save() and column defaults).
    const setFields: Partial<TunnelEntity> = {};

    if (updates.name !== undefined) {
      setFields.name = updates.name;
    }
    if (updates.rateLimitConfig !== undefined) {
      setFields.rateLimitConfig = updates.rateLimitConfig;
    }
    if (updates.contentFilterEnabled !== undefined) {
      setFields.contentFilterEnabled = updates.contentFilterEnabled;
    }
    if (updates.allowBotMessages !== undefined) {
      setFields.allowBotMessages = updates.allowBotMessages;
    }
    if (updates.maxConnectedServers !== undefined) {
      setFields.maxConnectedServers = updates.maxConnectedServers;
    }

    if (Object.keys(setFields).length > 0) {
      await this.getRepository().update(tunnelId, setFields as Record<string, unknown>);
    }

    // Reload the entity to get the updated state
    const updated = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (updated) {
      this.cache.set(tunnelId, updated);
      return this.toTunnelInterface(updated);
    }

    return this.toTunnelInterface(tunnel);
  }

  /**
   * Update tunnel name
   */
  public async updateName(tunnelId: string, name: string): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    tunnel.name = name;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Set whether the tunnel is publicly listed.
   */
  public async setPublic(tunnelId: string, isPublic: boolean): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    tunnel.isPublic = isPublic;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Generate and store a fresh invite code for an existing tunnel.
   * Returns the new code, or null if the tunnel does not exist.
   */
  public async regenerateInviteCode(tunnelId: string): Promise<string | null> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return null;
    }

    const newCode = await this.generateInviteCode();
    tunnel.inviteCode = newCode;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return newCode;
  }

  /**
   * Update or clear the tunnel password. Pass `undefined` / empty string to clear.
   */
  public async setPassword(tunnelId: string, password?: string): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    if (password && password.length > 0) {
      tunnel.password = await bcrypt.hash(password, 10);
    } else {
      tunnel.password = undefined;
    }

    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Update rate limit configuration for a tunnel
   */
  public async updateRateLimitConfig(
    tunnelId: string,
    config: TunnelRateLimitConfig
  ): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    tunnel.rateLimitConfig = config;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Toggle content filter for a tunnel
   */
  public async toggleContentFilter(tunnelId: string, enabled: boolean): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    tunnel.contentFilterEnabled = enabled;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Get tunnel configuration
   */
  public getTunnelConfig(tunnelId: string): {
    rateLimitConfig?: TunnelRateLimitConfig;
    contentFilterEnabled: boolean;
  } {
    const tunnel = this.cache.get(tunnelId);
    if (!tunnel) {
      // Return default config for non-existent tunnel
      return {
        rateLimitConfig: undefined,
        contentFilterEnabled: false,
      };
    }

    return {
      rateLimitConfig: tunnel.rateLimitConfig,
      contentFilterEnabled: tunnel.contentFilterEnabled,
    };
  }

  /**
   * Refresh cache from database
   */
  public async refreshCache(): Promise<void> {
    this.ensureInitialized();

    // PERF-03: bounded keyset batches instead of an unbounded full-table scan.
    this.cache.clear();
    const tunnelCount = await findInBatches(this.getRepository(), {}, batch => {
      for (const tunnel of batch) {
        this.cache.set(tunnel.id, tunnel);
      }
    });
    logger.info(`TunnelService cache refreshed with ${tunnelCount} tunnels`);
  }

  /**
   * Generate unique tunnel ID as UUID (required by database schema)
   */
  private generateTunnelId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a unique 6-character alphanumeric invite code
   */
  private async generateInviteCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bytes = crypto.randomBytes(6);
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
      }

      // Check uniqueness
      const existing = await this.getRepository().findOne({ where: { inviteCode: code } });
      if (!existing) {
        return code;
      }
    }

    // Fallback: use longer code to guarantee uniqueness
    return crypto.randomBytes(8).toString('base64url').substring(0, 8);
  }

  /**
   * Convert entity to interface
   */
  private toTunnelInterface(entity: TunnelEntity): Tunnel {
    return {
      id: entity.id,
      name: entity.name,
      inviteCode: entity.inviteCode ?? undefined,
      creatorGuildId: entity.creatorGuildId,
      creatorChannelId: entity.creatorChannelId,
      isPublic: entity.isPublic,
      password: entity.password,
      createdAt: entity.createdAt,
      connectedChannels: entity.connectedChannels,
      rateLimitConfig: entity.rateLimitConfig,
      contentFilterEnabled: entity.contentFilterEnabled,
      allowBotMessages: entity.allowBotMessages,
      maxConnectedServers: entity.maxConnectedServers,
      organizationId: entity.organizationId ?? undefined,
    };
  }

  // ==================== ANALYTICS METHODS ====================

  /**
   * Record a message relay event for analytics
   */
  public recordMessageRelay(
    tunnelId: string,
    wasBlocked: boolean = false,
    userId?: string,
    hasAttachments: boolean = false
  ): void {
    const now = new Date();
    const hour = now.getHours();

    // Update hourly activity
    const currentHourCount = this.hourlyActivity.get(hour) ?? 0;
    this.hourlyActivity.set(hour, currentHourCount + 1);

    // Get or create analytics for this tunnel
    let analytics = this.analyticsData.get(tunnelId);
    if (!analytics) {
      const tunnel = this.cache.get(tunnelId);
      analytics = {
        tunnelId,
        messagesRelayed: 0,
        messagesBlocked: 0,
        lastActivity: null,
        peakConnectionCount: tunnel?.connectedChannels.length ?? 0,
        totalUniqueGuilds: this.getUniqueGuildCount(tunnelId),
        attachmentsRelayed: 0,
        reactionsRelayed: 0,
        uniqueUserIds: new Set<string>(),
      };
      this.analyticsData.set(tunnelId, analytics);
    }

    // Update analytics
    if (wasBlocked) {
      analytics.messagesBlocked++;
    } else {
      analytics.messagesRelayed++;
      if (hasAttachments) {
        analytics.attachmentsRelayed++;
      }
    }
    analytics.lastActivity = now;

    // Track unique user
    if (userId) {
      analytics.uniqueUserIds.add(userId);
    }

    // Update peak connection count if necessary
    const tunnel = this.cache.get(tunnelId);
    if (tunnel && tunnel.connectedChannels.length > analytics.peakConnectionCount) {
      analytics.peakConnectionCount = tunnel.connectedChannels.length;
    }
  }

  /**
   * Get analytics for a specific tunnel
   */
  public getTunnelAnalytics(tunnelId: string): TunnelAnalytics | null {
    const analytics = this.analyticsData.get(tunnelId);
    if (analytics) {
      return { ...analytics };
    }

    // Create empty analytics if tunnel exists but no data yet
    const tunnel = this.cache.get(tunnelId);
    if (tunnel) {
      return {
        tunnelId,
        messagesRelayed: 0,
        messagesBlocked: 0,
        lastActivity: null,
        peakConnectionCount: tunnel.connectedChannels.length,
        totalUniqueGuilds: this.getUniqueGuildCount(tunnelId),
        attachmentsRelayed: 0,
        reactionsRelayed: 0,
        uniqueUserIds: new Set<string>(),
      };
    }

    return null;
  }

  /**
   * Get system-wide tunnel statistics
   */
  public getSystemStats(): TunnelSystemStats {
    const tunnels = Array.from(this.cache.values());

    // Count by visibility
    let publicCount = 0;
    let privateCount = 0;
    let totalConnections = 0;

    for (const tunnel of tunnels) {
      if (tunnel.isPublic) {
        publicCount++;
      } else {
        privateCount++;
      }
      totalConnections += tunnel.connectedChannels.length;
    }

    // Calculate totals from analytics
    let totalMessagesRelayed = 0;
    let totalMessagesBlocked = 0;

    for (const analytics of this.analyticsData.values()) {
      totalMessagesRelayed += analytics.messagesRelayed;
      totalMessagesBlocked += analytics.messagesBlocked;
    }

    // Find most active hour
    let mostActiveHour = 0;
    let maxHourlyMessages = 0;
    for (const [hour, count] of this.hourlyActivity.entries()) {
      if (count > maxHourlyMessages) {
        maxHourlyMessages = count;
        mostActiveHour = hour;
      }
    }

    // Get top tunnels by activity
    const tunnelStats = tunnels.map(tunnel => {
      const analytics = this.analyticsData.get(tunnel.id);
      return {
        id: tunnel.id,
        name: tunnel.name,
        messagesRelayed: analytics?.messagesRelayed ?? 0,
        connectionCount: tunnel.connectedChannels.length,
      };
    });

    tunnelStats.sort((a, b) => b.messagesRelayed - a.messagesRelayed);
    const topTunnels = tunnelStats.slice(0, 10);

    // Count active tunnels (had activity in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let activeTunnels = 0;
    for (const analytics of this.analyticsData.values()) {
      if (analytics.lastActivity && analytics.lastActivity > oneDayAgo) {
        activeTunnels++;
      }
    }

    return {
      totalTunnels: tunnels.length,
      activeTunnels,
      totalConnections,
      totalMessagesRelayed,
      totalMessagesBlocked,
      mostActiveHour,
      tunnelsByVisibility: {
        public: publicCount,
        private: privateCount,
      },
      topTunnels,
    };
  }

  /**
   * Get hourly activity distribution
   */
  public getHourlyActivity(): Map<number, number> {
    return new Map(this.hourlyActivity);
  }

  /**
   * Reset analytics data (admin operation)
   */
  public resetAnalytics(): void {
    this.analyticsData.clear();
    for (let i = 0; i < 24; i++) {
      this.hourlyActivity.set(i, 0);
    }
    logger.info('Tunnel analytics reset');
  }

  /**
   * Get count of unique guilds for a tunnel
   */
  private getUniqueGuildCount(tunnelId: string): number {
    const tunnel = this.cache.get(tunnelId);
    if (!tunnel) {
      return 0;
    }

    const uniqueGuilds = new Set(tunnel.connectedChannels.map(c => c.guildId));
    return uniqueGuilds.size;
  }

  // ==================== INVITE CODE METHODS ====================

  /**
   * Find tunnel by invite code (for /tunnel link command)
   */
  public async findByInviteCode(code: string): Promise<Tunnel | undefined> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { inviteCode: code } });
    if (!tunnel) {
      return undefined;
    }

    this.cache.set(tunnel.id, tunnel);
    return this.toTunnelInterface(tunnel);
  }

  /**
   * Connect to a tunnel via invite code
   */
  public async connectByInviteCode(
    code: string,
    guildId: string,
    channelId: string,
    password?: string,
    guildName?: string,
    channelName?: string
  ): Promise<Tunnel> {
    const tunnel = await this.findByInviteCode(code);
    if (!tunnel) {
      throw new Error('Invalid invite code');
    }

    await this.connectToTunnel(tunnel.id, guildId, channelId, password, guildName, channelName);
    const updated = await this.getTunnel(tunnel.id);
    if (!updated) {
      throw new Error('Failed to retrieve tunnel after connecting');
    }
    return updated;
  }

  // ==================== MESSAGE PERSISTENCE METHODS ====================

  /**
   * Save a relayed message for history and audit
   */
  public async saveMessage(data: TunnelMessageData): Promise<void> {
    try {
      const repo = this.getMessageRepository();
      const entity = repo.create({
        tunnelId: data.tunnelId,
        authorId: data.authorId,
        authorName: data.authorName,
        authorAvatar: data.authorAvatar,
        sourceGuildId: data.sourceGuildId,
        sourceChannelId: data.sourceChannelId,
        discordMessageId: data.discordMessageId,
        content: data.content,
        attachments: data.attachments,
        embeds: data.embeds,
        stickerIds: data.stickerIds,
        replyToMessageId: data.replyToMessageId,
        isBot: data.isBot,
        wasBlocked: data.wasBlocked ?? false,
        blockReason: data.blockReason,
      });
      await repo.save(entity);
    } catch (error: unknown) {
      // Non-blocking: log but don't fail message relay
      logger.error('Failed to persist tunnel message:', error);
    }
  }

  /**
   * Get message history for a tunnel (paginated)
   */
  public async getMessageHistory(
    tunnelId: string,
    limit: number = 50,
    before?: Date
  ): Promise<TunnelMessageData[]> {
    this.ensureInitialized();

    const repo = this.getMessageRepository();
    const queryBuilder = repo
      .createQueryBuilder('msg')
      .where('msg.tunnelId = :tunnelId', { tunnelId })
      .andWhere('msg.wasBlocked = :blocked', { blocked: false });

    if (before) {
      queryBuilder.andWhere('msg.createdAt < :before', { before });
    }

    const messages = await queryBuilder
      .orderBy('msg.createdAt', 'DESC')
      .take(Math.min(limit, 100))
      .getMany();

    return messages.map(m => ({
      id: m.id,
      tunnelId: m.tunnelId,
      authorId: m.authorId,
      authorName: m.authorName,
      authorAvatar: m.authorAvatar,
      sourceGuildId: m.sourceGuildId,
      sourceChannelId: m.sourceChannelId,
      discordMessageId: m.discordMessageId,
      content: m.content,
      attachments: m.attachments,
      embeds: m.embeds,
      stickerIds: m.stickerIds,
      replyToMessageId: m.replyToMessageId,
      isBot: m.isBot,
      wasBlocked: m.wasBlocked,
      blockReason: m.blockReason,
      isEdited: m.isEdited,
      editedAt: m.editedAt,
      timestamp: m.createdAt,
    }));
  }

  /**
   * Find a persisted tunnel message by its original Discord message ID
   */
  public async findByDiscordMessageId(
    discordMessageId: string
  ): Promise<TunnelMessageEntity | null> {
    const repo = this.getMessageRepository();
    return repo.findOne({ where: { discordMessageId } });
  }

  /**
   * Mark a tunnel message as edited and update its content (single query)
   */
  public async updateMessageContent(discordMessageId: string, newContent: string): Promise<void> {
    const repo = this.getMessageRepository();
    await repo.update(
      { discordMessageId },
      { content: newContent, isEdited: true, editedAt: new Date() }
    );
  }

  // ---- Redis-based relay ID mapping (ephemeral, 1-hour TTL) ----

  /** Redis key prefix for discord→relay mapping (original → relayed copies) */
  private static readonly RELAY_KEY_PREFIX = 'tunnel:relay:';
  /** Redis key prefix for reverse mapping (relayed copy → original) */
  private static readonly RELAY_REVERSE_PREFIX = 'tunnel:relay-rev:';
  /** TTL in seconds — 1 hour covers Discord's practical edit window */
  private static readonly RELAY_TTL = 3600;

  /**
   * Store the relayed webhook message IDs for a Discord message in Redis.
   * Also stores reverse mappings so relayed copies can be traced back to the original.
   * Called after relaying to all connected channels.
   */
  public async storeRelayedMessageIds(
    discordMessageId: string,
    relayedIds: Record<string, string>,
    sourceChannelId?: string
  ): Promise<void> {
    if (Object.keys(relayedIds).length === 0) {
      return;
    }
    try {
      await cache.set(
        `${TunnelService.RELAY_KEY_PREFIX}${discordMessageId}`,
        relayedIds,
        TunnelService.RELAY_TTL
      );

      // Store reverse mappings: relayed message ID → { originalId, sourceChannelId }
      const reverseValue = { originalId: discordMessageId, sourceChannelId: sourceChannelId ?? '' };
      await Promise.all(
        Object.values(relayedIds).map(relayedMsgId =>
          cache.set(
            `${TunnelService.RELAY_REVERSE_PREFIX}${relayedMsgId}`,
            reverseValue,
            TunnelService.RELAY_TTL
          )
        )
      );
    } catch (error: unknown) {
      logger.error('Failed to store relay IDs in Redis:', error);
    }
  }

  /**
   * Retrieve the relayed webhook message IDs for a Discord message from Redis.
   * Returns null if expired or not found.
   */
  public async getRelayedMessageIds(
    discordMessageId: string
  ): Promise<Record<string, string> | null> {
    try {
      return await cache.get<Record<string, string>>(
        `${TunnelService.RELAY_KEY_PREFIX}${discordMessageId}`
      );
    } catch (error: unknown) {
      logger.error('Failed to get relay IDs from Redis:', error);
      return null;
    }
  }

  /**
   * Reverse-lookup: given a relayed webhook message ID, find the original
   * Discord message ID and the source channel. Returns null if not found.
   */
  public async getOriginalMessageId(
    relayedMessageId: string
  ): Promise<{ originalId: string; sourceChannelId: string } | null> {
    try {
      return await cache.get<{ originalId: string; sourceChannelId: string }>(
        `${TunnelService.RELAY_REVERSE_PREFIX}${relayedMessageId}`
      );
    } catch (error: unknown) {
      logger.error('Failed to get reverse relay ID from Redis:', error);
      return null;
    }
  }

  // ==================== MODERATION METHODS ====================

  /**
   * Ban a user from a tunnel
   */
  public async banUser(
    tunnelId: string,
    userId: string,
    username: string,
    reason: string,
    issuedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    const repo = this.getBanRepository();

    // Upsert: remove existing ban/mute first
    await repo.delete({ tunnelId, userId });

    const ban = repo.create({
      tunnelId,
      userId,
      username,
      type: 'ban' as TunnelBanType,
      reason,
      issuedBy,
      expiresAt,
    });
    await repo.save(ban);

    logger.info(`User ${userId} banned from tunnel ${tunnelId} by ${issuedBy}: ${reason}`);
  }

  /**
   * Mute a user in a tunnel (can still see messages, can't send)
   */
  public async muteUser(
    tunnelId: string,
    userId: string,
    username: string,
    reason: string,
    issuedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    const repo = this.getBanRepository();

    await repo.delete({ tunnelId, userId });

    const mute = repo.create({
      tunnelId,
      userId,
      username,
      type: 'mute' as TunnelBanType,
      reason,
      issuedBy,
      expiresAt,
    });
    await repo.save(mute);

    logger.info(`User ${userId} muted in tunnel ${tunnelId} by ${issuedBy}: ${reason}`);
  }

  /**
   * Remove ban/mute for a user in a tunnel
   */
  public async unbanUser(tunnelId: string, userId: string): Promise<boolean> {
    const repo = this.getBanRepository();
    const result = await repo.delete({ tunnelId, userId });
    const removed = (result.affected ?? 0) > 0;

    if (removed) {
      logger.info(`User ${userId} unbanned/unmuted from tunnel ${tunnelId}`);
    }
    return removed;
  }

  /**
   * Check if user is banned from a tunnel
   */
  public async isUserBanned(tunnelId: string, userId: string): Promise<boolean> {
    const repo = this.getBanRepository();
    const ban = await repo.findOne({
      where: { tunnelId, userId, type: 'ban' as TunnelBanType },
    });

    if (!ban) {
      return false;
    }

    // Check expiry
    if (ban.expiresAt && ban.expiresAt < new Date()) {
      await repo.delete({ id: ban.id });
      return false;
    }

    return true;
  }

  /**
   * Check if user is muted in a tunnel
   */
  public async isUserMuted(tunnelId: string, userId: string): Promise<boolean> {
    const repo = this.getBanRepository();
    const mute = await repo.findOne({
      where: { tunnelId, userId, type: 'mute' as TunnelBanType },
    });

    if (!mute) {
      return false;
    }

    // Check expiry
    if (mute.expiresAt && mute.expiresAt < new Date()) {
      await repo.delete({ id: mute.id });
      return false;
    }

    return true;
  }

  /**
   * List all bans/mutes for a tunnel
   */
  public async listBans(tunnelId: string): Promise<TunnelBanEntity[]> {
    const repo = this.getBanRepository();
    return repo.find({
      where: { tunnelId },
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== ANALYTICS PERSISTENCE METHODS ====================

  /**
   * Flush in-memory analytics to database (called periodically)
   */
  public async persistAnalytics(): Promise<void> {
    try {
      const repo = this.getAnalyticsRepository();
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setMinutes(0, 0, 0);

      const entries: TunnelAnalyticsEntry[] = [];

      for (const [tunnelId, analytics] of this.analyticsData.entries()) {
        if (analytics.messagesRelayed === 0 && analytics.messagesBlocked === 0) {
          continue;
        }

        const tunnel = this.cache.get(tunnelId);
        const entry = repo.create({
          tunnelId,
          periodStart,
          messagesRelayed: analytics.messagesRelayed,
          messagesBlocked: analytics.messagesBlocked,
          uniqueUsers: analytics.uniqueUserIds.size,
          peakConnections: tunnel?.connectedChannels.length ?? 0,
          attachmentsRelayed: analytics.attachmentsRelayed,
          reactionsRelayed: analytics.reactionsRelayed,
        });
        entries.push(entry);
      }

      if (entries.length > 0) {
        await repo.save(entries);
        logger.info(`Persisted analytics for ${entries.length} tunnels`);
      }

      // Reset in-memory counters after flush
      for (const analytics of this.analyticsData.values()) {
        analytics.messagesRelayed = 0;
        analytics.messagesBlocked = 0;
        analytics.attachmentsRelayed = 0;
        analytics.reactionsRelayed = 0;
        analytics.uniqueUserIds.clear();
      }
    } catch (error: unknown) {
      logger.error('Failed to persist tunnel analytics:', error);
    }
  }

  /**
   * Get persisted analytics for a tunnel over a time range
   */
  public async getPersistedAnalytics(
    tunnelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TunnelAnalyticsEntry[]> {
    const repo = this.getAnalyticsRepository();
    return repo
      .createQueryBuilder('a')
      .where('a.tunnelId = :tunnelId', { tunnelId })
      .andWhere('a.periodStart >= :startDate', { startDate })
      .andWhere('a.periodStart <= :endDate', { endDate })
      .orderBy('a.periodStart', 'ASC')
      .getMany();
  }

  // ==================== TUNNEL CONFIG METHODS ====================

  /**
   * Update max connected servers for a tunnel (admin config)
   */
  public async updateMaxConnectedServers(tunnelId: string, maxServers: number): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    tunnel.maxConnectedServers = maxServers;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Toggle bot message relay for a tunnel
   */
  public async toggleBotMessages(tunnelId: string, enabled: boolean): Promise<boolean> {
    this.ensureInitialized();

    const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
    if (!tunnel) {
      return false;
    }

    tunnel.allowBotMessages = enabled;
    await this.getRepository().save(tunnel);
    this.cache.set(tunnelId, tunnel);
    return true;
  }

  /**
   * Cleanup: stop analytics flush interval
   */
  public destroy(): void {
    if (this.analyticsFlushInterval) {
      clearInterval(this.analyticsFlushInterval);
      this.analyticsFlushInterval = null;
    }
  }
}

