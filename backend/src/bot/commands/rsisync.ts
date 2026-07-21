import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';

import { handleRsiSyncAdminAction, isRsiSyncAdminAction } from './shared/rsiSyncAdminActions';
import { BotCommand } from './types';

/**
 * /rsisync — Admin panel for RSI role sync management.
 *
 * Provides tools for org admins to configure role mappings,
 * trigger synchronisation, and review audit logs.
 */
export const rsisync: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rsisync')
    .setDescription('Manage RSI role sync configuration and audit (admin)')
    .addBooleanOption(option =>
      option
        .setName('public')
        .setDescription('Post the RSI sync panel publicly in this channel')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'organization',
  examples: ['/rsisync'],
  permissions: ['ManageRoles'],
  guildOnly: true,
  cooldown: 10,

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'rsisync');
    if (!sub) {
      // Permission checks protect all button actions, regardless of whether the panel
      // was posted publicly or ephemerally. This ensures that even if a public panel
      // is visible in channel history, only users with ManageRoles can execute admin actions.
      return;
    }

    if (!isRsiSyncAdminAction(sub)) {
      return;
    }

    await handleRsiSyncAdminAction(sub, interaction);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const isPublicPanel = interaction.options.getBoolean('public') ?? false;

    const panelConfig: CommandPanelConfig = {
      prefix: 'rsisync',
      title: '🔄 RSI Role Sync Management',
      description:
        'Configure and manage RSI role synchronisation for your organization.\n\n' +
        '• **Sync Status** — View current role mappings and sync health\n' +
        '• **Setup Wizard** — Configure RSI rank → Discord role mappings\n' +
        '• **Run Sync** — Manually trigger role synchronisation\n' +
        '• **Audit** — Review sync history and error logs\n\n' +
        '*Members: Use `/verify` to link your RSI account.*',
      buttons: [
        {
          subcommand: 'status',
          label: 'Sync Status',
          emoji: '\ud83d\udcca',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'setup',
          label: 'Setup Wizard',
          emoji: '\ud83d\udd27',
          style: ButtonStyle.Success,
        },
        { subcommand: 'run', label: 'Run Sync', emoji: '\ud83d\udd04' },
        { subcommand: 'audit', label: 'Audit', emoji: '\ud83d\udcdd' },
      ],
    };
    await replyWithCommandPanel(
      interaction,
      panelConfig,
      isPublicPanel ? {} : { flags: MessageFlags.Ephemeral }
    );
  },
};
