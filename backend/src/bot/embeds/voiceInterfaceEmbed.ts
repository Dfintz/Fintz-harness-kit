import { decodeHtmlEntities, type VoiceServerStatus } from '@sc-fleet-manager/shared-types';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';

/**
 * Builds the Voice Interface Message embed — posted inside auto-created voice channels.
 * Users click buttons instead of using slash commands to manage their temporary channel.
 *
 * Visual design: SC_BLUE branded embed with per-action button rows.
 * Mirrors the TempVoice "Interface Message" pattern while following our design system.
 */
export function buildVoiceInterfaceEmbed(
  channelName: string,
  creatorDisplayName: string
): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🎤 Voice Channel Controls')
    .setDescription(
      `Welcome to **${decodeHtmlEntities(channelName)}**!\n` +
        `Channel owner: **${decodeHtmlEntities(creatorDisplayName)}**\n\n` +
        `Use the buttons below to manage your channel.`
    )
    .addFields(
      {
        name: '🔒 Lock / Unlock',
        value: 'Control who can join your channel',
        inline: true,
      },
      {
        name: '✏️ Rename / 👥 Limit',
        value: 'Customise name and user cap',
        inline: true,
      },
      {
        name: '✅ Trust / 🚫 Block',
        value: 'Allow or deny specific users',
        inline: true,
      },
      {
        name: '🔓 Unblock / 🗑️ Delete',
        value: 'Remove blocks or delete channel',
        inline: true,
      }
    )
    .setFooter({ text: 'Only the channel owner can use these controls' })
    .setTimestamp()
    .build();
}

/**
 * Builds the primary control row (Lock, Unlock, Rename, Limit).
 * CustomId format: voice_iface_{action}_{channelId}
 */
export function buildVoiceControlButtons(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_iface_lock_${channelId}`)
      .setLabel('Lock')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_unlock_${channelId}`)
      .setLabel('Unlock')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔓'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_rename_${channelId}`)
      .setLabel('Rename')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_limit_${channelId}`)
      .setLabel('Limit')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥')
  );
}

/**
 * Builds the moderation row (Trust, Block, Claim ownership).
 * CustomId format: voice_iface_{action}_{channelId}
 */
export function buildVoiceModerationButtons(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_iface_trust_${channelId}`)
      .setLabel('Trust User')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_block_${channelId}`)
      .setLabel('Block User')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚫'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_claim_${channelId}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👑')
  );
}

/**
 * Builds the extended actions row (Unblock, Privacy, Kick, Delete).
 */
export function buildVoiceExtendedButtons(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_iface_unblock_${channelId}`)
      .setLabel('Unblock')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔓'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_privacy_${channelId}`)
      .setLabel('Privacy')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔐'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_kick_${channelId}`)
      .setLabel('Kick')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('👢'),
    new ButtonBuilder()
      .setCustomId(`voice_iface_delete_${channelId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
  );
}

export interface VoiceTemplateSummary {
  id: string;
  name: string;
  description: string;
  userLimit: number;
  bitrate: number;
  autoDelete: boolean;
  autoDeleteDelay: number;
}

export function buildVoiceTemplatesEmbed(templates: readonly VoiceTemplateSummary[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Available Voice Channel Templates')
    .setTimestamp();

  templates.forEach(template => {
    const autoDeleteText = template.autoDelete ? `${String(template.autoDeleteDelay)}min` : 'No';
    embed.addFields({
      name: `${template.name} (${template.id})`,
      value: [
        template.description,
        `Limit: ${template.userLimit === 0 ? 'Unlimited' : template.userLimit}`,
        `Bitrate: ${template.bitrate / 1000} kbps`,
        `Auto-Delete: ${autoDeleteText}`,
      ].join('\n'),
      inline: false,
    });
  });

  return embed;
}

export interface VoiceChannelCreatedSummary {
  channelName: string;
  templateName: string;
  channelId: string;
  userLimit?: number;
  bitrate: number;
  expiresAt?: Date;
}

export function buildVoiceChannelCreatedEmbed(summary: VoiceChannelCreatedSummary): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setDescription(
      `\u2705 Created **${summary.channelName}** from **${summary.templateName}** template`
    )
    .addFields(
      { name: 'Channel', value: `<#${summary.channelId}>`, inline: true },
      {
        name: 'User Limit',
        value:
          summary.userLimit === 0 || !summary.userLimit
            ? 'Unlimited'
            : summary.userLimit.toString(),
        inline: true,
      },
      { name: 'Bitrate', value: `${summary.bitrate / 1000} kbps`, inline: true }
    );

  if (summary.expiresAt) {
    embed.addFields({
      name: 'Auto-Delete',
      value: `<t:${Math.floor(summary.expiresAt.getTime() / 1000)}:R>`,
    });
  }

  return embed;
}

export interface VoiceAutoCreateConfiguredSummary {
  hubChannelId: string;
  parentCategoryId?: string;
  maxChannels: number;
}

export function buildVoiceAutoCreateConfiguredEmbed(
  summary: VoiceAutoCreateConfiguredSummary
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('\u2705 Voice Auto-Create Configured')
    .setDescription('Users who join the hub channel will get a temporary voice channel.')
    .addFields(
      { name: 'Hub Channel', value: `<#${summary.hubChannelId}>`, inline: true },
      {
        name: 'Category',
        value: summary.parentCategoryId ? `<#${summary.parentCategoryId}>` : 'Guild root',
        inline: true,
      },
      { name: 'Max Channels', value: `${summary.maxChannels}`, inline: true }
    )
    .setTimestamp();
}

interface PlatformConnectInfo {
  connectUrl?: string;
  serverType?: string;
  displayName?: string;
}

export function buildMumbleStatusEmbed(
  status: VoiceServerStatus | null,
  hasAccess: boolean,
  connectInfo: PlatformConnectInfo
): EmbedBuilder {
  const isOnline = status?.online ?? false;
  const displayName = connectInfo.displayName ?? 'Platform Voice Server';

  const embed = new EmbedBuilder()
    .setTitle(`🎧 ${displayName}`)
    .setColor(isOnline ? EmbedColors.SUCCESS : EmbedColors.ERROR)
    .setTimestamp();

  embed.addFields({
    name: 'Status',
    value: isOnline ? '🟢 **Online**' : '🔴 **Offline**',
    inline: true,
  });

  if (isOnline) {
    embed.addFields({
      name: 'Users',
      value: `**${status?.currentUsers ?? 0}** / ${status?.maxUsers ?? 0}`,
      inline: true,
    });
  }

  embed.addFields({
    name: 'Access',
    value: hasAccess ? '✅ You have access' : '⚠️ Federation membership required',
    inline: true,
  });

  if (status?.channels && status.channels.length > 0) {
    const channelLines = status.channels.slice(0, 10).map(ch => {
      const userCount = ch.users?.length ?? ch.userCount ?? 0;
      const users = userCount > 0 ? ` (${userCount} user${userCount !== 1 ? 's' : ''})` : '';
      return `📁 ${ch.name}${users}`;
    });
    embed.addFields({
      name: 'Channels',
      value: channelLines.join('\n') || 'No channels',
    });
  }

  if (connectInfo.connectUrl && isOnline && hasAccess) {
    embed.addFields({
      name: 'Connect',
      value: `\`${connectInfo.connectUrl}\``,
    });
  }

  embed.setFooter({
    text: `${connectInfo.serverType?.toUpperCase() ?? 'MUMBLE'} • Updated`,
  });

  return embed;
}

/**
 * Parses a voice interface button customId.
 * e.g. 'voice_iface_lock_123456789' → { action: 'lock', channelId: '123456789' }
 */
export type VoiceInterfaceAction =
  | 'lock'
  | 'unlock'
  | 'rename'
  | 'limit'
  | 'trust'
  | 'block'
  | 'claim'
  | 'unblock'
  | 'privacy'
  | 'kick'
  | 'delete';

export function parseVoiceInterfaceButtonId(customId: string): {
  action: VoiceInterfaceAction;
  channelId: string;
} | null {
  const match =
    /^voice_iface_(lock|unlock|rename|limit|trust|block|claim|unblock|privacy|kick|delete)_(.+)$/.exec(
      customId
    );
  if (!match) {
    return null;
  }
  return {
    action: match[1] as VoiceInterfaceAction,
    channelId: match[2],
  };
}
