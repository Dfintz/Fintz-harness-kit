"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.help = void 0;
const discord_js_1 = require("discord.js");
const WikiService_1 = require("../../services/content/WikiService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const slashRoots_1 = require("../constants/slashRoots");
const faqContent_1 = require("../data/faqContent");
const commandErrorHandler_1 = require("../utils/commandErrorHandler");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const discord_1 = require("../utils/discord");
const embedBuilder_1 = require("../utils/embedBuilder");
let _wikiServices = null;
function getWikiServices() {
    _wikiServices ??= {
        wikiService: new WikiService_1.WikiService(),
        guildOrgService: GuildOrganizationService_1.GuildOrganizationService.getInstance(),
    };
    return _wikiServices;
}
function truncateText(text, max) {
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, max - 1)}…`;
}
function stripMarkdown(text) {
    return text.replaceAll(/[#*_~`>|[\]()]/g, '').trim();
}
const FAQ_ITEMS_PER_PAGE = 5;
function formatCommandHelp(cmd) {
    const json = cmd.data.toJSON();
    const options = json.options ?? [];
    const groups = options.filter(o => o.type === discord_js_1.ApplicationCommandOptionType.SubcommandGroup);
    const directSubs = options.filter(o => o.type === discord_js_1.ApplicationCommandOptionType.Subcommand);
    if (groups.length === 0 && directSubs.length === 0) {
        return `\`/${json.name}\` — ${json.description}`;
    }
    const parts = [`\`/${json.name}\` — ${json.description}`];
    if (groups.length > 0) {
        const groupNames = groups.map(g => `\`${g.name}\``).join(', ');
        parts.push(`  Groups: ${groupNames}`);
    }
    if (directSubs.length > 0) {
        const subNames = directSubs.map(s => `\`${s.name}\``).join(', ');
        parts.push(`  Subcommands: ${subNames}`);
    }
    return parts.join('\n');
}
exports.help = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('help')
        .setDescription('Help, FAQ, and wiki — all in one place'),
    category: 'utility',
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'help');
        if (!sub) {
            return;
        }
        try {
            switch (sub) {
                case 'wiki': {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                        .setTitle('📖 Organization Wiki')
                        .setDescription('Browse and search your organization\u2019s wiki pages.');
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId('help_panel_wiki_search')
                        .setLabel('Search Wiki')
                        .setEmoji('🔍')
                        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                        .setCustomId('help_panel_wiki_view')
                        .setLabel('View Page')
                        .setEmoji('📄')
                        .setStyle(discord_js_1.ButtonStyle.Secondary));
                    await interaction.reply({
                        embeds: [embed],
                        components: [row],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                case 'wiki_search': {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('help_wiki_search_modal')
                        .setTitle('Search Wiki');
                    const queryInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('query')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('e.g. mining guide')
                        .setRequired(true)
                        .setMaxLength(100);
                    const queryLabel = new discord_js_1.LabelBuilder()
                        .setLabel('Search keyword or phrase')
                        .setTextInputComponent(queryInput);
                    modal.addLabelComponents(queryLabel);
                    await interaction.showModal(modal);
                    break;
                }
                case 'wiki_view': {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('help_wiki_view_modal')
                        .setTitle('View Wiki Page');
                    const pageInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('page')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('e.g. getting-started')
                        .setRequired(true)
                        .setMaxLength(200);
                    const pageLabel = new discord_js_1.LabelBuilder()
                        .setLabel('Page slug or UUID')
                        .setTextInputComponent(pageInput);
                    modal.addLabelComponents(pageLabel);
                    await interaction.showModal(modal);
                    break;
                }
                case 'faq': {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                        .setTitle('❓ FAQ & Knowledge Base')
                        .setDescription('Browse frequently asked questions and guides.');
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId('help_panel_faq_list')
                        .setLabel('Browse All')
                        .setEmoji('📋')
                        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                        .setCustomId('help_panel_faq_search')
                        .setLabel('Search')
                        .setEmoji('🔍')
                        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                        .setCustomId('help_panel_faq_category')
                        .setLabel('By Category')
                        .setEmoji('📂')
                        .setStyle(discord_js_1.ButtonStyle.Secondary));
                    await interaction.reply({
                        embeds: [embed],
                        components: [row],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                case 'faq_list': {
                    await handleFaqList(interaction);
                    break;
                }
                case 'faq_search': {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('help_faq_search_modal')
                        .setTitle('Search FAQ');
                    const queryInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('query')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('e.g. "fleet", "GDPR", "discord"')
                        .setRequired(true)
                        .setMaxLength(100);
                    const queryLabel = new discord_js_1.LabelBuilder()
                        .setLabel('Search terms')
                        .setTextInputComponent(queryInput);
                    modal.addLabelComponents(queryLabel);
                    await interaction.showModal(modal);
                    break;
                }
                case 'faq_category': {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('help_faq_category_modal')
                        .setTitle('Browse FAQ Category');
                    const categoryInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('name')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder(faqContent_1.botFaqCategories[0]?.id ?? 'category-id')
                        .setRequired(true)
                        .setMaxLength(100);
                    const categoryLabel = new discord_js_1.LabelBuilder()
                        .setLabel(`Category ID (${faqContent_1.botFaqCategories.length} available)`)
                        .setTextInputComponent(categoryInput);
                    modal.addLabelComponents(categoryLabel);
                    await interaction.showModal(modal);
                    break;
                }
                case 'server_setup': {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                        .setTitle('\u2699\ufe0f Server Setup & Admin')
                        .setDescription('One-time setup and admin tools.\n' +
                        'Click a button to open that feature\u2019s panel.');
                    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId('guild_panel_status')
                        .setLabel('Server Link')
                        .setEmoji('\ud83d\udd17')
                        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                        .setCustomId('federation_panel_status')
                        .setLabel('Federation')
                        .setEmoji('\ud83c\udfe9')
                        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                        .setCustomId('voice_panel_create')
                        .setLabel('Voice Channels')
                        .setEmoji('\ud83d\udd0a')
                        .setStyle(discord_js_1.ButtonStyle.Secondary));
                    await interaction.reply({
                        embeds: [embed],
                        components: [row1],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                case 'more_features': {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                        .setTitle('\ud83d\udce6 More Features')
                        .setDescription('Additional features accessible through panels.\n' +
                        'Click a button to open that feature\u2019s panel.');
                    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId('diplomacy_panel_status')
                        .setLabel('Diplomacy')
                        .setEmoji('\ud83c\udf0d')
                        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                        .setCustomId('commlink_panel_list')
                        .setLabel('Comm Links')
                        .setEmoji('\ud83d\udd17')
                        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                        .setCustomId('discover_panel_opportunities')
                        .setLabel('Discover')
                        .setEmoji('\ud83d\udd0d')
                        .setStyle(discord_js_1.ButtonStyle.Secondary));
                    await interaction.reply({
                        embeds: [embed],
                        components: [row1],
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                default:
                    await interaction.reply({ content: '❌ Unknown action.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (error) {
            logger_1.logger.error('Help button handler failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
        }
    },
    async handleModal(interaction) {
        try {
            const handled = await routeHelpModal(interaction);
            if (!handled) {
                await interaction.reply({ content: '❌ Unknown modal.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (error) {
            (0, errorHandler_1.logError)(error, 'HelpCommand.handleModal');
            const message = (0, errorHandler_1.getErrorMessage)(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${message}` });
            }
            else {
                await interaction.reply({ content: `❌ ${message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
    },
    async execute(interaction) {
        try {
            const commands = interaction.client.commands;
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                .setTitle('Fringe Core Bot \u2014 Help Center')
                .setDescription('Type any command to open its interactive panel with action buttons.\n' +
                'Panels let you browse data, select from lists, and fill in forms.\n\n' +
                '**How it works:** Type `/command` (e.g. `/bounty`, `/mission`, `/events`) to get started.')
                .setFooter({ text: 'Fringe Core Bot \u2022 fringecore.space/bot-commands' })
                .setTimestamp();
            if (commands?.size) {
                const slashCmds = [...commands.values()].filter(cmd => slashRoots_1.TOP_LEVEL_SLASH_COMMAND_NAME_SET.has(cmd.data.name));
                const categorized = new Map();
                for (const cmd of slashCmds) {
                    const cat = cmd.category ?? 'General';
                    const list = categorized.get(cat) ?? [];
                    list.push(cmd);
                    categorized.set(cat, list);
                }
                for (const [category, cmds] of categorized) {
                    const lines = cmds.map(formatCommandHelp);
                    embed.addFields({
                        name: category.charAt(0).toUpperCase() + category.slice(1),
                        value: lines.join('\n'),
                    });
                }
            }
            else {
                embed.setDescription('No commands registered yet.');
            }
            const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('help_panel_wiki')
                .setLabel('Wiki')
                .setEmoji('\ud83d\udcd6')
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId('help_panel_faq')
                .setLabel('FAQ')
                .setEmoji('\u2753')
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId('help_panel_server_setup')
                .setLabel('Server Setup')
                .setEmoji('\u2699\ufe0f')
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId('help_panel_more_features')
                .setLabel('More Features')
                .setEmoji('\ud83d\udce6')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.reply({ embeds: [embed], components: [row1] });
        }
        catch (error) {
            await (0, commandErrorHandler_1.handleCommandError)(interaction, error, 'HelpCommand.execute');
        }
    },
};
async function handleFaqList(interaction) {
    const totalItems = faqContent_1.botFaqCategories.reduce((sum, cat) => sum + cat.items.length, 0);
    const categoryLines = faqContent_1.botFaqCategories.map(cat => `${cat.emoji} **${cat.title}** — ${cat.items.length} question${cat.items.length === 1 ? '' : 's'}\n> ${cat.description}`);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle('📖 SC Fleet Manager — FAQ')
        .setDescription(`Browse **${totalItems}** frequently asked questions across **${faqContent_1.botFaqCategories.length}** categories.\n\n${categoryLines.join('\n\n')}`)
        .setFooter({
        text: 'Use the By Category button to browse a specific category',
    })
        .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
}
async function routeHelpModal(interaction) {
    const { customId } = interaction;
    if (customId === 'help_wiki_search_modal') {
        await handleWikiSearchModal(interaction);
        return true;
    }
    if (customId === 'help_wiki_view_modal') {
        await handleWikiViewModal(interaction);
        return true;
    }
    if (customId === 'help_faq_search_modal') {
        await handleFaqSearchModal(interaction);
        return true;
    }
    if (customId === 'help_faq_category_modal') {
        await handleFaqCategoryModal(interaction);
        return true;
    }
    return false;
}
async function handleWikiSearchModal(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: '❌ Wiki can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const query = interaction.fields.getTextInputValue('query').trim();
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const organizationId = await getWikiServices().guildOrgService.resolveOrganization(interaction.guildId);
    if (!organizationId) {
        await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
        });
        return;
    }
    const results = await getWikiServices().wikiService.searchPages(organizationId, query, 5);
    if (results.length === 0) {
        await interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.WARNING)
                    .setTitle('No Wiki Results')
                    .setDescription(`No pages matched **"${truncateText(query, 80)}"**. Try a different search term.`),
            ],
        });
        return;
    }
    const lines = results.map((result, i) => {
        const snippet = result.snippet
            ? truncateText(stripMarkdown(result.snippet), 100)
            : 'No preview available.';
        return `**${i + 1}.** 📄 **${result.title}** (\`${result.slug}\`)\n> ${snippet}`;
    });
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`Wiki Search: "${truncateText(query, 60)}"`)
        .setDescription(lines.join('\n\n'))
        .setFooter({
        text: `${results.length} result${results.length === 1 ? '' : 's'} — Full wiki at fringecore.space/wiki`,
    })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
async function handleWikiViewModal(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: '❌ Wiki can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const pageRef = interaction.fields.getTextInputValue('page').trim();
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const organizationId = await getWikiServices().guildOrgService.resolveOrganization(interaction.guildId);
    if (!organizationId) {
        await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
        });
        return;
    }
    const page = await getWikiServices().wikiService.getPage(organizationId, pageRef);
    const contentPreview = page.content
        ? truncateText(stripMarkdown(page.content), 1800)
        : '*No content yet.*';
    const appUrl = process.env.APP_URL ?? 'https://fringecore.space';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`📖 ${page.title}`)
        .setDescription(contentPreview)
        .addFields({ name: 'Slug', value: `\`${page.slug}\``, inline: true }, { name: 'Version', value: `${page.version}`, inline: true }, { name: 'Status', value: page.isLocked ? '🔒 Locked' : '📝 Editable', inline: true })
        .setFooter({ text: `Edit on web: ${appUrl}/wiki/${page.slug}` })
        .setTimestamp(new Date(page.updatedAt));
    await interaction.editReply({ embeds: [embed] });
}
async function handleFaqSearchModal(interaction) {
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
            value: `${truncateText(item.answer, 200)}\n*Category: ${item.categoryTitle}*`,
        });
    });
    embed.setFooter({ text: 'Use the By Category button for full category details' });
    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
}
async function handleFaqCategoryModal(interaction) {
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
    const totalPages = Math.ceil(category.items.length / FAQ_ITEMS_PER_PAGE);
    const pageItems = category.items.slice(0, FAQ_ITEMS_PER_PAGE);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`${category.emoji} ${category.title}`)
        .setDescription(category.description)
        .setTimestamp();
    pageItems.forEach((item, index) => {
        embed.addFields({
            name: `${index + 1}. ${item.question}`,
            value: truncateText(item.answer, 250),
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
//# sourceMappingURL=help.js.map