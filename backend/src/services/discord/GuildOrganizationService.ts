import { Not, Repository } from 'typeorm';

import { BotClientManager } from '../../bot/BotClientManager';
import { AppDataSource } from '../../data-source';
import { GuildOrganization } from '../../models/GuildOrganization';
import { Organization } from '../../models/Organization';
import { logger } from '../../utils/logger';
import { EnhancedCacheService } from '../caching/EnhancedCacheService';
import { discordAuditLogger } from '../shared/DiscordAuditLogger';

/**
 * Service for managing Discord guild to organization mappings
 *
 * Handles:
 * - Creating and updating guild-org mappings
 * - Resolving organization from guild ID
 * - Managing multiple guilds per organization
 * - Auto-sync when Discord integration is connected
 * - Caching for improved performance
 */
export class GuildOrganizationService {
  private static instance: GuildOrganizationService;
  private readonly repository: Repository<GuildOrganization>;
  private readonly orgRepository: Repository<Organization>;
  private readonly cache: EnhancedCacheService;
  private readonly CACHE_PREFIX = 'guild-org:';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds for positive results
  // Negative results (no mapping) are cached only briefly so that a freshly-linked
  // guild becomes resolvable within seconds, even when the link was created on a
  // different process/replica that can't directly invalidate this instance's cache.
  private readonly NEGATIVE_CACHE_TTL = 30; // 30 seconds

  private constructor() {
    this.repository = AppDataSource.getRepository(GuildOrganization);
    this.orgRepository = AppDataSource.getRepository(Organization);
    this.cache = new EnhancedCacheService({
      stdTTL: this.CACHE_TTL,
      checkperiod: 600, // 10 minutes - balance between cleanup efficiency and performance
      maxKeys: 5000,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GuildOrganizationService {
    if (!GuildOrganizationService.instance) {
      GuildOrganizationService.instance = new GuildOrganizationService();
    }
    return GuildOrganizationService.instance;
  }

  /**
   * Create or update a guild-to-organization mapping
   *
   * @param guildId Discord guild ID
   * @param organizationId Organization ID
   * @param guildName Optional guild name
   * @param isPrimary Whether this is the primary guild for the org
   * @param createdBy User ID who created the mapping
   * @returns The created or updated mapping
   */
  async createOrUpdateMapping(
    guildId: string,
    organizationId: string,
    guildName?: string,
    isPrimary: boolean = true,
    createdBy?: string
  ): Promise<GuildOrganization> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if mapping already exists
      let mapping = await queryRunner.manager.findOne(GuildOrganization, {
        where: { guildId },
      });

      if (mapping) {
        // Update existing mapping
        mapping.organizationId = organizationId;
        mapping.guildName = guildName || mapping.guildName;
        mapping.isPrimary = isPrimary;
        mapping.isActive = true;
        mapping.deactivatedAt = undefined;
        mapping.deactivatedBy = undefined;

        logger.info(`Updated guild-to-org mapping: ${guildId} -> ${organizationId}`);
      } else {
        // Create new mapping
        mapping = queryRunner.manager.create(GuildOrganization, {
          guildId,
          organizationId,
          guildName,
          isPrimary,
          isActive: true,
          createdBy,
        });

        logger.info(`Created guild-to-org mapping: ${guildId} -> ${organizationId}`);
      }

      // If this is marked as primary, ensure no other guilds for this org are primary
      if (isPrimary) {
        await queryRunner.manager.update(
          GuildOrganization,
          {
            organizationId,
            guildId: Not(guildId),
            isPrimary: true,
          },
          { isPrimary: false }
        );
      }

      const savedMapping = await queryRunner.manager.save(mapping);
      await queryRunner.commitTransaction();

      // Invalidate cache for this guild
      this.invalidateGuildCache(guildId);

      // Audit guild link
      discordAuditLogger.logGuildLinked(
        organizationId,
        guildId,
        savedMapping.guildName,
        createdBy,
        savedMapping.isPrimary
      );

      return savedMapping;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Error creating/updating guild-org mapping:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Resolve organization ID from guild ID with caching
   *
   * @param guildId Discord guild ID
   * @returns Organization ID or null if not found
   */
  async resolveOrganization(guildId: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(guildId);

    try {
      // Check cache first
      const cached = this.cache.get<string | null>(cacheKey);
      if (cached !== undefined) {
        logger.debug(`Cache hit for guild: ${guildId}`);
        return cached;
      }

      // Cache miss - query database
      logger.debug(`Cache miss for guild: ${guildId}, querying database`);
      const mapping = await this.repository.findOne({
        where: {
          guildId,
          isActive: true,
        },
      });

      if (!mapping) {
        logger.debug(`No active mapping found for guild: ${guildId}`);
        // Cache the null result briefly to avoid repeated queries while still
        // allowing a freshly-created link to be picked up within ~30s.
        this.cache.set(cacheKey, null, { ttl: this.NEGATIVE_CACHE_TTL });
        return null;
      }

      // Cache the result
      this.cache.set(cacheKey, mapping.organizationId, { ttl: this.CACHE_TTL });
      return mapping.organizationId;
    } catch (error: unknown) {
      logger.error('Error resolving organization from guild:', error);
      return null;
    }
  }

  /**
   * Resolve organization ID with fallback to using guild ID as org ID
   * This maintains backward compatibility with existing code
   *
   * @param guildId Discord guild ID
   * @returns Organization ID (mapped or guild ID as fallback)
   */
  async resolveOrganizationWithFallback(guildId: string): Promise<string> {
    const organizationId = await this.resolveOrganization(guildId);

    if (!organizationId) {
      logger.warn(`No guild-org mapping found for guild ${guildId}. Cannot resolve organization.`);
      return guildId; // Fallback kept for backward compatibility but logged as warning
    }

    return organizationId;
  }

  /**
   * Get all guilds for an organization
   *
   * @param organizationId Organization ID
   * @param activeOnly Whether to return only active mappings
   * @returns Array of guild mappings
   */
  async getGuildsForOrganization(
    organizationId: string,
    activeOnly: boolean = true
  ): Promise<GuildOrganization[]> {
    try {
      const where: Record<string, unknown> = { organizationId };
      if (activeOnly) {
        where.isActive = true;
      }

      return await this.repository.find({
        where,
        order: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      });
    } catch (error: unknown) {
      logger.error('Error fetching guilds for organization:', error);
      return [];
    }
  }

  /**
   * Get the primary guild for an organization
   *
   * @param organizationId Organization ID
   * @returns Primary guild mapping or null
   */
  async getPrimaryGuildForOrganization(organizationId: string): Promise<GuildOrganization | null> {
    try {
      return await this.repository.findOne({
        where: {
          organizationId,
          isActive: true,
          isPrimary: true,
        },
      });
    } catch (error: unknown) {
      logger.error('Error fetching primary guild for organization:', error);
      return null;
    }
  }

  /**
   * Deactivate a guild mapping
   *
   * @param guildId Discord guild ID
   * @param userId User ID who is deactivating
   * @returns Whether deactivation was successful
   */
  async deactivateMapping(guildId: string, userId: string): Promise<boolean> {
    try {
      const mapping = await this.repository.findOne({
        where: { guildId },
      });

      if (!mapping) {
        logger.warn(`Cannot deactivate: mapping not found for guild ${guildId}`);
        return false;
      }

      const previousOrganizationId = mapping.organizationId;
      const previousGuildName = mapping.guildName;

      mapping.deactivate(userId);
      await this.repository.save(mapping);

      // Invalidate cache
      this.invalidateGuildCache(guildId);

      // Audit guild unlink
      discordAuditLogger.logGuildUnlinked(
        previousOrganizationId,
        guildId,
        previousGuildName,
        userId
      );

      logger.info(`Deactivated guild-to-org mapping: ${guildId}`);
      return true;
    } catch (error: unknown) {
      logger.error('Error deactivating guild mapping:', error);
      return false;
    }
  }

  /**
   * Auto-sync guild mapping when Discord integration is connected
   * This should be called when an organization connects their Discord server
   *
   * @param guildId Discord guild ID
   * @param organizationId Organization ID
   * @param guildName Guild name
   * @param userId User ID who is connecting
   */
  async syncOnDiscordConnection(
    guildId: string,
    organizationId: string,
    guildName: string,
    userId: string
  ): Promise<GuildOrganization> {
    logger.info(
      `Auto-syncing guild mapping on Discord connection: ${guildId} -> ${organizationId}`
    );

    // Check if org already has guilds
    const existingGuilds = await this.getGuildsForOrganization(organizationId);
    const isPrimary = existingGuilds.length === 0; // First guild is primary

    return this.createOrUpdateMapping(guildId, organizationId, guildName, isPrimary, userId);
  }

  /**
   * Check if a guild is mapped to any organization
   *
   * @param guildId Discord guild ID
   * @returns Whether the guild has an active mapping
   */
  async isMapped(guildId: string): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: {
          guildId,
          isActive: true,
        },
      });
      return count > 0;
    } catch (error: unknown) {
      logger.error('Error checking if guild is mapped:', error);
      return false;
    }
  }

  /**
   * Get mapping details for a guild
   *
   * @param guildId Discord guild ID
   * @returns Guild mapping or null
   */
  async getMapping(guildId: string): Promise<GuildOrganization | null> {
    try {
      return await this.repository.findOne({
        where: { guildId },
        relations: ['organization'],
      });
    } catch (error: unknown) {
      logger.error('Error fetching guild mapping:', error);
      return null;
    }
  }

  /**
   * Handle multi-org guilds scenario
   * In some cases, a guild might need to be shared across organizations
   * This returns all organizations associated with a guild
   *
   * @param guildId Discord guild ID
   * @returns Array of organization IDs
   */
  async getOrganizationsForGuild(guildId: string): Promise<string[]> {
    try {
      // Note: Current design enforces one guild -> one org via unique constraint
      // This method is here for future extensibility if we need to support
      // shared guilds. For now, it will return at most one organization.
      const mapping = await this.repository.findOne({
        where: {
          guildId,
          isActive: true,
        },
      });

      return mapping ? [mapping.organizationId] : [];
    } catch (error: unknown) {
      logger.error('Error fetching organizations for guild:', error);
      return [];
    }
  }

  /**
   * Fetch the real guild name from Discord API via the bot client.
   * Falls back to the provided fallback name if the bot is unavailable.
   */
  async fetchGuildName(guildId: string, fallback: string): Promise<string> {
    const info = await this.fetchGuildInfo(guildId);
    return info?.name ?? fallback;
  }

  /**
   * Fetch guild name and icon URL from Discord API via the bot client.
   * Returns null if the bot is unavailable or the guild cannot be fetched.
   */
  async fetchGuildInfo(guildId: string): Promise<{ name: string; iconUrl: string | null } | null> {
    try {
      const client = BotClientManager.getInstance().getClient();
      if (client.isReady()) {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          return {
            name: guild.name,
            iconUrl: guild.iconURL({ size: 128, extension: 'png' }) ?? null,
          };
        }
      }
    } catch (error: unknown) {
      logger.debug(`Could not fetch guild info from Discord API for ${guildId}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }

  /**
   * Get cache key for a guild ID
   *
   * @param guildId Discord guild ID
   * @returns Cache key
   */
  private getCacheKey(guildId: string): string {
    return `${this.CACHE_PREFIX}${guildId}`;
  }

  /**
   * Invalidate cache for a specific guild
   * Called when guild mapping is created, updated, or deactivated
   *
   * @param guildId Discord guild ID
   */
  private invalidateGuildCache(guildId: string): void {
    const cacheKey = this.getCacheKey(guildId);
    this.cache.del(cacheKey);
    logger.debug(`Invalidated cache for guild: ${guildId}`);
  }

  /**
   * Clear all cached guild-org mappings
   * Useful for bulk operations or maintenance
   */
  public clearCache(): void {
    this.cache.flushAll();
    logger.info('Cleared all guild-org mapping cache');
  }

  /**
   * Get cache metrics for monitoring
   *
   * @returns Cache metrics
   */
  public getCacheMetrics() {
    return this.cache.getMetrics();
  }
}

