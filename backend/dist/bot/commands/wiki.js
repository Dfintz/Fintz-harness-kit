"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wiki = void 0;
const discord_js_1 = require("discord.js");
const WikiService_1 = require("../../services/content/WikiService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const errorHandler_1 = require("../../utils/errorHandler");
const wikiEmbeds_1 = require("../embeds/wikiEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
let _services = null;
function getServices() {
    _services ??= {
        wikiService: new WikiService_1.WikiService(),
        guildOrgService: GuildOrganizationService_1.GuildOrganizationService.getInstance(),
    };
    return _services;
}
const PANEL_CONFIG = {
    prefix: 'wiki',
    title: 'Wiki',
    description: 'Browse and search the wiki.',
    buttons: [
        {
            subcommand: 'search',
            label: 'Search Wiki',
            emoji: '\ud83d\udd0d',
            style: discord_js_1.ButtonStyle.Primary,
        },
        { subcommand: 'view', label: 'View Page', emoji: '\ud83d\udcc4' },
    ],
};
exports.wiki = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('wiki')
        .setDescription('Search and view organization wiki pages'),
    cooldown: 5,
    category: 'organization',
    guildOnly: true,
    examples: ['/wiki view page:getting-started', '/wiki search query:mining guide'],
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, PANEL_CONFIG);
    },
    async handleButton(interaction) {
        const subcommand = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'wiki');
        if (!subcommand) {
            return;
        }
        switch (subcommand) {
            case 'search': {
                const modal = new discord_js_1.ModalBuilder().setCustomId('wiki_search_modal').setTitle('Search Wiki');
                const queryInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('query')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder('e.g. mining guide')
                    .setRequired(true)
                    .setMaxLength(100);
                modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(queryInput));
                await interaction.showModal(modal);
                break;
            }
            case 'view': {
                const modal = new discord_js_1.ModalBuilder().setCustomId('wiki_view_modal').setTitle('View Wiki Page');
                const pageInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('page')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder('e.g. getting-started')
                    .setRequired(true)
                    .setMaxLength(200);
                modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(pageInput));
                await interaction.showModal(modal);
                break;
            }
            default:
                await interaction.reply({ content: '❌ Unknown action.', flags: discord_js_1.MessageFlags.Ephemeral });
        }
    },
    async handleModal(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        try {
            const organizationId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
            if (!organizationId) {
                await interaction.reply({
                    content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            if (interaction.customId === 'wiki_search_modal') {
                const query = interaction.fields.getTextInputValue('query').trim();
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const results = await getServices().wikiService.searchPages(organizationId, query, 5);
                if (results.length === 0) {
                    await interaction.editReply({ embeds: [(0, wikiEmbeds_1.buildWikiNoResultsEmbed)(query)] });
                    return;
                }
                await interaction.editReply({ embeds: [(0, wikiEmbeds_1.buildWikiSearchEmbed)(query, results)] });
            }
            else if (interaction.customId === 'wiki_view_modal') {
                const pageRef = interaction.fields.getTextInputValue('page').trim();
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const page = await getServices().wikiService.getPage(organizationId, pageRef);
                await interaction.editReply({ embeds: [(0, wikiEmbeds_1.buildWikiPageEmbed)(page)] });
            }
        }
        catch (error) {
            (0, errorHandler_1.logError)(error, 'WikiCommand.handleModal');
            const message = (0, errorHandler_1.getErrorMessage)(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${message}` });
            }
            else {
                await interaction.reply({ content: `❌ ${message}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
    },
};
//# sourceMappingURL=wiki.js.map