import {
  Client,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  PermissionFlagsBits,
} from 'discord.js';

import { checkBotGuildPermissions } from '../../bot/utils/discord';
import { logger } from '../../utils/logger';

/**
 * Discord Scheduled Event Service
 *
 * Creates, updates, and deletes native Discord Scheduled Events
 * linked to platform Activities. When `createDiscordEvent` is enabled
 * in EventSettings, activities automatically appear in Discord's
 * calendar sidebar.
 */
export class DiscordEventService {
  private static instance: DiscordEventService;
  private client: Client | null = null;

  private constructor() {}

  static getInstance(): DiscordEventService {
    DiscordEventService.instance ??= new DiscordEventService();
    return DiscordEventService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
    logger.info('DiscordEventService initialized');
  }

  /**
   * Create a Discord Scheduled Event linked to an activity.
   * Returns the Discord event ID or null on failure.
   */
  async createEvent(
    guildId: string,
    activity: {
      title: string;
      description?: string;
      scheduledStartDate: Date;
      scheduledEndDate?: Date;
      location?: string;
      participantCount?: number;
      participantCap?: number;
    }
  ): Promise<string | null> {
    if (!this.client) {
      logger.warn('DiscordEventService: Client not initialized');
      return null;
    }

    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn(`DiscordEventService: Guild ${guildId} not found in cache`);
        return null;
      }

      if (!checkBotGuildPermissions(guild, PermissionFlagsBits.ManageEvents)) {
        logger.warn(`DiscordEventService: Missing ManageEvents permission in guild ${guildId}`);
        return null;
      }

      const startTime = new Date(activity.scheduledStartDate);
      // End time must be after start — default to 2 hours if not set
      const endTime = activity.scheduledEndDate
        ? new Date(activity.scheduledEndDate)
        : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      const summaryLine =
        activity.participantCount !== undefined
          ? `Participants: ${activity.participantCount}${
              activity.participantCap !== undefined ? ` / ${activity.participantCap}` : ''
            }`
          : '';

      const descriptionParts = [activity.description?.trim() ?? '', summaryLine].filter(Boolean);
      const fullDescription = descriptionParts.join('\n\n');

      const event = await guild.scheduledEvents.create({
        name: activity.title.substring(0, 100),
        description: fullDescription.substring(0, 1000) || undefined,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: {
          location: activity.location ?? 'Star Citizen',
        },
      });

      logger.info(
        `Created Discord event ${event.id} for activity "${activity.title}" in guild ${guildId}`
      );
      return event.id;
    } catch (error: unknown) {
      logger.error(`Failed to create Discord event in guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Update a Discord Scheduled Event.
   */
  async updateEvent(
    guildId: string,
    discordEventId: string,
    updates: {
      title?: string;
      description?: string;
      scheduledStartDate?: Date;
      scheduledEndDate?: Date;
      status?: 'active' | 'completed' | 'cancelled';
    }
  ): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return false;
      }

      if (!checkBotGuildPermissions(guild, PermissionFlagsBits.ManageEvents)) {
        logger.warn(`DiscordEventService: Missing ManageEvents permission in guild ${guildId}`);
        return false;
      }

      const event = await guild.scheduledEvents.fetch(discordEventId).catch(() => null);
      if (!event) {
        return false;
      }

      const editData: Record<string, unknown> = {};
      if (updates.title) {
        editData.name = updates.title.substring(0, 100);
      }
      if (updates.description !== undefined) {
        editData.description = updates.description.substring(0, 1000);
      }
      if (updates.scheduledStartDate) {
        editData.scheduledStartTime = new Date(updates.scheduledStartDate);
      }
      if (updates.scheduledEndDate) {
        editData.scheduledEndTime = new Date(updates.scheduledEndDate);
      }
      if (updates.status === 'completed') {
        editData.status = GuildScheduledEventStatus.Completed;
      }
      if (updates.status === 'cancelled') {
        editData.status = GuildScheduledEventStatus.Canceled;
      }

      await event.edit(editData);
      logger.info(`Updated Discord event ${discordEventId} in guild ${guildId}`);
      return true;
    } catch (error: unknown) {
      logger.error(`Failed to update Discord event ${discordEventId}:`, error);
      return false;
    }
  }

  /**
   * Delete a Discord Scheduled Event.
   */
  async deleteEvent(guildId: string, discordEventId: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return false;
      }

      if (!checkBotGuildPermissions(guild, PermissionFlagsBits.ManageEvents)) {
        logger.warn(`DiscordEventService: Missing ManageEvents permission in guild ${guildId}`);
        return false;
      }

      const event = await guild.scheduledEvents.fetch(discordEventId).catch(() => null);
      if (!event) {
        return true;
      } // Already gone

      await event.delete();
      logger.info(`Deleted Discord event ${discordEventId} in guild ${guildId}`);
      return true;
    } catch (error: unknown) {
      logger.error(`Failed to delete Discord event ${discordEventId}:`, error);
      return false;
    }
  }
}
