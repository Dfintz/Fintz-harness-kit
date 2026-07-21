import { SystemRole, type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { Client, TextChannel, VoiceChannel } from 'discord.js';
import { Repository } from 'typeorm';

import { BotClientManager } from '../../bot/BotClientManager';
import {
  buildLfgButtons,
  buildLfgDmDoneButton,
  buildLfgDmRatingEmbed,
  buildLfgDmRatingRows,
  buildLfgEmbed,
} from '../../bot/embeds/lfgEmbed';
import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, ActivityType, ParticipantRole } from '../../models/Activity';
import { LFGGroupHistory } from '../../models/LFGGroupHistory';
import { LFGReputationRating } from '../../models/LFGReputationRating';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { LFGActivity, LFGPost } from '../../types';
import { logger } from '../../utils/logger';
import { ActivityService } from '../activity/ActivityService';
import { TenantService } from '../base/TenantService';

import { LFGSessionService, LFGSessionStatus, lfgSessionService } from './LFGSessionService';
// LFG/matchmaking + group-history DTOs live in a sibling module (E5 decomposition);
// imported back for internal use and re-exported so importers are unchanged.
import type {
  CreateGroupHistoryParams,
  GroupHistoryStats,
  LFGMatch,
  LFGPreferences,
  MatchCriteria,
} from './SocialGroupService.types';

export type {
  CreateGroupHistoryParams,
  GroupHistoryStats,
  LFGMatch,
  LFGPreferences,
  MatchCriteria
} from './SocialGroupService.types';

/**
 * Consolidated Social Group Service
 *
 * Merges functionality from:
 * - LFGService (Discord-based LFG posts)
 * - LFGGroupHistoryService (Session history tracking)
 * - ActivityLFGService (Database-persisted matchmaking)
 *
 * Provides unified interface for:
 * - Quick LFG posts (Discord, in-memory)
 * - Persistent group activities (Database)
 * - Session history and analytics
 * - Matchmaking and recommendations
 *
 * @author Phase 1 Consolidation - October 2025
 */
export class SocialGroupService extends TenantService<Activity> {
  private historyRepository: Repository<LFGGroupHistory>;
  private posts: LFGPost[] = [];
  private static instance: SocialGroupService;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly sessionService: LFGSessionService;

  constructor() {
    super(AppDataSource.getRepository(Activity));
    this.historyRepository = AppDataSource.getRepository(LFGGroupHistory);
    this.sessionService = lfgSessionService;

    // Start cleanup job for expired posts.
    this.cleanupInterval = setInterval(() => this.cleanupExpiredPosts(), 60000);
    // Prevent this timer from keeping process workers alive in test/runtime shutdown.
    this.cleanupInterval.unref();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SocialGroupService {
    if (!SocialGroupService.instance) {
      SocialGroupService.instance = new SocialGroupService();
    }
    return SocialGroupService.instance;
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  // ==================== LFG POST MANAGEMENT (Discord-based) ====================

  /**
   * Create a new LFG post
   */
  public createPost(
    activity: LFGActivity,
    description: string,
    creatorId: string,
    creatorName: string,
    maxPlayers: number,
    guildId: string,
    channelId: string,
    expirationMinutes: number = 60,
    options?: { voiceChannelId?: string; isAutoLfg?: boolean; game?: string; isPublic?: boolean }
  ): LFGPost {
    const id = `lfg-${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationMinutes * 60000);

    const post: LFGPost = {
      id,
      activity,
      description,
      creatorId,
      creatorName,
      currentPlayers: 1,
      maxPlayers,
      members: [creatorId],
      createdAt: now,
      expiresAt,
      guildId,
      channelId,
      voiceChannelId: options?.voiceChannelId,
      isAutoLfg: options?.isAutoLfg,
      status: 'open',
      game: options?.game,
      isPublic: options?.isPublic,
    };

    this.posts.push(post);

    // Always persist to Redis-backed session store so web UI can display Discord LFG groups
    const orgId = this.getOrganizationIdForGuild(guildId) ?? `discord-guild-${guildId}`;
    try {
      void this.sessionService.createSession({
        hostUserId: creatorId,
        organizationId: orgId,
        activityType: activity,
        title: `${activity}: ${description}`,
        description,
        maxPlayers,
        minPlayers: 1,
        metadata: { guildId, channelId, originatedFrom: 'discord-lfg', lfgPostId: id, creatorName },
        tags: ['lfg', activity.toLowerCase()],
        ttlSeconds: expirationMinutes * 60,
      });
    } catch (e: unknown) {
      logger.warn('Failed to persist LFG session to Redis', { error: String(e) });
    }
    return post;
  }

  /**
   * Get specific LFG post by ID
   */
  public getPost(postId: string): LFGPost | undefined {
    return this.posts.find(p => p.id === postId);
  }

  /**
   * Get all active LFG posts for a guild
   *
   * Uses the guild index in Redis for efficient lookup instead of scanning all keys.
   * Falls back to in-memory posts if Redis is unavailable.
   *
   * @param guildId The guild ID to filter posts
   * @returns Array of active LFG posts for the guild
   */
  public async getActivePostsByGuild(guildId: string): Promise<LFGPost[]> {
    const now = new Date();

    // Start with in-memory posts for this guild
    const inMemoryPosts = this.posts.filter(
      p => p.guildId === guildId && p.status !== 'closed' && p.expiresAt > now
    );

    // Try to load from Redis sessions using the guild index
    try {
      const guildSessions = await this.sessionService.getSessionsByGuild(guildId);

      if (!guildSessions || guildSessions.length === 0) {
        return inMemoryPosts;
      }

      const redisPosts: LFGPost[] = [];

      for (const session of guildSessions) {
        // Skip completed/cancelled sessions
        if (session.status === 'cancelled' || session.status === 'completed') {
          continue;
        }

        const postId = (session.metadata?.lfgPostId as string) || session.id;

        // Avoid duplicates with in-memory posts
        if (inMemoryPosts.some(p => p.id === postId)) {
          continue;
        }

        redisPosts.push({
          id: postId,
          activity: session.activityType as LFGActivity,
          description: session.description ?? session.title,
          creatorId: session.hostUserId,
          creatorName: (session.metadata?.creatorName as string) ?? '',
          currentPlayers: session.currentPlayers?.length ?? 1,
          maxPlayers: session.maxPlayers,
          members: session.currentPlayers ?? [session.hostUserId],
          createdAt: new Date(session.createdAt),
          expiresAt: new Date(session.expiresAt),
          guildId,
          channelId: (session.metadata?.channelId as string) ?? '',
          messageId: (session.metadata?.messageId as string) ?? undefined,
          status: session.status === 'open' ? 'open' : session.status === 'full' ? 'full' : 'open',
        });
      }

      // Hydrate in-memory store so joinPost/leavePost/closePost can find these
      // posts after a bot restart without requiring a full Redis-backed mutation layer.
      // The existing 60-second cleanupExpiredPosts interval will evict them when stale.
      this.hydrateFromRedis(redisPosts);

      // Merge and sort by creation time (newest first)
      return [...inMemoryPosts, ...redisPosts].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    } catch (e: unknown) {
      logger.warn('Failed to query Redis for LFG posts, using in-memory fallback', {
        error: e,
        guildId,
      });
      return inMemoryPosts;
    }
  }

  /**
   * Hydrate the in-memory post store with Redis-derived posts that are not yet tracked.
   * This is a deliberate write side-effect so that joinPost/leavePost/closePost
   * can find posts after a bot restart. The 60-second cleanupExpiredPosts interval
   * evicts stale entries automatically.
   */
  private hydrateFromRedis(redisPosts: LFGPost[]): void {
    for (const redisPost of redisPosts) {
      if (!this.posts.some(p => p.id === redisPost.id)) {
        this.posts.push(redisPost);
      }
    }
  }

  /**
   * Get all active LFG posts
   *
   * Uses LFGSessionService.findOpenSessions for efficient lookup.
   * Deduplicates by post ID to avoid returning the same post twice.
   *
   * @returns Array of all active LFG posts across all guilds
   */
  public async getAllActivePosts(): Promise<LFGPost[]> {
    const now = new Date();

    // Start with in-memory posts
    const inMemoryPosts = this.posts.filter(p => p.status !== 'closed' && p.expiresAt > now);

    try {
      const sessions = await this.sessionService.findOpenSessions({
        status: [LFGSessionStatus.OPEN, LFGSessionStatus.FULL, LFGSessionStatus.IN_PROGRESS],
      });

      if (!sessions || sessions.length === 0) {
        return inMemoryPosts;
      }

      const redisPosts: LFGPost[] = [];
      const seenIds = new Set<string>();

      // Track in-memory post IDs to avoid duplicates
      inMemoryPosts.forEach(p => seenIds.add(p.id));

      for (const session of sessions) {
        const postId = (session.metadata?.lfgPostId as string) || session.id;

        if (seenIds.has(postId)) {
          continue;
        }
        seenIds.add(postId);

        redisPosts.push({
          id: postId,
          activity: session.activityType as LFGActivity,
          description: session.description ?? session.title,
          creatorId: session.hostUserId,
          creatorName: (session.metadata?.creatorName as string) ?? '',
          currentPlayers: session.currentPlayers?.length ?? 1,
          maxPlayers: session.maxPlayers,
          members: session.currentPlayers ?? [session.hostUserId],
          createdAt: new Date(session.createdAt),
          expiresAt: new Date(session.expiresAt),
          guildId: (session.metadata?.guildId as string) ?? '',
          channelId: (session.metadata?.channelId as string) ?? '',
          messageId: (session.metadata?.messageId as string) ?? undefined,
          status: session.status === 'open' ? 'open' : session.status === 'full' ? 'full' : 'open',
        });
      }

      // Merge and sort by creation time (newest first)
      return [...inMemoryPosts, ...redisPosts].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    } catch (e: unknown) {
      logger.warn('Failed to query Redis for LFG posts, using in-memory fallback', { error: e });
      return inMemoryPosts;
    }
  }

  /**
   * Join an LFG post
   */
  public joinPost(postId: string, userId: string): LFGPost {
    const post = this.posts.find(p => p.id === postId);

    if (!post) {
      throw new Error('LFG post not found');
    }

    if (post.status === 'closed') {
      throw new Error('This LFG post is closed');
    }

    if (post.status === 'full') {
      throw new Error('This group is already full');
    }

    if (post.members.includes(userId)) {
      throw new Error('You are already in this group');
    }

    const now = new Date();
    if (post.expiresAt <= now) {
      throw new Error('This LFG post has expired');
    }

    post.members.push(userId);
    post.currentPlayers = post.members.length;

    if (post.currentPlayers >= post.maxPlayers) {
      post.status = 'full';
    }

    return post;
  }

  /**
   * Leave an LFG post
   */
  public leavePost(postId: string, userId: string): LFGPost {
    const post = this.posts.find(p => p.id === postId);

    if (!post) {
      throw new Error('LFG post not found');
    }

    if (!post.members.includes(userId)) {
      throw new Error('You are not in this group');
    }

    if (post.creatorId === userId) {
      throw new Error('Creator cannot leave. Use close instead');
    }

    post.members = post.members.filter(id => id !== userId);
    post.currentPlayers = post.members.length;

    if (post.status === 'full') {
      post.status = 'open';
    }

    return post;
  }

  /**
   * Close an LFG post
   */
  public closePost(postId: string, userId: string): LFGPost {
    const post = this.posts.find(p => p.id === postId);

    if (!post) {
      throw new Error('LFG post not found');
    }

    if (post.creatorId !== userId) {
      throw new Error('Only the creator can close this LFG post');
    }

    post.status = 'closed';

    // Also close the Redis-backed session so it doesn't reappear as active
    this.closeRedisSession(postId).catch((e: unknown) => {
      logger.debug('Failed to cancel Redis session for closed LFG post', {
        postId,
        error: String(e),
      });
    });

    // Clean up auto-created voice channel (fire-and-forget)
    if (post.autoCreatedVoiceChannel && post.voiceChannelId) {
      void this.deleteAutoCreatedVoiceChannel(post);
    }

    return post;
  }

  /**
   * Delete an LFG post
   */
  public deletePost(postId: string): void {
    const index = this.posts.findIndex(p => p.id === postId);
    if (index !== -1) {
      this.posts.splice(index, 1);
    }
  }

  /**
   * Set the Discord message ID for an LFG post and persist to Redis session metadata.
   * Called after the embed is sent to the channel.
   */
  public setMessageId(postId: string, messageId: string): void {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.messageId = messageId;
    }

    // Also persist to Redis session metadata so it survives bot restarts
    void this.persistMessageIdToRedis(postId, messageId);
  }

  /**
   * Persist the messageId to the Redis-backed session metadata.
   */
  private async persistMessageIdToRedis(postId: string, messageId: string): Promise<void> {
    try {
      const sessions = await this.sessionService.findOpenSessions({});
      const session = sessions.find(s => (s.metadata?.lfgPostId as string) === postId);
      if (session) {
        await this.sessionService.updateSession(session.id, {
          metadata: { ...session.metadata, messageId },
        });
      }
    } catch (e: unknown) {
      logger.debug('Failed to persist messageId to Redis session', {
        postId,
        error: String(e),
      });
    }
  }

  /**
   * Cancel the Redis-backed session for a closed LFG post so it doesn't
   * reappear as active when getActivePostsByGuild rehydrates from Redis.
   */
  private async closeRedisSession(postId: string): Promise<void> {
    const sessions = await this.sessionService.findOpenSessions({});
    const session = sessions.find(s => (s.metadata?.lfgPostId as string) === postId);
    if (session) {
      await this.sessionService.updateSession(session.id, {
        status: LFGSessionStatus.CANCELLED,
      });
    }
  }

  /**
   * Clear all posts (testing only)
   */
  public clearAllPosts(): void {
    this.posts = [];
  }

  /**
   * Non-breaking Phase 1 adapter for canonical participant shape.
   */
  static toParticipantInfo(
    userId: string,
    post: LFGPost,
    options?: { username?: string; displayName?: string }
  ): ParticipantInfo {
    const isInitiator = userId === post.creatorId;

    return {
      userId,
      organizationId: undefined,
      username: options?.username || (isInitiator ? post.creatorName : userId),
      displayName: options?.displayName || (isInitiator ? post.creatorName : undefined),
      roles: [isInitiator ? SystemRole.LFG_INITIATOR : SystemRole.LFG_MEMBER],
      primaryRole: isInitiator ? 'initiator' : 'member',
      status: post.status === 'closed' ? 'completed' : 'active',
      joinedAt: post.createdAt,
      source: 'manual',
      metadata: {
        lfgPostId: post.id,
        activity: post.activity,
        guildId: post.guildId,
        channelId: post.channelId,
      },
    };
  }

  toParticipantInfo(
    userId: string,
    post: LFGPost,
    options?: { username?: string; displayName?: string }
  ): ParticipantInfo {
    return SocialGroupService.toParticipantInfo(userId, post, options);
  }

  /**
   * Cleanup expired posts and remove their Discord messages.
   *
   * Flow:
   * 1. Expired open/full posts → mark as 'closed', edit embed to show expired state
   * 2. Closed posts older than 5 minutes past expiry → delete Discord message, remove from memory
   */
  private cleanupExpiredPosts(): void {
    const now = new Date();
    const beforeCount = this.posts.length;

    // Phase 1: Mark expired open/full posts as closed and update their embeds
    this.markExpiredPostsAsClosed(now);

    // Phase 2+3: Remove stale closed posts and clean up their Discord resources
    const postsToDelete = this.removeStaleClosedPosts(now);

    for (const post of postsToDelete) {
      if (post.messageId && post.channelId) {
        void this.deleteExpiredMessage(post);
      }
      if (post.autoCreatedVoiceChannel && post.voiceChannelId) {
        void this.deleteAutoCreatedVoiceChannel(post);
      }
    }

    const removedCount = beforeCount - this.posts.length;
    if (removedCount > 0) {
      logger.info(`🧹 Cleaned up ${removedCount} expired LFG posts`);
    }
  }

  /**
   * Mark expired open/full posts as closed and fire-and-forget edit their Discord embeds.
   *
   * Also handles two voice-channel-aware behaviours:
   * 1. **Empty VC → auto-close**: If the LFG voice channel has 0 members and at least
   *    5 minutes have passed since creation, close the post early.
   * 2. **Active VC → extend**: If the post is about to expire but the voice channel still
   *    has members, extend the expiry by 50% of the original duration (one extension only).
   */
  private markExpiredPostsAsClosed(now: Date): void {
    let client: Client | null | undefined;

    for (const post of this.posts) {
      if (post.status === 'closed') {
        continue;
      }

      // Voice-channel-aware logic for posts with auto-created VCs
      if (post.voiceChannelId && post.autoCreatedVoiceChannel) {
        // Lazily initialize Discord client only when a voice-channel-aware post exists.
        // This avoids creating bot runtime objects during idle timer ticks in tests.
        client ??= this.getDiscordClient();
        if (!client) {
          continue;
        }

        const vc = client.channels.cache.get(post.voiceChannelId);
        const vcMemberCount = vc instanceof VoiceChannel ? vc.members.size : -1;

        // Auto-close: VC exists but is empty and post is at least 5 min old
        if (vcMemberCount === 0 && now.getTime() - post.createdAt.getTime() >= 300_000) {
          logger.info('🔇 Auto-closing LFG post — voice channel is empty', {
            postId: post.id,
            activity: post.activity,
          });
          post.status = 'closed';
          // Record session history + DM rating prompts (idempotent, fire-and-forget)
          void this.finalizeClosedSession(post);
          // Delete both the embed message and the empty voice channel immediately
          if (post.messageId && post.channelId) {
            void this.deleteExpiredMessage(post);
          }
          void this.deleteAutoCreatedVoiceChannel(post);
          continue;
        }

        // Extend: post is about to expire but VC still has members — grant 50% more time (once)
        if (
          vcMemberCount > 0 &&
          post.expiresAt <= now &&
          !(post as LFGPost & { _extended?: boolean })._extended
        ) {
          const originalDurationMs = post.expiresAt.getTime() - post.createdAt.getTime();
          const extensionMs = Math.floor(originalDurationMs * 0.5);
          post.expiresAt = new Date(now.getTime() + extensionMs);
          (post as LFGPost & { _extended?: boolean })._extended = true;
          logger.info('⏱️ Extended LFG post — voice channel still active', {
            postId: post.id,
            extensionMinutes: Math.round(extensionMs / 60_000),
            newExpiry: post.expiresAt.toISOString(),
          });
          continue;
        }
      }

      // Standard expiry check
      if (post.expiresAt <= now) {
        post.status = 'closed';
        // Record session history + DM rating prompts (idempotent, fire-and-forget)
        void this.finalizeClosedSession(post);
        // Delete the embed message and voice channel immediately on expiry
        if (post.messageId && post.channelId) {
          void this.deleteExpiredMessage(post);
        }
        if (post.autoCreatedVoiceChannel && post.voiceChannelId) {
          void this.deleteAutoCreatedVoiceChannel(post);
        }
      }
    }
  }

  /**
   * Remove closed posts that have been expired for > 5 minutes and return them for resource cleanup.
   */
  private removeStaleClosedPosts(now: Date): LFGPost[] {
    const postsToDelete: LFGPost[] = [];

    this.posts = this.posts.filter(p => {
      if (p.status === 'closed') {
        const pastGrace = now.getTime() - p.expiresAt.getTime() >= 300000;
        if (pastGrace) {
          postsToDelete.push(p);
          return false;
        }
      }
      return true;
    });

    return postsToDelete;
  }

  /**
   * Edit a Discord LFG message to show the expired/closed state with disabled buttons.
   */
  private async editExpiredMessage(post: LFGPost): Promise<void> {
    try {
      const client = this.getDiscordClient();
      if (!client) {
        return;
      }

      const channel = await client.channels.fetch(post.channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        return;
      }

      const messageId = post.messageId;
      if (!messageId) {
        return;
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        return;
      }

      const embed = buildLfgEmbed(post);
      const buttons = buildLfgButtons(post.id, true);
      await message.edit({ embeds: [embed], components: [buttons] });
    } catch (error: unknown) {
      logger.debug('Failed to edit expired LFG message', {
        postId: post.id,
        messageId: post.messageId,
        error: String(error),
      });
    }
  }

  /**
   * Delete a Discord LFG message after the grace period.
   */
  private async deleteExpiredMessage(post: LFGPost): Promise<void> {
    try {
      const client = this.getDiscordClient();
      if (!client) {
        return;
      }

      const channel = await client.channels.fetch(post.channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        return;
      }

      const messageId = post.messageId;
      if (!messageId) {
        return;
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        return;
      }

      await message.delete();
      logger.debug('🗑️ Deleted expired LFG message', {
        postId: post.id,
        messageId: post.messageId,
      });
    } catch (error: unknown) {
      logger.debug('Failed to delete expired LFG message', {
        postId: post.id,
        messageId: post.messageId,
        error: String(error),
      });
    }
  }

  /**
   * Delete an auto-created LFG voice channel when the post expires or is closed.
   * Only deletes channels that were auto-created (not user's pre-existing VCs).
   */
  private async deleteAutoCreatedVoiceChannel(post: LFGPost): Promise<void> {
    try {
      const client = this.getDiscordClient();
      if (!client) {
        return;
      }

      const vcId = post.voiceChannelId;
      if (!vcId) {
        return;
      }

      const vc = await client.channels.fetch(vcId).catch(() => null);
      if (!vc) {
        return;
      }

      await vc.delete('LFG post expired — auto-created voice channel removed');
      logger.debug('🗑️ Deleted LFG voice channel', {
        postId: post.id,
        voiceChannelId: post.voiceChannelId,
      });
    } catch (error: unknown) {
      logger.debug('Failed to delete LFG voice channel', {
        postId: post.id,
        voiceChannelId: post.voiceChannelId,
        error: String(error),
      });
    }
  }

  /**
   * Get the Discord client from BotClientManager (null if bot is not running).
   */
  private getDiscordClient(): Client | null {
    try {
      return BotClientManager.getInstance().getClient();
    } catch {
      return null;
    }
  }

  /**
   * Finalize a closed LFG session: record history rows + DM rating prompts to participants.
   *
   * **Idempotent** — sets `_finalized` flag on the in-memory post so repeated cleanup ticks
   * (during the 5-minute grace period before eviction) only run this once. Safe to call from
   * both the manual close button and the auto-expiry/empty-VC cleanup paths.
   *
   * Skips entirely if `members.length <= 1` (solo posts produce no useful ratings).
   * All errors are caught and logged at debug/warn level — finalization must never throw
   * because callers are fire-and-forget.
   */
  async finalizeClosedSession(post: LFGPost): Promise<void> {
    const flagged = post as LFGPost & { _finalized?: boolean };
    if (flagged._finalized) {
      return;
    }
    flagged._finalized = true;

    if (post.members.length <= 1) {
      return;
    }

    try {
      // Step 1: Record session history rows (one per participant)
      const histories = await this.recordFromLFGPost(post, true);
      const sessionId = histories[0]?.id;
      if (!sessionId) {
        logger.warn('finalizeClosedSession: recordFromLFGPost returned no histories', {
          postId: post.id,
          memberCount: post.members.length,
        });
        return;
      }

      // Step 2: DM rating prompts to each participant
      const client = this.getDiscordClient();
      if (!client) {
        logger.debug('finalizeClosedSession: Discord client unavailable — skipping DM prompts', {
          postId: post.id,
          sessionId,
        });
        return;
      }

      // Best-effort guild lookup for display names (cache-first; fall back to userId)
      const guild = post.guildId ? (client.guilds.cache.get(post.guildId) ?? null) : null;

      const displayNameFor = async (userId: string): Promise<string> => {
        if (guild) {
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              return member.displayName || member.user.username;
            }
          } catch {
            // ignored — fall back to user fetch
          }
        }
        try {
          const user = await client.users.fetch(userId);
          return user.username;
        } catch {
          return userId;
        }
      };

      for (const memberId of post.members) {
        try {
          const recipient = await client.users.fetch(memberId);
          const otherIds = post.members.filter(id => id !== memberId).slice(0, 5);
          const targets = await Promise.all(
            otherIds.map(async id => ({
              userId: id,
              displayName: await displayNameFor(id),
            }))
          );

          if (targets.length === 0) {
            continue;
          }

          await recipient.send({
            embeds: [buildLfgDmRatingEmbed(post, sessionId)],
            components: [
              ...buildLfgDmRatingRows(sessionId, targets),
              buildLfgDmDoneButton(sessionId),
            ],
          });
        } catch (dmError: unknown) {
          // DMs disabled or user unreachable — non-fatal
          logger.debug('finalizeClosedSession: failed to DM rating prompt', {
            postId: post.id,
            sessionId,
            memberId,
            error: String(dmError),
          });
        }
      }
    } catch (error: unknown) {
      logger.error('finalizeClosedSession: failed to finalize LFG session', {
        postId: post.id,
        memberCount: post.members.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  // ==================== SESSION HISTORY ====================

  /**
   * Record completed LFG session
   */
  async recordSession(params: CreateGroupHistoryParams): Promise<LFGGroupHistory[]> {
    const records: LFGGroupHistory[] = [];

    for (const userId of params.participantIds) {
      const history = this.historyRepository.create({
        lfgPostId: params.lfgPostId,
        activity: params.activity,
        description: params.description,
        creatorId: params.creatorId,
        creatorName: params.creatorName,
        participantIds: params.participantIds,
        participantCount: params.participantIds.length,
        guildId: params.guildId,
        channelId: params.channelId,
        wasSuccessful: params.wasSuccessful,
        durationMinutes: params.durationMinutes,
        completionNotes: params.completionNotes,
        userId,
      });

      records.push(await this.historyRepository.save(history));
    }

    logger.info(
      `📝 Recorded ${records.length} LFG history entries for session ${params.lfgPostId}`
    );
    return records;
  }

  /**
   * Record session from LFG post
   */
  async recordFromLFGPost(
    post: LFGPost,
    wasSuccessful: boolean,
    durationMinutes?: number,
    completionNote?: string,
    submittedBy?: string
  ): Promise<LFGGroupHistory[]> {
    return this.recordSession({
      lfgPostId: post.id,
      activity: post.activity,
      description: post.description,
      creatorId: post.creatorId,
      creatorName: post.creatorName,
      participantIds: post.members,
      guildId: post.guildId,
      channelId: post.channelId,
      wasSuccessful,
      durationMinutes,
      completionNotes: completionNote
        ? {
            submittedBy: submittedBy || post.creatorId,
            note: completionNote,
            timestamp: new Date(),
          }
        : undefined,
    });
  }

  /**
   * Get user's LFG history
   */
  async getUserHistory(userId: string, limit: number = 50): Promise<LFGGroupHistory[]> {
    return this.historyRepository
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .orderBy('history.completedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get user's history for specific activity
   */
  async getUserHistoryByActivity(
    userId: string,
    activity: string,
    limit: number = 50
  ): Promise<LFGGroupHistory[]> {
    return this.historyRepository
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.activity = :activity', { activity })
      .orderBy('history.completedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<GroupHistoryStats> {
    const history = await this.getUserHistory(userId, 1000);

    if (history.length === 0) {
      return {
        totalSessions: 0,
        successfulSessions: 0,
        failedSessions: 0,
        successRate: 0,
        totalPlayersEncountered: 0,
      };
    }

    const successful = history.filter(h => h.wasSuccessful).length;
    const durationsWithData = history.filter(h => h.durationMinutes);
    const averageDuration =
      durationsWithData.length > 0
        ? durationsWithData.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) /
          durationsWithData.length
        : undefined;

    const activityCounts: { [key: string]: number } = {};
    history.forEach(h => {
      activityCounts[h.activity] = (activityCounts[h.activity] || 0) + 1;
    });
    const favoriteActivity = Object.entries(activityCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    const uniquePlayers = new Set<string>();
    history.forEach(h => {
      h.participantIds.forEach(id => {
        if (id !== userId) {
          uniquePlayers.add(id);
        }
      });
    });

    return {
      totalSessions: history.length,
      successfulSessions: successful,
      failedSessions: history.length - successful,
      successRate: Math.round((successful / history.length) * 100),
      averageDuration: averageDuration ? Math.round(averageDuration) : undefined,
      favoriteActivity,
      totalPlayersEncountered: uniquePlayers.size,
    };
  }

  /**
   * Get activity-specific stats for user
   */
  async getUserActivityStats(userId: string): Promise<{
    [activity: string]: {
      sessions: number;
      successful: number;
      averageRating: number;
    };
  }> {
    const history = await this.getUserHistory(userId, 1000);
    const activityStats: {
      [activity: string]: {
        sessions: number;
        successful: number;
        averageRating: number;
      };
    } = {};

    history.forEach(h => {
      if (!activityStats[h.activity]) {
        activityStats[h.activity] = {
          sessions: 0,
          successful: 0,
          averageRating: 0,
        };
      }

      activityStats[h.activity].sessions++;
      if (h.wasSuccessful) {
        activityStats[h.activity].successful++;
      }
    });

    Object.keys(activityStats).forEach(activity => {
      const stats = activityStats[activity];
      stats.averageRating = Math.round((stats.successful / stats.sessions) * 100);
    });

    return activityStats;
  }

  /**
   * Get recent sessions for guild
   */
  async getRecentSessions(guildId: string, limit: number = 20): Promise<LFGGroupHistory[]> {
    return this.historyRepository
      .createQueryBuilder('history')
      .where('history.guildId = :guildId', { guildId })
      .orderBy('history.completedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<LFGGroupHistory | null> {
    return this.historyRepository.findOne({ where: { id: sessionId } });
  }

  /**
   * Get shared sessions between two users
   */
  async getSharedSessions(
    userId1: string,
    userId2: string,
    limit: number = 50
  ): Promise<LFGGroupHistory[]> {
    const user1Sessions = await this.getUserHistory(userId1, 500);

    return user1Sessions
      .filter(session => session.participantIds.includes(userId2))
      .slice(0, limit);
  }

  /**
   * Find users who have played with `userId` across multiple sessions with mutual positive ratings.
   * Returns an array of { userId, sharedSessionCount, mutualPositive } objects sorted by session count.
   */
  async findFrequentPositiveMatches(
    userId: string,
    guildId: string,
    minSessions: number = 3
  ): Promise<Array<{ userId: string; sharedSessionCount: number; mutualPositive: boolean }>> {
    // 1. Get recent sessions for this user in this guild
    const sessions = await this.historyRepository.find({
      where: { userId, guildId },
      order: { completedAt: 'DESC' },
      take: 200,
    });

    // 2. Count co-occurrences per participant
    const coPlayCounts = new Map<string, number>();
    for (const session of sessions) {
      for (const participantId of session.participantIds) {
        if (participantId === userId) {
          continue;
        }
        coPlayCounts.set(participantId, (coPlayCounts.get(participantId) ?? 0) + 1);
      }
    }

    // 3. Filter to those exceeding the minimum sessions threshold
    const candidates = Array.from(coPlayCounts.entries())
      .filter(([, count]) => count >= minSessions)
      .sort(([, a], [, b]) => b - a);

    if (candidates.length === 0) {
      return [];
    }

    // 4. Check mutual positive ratings
    const ratingRepository = AppDataSource.getRepository(LFGReputationRating);
    const results: Array<{ userId: string; sharedSessionCount: number; mutualPositive: boolean }> =
      [];

    for (const [candidateId, sessionCount] of candidates) {
      // Rating from userId → candidateId (positive = overallRating ≥ 4)
      const ratingGiven = await ratingRepository.findOne({
        where: { userId: candidateId, raterId: userId, isPositive: true },
        order: { createdAt: 'DESC' },
      });
      // Rating from candidateId → userId
      const ratingReceived = await ratingRepository.findOne({
        where: { userId, raterId: candidateId, isPositive: true },
        order: { createdAt: 'DESC' },
      });

      results.push({
        userId: candidateId,
        sharedSessionCount: sessionCount,
        mutualPositive: !!(ratingGiven && ratingReceived),
      });
    }

    return results.filter(r => r.mutualPositive);
  }

  /**
   * Cleanup old history
   */
  async cleanupOldHistory(daysOld: number = 180): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.historyRepository
      .createQueryBuilder()
      .delete()
      .where('completedAt < :cutoff', { cutoff: cutoffDate })
      .execute();

    logger.info(`🧹 Cleaned up ${result.affected || 0} old LFG history records`);
    return result.affected || 0;
  }

  // ==================== PERSISTENT ACTIVITY MATCHMAKING ====================

  /**
   * Find matching activities for LFG
   */
  async findMatches(
    userId: string,
    preferences: LFGPreferences,
    criteria: MatchCriteria,
    organizationId?: string
  ): Promise<LFGMatch[]> {
    const query = this.repository
      .createQueryBuilder('activity')
      .where('activity.status = :status', { status: ActivityStatus.OPEN })
      .andWhere('activity.maxParticipants > 0');

    if (organizationId) {
      query.andWhere('activity.organizationId = :organizationId', { organizationId });
    }

    if (criteria.activityTypes.length > 0) {
      query.andWhere('activity.activityType IN (:...types)', { types: criteria.activityTypes });
    }

    if (criteria.location) {
      query.andWhere('activity.location = :location', { location: criteria.location });
    }

    if (criteria.timeRange) {
      query.andWhere('activity.scheduledStartDate BETWEEN :start AND :end', {
        start: criteria.timeRange.start,
        end: criteria.timeRange.end,
      });
    }

    const activities = await query.getMany();
    const matches: LFGMatch[] = [];

    for (const activity of activities) {
      const matchScore = this.calculateMatchScore(activity, preferences, criteria);

      if (matchScore > 0) {
        const participantCount = activity.currentParticipants ?? 0;
        // @ts-expect-error - Strict mode compatibility
        const availableSlots = activity.maxParticipants - participantCount;

        if (availableSlots > 0) {
          matches.push({
            activityId: activity.id,
            matchScore,
            reasons: this.getMatchReasons(activity, preferences, criteria),
            activity,
            availableSlots,
          });
        }
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate match score
   */
  private calculateMatchScore(
    activity: Activity,
    preferences: LFGPreferences,
    criteria: MatchCriteria
  ): number {
    let score = 50; // Base score

    // Activity type match
    if (criteria.activityTypes.includes(activity.activityType)) {
      score += 20;
    }

    // Skill level match
    const activitySkill = (activity.metadata as Record<string, unknown>)?.skillLevel;
    if (activitySkill === preferences.skillLevel) {
      score += 15;
    }

    // Voice requirement match
    if (activity.voiceChannelId && preferences.communicationPreference !== 'text') {
      score += 10;
    }

    // Group size preference
    if (criteria.groupSize) {
      const participants = activity.currentParticipants ?? 0;
      if (participants >= criteria.groupSize.min && participants <= criteria.groupSize.max) {
        score += 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get match reasons
   */
  private getMatchReasons(
    activity: Activity,
    preferences: LFGPreferences,
    criteria: MatchCriteria
  ): string[] {
    const reasons: string[] = [];

    if (criteria.activityTypes.includes(activity.activityType)) {
      reasons.push('Activity type matches your preferences');
    }

    if ((activity.metadata as Record<string, unknown>)?.skillLevel === preferences.skillLevel) {
      reasons.push('Skill level is a good match');
    }

    if (activity.voiceChannelId) {
      reasons.push('Voice channel available');
    }

    const participantCount = activity.currentParticipants ?? 0;
    if (criteria.groupSize && participantCount >= criteria.groupSize.min) {
      reasons.push('Group has enough members');
    }

    return reasons;
  }

  // ==================== LFG TO ACTIVITY CONVERSION ====================

  /**
   * Formalize LFG post into persistent Activity
   */
  public async formalizeToActivity(lfgPostId: string): Promise<Activity> {
    const post = this.getPost(lfgPostId);

    if (!post) {
      throw new Error('LFG post not found');
    }

    const activityService = new ActivityService();

    const orgId = this.getOrganizationIdForGuild(post.guildId);
    const activity = await activityService.createActivity('', {
      title: `${post.activity}: ${post.description}`,
      description: post.description,
      activityType: ActivityType.LFG,
      creatorId: post.creatorId,
      creatorName: post.creatorName,
      organizationId: orgId,
      scheduledStartDate: new Date(),
      estimatedDuration: Math.floor((post.expiresAt.getTime() - new Date().getTime()) / 60000),
      maxParticipants: post.maxPlayers,
      minParticipants: 1,
      tags: [post.activity.toLowerCase(), 'lfg', 'casual'],
      metadata: {
        lfgActivity: post.activity,
        quickJoin: true,
        originatedFromLFG: true,
        lfgPostId: post.id,
      },
    });

    // Add members as participants, enforcing active membership when organization context is available
    for (const memberId of post.members) {
      let canJoin = true;
      if (orgId) {
        try {
          const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
          const membership = await membershipRepo.findOne({
            where: { userId: memberId, organizationId: orgId, isActive: true },
          });
          canJoin = !!membership;
        } catch (err: unknown) {
          logger.warn('Membership check failed during formalizeToActivity', { err });
        }
      }

      if (canJoin) {
        await activityService.joinActivity(activity.id, {
          userId: memberId,
          userName: memberId === post.creatorId ? post.creatorName : 'LFG Member',
          role: memberId === post.creatorId ? ParticipantRole.LEADER : ParticipantRole.MEMBER,
        });
      }
    }

    await activityService.updateActivity(activity.id, {
      status: ActivityStatus.IN_PROGRESS,
    });

    logger.info(`LFG post ${lfgPostId} formalized to activity ${activity.id}`);
    return activity;
  }

  /**
   * Complete LFG session
   * @param lfgPostId - The ID of the LFG post to complete
   * @param wasSuccessful - Whether the session was successful
   * @param createActivityRecord - Whether to create a persistent Activity record
   * @param recordHistory - Whether to record session history (defaults to true)
   */
  public async completeLFG(
    lfgPostId: string,
    wasSuccessful: boolean,
    createActivityRecord: boolean = false,
    recordHistory: boolean = true
  ): Promise<void> {
    const post = this.getPost(lfgPostId);

    if (!post) {
      throw new Error('LFG post not found');
    }

    post.status = 'closed';

    // Calculate session duration
    const durationMinutes = Math.floor((new Date().getTime() - post.createdAt.getTime()) / 60000);

    // Record session history for all participants
    if (recordHistory) {
      try {
        await this.recordFromLFGPost(post, wasSuccessful, durationMinutes);
        logger.info(`Session history recorded for LFG ${lfgPostId}`);
      } catch (error: unknown) {
        logger.error(`Failed to record session history for LFG ${lfgPostId}:`, error);
      }
    }

    if (createActivityRecord) {
      const activityService = new ActivityService();
      const activity = await this.formalizeToActivity(lfgPostId);

      await activityService.completeActivity(activity.id, {
        submittedBy: post.creatorId,
        submittedAt: new Date(),
        outcome: wasSuccessful ? 'success' : 'failure',
        participantCount: post.members.length,
        duration: durationMinutes,
        creditsEarned: 0,
        reputationEarned: wasSuccessful ? 10 : 0,
        notableEvents: [`LFG ${post.activity} session`],
      });

      logger.info(`LFG post ${lfgPostId} completed and recorded as activity`);
    } else {
      logger.info(`LFG post ${lfgPostId} completed (no activity record)`);
    }
  }

  // ==================== TEAM CONVERSION ====================

  /**
   * Convert an LFG group into a persistent Team.
   * Follows the same pattern as formalizeToActivity — get post, create entity,
   * carry over members with org-membership checks, then close the post.
   */
  public async convertToTeam(
    lfgPostId: string,
    organizationId: string,
    teamName: string,
    teamType?: string
  ): Promise<{ teamId: string; memberCount: number }> {
    const post = this.getPost(lfgPostId);

    if (!post) {
      throw new Error('LFG post not found');
    }

    if (post.status === 'closed') {
      throw new Error('LFG post is already closed');
    }

    // Resolve org context (explicit param takes priority, else infer from guild)
    const orgId = organizationId || this.getOrganizationIdForGuild(post.guildId);
    if (!orgId) {
      throw new Error('Organization context required for team conversion');
    }

    const { TeamService } = await import('../team/TeamService');
    const teamService = new TeamService();

    // Create the team
    const team = await teamService.createTeam(orgId, {
      name: teamName,
      description: `Formed from LFG group: ${post.activity} — ${post.description}`,
      type: (teamType as 'squadron' | 'division' | 'crew' | 'platoon' | 'custom') || 'squadron',
    });

    // Filter members to those with active org membership
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const eligibleMembers: Array<{ userId: string; role: 'leader' | 'member' }> = [];

    for (const memberId of post.members) {
      try {
        const membership = await membershipRepo.findOne({
          where: { userId: memberId, organizationId: orgId, isActive: true },
        });
        if (membership) {
          eligibleMembers.push({
            userId: memberId,
            role: memberId === post.creatorId ? 'leader' : 'member',
          });
        }
      } catch (err: unknown) {
        logger.warn('Membership check failed during convertToTeam', { err, memberId });
      }
    }

    if (eligibleMembers.length > 0) {
      await teamService.bulkAddMembers(orgId, team.id, eligibleMembers);
    }

    // Close the LFG post
    post.status = 'closed';

    logger.info(`LFG post ${lfgPostId} converted to team ${team.id}`, {
      organizationId: orgId,
      memberCount: eligibleMembers.length,
    });

    return { teamId: team.id, memberCount: eligibleMembers.length };
  }

  /**
   * Create a team directly from a list of user IDs (no LFG post required).
   * Used by the team suggestion feature after frequent positive co-play detection.
   */
  public async convertToTeamFromUsers(
    guildId: string,
    memberIds: string[],
    teamName: string,
    leaderId: string,
    teamType?: string
  ): Promise<{ teamId: string; memberCount: number }> {
    const orgId = this.getOrganizationIdForGuild(guildId);
    if (!orgId) {
      throw new Error('Organization context required — no guild-to-org mapping found');
    }

    const { TeamService } = await import('../team/TeamService');
    const teamService = new TeamService();

    const team = await teamService.createTeam(orgId, {
      name: teamName,
      description: 'Formed from frequent positive LFG sessions together',
      type: (teamType as 'squadron' | 'division' | 'crew' | 'platoon' | 'custom') || 'squadron',
    });

    // Filter members to those with active org membership
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const eligibleMembers: Array<{ userId: string; role: 'leader' | 'member' }> = [];

    for (const memberId of memberIds) {
      try {
        const membership = await membershipRepo.findOne({
          where: { userId: memberId, organizationId: orgId, isActive: true },
        });
        if (membership) {
          eligibleMembers.push({
            userId: memberId,
            role: memberId === leaderId ? 'leader' : 'member',
          });
        }
      } catch (err: unknown) {
        logger.warn('Membership check failed during convertToTeamFromUsers', { err, memberId });
      }
    }

    if (eligibleMembers.length > 0) {
      await teamService.bulkAddMembers(orgId, team.id, eligibleMembers);
    }

    logger.info(`Team ${team.id} created from suggestion`, {
      organizationId: orgId,
      memberCount: eligibleMembers.length,
      guildId,
    });

    return { teamId: team.id, memberCount: eligibleMembers.length };
  }

  // ==================== ORGANIZATION CONTEXT ====================

  /**
   * Resolve organization ID for a Discord guild, if mapping exists.
   * Environment variable GUILD_ORG_MAP can provide JSON mapping: { "<guildId>": "<organizationId>" }
   */
  private getOrganizationIdForGuild(guildId: string | undefined): string | undefined {
    if (!guildId) {
      return undefined;
    }
    try {
      const raw = process.env.GUILD_ORG_MAP;
      if (!raw) {
        return undefined;
      }
      const map = JSON.parse(raw) as Record<string, string>;
      return map[guildId];
    } catch {
      return undefined;
    }
  }
}

