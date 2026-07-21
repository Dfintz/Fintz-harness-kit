import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { ChannelType, Client, Guild, PermissionFlagsBits } from 'discord.js';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { DiscordGuildSettings, TeamVoiceSettings } from '../../models/DiscordGuildSettings';
import { TeamDiscordChannel } from '../../models/TeamDiscordChannel';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import {
  domainEvents,
  type TeamCreatedPayload,
  type TeamDeletedPayload,
  type TeamMemberAddedPayload,
  type TeamMemberRemovedPayload,
} from '../shared/DomainEventBus';

import { GuildOrganizationService } from './GuildOrganizationService';
import { teamVoiceAuditLogger } from './TeamVoiceAuditLogger';

/**
 * TeamVoiceService — Orchestrates Discord channel/role lifecycle for teams.
 *
 * Listens to team domain events and creates/manages Discord resources:
 * - Category channel per team (with text + voice channels inside)
 * - Discord role per team (assigned to team members for access)
 * - Permission overrides for visibility, listen-in, push-to-talk, priority speaker
 *
 * Settings are stored as `teamVoiceSettings` on DiscordGuildSettings (per-org-per-guild).
 */
export class TeamVoiceService {
  private static instance: TeamVoiceService;
  private client: Client | null = null;
  private channelRepository!: Repository<TeamDiscordChannel>;
  private settingsRepository!: Repository<DiscordGuildSettings>;
  private userRepository!: Repository<User>;
  private initialized = false;

  private readonly teamCreatedListener = (payload: TeamCreatedPayload): Promise<void> =>
    this.onTeamCreated(payload);

  private readonly teamDeletedListener = (payload: TeamDeletedPayload): Promise<void> =>
    this.onTeamDeleted(payload);

  private readonly teamMemberAddedListener = (payload: TeamMemberAddedPayload): Promise<void> =>
    this.onMemberAdded(payload);

  private readonly teamMemberRemovedListener = (payload: TeamMemberRemovedPayload): Promise<void> =>
    this.onMemberRemoved(payload);

  private constructor() {
    // Repositories initialised lazily in initialize()
  }

  public static getInstance(): TeamVoiceService {
    if (!TeamVoiceService.instance) {
      TeamVoiceService.instance = new TeamVoiceService();
    }
    return TeamVoiceService.instance;
  }

  /**
   * Initialise the service with the Discord.js client and register domain event listeners.
   * Called once during bot startup in botApp.ts.
   */
  public initialize(client: Client): void {
    if (this.initialized) {
      return;
    }

    this.client = client;

    if (AppDataSource.isInitialized) {
      this.channelRepository = AppDataSource.getRepository(TeamDiscordChannel);
      this.settingsRepository = AppDataSource.getRepository(DiscordGuildSettings);
      this.userRepository = AppDataSource.getRepository(User);
    }

    // Subscribe to team domain events
    domainEvents.on('team:created', this.teamCreatedListener);
    domainEvents.on('team:deleted', this.teamDeletedListener);
    domainEvents.on('team:member_added', this.teamMemberAddedListener);
    domainEvents.on('team:member_removed', this.teamMemberRemovedListener);

    this.initialized = true;
    logger.info('🎙️ TeamVoiceService initialized — listening for team domain events');
  }

  public shutdown(): void {
    if (!this.initialized) {
      return;
    }

    domainEvents.off('team:created', this.teamCreatedListener);
    domainEvents.off('team:deleted', this.teamDeletedListener);
    domainEvents.off('team:member_added', this.teamMemberAddedListener);
    domainEvents.off('team:member_removed', this.teamMemberRemovedListener);

    this.client = null;
    this.initialized = false;
    logger.info('🎙️ TeamVoiceService shut down');
  }

  // ==================== Domain Event Handlers ====================

  private async onTeamCreated(payload: TeamCreatedPayload): Promise<void> {
    try {
      const guilds = await GuildOrganizationService.getInstance().getGuildsForOrganization(
        payload.organizationId
      );

      for (const guildOrg of guilds) {
        const guildSettings = await this.getTeamVoiceSettings(
          payload.organizationId,
          guildOrg.guildId
        );
        if (!guildSettings?.enabled || !guildSettings.autoCreateOnTeamCreate) {
          continue;
        }

        await this.createTeamChannels(
          payload.organizationId,
          payload.teamId,
          guildOrg.guildId,
          payload.teamName,
          payload.createdBy ?? 'system'
        );
      }
    } catch (error: unknown) {
      logger.error('TeamVoiceService: Failed to handle team:created', { error, payload });
    }
  }

  private async onTeamDeleted(payload: TeamDeletedPayload): Promise<void> {
    try {
      const guilds = await GuildOrganizationService.getInstance().getGuildsForOrganization(
        payload.organizationId
      );

      // Only delete Discord channels if at least one guild has auto-delete enabled.
      let shouldDelete = false;
      for (const guildOrg of guilds) {
        const guildSettings = await this.getTeamVoiceSettings(
          payload.organizationId,
          guildOrg.guildId
        );
        if (guildSettings?.enabled && guildSettings.autoDeleteOnTeamDelete) {
          shouldDelete = true;
          break;
        }
      }

      if (shouldDelete) {
        await this.deleteTeamChannels(payload.organizationId, payload.teamId);
      }
    } catch (error: unknown) {
      logger.error('TeamVoiceService: Failed to handle team:deleted', { error, payload });
    }
  }

  private async onMemberAdded(payload: TeamMemberAddedPayload): Promise<void> {
    try {
      await this.addMemberToTeamChannels(
        payload.organizationId,
        payload.teamId,
        payload.userId,
        payload.role
      );
    } catch (error: unknown) {
      logger.error('TeamVoiceService: Failed to handle team:member_added', { error, payload });
    }
  }

  private async onMemberRemoved(payload: TeamMemberRemovedPayload): Promise<void> {
    try {
      await this.removeMemberFromTeamChannels(
        payload.organizationId,
        payload.teamId,
        payload.userId
      );
    } catch (error: unknown) {
      logger.error('TeamVoiceService: Failed to handle team:member_removed', { error, payload });
    }
  }

  // ==================== Channel Lifecycle ====================

  /**
   * Create a Discord category with text + voice channels and a team role for the given team.
   */
  async createTeamChannels(
    organizationId: string,
    teamId: string,
    guildId: string,
    teamNameRaw: string,
    createdBy: string
  ): Promise<TeamDiscordChannel | null> {
    const teamName = decodeHtmlEntities(teamNameRaw);
    if (!this.client) {
      logger.warn('TeamVoiceService: Client not initialised — cannot create channels');
      return null;
    }

    // Prevent duplicate (per team per guild)
    const existing = await this.channelRepository.findOne({
      where: { organizationId, teamId, guildId },
    });
    if (existing) {
      logger.info(
        `TeamVoiceService: Channels already exist for team ${teamId} in guild ${guildId} — skipping`
      );
      return existing;
    }

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      logger.warn(`TeamVoiceService: Guild ${guildId} not in cache — cannot create channels`);
      return null;
    }

    const settings = await this.getTeamVoiceSettings(organizationId, guildId);
    if (!settings) {
      return null;
    }

    try {
      // 1. Create team Discord role
      const teamRole = await guild.roles.create({
        name: `Team: ${teamName}`,
        reason: `Auto-created for team "${teamName}" voice integration`,
      });

      let category: { id: string } | null = null;
      let textChannel: { id: string } | null = null;
      let voiceChannel: { id: string } | null = null;

      try {
        // 2. Create category with permission overrides
        category = await guild.channels.create({
          name: `🎮 ${teamName}`,
          type: ChannelType.GuildCategory,
          parent: settings.parentCategoryId ?? undefined,
          permissionOverwrites: this.buildCategoryPermissions(guild, teamRole.id, settings),
          reason: `Team voice category for "${teamName}"`,
        });

        // 3. Create text channel under category (inherits category permissions)
        textChannel = await guild.channels.create({
          name: this.slugify(teamName),
          type: ChannelType.GuildText,
          parent: category.id,
          reason: `Team text channel for "${teamName}"`,
        });

        // 4. Create voice channel under category with specific voice permission overrides
        voiceChannel = await guild.channels.create({
          name: teamName,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: this.buildVoicePermissions(guild, teamRole.id, settings),
          reason: `Team voice channel for "${teamName}"`,
        });
      } catch (channelError: unknown) {
        // Rollback: clean up any resources created before the failure
        if (voiceChannel) {
          guild.channels.cache
            .get(voiceChannel.id)
            ?.delete('Rollback')
            .catch(() => {});
        }
        if (textChannel) {
          guild.channels.cache
            .get(textChannel.id)
            ?.delete('Rollback')
            .catch(() => {});
        }
        if (category) {
          guild.channels.cache
            .get(category.id)
            ?.delete('Rollback')
            .catch(() => {});
        }
        await teamRole.delete('Rollback — channel creation failed').catch(() => {});
        throw channelError;
      }

      // 5. Persist mapping
      const mapping = this.channelRepository.create({
        organizationId,
        teamId,
        guildId,
        categoryId: category.id,
        textChannelId: textChannel.id,
        voiceChannelId: voiceChannel.id,
        teamRoleId: teamRole.id,
        createdBy,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
      });
      await this.channelRepository.save(mapping);

      logger.info(
        `🎙️ Created team voice channels for "${teamName}" (team:${teamId}) in guild ${guild.name}`
      );

      teamVoiceAuditLogger.logChannelsCreated(organizationId, teamId, teamName, guildId, createdBy);

      return mapping;
    } catch (error: unknown) {
      logger.error(`TeamVoiceService: Failed to create channels for team ${teamId}`, {
        error,
        guildId,
        organizationId,
      });

      return null;
    }
  }

  /**
   * Delete all Discord channel resources for a team across all guilds.
   */
  async deleteTeamChannels(organizationId: string, teamId: string): Promise<void> {
    const mappings = await this.channelRepository.find({
      where: { organizationId, teamId },
    });

    for (const mapping of mappings) {
      await this.deleteTeamChannelResources(mapping);
    }
  }

  /**
   * Add a user to the team's Discord role and (optionally) priority speaker override.
   */
  async addMemberToTeamChannels(
    organizationId: string,
    teamId: string,
    userId: string,
    memberRole?: string
  ): Promise<void> {
    const mapping = await this.channelRepository.findOne({
      where: { organizationId, teamId },
    });
    if (!mapping || mapping.syncStatus === 'error') {
      return;
    }

    const discordId = await this.resolveDiscordId(userId);
    if (!discordId) {
      return;
    }

    const guild = this.client?.guilds.cache.get(mapping.guildId);
    if (!guild) {
      return;
    }

    try {
      const member = await guild.members.fetch(discordId);

      // Assign team role
      await member.roles.add(mapping.teamRoleId, 'Added to team');

      // If leader/officer and priority speaker is enabled, add per-user override
      const settings = await this.getTeamVoiceSettings(organizationId, mapping.guildId);
      if (
        settings?.enablePrioritySpeaker &&
        (memberRole === 'leader' || memberRole === 'officer')
      ) {
        const voiceChannel = guild.channels.cache.get(mapping.voiceChannelId);
        if (voiceChannel?.isVoiceBased()) {
          await voiceChannel.permissionOverwrites.edit(discordId, {
            PrioritySpeaker: true,
          });
        }
      }

      // Update sync timestamp
      await this.channelRepository.update(mapping.id, {
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      });

      logger.info(
        `🎙️ Added member ${userId} (discord:${discordId}) to team role ${mapping.teamRoleId}`
      );

      teamVoiceAuditLogger.logMemberAdded(organizationId, teamId, userId, memberRole);
    } catch (error: unknown) {
      logger.error(`TeamVoiceService: Failed to add member ${userId} to team channels`, {
        error,
        teamId,
      });
    }
  }

  /**
   * Remove a user from the team's Discord role and clean up any per-user overrides.
   */
  async removeMemberFromTeamChannels(
    organizationId: string,
    teamId: string,
    userId: string
  ): Promise<void> {
    const mapping = await this.channelRepository.findOne({
      where: { organizationId, teamId },
    });
    if (!mapping || mapping.syncStatus === 'error') {
      return;
    }

    const discordId = await this.resolveDiscordId(userId);
    if (!discordId) {
      return;
    }

    const guild = this.client?.guilds.cache.get(mapping.guildId);
    if (!guild) {
      return;
    }

    try {
      const member = await guild.members.fetch(discordId);

      // Remove team role
      await member.roles.remove(mapping.teamRoleId, 'Removed from team');

      // Remove any per-user voice channel overrides (priority speaker)
      const voiceChannel = guild.channels.cache.get(mapping.voiceChannelId);
      if (voiceChannel?.isVoiceBased()) {
        await voiceChannel.permissionOverwrites.delete(
          discordId,
          'Removed from team — cleaning up overrides'
        );
      }

      logger.info(
        `🎙️ Removed member ${userId} (discord:${discordId}) from team role ${mapping.teamRoleId}`
      );

      teamVoiceAuditLogger.logMemberRemoved(organizationId, teamId, userId);
    } catch (error: unknown) {
      logger.error(`TeamVoiceService: Failed to remove member ${userId} from team channels`, {
        error,
        teamId,
      });
    }
  }

  /**
   * Get all team channel mappings for an organization.
   */
  async getTeamChannelsByOrg(organizationId: string): Promise<TeamDiscordChannel[]> {
    return this.channelRepository.find({ where: { organizationId } });
  }

  /**
   * Get the team channel mapping for a specific team.
   */
  async getTeamChannel(organizationId: string, teamId: string): Promise<TeamDiscordChannel | null> {
    return this.channelRepository.findOne({ where: { organizationId, teamId } });
  }

  // ==================== Permission Builders ====================

  private buildCategoryPermissions(guild: Guild, teamRoleId: string, settings: TeamVoiceSettings) {
    const overwrites: Array<{
      id: string;
      allow?: bigint[];
      deny?: bigint[];
    }> = [
      // @everyone: deny view
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Team role: allow view
      {
        id: teamRoleId,
        allow: [PermissionFlagsBits.ViewChannel],
      },
    ];

    // Base access role: allow view only (see who's there, but not join)
    if (settings.allowBaseVisibility && settings.baseAccessRoleId) {
      overwrites.push({
        id: settings.baseAccessRoleId,
        allow: [PermissionFlagsBits.ViewChannel],
      });
    }

    return overwrites;
  }

  private buildVoicePermissions(guild: Guild, teamRoleId: string, settings: TeamVoiceSettings) {
    const overwrites: Array<{
      id: string;
      allow?: bigint[];
      deny?: bigint[];
    }> = [
      // @everyone: deny view + connect
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      },
      // Team role: connect + speak (+ push-to-talk enforcement if configured)
      {
        id: teamRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
        // Deny UseVAD (voice activity detection) to force push-to-talk
        ...(settings.enforcePushToTalk ? { deny: [PermissionFlagsBits.UseVAD] } : {}),
      },
    ];

    // Base access role: determines visibility and listen-in permissions
    if (settings.baseAccessRoleId) {
      if (settings.allowListenIn) {
        // Listen-in: can see channel, connect, but not speak
        overwrites.push({
          id: settings.baseAccessRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          deny: [PermissionFlagsBits.Speak],
        });
      } else if (settings.allowBaseVisibility) {
        // View only: can see who's in voice but cannot connect
        overwrites.push({
          id: settings.baseAccessRoleId,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect],
        });
      }
    }

    return overwrites;
  }

  // ==================== Helpers ====================

  private async getTeamVoiceSettings(
    organizationId: string,
    guildId?: string
  ): Promise<TeamVoiceSettings | null> {
    if (!AppDataSource.isInitialized) {
      return null;
    }

    const where: Record<string, unknown> = { organizationId };
    if (guildId) {
      where.guildId = guildId;
    }

    const settings = await this.settingsRepository.findOne({ where });
    return settings?.teamVoiceSettings ?? null;
  }

  private async resolveDiscordId(userId: string): Promise<string | null> {
    if (!AppDataSource.isInitialized) {
      return null;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.discordId) {
      logger.info(`TeamVoiceService: User ${userId} has no linked Discord account — skipping`);
      return null;
    }
    return user.discordId;
  }

  private async deleteTeamChannelResources(mapping: TeamDiscordChannel): Promise<void> {
    const guild = this.client?.guilds.cache.get(mapping.guildId);

    if (guild) {
      // Delete channels (voice, text, then category)
      for (const channelId of [mapping.voiceChannelId, mapping.textChannelId, mapping.categoryId]) {
        if (!channelId) {
          continue;
        }
        try {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            await channel.delete('Team deleted — cleaning up team voice channels');
          }
        } catch (error: unknown) {
          logger.warn(`TeamVoiceService: Failed to delete channel ${channelId}`, { error });
        }
      }

      // Delete role
      if (mapping.teamRoleId) {
        try {
          const role = guild.roles.cache.get(mapping.teamRoleId);
          if (role) {
            await role.delete('Team deleted — cleaning up team role');
          }
        } catch (error: unknown) {
          logger.warn(`TeamVoiceService: Failed to delete role ${mapping.teamRoleId}`, { error });
        }
      }
    }

    // Remove DB record
    await this.channelRepository.remove(mapping);

    teamVoiceAuditLogger.logChannelsDeleted(
      mapping.organizationId,
      mapping.teamId,
      mapping.guildId
    );
    logger.info(
      `🎙️ Deleted team voice channels for team ${mapping.teamId} in guild ${mapping.guildId}`
    );
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100);
  }
}

