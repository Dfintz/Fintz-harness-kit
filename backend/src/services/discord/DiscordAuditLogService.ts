import {
  Client,
  ClientEvents,
  EmbedBuilder,
  GuildChannel,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  TextChannel,
} from 'discord.js';

import { AuditLogSettings } from '../../models/DiscordGuildSettings';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';

/**
 * Discord Audit Log Service
 *
 * Listens for guild events and posts formatted embeds to a configured log channel.
 * Respects per-guild toggle settings and ignored channel lists.
 */
export class DiscordAuditLogService {
  private static instance: DiscordAuditLogService;
  private client: Client | null = null;

  private readonly onMessageDelete = (message: Message | PartialMessage): void => {
    this.handleMessageDelete(message).catch(err =>
      logger.error('AuditLog messageDelete error:', err)
    );
  };

  private readonly onMessageUpdate = (
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ): void => {
    this.handleMessageEdit(oldMessage, newMessage).catch(err =>
      logger.error('AuditLog messageUpdate error:', err)
    );
  };

  private readonly onGuildMemberUpdate = (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ): void => {
    this.handleMemberUpdate(oldMember, newMember).catch(err =>
      logger.error('AuditLog guildMemberUpdate error:', err)
    );
  };

  private readonly onChannelCreate: (...args: ClientEvents['channelCreate']) => void = channel => {
    if (channel.isDMBased()) {
      return;
    }

    this.handleChannelCreate(channel as GuildChannel).catch(err =>
      logger.error('AuditLog channelCreate error:', err)
    );
  };

  private readonly onChannelDelete: (...args: ClientEvents['channelDelete']) => void = channel => {
    if (channel.isDMBased()) {
      return;
    }

    this.handleChannelDelete(channel as GuildChannel).catch(err =>
      logger.error('AuditLog channelDelete error:', err)
    );
  };

  private constructor() {}

  static getInstance(): DiscordAuditLogService {
    DiscordAuditLogService.instance ??= new DiscordAuditLogService();
    return DiscordAuditLogService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
    this.registerListeners();
    logger.info('DiscordAuditLogService initialized');
  }

  shutdown(): void {
    if (!this.client) {
      return;
    }

    this.client.off('messageDelete', this.onMessageDelete);
    this.client.off('messageUpdate', this.onMessageUpdate);
    this.client.off('guildMemberUpdate', this.onGuildMemberUpdate);
    this.client.off('channelCreate', this.onChannelCreate);
    this.client.off('channelDelete', this.onChannelDelete);

    this.client = null;
    logger.info('DiscordAuditLogService shut down');
  }

  private registerListeners(): void {
    if (!this.client) {
      return;
    }

    this.client.on('messageDelete', this.onMessageDelete);
    this.client.on('messageUpdate', this.onMessageUpdate);
    this.client.on('guildMemberUpdate', this.onGuildMemberUpdate);
    this.client.on('channelCreate', this.onChannelCreate);
    this.client.on('channelDelete', this.onChannelDelete);
  }

  // ── Event Handlers ──────────────────────────────────────────

  private async handleMessageDelete(message: Message | PartialMessage): Promise<void> {
    if (!message.guild || message.author?.bot) {
      return;
    }

    const settings = await this.getSettings(message.guild.id);
    if (!settings?.enabled || !settings.logMessageDeletes || !settings.logChannelId) {
      return;
    }
    if (settings.ignoredChannelIds?.includes(message.channel.id)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff5252)
      .setTitle('Message Deleted')
      .setDescription(
        `**Author:** ${message.author?.tag ?? 'Unknown'}\n` +
          `**Channel:** <#${message.channel.id}>\n` +
          `**Content:** ${(message.content ?? '*empty or not cached*').substring(0, 1000)}`
      )
      .setTimestamp();

    await this.postLog(
      message.guild.id,
      settings.logChannelId,
      embed,
      AuditEventType.DISCORD_MESSAGE_DELETED,
      {
        authorTag: message.author?.tag,
        channelId: message.channel.id,
      }
    );
  }

  private async handleMessageEdit(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ): Promise<void> {
    if (!newMessage.guild || newMessage.author?.bot) {
      return;
    }
    if (oldMessage.content === newMessage.content) {
      return;
    }

    const settings = await this.getSettings(newMessage.guild.id);
    if (!settings?.enabled || !settings.logMessageEdits || !settings.logChannelId) {
      return;
    }
    if (settings.ignoredChannelIds?.includes(newMessage.channel.id)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffab00)
      .setTitle('Message Edited')
      .setDescription(
        `**Author:** ${newMessage.author?.tag ?? 'Unknown'}\n` +
          `**Channel:** <#${newMessage.channel.id}>\n` +
          `**Before:** ${(oldMessage.content ?? '*not cached*').substring(0, 500)}\n` +
          `**After:** ${(newMessage.content ?? '*empty*').substring(0, 500)}`
      )
      .setTimestamp();

    await this.postLog(
      newMessage.guild.id,
      settings.logChannelId,
      embed,
      AuditEventType.DISCORD_MESSAGE_EDITED,
      {
        authorTag: newMessage.author?.tag,
        channelId: newMessage.channel.id,
      }
    );
  }

  private async handleMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ): Promise<void> {
    const settings = await this.getSettings(newMember.guild.id);
    if (!settings?.enabled || !settings.logRoleChanges || !settings.logChannelId) {
      return;
    }

    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());

    const added = [...newRoles].filter(r => !oldRoles.has(r));
    const removed = [...oldRoles].filter(r => !newRoles.has(r));

    if (added.length === 0 && removed.length === 0) {
      return;
    }

    const changes: string[] = [];
    for (const roleId of added) {
      changes.push(`+ <@&${roleId}>`);
    }
    for (const roleId of removed) {
      changes.push(`- <@&${roleId}>`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Role Changes')
      .setDescription(`**Member:** ${newMember.user.tag}\n` + `**Changes:**\n${changes.join('\n')}`)
      .setTimestamp();

    await this.postLog(
      newMember.guild.id,
      settings.logChannelId,
      embed,
      AuditEventType.DISCORD_ROLE_CHANGED,
      {
        memberTag: newMember.user.tag,
      }
    );
  }

  private async handleChannelCreate(channel: GuildChannel): Promise<void> {
    const settings = await this.getSettings(channel.guild.id);
    if (!settings?.enabled || !settings.logChannelChanges || !settings.logChannelId) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Channel Created')
      .setDescription(
        `**Name:** ${channel.name}\n` + `**Type:** ${channel.type}\n` + `**ID:** ${channel.id}`
      )
      .setTimestamp();

    await this.postLog(
      channel.guild.id,
      settings.logChannelId,
      embed,
      AuditEventType.DISCORD_CHANNEL_CREATED,
      {
        channelName: channel.name,
        channelType: channel.type,
      }
    );
  }

  private async handleChannelDelete(channel: GuildChannel): Promise<void> {
    const settings = await this.getSettings(channel.guild.id);
    if (!settings?.enabled || !settings.logChannelChanges || !settings.logChannelId) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff5252)
      .setTitle('Channel Deleted')
      .setDescription(
        `**Name:** ${channel.name}\n` + `**Type:** ${channel.type}\n` + `**ID:** ${channel.id}`
      )
      .setTimestamp();

    await this.postLog(
      channel.guild.id,
      settings.logChannelId,
      embed,
      AuditEventType.DISCORD_CHANNEL_DELETED,
      {
        channelName: channel.name,
        channelType: channel.type,
      }
    );
  }

  // ── Helpers ──────────────────────────────────────────

  private async getSettings(guildId: string): Promise<AuditLogSettings | null> {
    try {
      const service = new DiscordSettingsService();
      const allSettings = await service.getSettingsByGuildId(guildId);
      return allSettings?.[0]?.auditLogSettings ?? null;
    } catch {
      return null;
    }
  }

  private async postLog(
    guildId: string,
    channelId: string,
    embed: EmbedBuilder,
    auditEventType?: AuditEventType,
    auditDetails?: Record<string, unknown>
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    // Write to unified audit trail
    if (auditEventType) {
      logAuditEvent({
        eventType: auditEventType,
        message: embed.data.title ?? 'Discord audit event',
        resource: `discord/guild/${guildId}`,
        metadata: { guildId, ...auditDetails },
      });
    }

    try {
      const guild = this.client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send({ embeds: [embed] });
      }
    } catch (err: unknown) {
      logger.debug(`AuditLog: Failed to post log to ${channelId}: ${err}`);
    }
  }
}

