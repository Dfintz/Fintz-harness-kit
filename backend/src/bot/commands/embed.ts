import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { EmbedBuilderService } from '../../services/discord/EmbedBuilderService';
import { getErrorMessage } from '../../utils/errorHandler';
import { buildPanelModal } from '../embeds/panelEmbed';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';
import { sanitizeErrorForUser } from '../utils/errorSanitizer';

import { BotCommand } from './types';

const PANEL_CONFIG: CommandPanelConfig = {
  prefix: 'embed',
  title: 'Custom Embeds',
  description: 'Create and send custom embed messages.',
  buttons: [
    { subcommand: 'create', label: 'Create Embed', emoji: '\u2795', style: ButtonStyle.Success },
    { subcommand: 'send', label: 'Send Embed', emoji: '\ud83d\udce4' },
  ],
};

export const embed: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and send custom embed messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  cooldown: 5,
  category: 'admin',

  async execute(interaction: ChatInputCommandInteraction) {
    await replyWithCommandPanel(interaction, PANEL_CONFIG);
  },

  async handleButton(interaction: ButtonInteraction) {
    const subcommand = parsePanelCustomId(interaction.customId, 'embed');
    if (!subcommand) {
      return;
    }

    try {
      switch (subcommand) {
        case 'create': {
          const modal = buildPanelModal('embed_create_panel', 'Create Embed Template', [
            {
              customId: 'template_name',
              label: 'Template Name',
              style: 'short',
              placeholder: 'e.g. welcome-message',
              required: true,
              maxLength: 100,
            },
            {
              customId: 'embed_title',
              label: 'Title',
              style: 'short',
              placeholder: 'Embed title',
              required: true,
              maxLength: 256,
            },
            {
              customId: 'embed_description',
              label: 'Description',
              style: 'paragraph',
              placeholder: 'Embed description',
              required: true,
              maxLength: 2000,
            },
            {
              customId: 'embed_color',
              label: 'Color (hex, e.g., #00FF88)',
              style: 'short',
              placeholder: '#00FF88',
              required: false,
              maxLength: 7,
            },
          ]);

          await interaction.showModal(modal);
          break;
        }
        case 'send': {
          const modal = buildPanelModal('embed_send_modal', 'Send Embed', [
            {
              customId: 'template_name',
              label: 'Template Name',
              style: 'short',
              placeholder: 'e.g. welcome-message',
              required: true,
              maxLength: 100,
            },
          ]);

          await interaction.showModal(modal);
          break;
        }
        default:
          await interaction.reply({ content: '❌ Unknown action.', flags: MessageFlags.Ephemeral });
      }
    } catch (error: unknown) {
      const errorMessage = sanitizeErrorForUser(getErrorMessage(error) || 'An error occurred');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `❌ ${errorMessage}`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({ content: `❌ ${errorMessage}`, flags: MessageFlags.Ephemeral });
      }
    }
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    // Handle combined create modal from panel button
    if (interaction.customId === 'embed_create_panel') {
      const name = interaction.fields.getTextInputValue('template_name').trim();
      const title = interaction.fields.getTextInputValue('embed_title').trim();
      const description = interaction.fields.getTextInputValue('embed_description').trim();
      const colorStr = interaction.fields.getTextInputValue('embed_color')?.trim() || undefined;
      const colorNum = colorStr ? parseInt(colorStr.replace('#', ''), 16) : undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const service = EmbedBuilderService.getInstance();
        service.createEmbed(
          interaction.guildId ?? '',
          name,
          {
            title,
            description,
            color: !isNaN(colorNum ?? NaN) ? colorNum : undefined,
          },
          interaction.user.id
        );
        await interaction.editReply(`\u2705 Embed template **${name}** created.`);
      } catch (error: unknown) {
        const msg = sanitizeErrorForUser(getErrorMessage(error) || 'Failed to create embed');
        await interaction.editReply(`\u274c ${msg}`);
      }
      return;
    }

    // Handle send modal
    if (interaction.customId === 'embed_send_modal') {
      const name = interaction.fields.getTextInputValue('template_name').trim();
      const service = EmbedBuilderService.getInstance();
      const template = service.findByName(interaction.guildId ?? '', name);

      if (!template) {
        await interaction.reply({
          content: `❌ Template "${name}" not found.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const context: import('../../services/discord/ShortcodeEngine').ShortcodeContext = {
        user: interaction.user,
        member:
          interaction.member && 'displayName' in interaction.member
            ? interaction.member
            : undefined,
        guild: interaction.guild ?? undefined,
      };

      const discordEmbed = service.buildDiscordEmbed(template, context);

      await interaction.reply({ content: '✅ Embed sent!', flags: MessageFlags.Ephemeral });
      if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [discordEmbed] });
      }
      return;
    }

    // Handle existing embed_create_* submissions
    const createMatch = /^embed_create_(.+)$/.exec(interaction.customId);
    if (createMatch) {
      await handleCreateSubmit(interaction, createMatch[1]);
    }
  },
};

async function _handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true);

  const modal = buildPanelModal(`embed_create_${name}`, `Create Embed: ${name.substring(0, 30)}`, [
    {
      customId: 'embed_title',
      label: 'Title',
      style: 'short',
      placeholder: 'Embed title',
      required: true,
      maxLength: 256,
    },
    {
      customId: 'embed_description',
      label: 'Description',
      style: 'paragraph',
      placeholder: 'Embed description',
      required: true,
      maxLength: 2000,
    },
    {
      customId: 'embed_color',
      label: 'Color (hex, e.g., #00FF88)',
      style: 'short',
      placeholder: '#00FF88',
      required: false,
      maxLength: 7,
    },
    {
      customId: 'embed_footer',
      label: 'Footer text',
      style: 'short',
      placeholder: 'Optional footer text',
      required: false,
      maxLength: 200,
    },
  ]);

  await interaction.showModal(modal);
}

async function handleCreateSubmit(
  interaction: ModalSubmitInteraction,
  name: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const title = interaction.fields.getTextInputValue('embed_title');
  const description = interaction.fields.getTextInputValue('embed_description');
  let colorStr = '';
  let footer = '';

  try {
    colorStr = interaction.fields.getTextInputValue('embed_color');
  } catch {
    // Optional field
  }
  try {
    footer = interaction.fields.getTextInputValue('embed_footer');
  } catch {
    // Optional field
  }

  const color = colorStr ? Number.parseInt(colorStr.replace('#', ''), 16) || 0x00ff88 : 0x00ff88;

  const service = EmbedBuilderService.getInstance();
  const result = service.createEmbed(
    interaction.guildId ?? '',
    name,
    { title, description, color, footerText: footer || undefined },
    interaction.user.id
  );

  if (typeof result === 'string') {
    await interaction.editReply({ content: `❌ ${result}` });
    return;
  }

  await interaction.editReply({
    content: `✅ Embed template **${name}** created! Use \`/embed send name:${name}\` to send it.`,
  });
}

async function _handleSend(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true);
  const service = EmbedBuilderService.getInstance();
  const template = service.findByName(interaction.guildId ?? '', name);

  if (!template) {
    await interaction.reply({
      content: `❌ Template "${name}" not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const context: import('../../services/discord/ShortcodeEngine').ShortcodeContext = {
    user: interaction.user,
    member:
      interaction.member && 'displayName' in interaction.member ? interaction.member : undefined,
    guild: interaction.guild ?? undefined,
  };

  const discordEmbed = service.buildDiscordEmbed(template, context);

  await interaction.reply({ content: '✅ Embed sent!', flags: MessageFlags.Ephemeral });
  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [discordEmbed] });
  }
}
