import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalActionRowComponentBuilder,
  MessageFlags,
} from 'discord.js';

import { WikiService } from '../../services/content/WikiService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { getErrorMessage, logError } from '../../utils/errorHandler';
import {
  buildWikiNoResultsEmbed,
  buildWikiPageEmbed,
  buildWikiSearchEmbed,
} from '../embeds/wikiEmbeds';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';

import { BotCommand } from './types';

let _services: {
  wikiService: WikiService;
  guildOrgService: GuildOrganizationService;
} | null = null;

function getServices() {
  _services ??= {
    wikiService: new WikiService(),
    guildOrgService: GuildOrganizationService.getInstance(),
  };
  return _services;
}

const PANEL_CONFIG: CommandPanelConfig = {
  prefix: 'wiki',
  title: 'Wiki',
  description: 'Browse and search the wiki.',
  buttons: [
    {
      subcommand: 'search',
      label: 'Search Wiki',
      emoji: '\ud83d\udd0d',
      style: ButtonStyle.Primary,
    },
    { subcommand: 'view', label: 'View Page', emoji: '\ud83d\udcc4' },
  ],
};

export const wiki: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('Search and view organization wiki pages'),

  cooldown: 5,
  category: 'organization',
  guildOnly: true,
  examples: ['/wiki view page:getting-started', '/wiki search query:mining guide'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await replyWithCommandPanel(interaction, PANEL_CONFIG);
  },

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const subcommand = parsePanelCustomId(interaction.customId, 'wiki');
    if (!subcommand) {
      return;
    }

    switch (subcommand) {
      case 'search': {
        const modal = new ModalBuilder().setCustomId('wiki_search_modal').setTitle('Search Wiki');

        const queryInput = new TextInputBuilder()
          .setCustomId('query')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. mining guide')
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(queryInput)
        );

        await interaction.showModal(modal);
        break;
      }
      case 'view': {
        const modal = new ModalBuilder().setCustomId('wiki_view_modal').setTitle('View Wiki Page');

        const pageInput = new TextInputBuilder()
          .setCustomId('page')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. getting-started')
          .setRequired(true)
          .setMaxLength(200);

        modal.addComponents(
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(pageInput)
        );

        await interaction.showModal(modal);
        break;
      }
      default:
        await interaction.reply({ content: '❌ Unknown action.', flags: MessageFlags.Ephemeral });
    }
  },

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const organizationId = await getServices().guildOrgService.resolveOrganization(
        interaction.guildId
      );
      if (!organizationId) {
        await interaction.reply({
          content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'wiki_search_modal') {
        const query = interaction.fields.getTextInputValue('query').trim();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const results = await getServices().wikiService.searchPages(organizationId, query, 5);

        if (results.length === 0) {
          await interaction.editReply({ embeds: [buildWikiNoResultsEmbed(query)] });
          return;
        }

        await interaction.editReply({ embeds: [buildWikiSearchEmbed(query, results)] });
      } else if (interaction.customId === 'wiki_view_modal') {
        const pageRef = interaction.fields.getTextInputValue('page').trim();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const page = await getServices().wikiService.getPage(organizationId, pageRef);

        await interaction.editReply({ embeds: [buildWikiPageEmbed(page)] });
      }
    } catch (error: unknown) {
      logError(error, 'WikiCommand.handleModal');
      const message = getErrorMessage(error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ ${message}` });
      } else {
        await interaction.reply({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral });
      }
    }
  },
};
