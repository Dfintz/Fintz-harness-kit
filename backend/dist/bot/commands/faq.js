"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faq = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const faqContent_1 = require("../data/faqContent");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const discord_1 = require("../utils/discord");
const embedBuilder_1 = require("../utils/embedBuilder");
const ITEMS_PER_PAGE = 5;
const PANEL_CONFIG = {
    prefix: 'faq',
    title: 'FAQ & Knowledge Base',
    description: 'Browse frequently asked questions and guides.',
    buttons: [
        { subcommand: 'list', label: 'Browse All', emoji: '\ud83d\udccb', style: discord_js_1.ButtonStyle.Primary },
        { subcommand: 'search', label: 'Search', emoji: '\ud83d\udd0d' },
        { subcommand: 'category', label: 'By Category', emoji: '\ud83d\udcc2' },
    ],
};
exports.faq = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('faq')
        .setDescription('Browse frequently asked questions about SC Fleet Manager'),
    category: 'utility',
    cooldown: 5,
    examples: ['/faq list', '/faq search fleet', '/faq category getting-started'],
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, PANEL_CONFIG);
    },
    async handleButton(interaction) {
        const subcommand = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'faq');
        if (!subcommand) {
            return;
        }
        try {
            switch (subcommand) {
                case 'list':
                    await handleList(interaction);
                    break;
                case 'search': {
                    const modal = new discord_js_1.ModalBuilder().setCustomId('faq_search_modal').setTitle('Search FAQ');
                    const queryInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('query')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('e.g. "fleet", "GDPR", "discord"')
                        .setRequired(true)
                        .setMaxLength(100);
                    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(queryInput));
                    await interaction.showModal(modal);
                    break;
                }
                case 'category': {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('faq_category_modal')
                        .setTitle('Browse FAQ Category');
                    const categoryInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('name')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder(faqContent_1.botFaqCategories[0]?.id ?? 'category-id')
                        .setRequired(true)
                        .setMaxLength(100);
                    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(categoryInput));
                    await interaction.showModal(modal);
                    break;
                }
                default:
                    await interaction.reply({ content: '❌ Unknown action.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (error) {
            logger_1.logger.error('FAQ button handler failed', { error });
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong while fetching FAQ data.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
        }
    },
    async handleModal(interaction) {
        try {
            if (interaction.customId === 'faq_search_modal') {
                const query = interaction.fields.getTextInputValue('query').trim();
                const results = (0, faqContent_1.searchBotFaqItems)(query, 5);
                if (results.length === 0) {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(embedBuilder_1.EmbedColors.WARNING)
                        .setTitle('🔍 No Results')
                        .setDescription(`No FAQ items match **"${(0, discord_1.escapeDiscordMarkdown)(query)}"**.\n\n` +
                        'Try different keywords, or use the **Browse All** button to see all categories.')
                        .setTimestamp();
                    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.INFO)
                    .setTitle(`🔍 FAQ Search — "${(0, discord_1.escapeDiscordMarkdown)(query)}"`)
                    .setDescription(`Found **${results.length}** result${results.length === 1 ? '' : 's'}:`)
                    .setTimestamp();
                results.forEach((item, index) => {
                    embed.addFields({
                        name: `${index + 1}. ${item.categoryEmoji} ${item.question}`,
                        value: `${truncate(item.answer, 200)}\n*Category: ${item.categoryTitle}*`,
                    });
                });
                embed.setFooter({ text: 'Use the By Category button for full category details' });
                await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else if (interaction.customId === 'faq_category_modal') {
                const categoryId = interaction.fields.getTextInputValue('name').trim();
                const category = faqContent_1.botFaqCategories.find(c => c.id === categoryId);
                if (!category) {
                    const validIds = faqContent_1.botFaqCategories.map(c => `\`${c.id}\``).join(', ');
                    await interaction.reply({
                        content: `❌ Unknown category **"${categoryId}"**. Valid categories: ${validIds}`,
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    return;
                }
                const totalPages = Math.ceil(category.items.length / ITEMS_PER_PAGE);
                const pageItems = category.items.slice(0, ITEMS_PER_PAGE);
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
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
                }
                else {
                    embed.setFooter({ text: 'SC Fleet Manager FAQ' });
                }
                await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (error) {
            logger_1.logger.error('FAQ modal handler failed', { error });
            const errorMessage = '❌ Something went wrong while fetching FAQ data.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else {
                await interaction.reply({ content: errorMessage, flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
    },
};
async function handleList(interaction) {
    const totalItems = faqContent_1.botFaqCategories.reduce((sum, cat) => sum + cat.items.length, 0);
    const categoryLines = faqContent_1.botFaqCategories.map(cat => `${cat.emoji} **${cat.title}** — ${cat.items.length} question${cat.items.length === 1 ? '' : 's'}\n> ${cat.description}`);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle('📖 SC Fleet Manager — FAQ')
        .setDescription(`Browse **${totalItems}** frequently asked questions across **${faqContent_1.botFaqCategories.length}** categories.\n\n${categoryLines.join('\n\n')}`)
        .setFooter({
        text: 'Use /faq category <name> to browse • /faq search <query> to search',
    })
        .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
}
async function _handleSearch(interaction) {
    const query = interaction.options.getString('query', true);
    const results = (0, faqContent_1.searchBotFaqItems)(query, 5);
    if (results.length === 0) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.WARNING)
            .setTitle('🔍 No Results')
            .setDescription(`No FAQ items match **"${(0, discord_1.escapeDiscordMarkdown)(query)}"**.\n\n` +
            'Try different keywords, or use `/faq list` to browse all categories.')
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle(`🔍 FAQ Search — "${(0, discord_1.escapeDiscordMarkdown)(query)}"`)
        .setDescription(`Found **${results.length}** result${results.length === 1 ? '' : 's'}:`)
        .setTimestamp();
    results.forEach((item, index) => {
        embed.addFields({
            name: `${index + 1}. ${item.categoryEmoji} ${item.question}`,
            value: `${truncate(item.answer, 200)}\n*Category: ${item.categoryTitle}*`,
        });
    });
    embed.setFooter({ text: 'Use /faq category <name> for full category details' });
    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
}
async function _handleCategory(interaction) {
    const categoryId = interaction.options.getString('name', true);
    const page = interaction.options.getInteger('page') ?? 1;
    const category = faqContent_1.botFaqCategories.find(c => c.id === categoryId);
    if (!category) {
        await interaction.reply({
            content: '❌ Unknown category. Use `/faq list` to see available categories.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const totalPages = Math.ceil(category.items.length / ITEMS_PER_PAGE);
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    const pageItems = category.items.slice(start, start + ITEMS_PER_PAGE);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
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
    }
    else {
        embed.setFooter({ text: 'SC Fleet Manager FAQ' });
    }
    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
}
function truncate(text, maxLength) {
    if (maxLength < 1) {
        return '…';
    }
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.substring(0, maxLength - 1)}…`;
}
//# sourceMappingURL=faq.js.map