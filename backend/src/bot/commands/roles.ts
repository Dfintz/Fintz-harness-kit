import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  LabelBuilder,
} from 'discord.js';

import { ReactionRoleService } from '../../services/discord/ReactionRoleService';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { buildReactionRolePanelsListEmbed } from '../embeds/rolesEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';

import { BotCommand } from './types';

// ==================== PANEL CONFIG ====================

const ROLES_PANEL_PREFIX = 'reactionrole';

const ROLES_PANEL_CONFIG: CommandPanelConfig = {
  prefix: ROLES_PANEL_PREFIX,
  title: '🎭 Reaction Roles',
  description: 'Create and manage self-assign role panels.',
  buttons: [
    { subcommand: 'list', label: 'List Panels', emoji: '📋', style: ButtonStyle.Primary },
    { subcommand: 'create', label: 'Create Panel', emoji: '➕', style: ButtonStyle.Success },
    { subcommand: 'send', label: 'Send Panel', emoji: '📤' },
    { subcommand: 'delete', label: 'Delete Panel', emoji: '🗑️', style: ButtonStyle.Danger },
  ],
};

// ==================== COMMAND ====================

export const roles: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Create button-based role self-assignment panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  cooldown: 5,
  category: 'admin',

  // ==================== EXECUTE (show panel) ====================

  async execute(interaction: ChatInputCommandInteraction) {
    await replyWithCommandPanel(interaction, ROLES_PANEL_CONFIG);
  },

  // ==================== HANDLE BUTTON (panel + role toggle buttons) ====================

  async handleButton(interaction: ButtonInteraction) {
    // --- Panel button routing ---
    const panelSub = parsePanelCustomId(interaction.customId, ROLES_PANEL_PREFIX);
    if (panelSub) {
      switch (panelSub) {
        case 'list': {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          try {
            await handleListFromPanel(interaction);
          } catch (err) {
            await interaction.editReply({
              content: `❌ Error: ${getErrorMessage(err)}`,
            });
          }
          return;
        }
        case 'create':
          await showPanelNameModal(
            interaction,
            'create',
            'Create Role Panel',
            'Enter a title for the new panel'
          );
          return;
        case 'send':
          await showPanelNameModal(
            interaction,
            'send',
            'Send Role Panel',
            'Enter the Panel ID to send'
          );
          return;
        case 'delete':
          await showPanelNameModal(
            interaction,
            'delete',
            'Delete Role Panel',
            'Enter the Panel ID to delete'
          );
          return;
      }
    }

    // --- Existing role toggle buttons on posted role panels ---
    const service = ReactionRoleService.getInstance();
    const found = service.findPanelByButton(interaction.customId);

    if (!found) {
      return;
    }

    const { panel, roleId } = found;
    const member = interaction.member as GuildMember;

    if (!member || !interaction.guild) {
      await interaction.reply({
        content: '❌ Could not resolve your membership.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const result = await service.handleRoleToggle(panel.id, roleId, member);

      if (typeof result === 'string') {
        await interaction.reply({ content: `❌ ${result}`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({
        content: getRoleToggleMessage(result),
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('Failed to toggle reaction role:', error);
      await interaction.reply({
        content: `❌ Failed to update roles: ${getErrorMessage(error)}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  // ==================== HANDLE MODAL ====================

  async handleModal(interaction: ModalSubmitInteraction) {
    const { customId } = interaction;

    if (customId === 'reactionrole_create_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await handleCreateFromModal(interaction);
      } catch (err) {
        await interaction.editReply({
          content: `❌ Error: ${getErrorMessage(err)}`,
        });
      }
      return;
    }

    if (customId === 'reactionrole_send_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const panelId = interaction.fields.getTextInputValue('panel_id').trim();
      try {
        await handleSendFromModal(interaction, panelId);
      } catch (err) {
        await interaction.editReply({
          content: `❌ Error: ${getErrorMessage(err)}`,
        });
      }
      return;
    }

    if (customId === 'reactionrole_delete_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const panelId = interaction.fields.getTextInputValue('panel_id').trim();
      try {
        await handleDeleteFromModal(interaction, panelId);
      } catch (err) {
        await interaction.editReply({
          content: `❌ Error: ${getErrorMessage(err)}`,
        });
      }
      return;
    }
  },
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

function getRoleToggleMessage(result: { action: string; roleName: string }): string {
  switch (result.action) {
    case 'added':
      return `✅ You now have the **${result.roleName}** role!`;
    case 'switched':
      return `✅ Switched to **${result.roleName}** role!`;
    default:
      return `❎ The **${result.roleName}** role has been removed.`;
  }
}

// ==================== MODAL BUILDERS ====================

async function showPanelNameModal(
  interaction: ButtonInteraction,
  action: string,
  title: string,
  placeholder: string
): Promise<void> {
  const modal = new ModalBuilder().setCustomId(`reactionrole_${action}_modal`).setTitle(title);

  if (action === 'create') {
    const titleInput = new TextInputBuilder()
      .setCustomId('panel_title')
      .setPlaceholder(placeholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('panel_description')
      .setPlaceholder('Click a button below to assign yourself a role.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addLabelComponents(
      new LabelBuilder().setLabel('Panel Title').setTextInputComponent(titleInput),
      new LabelBuilder().setLabel('Description (optional)').setTextInputComponent(descInput)
    );
  } else {
    const idInput = new TextInputBuilder()
      .setCustomId('panel_id')
      .setPlaceholder(placeholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addLabelComponents(
      new LabelBuilder().setLabel('Panel ID').setTextInputComponent(idInput)
    );
  }

  await interaction.showModal(modal);
}

// ==================== PANEL HANDLERS ====================

async function handleListFromPanel(interaction: ButtonInteraction): Promise<void> {
  const service = ReactionRoleService.getInstance();
  const panels = service.listPanels(interaction.guildId ?? '');

  if (panels.length === 0) {
    await interaction.editReply({ content: '📡 No reaction role panels configured.' });
    return;
  }

  const embed = buildReactionRolePanelsListEmbed(panels);
  await interaction.editReply({ embeds: [embed] });
}

async function handleCreateFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageRoles')) {
    await interaction.editReply({
      content: '❌ You need Manage Roles permission to create role panels.',
    });
    return;
  }

  const title = interaction.fields.getTextInputValue('panel_title').trim();
  const description =
    interaction.fields.getTextInputValue('panel_description')?.trim() ||
    'Click a button below to assign yourself a role.';

  const service = ReactionRoleService.getInstance();
  const panelResult = service.createPanel(
    interaction.guildId as string,
    interaction.channelId as string,
    title,
    description,
    [],
    false,
    interaction.user.id
  );

  if (typeof panelResult === 'string') {
    await interaction.editReply({ content: `❌ ${panelResult}` });
    return;
  }

  await interaction.editReply({
    content: [
      `✅ Reaction role panel created!`,
      `**ID:** \`${panelResult.id}\``,
      `**Title:** ${title}`,
      `**Mode:** Multi-select`,
      '',
      `Use \`/roles add-role panel_id:${panelResult.id} role:@SomeRole\` to add roles.`,
      `Then use "Send Panel" to post it.`,
    ].join('\n'),
  });
}

async function handleSendFromModal(
  interaction: ModalSubmitInteraction,
  panelId: string
): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageRoles')) {
    await interaction.editReply({
      content: '❌ You need Manage Roles permission.',
    });
    return;
  }

  const service = ReactionRoleService.getInstance();
  const panel = service.getPanel(panelId);

  if (panel?.guildId !== interaction.guildId) {
    await interaction.editReply({ content: '❌ Panel not found.' });
    return;
  }

  if (panel.roles.length === 0) {
    await interaction.editReply({
      content: '❌ Panel has no roles. Add roles first with `/roles add-role`.',
    });
    return;
  }

  const embed = service.buildPanelEmbed(panel);
  const buttons = service.buildPanelButtons(panel);

  await interaction.editReply({ content: '✅ Panel sent!' });
  if (interaction.channel && 'send' in interaction.channel) {
    const msg = await interaction.channel.send({ embeds: [embed], components: buttons });
    service.setMessageId(panel.id, msg.id);
  }
}

async function handleDeleteFromModal(
  interaction: ModalSubmitInteraction,
  panelId: string
): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageRoles')) {
    await interaction.editReply({
      content: '❌ You need Manage Roles permission.',
    });
    return;
  }

  const service = ReactionRoleService.getInstance();

  const deleted = await service.deletePanel(panelId);
  if (!deleted) {
    await interaction.editReply({ content: '❌ Panel not found.' });
    return;
  }

  await interaction.editReply({
    content: `✅ Panel \`${panelId}\` has been deleted.`,
  });
}
