import { v4 as uuidv4 } from 'uuid';

import {
  ChannelUsageStats,
  VoiceActivityLog,
  VoiceChannel,
  VoiceChannelConfig,
  VoiceChannelTemplate,
  VoiceChannelType,
} from '../../../types';
import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/redis';

const REDIS_TEMPLATE_PREFIX = 'bot:voice:template:';
const REDIS_CONFIG_PREFIX = 'bot:voice:config:';
const REDIS_CHANNEL_PREFIX = 'bot:voice:channel:';

export class VoiceChannelService {
  private static instance: VoiceChannelService;
  private readonly channels: Map<string, VoiceChannel> = new Map();
  private readonly templates: Map<string, VoiceChannelTemplate> = new Map();
  private readonly configs: Map<string, VoiceChannelConfig> = new Map();
  private readonly stats: Map<string, ChannelUsageStats> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    this.initializeDefaultTemplates();
    this.startCleanupTask();
    this.loadFromRedis().catch(err =>
      logger.warn('VoiceChannelService: Failed to load persisted data from Redis', err)
    );
  }

  public static getInstance(): VoiceChannelService {
    if (!VoiceChannelService.instance) {
      VoiceChannelService.instance = new VoiceChannelService();
    }
    return VoiceChannelService.instance;
  }

  /**
   * Load persisted templates, configs, and channels from Redis
   */
  private async loadFromRedis(): Promise<void> {
    let totalLoaded = 0;

    // Load custom templates
    const templateKeys = await cache.keys(`${REDIS_TEMPLATE_PREFIX}*`);
    for (const key of templateKeys) {
      const data = await cache.get<VoiceChannelTemplate>(key);
      if (!data) {
        continue;
      }
      data.createdAt = new Date(data.createdAt);
      this.templates.set(data.id, data);
      totalLoaded++;
    }

    // Load guild configs
    const configKeys = await cache.keys(`${REDIS_CONFIG_PREFIX}*`);
    for (const key of configKeys) {
      const data = await cache.get<VoiceChannelConfig>(key);
      if (!data) {
        continue;
      }
      this.configs.set(data.guildId, data);
      totalLoaded++;
    }

    // Load channels
    const channelKeys = await cache.keys(`${REDIS_CHANNEL_PREFIX}*`);
    for (const key of channelKeys) {
      const data = await cache.get<VoiceChannel>(key);
      if (!data) {
        continue;
      }
      data.createdAt = new Date(data.createdAt);
      if (data.expiresAt) {
        data.expiresAt = new Date(data.expiresAt);
      }
      data.activityLogs = (data.activityLogs || []).map(log => ({
        ...log,
        timestamp: new Date(log.timestamp),
      }));
      this.channels.set(data.id, data);
      totalLoaded++;
    }

    if (totalLoaded > 0) {
      logger.info(`VoiceChannelService: Restored ${totalLoaded} items from Redis`);
    }
  }

  /**
   * Persist a channel to Redis
   */
  private async persistChannel(channel: VoiceChannel): Promise<void> {
    try {
      await cache.set(`${REDIS_CHANNEL_PREFIX}${channel.id}`, channel);
    } catch (err: unknown) {
      logger.warn('VoiceChannelService: Failed to persist channel to Redis', err);
    }
  }

  /**
   * Remove a channel from Redis
   */
  private async unpersistChannel(channelId: string): Promise<void> {
    try {
      await cache.del(`${REDIS_CHANNEL_PREFIX}${channelId}`);
    } catch (err: unknown) {
      logger.warn('VoiceChannelService: Failed to remove channel from Redis', err);
    }
  }

  /**
   * Persist a template to Redis (custom templates only, not system defaults)
   */
  private async persistTemplate(template: VoiceChannelTemplate): Promise<void> {
    if (template.createdBy === 'system') {
      return;
    }
    try {
      await cache.set(`${REDIS_TEMPLATE_PREFIX}${template.id}`, template);
    } catch (err: unknown) {
      logger.warn('VoiceChannelService: Failed to persist template to Redis', err);
    }
  }

  /**
   * Remove a template from Redis
   */
  private async unpersistTemplate(templateId: string): Promise<void> {
    try {
      await cache.del(`${REDIS_TEMPLATE_PREFIX}${templateId}`);
    } catch (err: unknown) {
      logger.warn('VoiceChannelService: Failed to remove template from Redis', err);
    }
  }

  /**
   * Persist guild config to Redis
   */
  private async persistConfig(config: VoiceChannelConfig): Promise<void> {
    try {
      await cache.set(`${REDIS_CONFIG_PREFIX}${config.guildId}`, config);
    } catch (err: unknown) {
      logger.warn('VoiceChannelService: Failed to persist config to Redis', err);
    }
  }

  /**
   * Create a voice channel
   */
  public createChannel(
    name: string,
    guildId: string,
    channelId: string,
    creatorId: string,
    type: VoiceChannelType,
    options?: {
      eventId?: string;
      expiresAt?: Date;
      userLimit?: number;
      templateId?: string;
    }
  ): VoiceChannel {
    const channel: VoiceChannel = {
      id: uuidv4(),
      name,
      guildId,
      channelId,
      type,
      creatorId,
      eventId: options?.eventId,
      createdAt: new Date(),
      expiresAt: options?.expiresAt,
      userLimit: options?.userLimit,
      isTemporary: type === VoiceChannelType.TEMPORARY || Boolean(options?.expiresAt),
      activityLogs: [],
      templateId: options?.templateId,
    };

    this.channels.set(channel.id, channel);
    this.persistChannel(channel).catch(() => {});
    return channel;
  }

  /**
   * Get a voice channel by ID
   */
  public getChannel(channelId: string): VoiceChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get channel by Discord channel ID
   */
  public getChannelByDiscordId(discordChannelId: string): VoiceChannel | undefined {
    return Array.from(this.channels.values()).find(
      channel => channel.channelId === discordChannelId
    );
  }

  /**
   * Get all channels for a guild
   */
  public getGuildChannels(guildId: string): VoiceChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.guildId === guildId);
  }

  /**
   * Get all channels for an event
   */
  public getEventChannels(eventId: string): VoiceChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.eventId === eventId);
  }

  /**
   * Get all temporary channels
   */
  public getTemporaryChannels(): VoiceChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.isTemporary);
  }

  /**
   * Get all expired channels
   */
  public getExpiredChannels(): VoiceChannel[] {
    const now = new Date();
    return Array.from(this.channels.values()).filter(
      channel => channel.expiresAt && channel.expiresAt <= now
    );
  }

  /**
   * Log voice activity
   */
  public logActivity(
    channelId: string,
    userId: string,
    userName: string,
    action: 'join' | 'leave' | 'move',
    guildId: string,
    channelName: string
  ): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      const log: VoiceActivityLog = {
        userId,
        userName,
        channelId: channel.channelId,
        channelName,
        guildId,
        action,
        timestamp: new Date(),
      };
      channel.activityLogs.push(log);
      this.persistChannel(channel).catch(() => {});
    }
  }

  /**
   * Get activity logs for a channel
   */
  public getActivityLogs(channelId: string): VoiceActivityLog[] {
    const channel = this.channels.get(channelId);
    return channel ? channel.activityLogs : [];
  }

  /**
   * Get activity logs for a guild
   */
  public getGuildActivityLogs(guildId: string): VoiceActivityLog[] {
    const logs: VoiceActivityLog[] = [];
    this.channels.forEach(channel => {
      if (channel.guildId === guildId) {
        logs.push(...channel.activityLogs);
      }
    });
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Delete a voice channel by internal UUID
   */
  public deleteChannel(channelId: string): boolean {
    const deleted = this.channels.delete(channelId);
    if (deleted) {
      this.unpersistChannel(channelId).catch(() => {});
    }
    return deleted;
  }

  /**
   * Delete a voice channel by its Discord channel ID
   */
  public deleteByDiscordId(discordChannelId: string): boolean {
    const channel = this.getChannelByDiscordId(discordChannelId);
    if (channel) {
      return this.deleteChannel(channel.id);
    }
    return false;
  }

  /**
   * Update channel expiration
   */
  public updateExpiration(channelId: string, expiresAt: Date | undefined): boolean {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.expiresAt = expiresAt;
      channel.isTemporary = Boolean(expiresAt) || channel.type === VoiceChannelType.TEMPORARY;
      this.persistChannel(channel).catch(() => {});
      return true;
    }
    return false;
  }

  /**
   * Update user limit
   */
  public updateUserLimit(channelId: string, userLimit: number | undefined): boolean {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.userLimit = userLimit;
      this.persistChannel(channel).catch(() => {});
      return true;
    }
    return false;
  }

  /**
   * Clean up expired channels
   */
  public cleanupExpiredChannels(): string[] {
    const expiredChannels = this.getExpiredChannels();
    const deletedIds: string[] = [];

    expiredChannels.forEach(channel => {
      this.deleteChannel(channel.id);
      deletedIds.push(channel.channelId);
    });

    return deletedIds;
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: VoiceChannelTemplate[] = [
      {
        id: 'default',
        name: 'Default Channel',
        description: 'Basic voice channel template',
        userLimit: 0,
        bitrate: 64000,
        autoDelete: true,
        autoDeleteDelay: 5,
        namingPattern: "{user}'s Channel",
        createdAt: new Date(),
        createdBy: 'system',
      },
      {
        id: 'gaming',
        name: 'Gaming Session',
        description: 'Optimized for gaming',
        userLimit: 10,
        bitrate: 96000,
        autoDelete: true,
        autoDeleteDelay: 10,
        namingPattern: "{user}'s Game",
        permissions: {
          canSpeak: true,
          canStream: true,
          canUseVoiceActivity: true,
          canPrioritySpeaker: false,
        },
        createdAt: new Date(),
        createdBy: 'system',
      },
      {
        id: 'meeting',
        name: 'Meeting Room',
        description: 'Professional meeting space',
        userLimit: 25,
        bitrate: 128000,
        autoDelete: true,
        autoDeleteDelay: 15,
        namingPattern: 'Meeting - {user}',
        permissions: {
          canSpeak: true,
          canStream: true,
          canUseVoiceActivity: false,
          canPrioritySpeaker: true,
        },
        createdAt: new Date(),
        createdBy: 'system',
      },
      {
        id: 'streaming',
        name: 'Stream Room',
        description: 'High quality for streaming',
        userLimit: 50,
        bitrate: 128000,
        autoDelete: true,
        autoDeleteDelay: 5,
        namingPattern: '{user} is Live!',
        permissions: {
          canSpeak: true,
          canStream: true,
          canUseVoiceActivity: true,
          canPrioritySpeaker: false,
        },
        createdAt: new Date(),
        createdBy: 'system',
      },
      {
        id: 'private',
        name: 'Private Room',
        description: 'Invite-only voice channel',
        userLimit: 5,
        bitrate: 96000,
        autoDelete: true,
        autoDeleteDelay: 2,
        namingPattern: "🔒 {user}'s Room",
        permissions: {
          canSpeak: true,
          canStream: false,
          canUseVoiceActivity: true,
          canPrioritySpeaker: false,
        },
        createdAt: new Date(),
        createdBy: 'system',
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });

    logger.info(`Initialized ${defaultTemplates.length} default voice channel templates`);
  }

  /**
   * Create a voice channel template
   */
  public createTemplate(
    template: Omit<VoiceChannelTemplate, 'id' | 'createdAt'>
  ): VoiceChannelTemplate {
    const id = `template-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const newTemplate: VoiceChannelTemplate = {
      ...template,
      id,
      createdAt: new Date(),
    };

    this.templates.set(id, newTemplate);
    this.persistTemplate(newTemplate).catch(() => {});
    logger.info(`Created voice channel template: ${newTemplate.name} (${id})`);
    return newTemplate;
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): VoiceChannelTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all templates
   */
  public listTemplates(): VoiceChannelTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Update template
   */
  public updateTemplate(templateId: string, updates: Partial<VoiceChannelTemplate>): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    Object.assign(template, updates);
    this.persistTemplate(template).catch(() => {});
    logger.info(`Updated voice channel template: ${templateId}`);
    return true;
  }

  /**
   * Delete template
   */
  public deleteTemplate(templateId: string): boolean {
    // Don't allow deleting system templates
    const template = this.templates.get(templateId);
    if (template?.createdBy === 'system') {
      logger.warn(`Cannot delete system template: ${templateId}`);
      return false;
    }

    const deleted = this.templates.delete(templateId);
    if (deleted) {
      this.unpersistTemplate(templateId).catch(() => {});
      logger.info(`Deleted voice channel template: ${templateId}`);
    }
    return deleted;
  }

  // ==================== CONFIGURATION MANAGEMENT ====================

  /**
   * Configure voice channels for a guild
   */
  public configureGuild(config: VoiceChannelConfig): void {
    this.configs.set(config.guildId, config);
    this.persistConfig(config).catch(() => {});
    logger.info(`Configured voice channels for guild ${config.guildId}`);
  }

  /**
   * Get guild configuration
   */
  public getGuildConfig(guildId: string): VoiceChannelConfig | undefined {
    return this.configs.get(guildId);
  }

  /**
   * Update guild configuration
   */
  public updateGuildConfig(guildId: string, updates: Partial<VoiceChannelConfig>): boolean {
    const config = this.configs.get(guildId);
    if (!config) {
      return false;
    }

    Object.assign(config, updates);
    this.persistConfig(config).catch(() => {});
    logger.info(`Updated voice channel config for guild ${guildId}`);
    return true;
  }

  // ==================== STATISTICS TRACKING ====================

  /**
   * Initialize stats for a channel
   */
  public initializeStats(channelId: string, guildId: string): void {
    if (!this.stats.has(channelId)) {
      this.stats.set(channelId, {
        channelId,
        guildId,
        totalSessions: 0,
        totalUsers: 0,
        totalDuration: 0,
        averageDuration: 0,
        peakUsers: 0,
        lastUsed: new Date(),
        userStats: new Map(),
      });
    }
  }

  /**
   * Track user session
   */
  public trackUserSession(
    channelId: string,
    userId: string,
    username: string,
    duration: number
  ): void {
    const stats = this.stats.get(channelId);
    if (!stats) {
      return;
    }

    stats.totalSessions++;
    stats.totalUsers++;
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.totalSessions;

    // Update user stats
    const userStat = stats.userStats.get(userId) || {
      userId,
      username,
      sessionCount: 0,
      totalTime: 0,
    };

    userStat.sessionCount++;
    userStat.totalTime += duration;
    stats.userStats.set(userId, userStat);

    logger.debug(
      `Tracked session for user ${username} in channel ${channelId}: ${duration} minutes`
    );
  }

  /**
   * Update peak users
   */
  public updatePeakUsers(channelId: string, userCount: number): void {
    const stats = this.stats.get(channelId);
    if (stats) {
      stats.peakUsers = Math.max(stats.peakUsers, userCount);
      stats.lastUsed = new Date();
    }
  }

  /**
   * Get channel statistics
   */
  public getChannelStats(channelId: string): ChannelUsageStats | undefined {
    return this.stats.get(channelId);
  }

  /**
   * Get guild statistics
   */
  public getGuildStats(guildId: string): ChannelUsageStats[] {
    return Array.from(this.stats.values()).filter(s => s.guildId === guildId);
  }

  /**
   * Get top channels by usage
   */
  public getTopChannels(guildId: string, limit: number = 10): ChannelUsageStats[] {
    return this.getGuildStats(guildId)
      .sort((a, b) => b.totalSessions - a.totalSessions)
      .slice(0, limit);
  }

  /**
   * Get top users by voice time
   */
  public getTopUsers(
    guildId: string,
    limit: number = 10
  ): Array<{
    userId: string;
    username: string;
    totalTime: number;
    sessionCount: number;
  }> {
    const userMap = new Map<
      string,
      {
        userId: string;
        username: string;
        totalTime: number;
        sessionCount: number;
      }
    >();

    this.getGuildStats(guildId).forEach(stats => {
      stats.userStats.forEach((userStat, userId) => {
        const existing = userMap.get(userId);
        if (existing) {
          existing.totalTime += userStat.totalTime;
          existing.sessionCount += userStat.sessionCount;
        } else {
          userMap.set(userId, {
            userId: userStat.userId,
            username: userStat.username,
            totalTime: userStat.totalTime,
            sessionCount: userStat.sessionCount,
          });
        }
      });
    });

    return Array.from(userMap.values())
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit);
  }

  // ==================== CUSTOMIZATION ====================

  /**
   * Customize channel
   */
  public customizeChannel(
    channelId: string,
    userId: string,
    customizations: {
      name?: string;
      userLimit?: number;
      bitrate?: number;
    }
  ): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    // Check ownership
    if (channel.creatorId !== userId) {
      throw new Error('Only the channel owner can customize it');
    }

    channel.customizations = customizations;
    this.persistChannel(channel).catch(() => {});
    logger.info(`Customized voice channel ${channelId}`);
    return true;
  }

  // ==================== CLEANUP TASKS ====================

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredChannels();
    }, 60000); // Run every minute
    this.cleanupInterval.unref();

    logger.info('Started voice channel cleanup task');
  }

  /**
   * Stop cleanup task
   */
  public stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Stopped voice channel cleanup task');
    }
  }

  /**
   * Get service statistics
   */
  public getServiceStats(): {
    totalTemplates: number;
    totalChannels: number;
    totalActiveChannels: number;
    totalGuilds: number;
    totalSessions: number;
  } {
    const totalSessions = Array.from(this.stats.values()).reduce(
      (sum, stat) => sum + stat.totalSessions,
      0
    );

    return {
      totalTemplates: this.templates.size,
      totalChannels: this.channels.size,
      totalActiveChannels: Array.from(this.channels.values()).filter(
        c => !c.expiresAt || c.expiresAt > new Date()
      ).length,
      totalGuilds: this.configs.size,
      totalSessions,
    };
  }
}
