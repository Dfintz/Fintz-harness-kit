import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

interface TunnelCreatedEmbedInput {
  tunnelName: string;
  tunnelId: string;
  isPublicFromPassword: boolean;
  inviteCode?: string;
}

interface TunnelInfoEmbedInput {
  tunnelName: string;
  tunnelId: string;
  isPublic: boolean;
  connectedChannelsCount: number;
  inviteCode?: string;
}

interface TunnelListEntry {
  id: string;
  name: string;
  isPublic: boolean;
  connectedChannelsCount: number;
}

interface AvailableTunnelsEmbedInput {
  guildTunnels: TunnelListEntry[];
  publicTunnels: TunnelListEntry[];
}

export function buildTunnelCreatedEmbed(input: Readonly<TunnelCreatedEmbedInput>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle('\u2705 Tunnel Created')
    .addFields(
      { name: 'Name', value: input.tunnelName, inline: true },
      { name: 'ID', value: `\`${input.tunnelId}\``, inline: true },
      { name: 'Public', value: input.isPublicFromPassword ? 'Yes' : 'No', inline: true }
    )
    .setTimestamp();

  if (input.inviteCode) {
    embed.addFields({ name: 'Invite Code', value: `\`${input.inviteCode}\``, inline: true });
  }

  return embed;
}

export function buildTunnelInfoEmbed(input: Readonly<TunnelInfoEmbedInput>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`\u{1F517} Tunnel: ${input.tunnelName}`)
    .addFields(
      { name: 'ID', value: `\`${input.tunnelId}\``, inline: true },
      { name: 'Public', value: input.isPublic ? 'Yes' : 'No', inline: true },
      { name: 'Connections', value: `${input.connectedChannelsCount}`, inline: true }
    )
    .setTimestamp();

  if (input.inviteCode) {
    embed.addFields({ name: 'Invite Code', value: `\`${input.inviteCode}\``, inline: true });
  }

  return embed;
}

export function buildAvailableTunnelsEmbed(
  input: Readonly<AvailableTunnelsEmbedInput>
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('\u{1F309} Available Tunnels')
    .setTimestamp();

  if (input.guildTunnels.length > 0) {
    const guildList = input.guildTunnels
      .map(t => {
        const icon = t.isPublic ? '\u{1F30D}' : '\u{1F512}';
        return `${icon} **${t.name}** (ID: \`${t.id}\`)\n   Connected: ${t.connectedChannelsCount} channels`;
      })
      .join('\n\n');

    embed.addFields({ name: "Your Server's Tunnels", value: guildList, inline: false });
  }

  const otherPublicTunnels = input.publicTunnels.filter(
    t => !input.guildTunnels.some(gt => gt.id === t.id)
  );

  if (otherPublicTunnels.length > 0) {
    const publicList = otherPublicTunnels
      .slice(0, 10)
      .map(
        t =>
          `\u{1F30D} **${t.name}** (ID: \`${t.id}\`)\n   Connected: ${t.connectedChannelsCount} channels`
      )
      .join('\n\n');

    embed.addFields({ name: 'Public Tunnels', value: publicList, inline: false });
  }

  if (input.guildTunnels.length === 0 && otherPublicTunnels.length === 0) {
    embed.setDescription('No tunnels available. Create one with `/commlink create`!');
  }

  return embed;
}
