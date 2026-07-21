import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';

import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { TunnelService } from '../../services/discord/TunnelService';
import {
  buildAvailableTunnelsEmbed,
  buildTunnelCreatedEmbed,
  buildTunnelInfoEmbed,
} from '../embeds/commlinkEmbeds';
import { buildPanelModal } from '../embeds/panelEmbed';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { buildCustomId, parseCustomId } from '../utils/customId';

import { BotCommand } from './types';

const tunnelService = TunnelService.getInstance();
const guildOrgService = GuildOrganizationService.getInstance();

const COMMLINK_PREFIX = 'commlink';

function buildCommlinkRenameModalCustomId(tunnelId: string): string {
  return buildCustomId(COMMLINK_PREFIX, 'rename', 'modal', tunnelId);
}

export function parseCommlinkRenameModalTunnelId(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== COMMLINK_PREFIX || parsed.action !== 'rename') {
    return null;
  }

  const [kind = '', tunnelId = ''] = parsed.params;
  if (kind !== 'modal' || tunnelId.length === 0) {
    return null;
  }

  return tunnelId;
}

function buildCommlinkPasswordModalCustomId(tunnelId: string): string {
  return buildCustomId(COMMLINK_PREFIX, 'password', 'modal', tunnelId);
}

export function parseCommlinkPasswordModalTunnelId(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== COMMLINK_PREFIX || parsed.action !== 'password') {
    return null;
  }

  const [kind = '', tunnelId = ''] = parsed.params;
  if (kind !== 'modal' || tunnelId.length === 0) {
    return null;
  }

  return tunnelId;
}

function buildCommlinkSettingsActionCustomId(tunnelId: string): string {
  return buildCustomId(COMMLINK_PREFIX, 'settings', 'action', tunnelId);
}

export function parseCommlinkSettingsActionTunnelId(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== COMMLINK_PREFIX || parsed.action !== 'settings') {
    return null;
  }

  const [kind = '', tunnelId = ''] = parsed.params;
  if (kind !== 'action' || tunnelId.length === 0) {
    return null;
  }

  return tunnelId;
}

export const commlink: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('commlink')
    .setDescription('Manage cross-server comm links')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'social',

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'commlink');
    if (!sub) {
      return;
    }

    switch (sub) {
      case 'list':
        await handleListFromBtn(interaction);
        break;
      case 'leave':
        await handleLeaveCmd(interaction);
        break;
      case 'link': {
        const modal = buildPanelModal('commlink_link_modal', 'Connect via Invite Code', [
          {
            customId: 'code',
            label: 'Invite Code',
            placeholder: 'Enter the invite code',
            style: 'short',
            required: true,
            maxLength: 64,
          },
        ]);
        await interaction.showModal(modal);
        break;
      }
      case 'create': {
        const modal = buildPanelModal('commlink_create_modal', 'Create Comm Link Tunnel', [
          {
            customId: 'name',
            label: 'Tunnel Name',
            placeholder: 'Enter a name for the tunnel',
            style: 'short',
            required: true,
            maxLength: 50,
          },
          {
            customId: 'password',
            label: 'Password (leave blank for public)',
            placeholder: 'Optional password for private tunnels',
            style: 'short',
            required: false,
            maxLength: 50,
          },
        ]);
        await interaction.showModal(modal);
        break;
      }
      case 'join':
      case 'info':
      case 'settings':
      case 'delete': {
        // Populate tunnel select from available tunnels
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const tunnels = await tunnelService.listGuildTunnels(interaction.guildId || '');

          if (tunnels.length > 0) {
            const options = tunnels.slice(0, 25).map(t => ({
              label: (t.name || 'Unnamed Tunnel').substring(0, 100),
              value: t.id,
              description:
                `${t.isPublic ? 'Public' : 'Private'} \u2022 ${t.connectedChannels?.length || 0} connections`.substring(
                  0,
                  100
                ),
            }));
            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`commlink_${sub}_select`)
                .setPlaceholder(`Select a tunnel to ${sub}...`)
                .addOptions(options)
            );
            const labels: Record<string, string> = {
              join: 'Select a tunnel to join:',
              info: 'Select a tunnel to view info:',
              settings: 'Select a tunnel to configure:',
              delete: 'Select a tunnel to delete:',
            };
            await interaction.editReply({
              content: labels[sub] || 'Select a tunnel:',
              components: [row],
            });
          } else {
            await interaction.editReply(
              'No tunnels found. Create one first with the Create Tunnel button.'
            );
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Failed to load tunnels';
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(`\u274c ${msg}`);
          } else {
            await interaction.reply({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
          }
        }
        break;
      }
      default:
        break;
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId } = interaction;

    if (customId === 'commlink_create_modal') {
      const name = interaction.fields.getTextInputValue('name').trim();
      const password = interaction.fields.getTextInputValue('password')?.trim() || undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const channel = interaction.channel as TextChannel;
        const tunnel = await tunnelService.createTunnel(
          name,
          interaction.guildId || '',
          channel.id,
          !password,
          password,
          {
            organizationId:
              (await guildOrgService.resolveOrganization(interaction.guildId || '')) ?? undefined,
            guildName: interaction.guild?.name,
            channelName: channel.name,
          }
        );

        const embed = buildTunnelCreatedEmbed({
          tunnelName: tunnel.name,
          tunnelId: tunnel.id,
          isPublicFromPassword: !password,
          inviteCode: tunnel.inviteCode,
        });

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to create tunnel';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_join_modal') {
      const tunnelId = interaction.fields.getTextInputValue('tunnelid').trim();
      const password = interaction.fields.getTextInputValue('password')?.trim() || undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const channel = interaction.channel as TextChannel;
        await tunnelService.connectToTunnel(
          tunnelId,
          interaction.guildId || '',
          channel.id,
          password,
          interaction.guild?.name,
          channel.name
        );
        await interaction.editReply(
          `\u2705 This channel is now connected to tunnel \`${tunnelId}\`.`
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to join tunnel';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_info_modal') {
      const tunnelId = interaction.fields.getTextInputValue('tunnelid').trim();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const tunnel = await tunnelService.getTunnel(tunnelId);
        if (!tunnel) {
          await interaction.editReply(`\u274c Tunnel \`${tunnelId}\` not found.`);
          return;
        }

        const embed = buildTunnelInfoEmbed({
          tunnelName: tunnel.name,
          tunnelId: tunnel.id,
          isPublic: tunnel.isPublic,
          connectedChannelsCount: tunnel.connectedChannels?.length || 0,
          inviteCode: tunnel.inviteCode,
        });

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to get tunnel info';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_delete_modal') {
      const tunnelId = interaction.fields.getTextInputValue('tunnelid').trim();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await tunnelService.deleteTunnel(tunnelId, interaction.guildId || '');
        await interaction.editReply(`\u2705 Tunnel \`${tunnelId}\` has been deleted.`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to delete tunnel';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_link_modal') {
      const code = interaction.fields.getTextInputValue('code').trim();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const channel = interaction.channel as TextChannel;
        const tunnel = await tunnelService.connectByInviteCode(
          code,
          interaction.guildId ?? '',
          channel.id,
          undefined,
          interaction.guild?.name,
          channel.name
        );
        await interaction.editReply(
          tunnel
            ? `\u2705 Connected to **${tunnel.name}** via invite code.`
            : '\u274c Invalid or expired invite code.'
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to connect via invite code';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else {
      const renameTunnelId = parseCommlinkRenameModalTunnelId(customId);
      if (renameTunnelId) {
        const name = interaction.fields.getTextInputValue('name').trim();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const ok = await tunnelService.updateName(renameTunnelId, name);
          await interaction.editReply(
            ok ? `\u2705 Tunnel renamed to **${name}**.` : '\u274c Tunnel not found.'
          );
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Failed to rename tunnel';
          await interaction.editReply(`\u274c ${msg}`);
        }
        return;
      }

      const passwordTunnelId = parseCommlinkPasswordModalTunnelId(customId);
      if (!passwordTunnelId) {
        return;
      }
      const password = interaction.fields.getTextInputValue('password')?.trim() || undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const ok = await tunnelService.setPassword(passwordTunnelId, password);
        if (!ok) {
          await interaction.editReply('\u274c Tunnel not found.');
          return;
        }
        await interaction.editReply(
          password
            ? '\u2705 Tunnel password updated.'
            : '\u2705 Tunnel password removed (now passwordless).'
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update password';
        await interaction.editReply(`\u274c ${msg}`);
      }
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    const { customId } = interaction;
    const tunnelId = interaction.values[0];

    if (customId === 'commlink_join_select') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const channel = interaction.channel as TextChannel;
        await tunnelService.connectToTunnel(
          tunnelId,
          interaction.guildId || '',
          channel.id,
          undefined,
          interaction.guild?.name,
          channel.name
        );
        await interaction.editReply(`\u2705 This channel is now connected to the tunnel.`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to join tunnel';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_info_select') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const tunnel = await tunnelService.getTunnel(tunnelId);
        if (!tunnel) {
          await interaction.editReply('\u274c Tunnel not found.');
          return;
        }
        const embed = buildTunnelInfoEmbed({
          tunnelName: tunnel.name,
          tunnelId: tunnel.id,
          isPublic: tunnel.isPublic,
          connectedChannelsCount: tunnel.connectedChannels?.length || 0,
          inviteCode: tunnel.inviteCode,
        });
        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to get tunnel info';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_delete_select') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await tunnelService.deleteTunnel(tunnelId, interaction.guildId || '');
        await interaction.editReply('\u2705 Tunnel has been deleted.');
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to delete tunnel';
        await interaction.editReply(`\u274c ${msg}`);
      }
    } else if (customId === 'commlink_settings_select') {
      // Step 1 of settings: user picked a tunnel; now show action menu
      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(buildCommlinkSettingsActionCustomId(tunnelId))
          .setPlaceholder('Choose an action...')
          .addOptions(
            { label: 'Rename tunnel', value: 'rename', emoji: '\u270f\ufe0f' },
            {
              label: 'Toggle public/private',
              value: 'toggle_public',
              emoji: '\ud83d\udd04',
            },
            {
              label: 'Regenerate invite code',
              value: 'regen_invite',
              emoji: '\ud83d\udd01',
            },
            { label: 'Change password', value: 'set_password', emoji: '\ud83d\udd11' },
            {
              label: 'Toggle word moderation',
              value: 'toggle_filter',
              emoji: '\ud83d\udee1\ufe0f',
              description: 'Enable or disable the profanity / spam filter',
            }
          )
      );
      await interaction.update({
        content: `\u2699\ufe0f Configure tunnel \`${tunnelId}\`:`,
        components: [actionRow],
      });
    } else {
      const targetTunnelId = parseCommlinkSettingsActionTunnelId(customId);
      if (!targetTunnelId) {
        return;
      }
      const action = tunnelId; // value of the selected option

      if (action === 'rename') {
        const modal = buildPanelModal(
          buildCommlinkRenameModalCustomId(targetTunnelId),
          'Rename Tunnel',
          [
            {
              customId: 'name',
              label: 'New Tunnel Name',
              style: 'short',
              required: true,
              maxLength: 50,
            },
          ]
        );
        await interaction.showModal(modal);
        return;
      }

      if (action === 'set_password') {
        const modal = buildPanelModal(
          buildCommlinkPasswordModalCustomId(targetTunnelId),
          'Change Tunnel Password',
          [
            {
              customId: 'password',
              label: 'New Password (blank = remove password)',
              style: 'short',
              required: false,
              maxLength: 50,
            },
          ]
        );
        await interaction.showModal(modal);
        return;
      }

      // Immediate-action paths
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        if (action === 'toggle_public') {
          const tunnel = await tunnelService.getTunnel(targetTunnelId);
          if (!tunnel) {
            await interaction.editReply('\u274c Tunnel not found.');
            return;
          }
          const newValue = !tunnel.isPublic;
          const ok = await tunnelService.setPublic(targetTunnelId, newValue);
          await interaction.editReply(
            ok
              ? `\u2705 Tunnel is now **${newValue ? 'public' : 'private'}**.`
              : '\u274c Failed to update visibility.'
          );
          return;
        }

        if (action === 'regen_invite') {
          const newCode = await tunnelService.regenerateInviteCode(targetTunnelId);
          await interaction.editReply(
            newCode
              ? `\u2705 New invite code: \`${newCode}\``
              : '\u274c Failed to regenerate invite code.'
          );
          return;
        }

        if (action === 'toggle_filter') {
          const tunnel = await tunnelService.getTunnel(targetTunnelId);
          if (!tunnel) {
            await interaction.editReply('\u274c Tunnel not found.');
            return;
          }
          const newValue = !tunnel.contentFilterEnabled;
          const ok = await tunnelService.toggleContentFilter(targetTunnelId, newValue);
          await interaction.editReply(
            ok
              ? `\u2705 Word moderation is now **${newValue ? 'enabled' : 'disabled'}**.`
              : '\u274c Failed to update word moderation.'
          );
          return;
        }

        await interaction.editReply('\u274c Unknown settings action.');
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update tunnel';
        await interaction.editReply(`\u274c ${msg}`);
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'commlink',
      title: '\ud83d\udd17 Comm Links',
      description:
        'Manage cross-server communication tunnels.\n\n' +
        'Pick an action below \u2014 buttons open prompts for any required values.',
      buttons: [
        {
          subcommand: 'list',
          label: 'List',
          emoji: '\ud83d\udccb',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'create',
          label: 'Create',
          emoji: '\u2795',
          style: ButtonStyle.Success,
        },
        {
          subcommand: 'join',
          label: 'Join',
          emoji: '\ud83d\udd0c',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'link',
          label: 'Link by Code',
          emoji: '\ud83d\udd11',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'leave',
          label: 'Leave',
          emoji: '\ud83d\udeaa',
          style: ButtonStyle.Secondary,
        },
        {
          subcommand: 'info',
          label: 'Info',
          emoji: '\u2139\ufe0f',
          style: ButtonStyle.Secondary,
        },
        {
          subcommand: 'settings',
          label: 'Settings',
          emoji: '\u2699\ufe0f',
          style: ButtonStyle.Secondary,
        },
        {
          subcommand: 'delete',
          label: 'Delete',
          emoji: '\ud83d\uddd1\ufe0f',
          style: ButtonStyle.Danger,
        },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

// ========== Panel Button Handlers ==========

async function handleListFromBtn(interaction: ButtonInteraction): Promise<void> {
  const guildTunnels = interaction.guildId
    ? await tunnelService.listGuildTunnels(interaction.guildId)
    : [];
  const publicTunnels = await tunnelService.listPublicTunnels();
  const embed = buildAvailableTunnelsEmbed({
    guildTunnels: guildTunnels.map(t => ({
      id: t.id,
      name: t.name,
      isPublic: t.isPublic,
      connectedChannelsCount: t.connectedChannels.length,
    })),
    publicTunnels: publicTunnels.map(t => ({
      id: t.id,
      name: t.name,
      isPublic: t.isPublic,
      connectedChannelsCount: t.connectedChannels.length,
    })),
  });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ========== Slash Subcommand Handlers ==========
// All actions are panel-driven (see `handleButton`). `handleLeaveCmd` is
// retained because the panel's Leave button reuses it.

async function handleLeaveCmd(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<void> {
  if (!interaction.guildId || !interaction.channelId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const tunnel = tunnelService.findTunnelByChannel(interaction.channelId);
  if (!tunnel) {
    await interaction.reply({
      content: '❌ This channel is not connected to any tunnel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await tunnelService.disconnectFromTunnel(tunnel.id, interaction.guildId, interaction.channelId);
    await interaction.reply({
      content: `✅ Left tunnel **${tunnel.name}**.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `❌ Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}
