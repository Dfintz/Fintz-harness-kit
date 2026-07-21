/**
 * /faq — Discord FAQ Command
 *
 * Provides FAQ access directly in Discord with three subcommands:
 *   /faq list       — Show all 7 categories with item counts
 *   /faq search     — Search FAQ items by keyword (top 5 results)
 *   /faq category   — Browse a specific category's questions
 *
 * All responses are ephemeral (only visible to the requesting user).
 *
 * Wave 1.3 — Part B: Discord /faq Command
 *
 * @module bot/commands/faq
 */

import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalActionRowComponentBuilder,
  MessageFlags,
} from 'discord.js';

import { logger } from '../../utils/logger';
import { botFaqCategories, searchBotFaqItems } from '../data/faqContent';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';
import { escapeDiscordMarkdown } from '../utils/discord';
import { EmbedColors } from '../utils/embedBuilder';

import { BotCommand } from './types';

// Max items to show per page in category view
const ITEMS_PER_PAGE = 5;

const PANEL_CONFIG: CommandPanelConfig = {
  prefix: 'faq',
  title: 'FAQ & Knowledge Base',
  description: 'Browse frequently asked questions and guides.',
  buttons: [
    { subcommand: 'list', label: 'Browse All', emoji: '\ud83d\udccb', style: ButtonStyle.Primary },
    { subcommand: 'search', label: 'Search', emoji: '\ud83d\udd0d' },
    { subcommand: 'category', label: 'By Category', emoji: '\ud83d\udcc2' },
  ],
};

export const faq: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Browse frequently asked questions about SC Fleet Manager'),

  category: 'utility',
  cooldown: 5,
  examples: ['/faq list', '/faq search fleet', '/faq category getting-started'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await replyWithCommandPanel(interaction, PANEL_CONFIG);
  },

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const subcommand = parsePanelCustomId(interaction.customId, 'faq');
    if (!subcommand) {
      return;
    }

    try {
      switch (subcommand) {
        case 'list':
          await handleList(interaction);
          break;
        case 'search': {
          const modal = new ModalBuilder().setCustomId('faq_search_modal').setTitle('Search FAQ');

          const queryInput = new TextInputBuilder()
            .setCustomId('query')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. "fleet", "GDPR", "discord"')
            .setRequired(true)
            .setMaxLength(100);

          modal.addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(queryInput)
          );

          await interaction.showModal(modal);
          break;
        }
        case 'category': {
          const modal = new ModalBuilder()
            .setCustomId('faq_category_modal')
            .setTitle('Browse FAQ Category');

          const categoryInput = new TextInputBuilder()
            .setCustomId('name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(botFaqCategories[0]?.id ?? 'category-id')
            .setRequired(true)
            .setMaxLength(100);

          modal.addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(categoryInput)
          );

          await interaction.showModal(modal);
          break;
        }
        default:
          await interaction.reply({ content: '❌ Unknown action.', flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      logger.error('FAQ button handler failed', { error });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Something went wrong while fetching FAQ data.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      if (interaction.customId === 'faq_search_modal') {
        const query = interaction.fields.getTextInputValue('query').trim();
        const results = searchBotFaqItems(query, 5);

        if (results.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(EmbedColors.WARNING)
            .setTitle('🔍 No Results')
            .setDescription(
              `No FAQ items match **"${escapeDiscordMarkdown(query)}"**.\n\n` +
                'Try different keywords, or use the **Browse All** button to see all categories.'
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(EmbedColors.INFO)
          .setTitle(`🔍 FAQ Search — "${escapeDiscordMarkdown(query)}"`)
          .setDescription(`Found **${results.length}** result${results.length === 1 ? '' : 's'}:`)
          .setTimestamp();

        results.forEach((item, index) => {
          embed.addFields({
            name: `${index + 1}. ${item.categoryEmoji} ${item.question}`,
            value: `${truncate(item.answer, 200)}\n*Category: ${item.categoryTitle}*`,
          });
        });

        embed.setFooter({ text: 'Use the By Category button for full category details' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (interaction.customId === 'faq_category_modal') {
        const categoryId = interaction.fields.getTextInputValue('name').trim();

        const category = botFaqCategories.find(c => c.id === categoryId);
        if (!category) {
          const validIds = botFaqCategories.map(c => `\`${c.id}\``).join(', ');
          await interaction.reply({
            content: `❌ Unknown category **"${categoryId}"**. Valid categories: ${validIds}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const totalPages = Math.ceil(category.items.length / ITEMS_PER_PAGE);
        const pageItems = category.items.slice(0, ITEMS_PER_PAGE);

        const embed = new EmbedBuilder()
          .setColor(EmbedColors.SC_BLUE)
          .setTitle(`${category.emoji} ${category.title}`)
          .setDescription(category.description)
          .setTimestamp();

        pageItems.forEach((item, index) => {
          embed.addFields({
            name: `${index + 1}. ${item.question}`,
            value: truncate(item.answer, 250),
          });
        });

        if (totalPages > 1) {
          embed.setFooter({
            text: `Page 1/${totalPages} • ${category.items.length} items total`,
          });
        } else {
          embed.setFooter({ text: 'SC Fleet Manager FAQ' });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      logger.error('FAQ modal handler failed', { error });
      const errorMessage = '❌ Something went wrong while fetching FAQ data.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    }
  },
};

// ── /faq list ─────────────────────────────────────────────────────────

async function handleList(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  const totalItems = botFaqCategories.reduce((sum, cat) => sum + cat.items.length, 0);

  const categoryLines = botFaqCategories.map(
    cat =>
      `${cat.emoji} **${cat.title}** — ${cat.items.length} question${cat.items.length === 1 ? '' : 's'}\n> ${cat.description}`
  );

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle('📖 SC Fleet Manager — FAQ')
    .setDescription(
      `Browse **${totalItems}** frequently asked questions across **${botFaqCategories.length}** categories.\n\n${categoryLines.join(
        '\n\n'
      )}`
    )
    .setFooter({
      text: 'Use /faq category <name> to browse • /faq search <query> to search',
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ── /faq search ───────────────────────────────────────────────────────

async function _handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('query', true);
  const results = searchBotFaqItems(query, 5);

  if (results.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(EmbedColors.WARNING)
      .setTitle('🔍 No Results')
      .setDescription(
        `No FAQ items match **"${escapeDiscordMarkdown(query)}"**.\n\n` +
          'Try different keywords, or use `/faq list` to browse all categories.'
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle(`🔍 FAQ Search — "${escapeDiscordMarkdown(query)}"`)
    .setDescription(`Found **${results.length}** result${results.length === 1 ? '' : 's'}:`)
    .setTimestamp();

  results.forEach((item, index) => {
    embed.addFields({
      name: `${index + 1}. ${item.categoryEmoji} ${item.question}`,
      value: `${truncate(item.answer, 200)}\n*Category: ${item.categoryTitle}*`,
    });
  });

  embed.setFooter({ text: 'Use /faq category <name> for full category details' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ── /faq category ─────────────────────────────────────────────────────

async function _handleCategory(interaction: ChatInputCommandInteraction): Promise<void> {
  const categoryId = interaction.options.getString('name', true);
  const page = interaction.options.getInteger('page') ?? 1;

  const category = botFaqCategories.find(c => c.id === categoryId);
  if (!category) {
    await interaction.reply({
      content: '❌ Unknown category. Use `/faq list` to see available categories.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const totalPages = Math.ceil(category.items.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = category.items.slice(start, start + ITEMS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`${category.emoji} ${category.title}`)
    .setDescription(category.description)
    .setTimestamp();

  pageItems.forEach((item, index) => {
    embed.addFields({
      name: `${start + index + 1}. ${item.question}`,
      value: truncate(item.answer, 250),
    });
  });

  if (totalPages > 1) {
    embed.setFooter({
      text: `Page ${safePage}/${totalPages} • Use /faq category ${categoryId} page:<n> for more`,
    });
  } else {
    embed.setFooter({ text: 'SC Fleet Manager FAQ' });
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ── Helpers ───────────────────────────────────────────────────────────

function truncate(text: string, maxLength: number): string {
  if (maxLength < 1) {
    return '…';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 1)}…`;
}
