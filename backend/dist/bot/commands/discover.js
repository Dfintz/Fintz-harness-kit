"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discover = void 0;
const discord_js_1 = require("discord.js");
const OpportunitySearchService_1 = require("../../services/search/OpportunitySearchService");
const social_1 = require("../../services/social");
const discoverEmbeds_1 = require("../embeds/discoverEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const deferInteraction_1 = require("../utils/deferInteraction");
const emojiMaps_1 = require("../utils/emojiMaps");
let _services = null;
function getServices() {
    _services ??= {
        lfgService: social_1.SocialGroupService.getInstance(),
        opportunityService: new OpportunitySearchService_1.OpportunitySearchService(),
    };
    return _services;
}
exports.discover = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('discover')
        .setDescription('Discover opportunities, groups, and activities'),
    cooldown: 5,
    category: 'social',
    examples: [
        '/discover opportunities',
        '/discover opportunities type:Jobs search:"cargo hauling"',
        '/discover opportunities activity_type:Mission open_slots:True',
        '/discover groups activity:Mining',
        '/discover stats',
        '/discover stats user:@SomeUser',
    ],
    guildOnly: true,
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'discover');
        if (!sub) {
            return;
        }
        try {
            if (sub === 'opportunities') {
                await handleOpportunities(interaction);
            }
            else if (sub === 'groups') {
                await handleGroups(interaction);
            }
            else if (sub === 'stats') {
                await handleStats(interaction);
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `\u274c ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else {
                await interaction.reply({ content: `\u274c ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
    },
    async execute(interaction) {
        const panelConfig = {
            prefix: 'discover',
            title: '\ud83d\udd0d Discovery Hub',
            description: 'Find opportunities, groups, and activities across the platform.',
            buttons: [
                {
                    subcommand: 'opportunities',
                    label: 'Browse Opportunities',
                    emoji: '\ud83d\udcbc',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'groups', label: 'Find Groups', emoji: '\ud83c\udfae' },
                { subcommand: 'stats', label: 'My Stats', emoji: '\ud83d\udcca' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
async function handleOpportunities(interaction) {
    await (0, deferInteraction_1.deferInteraction)(interaction, 'reply');
    const sourceType = interaction.isChatInputCommand()
        ? (interaction.options.getString('type') ?? 'all')
        : 'all';
    const searchTerm = interaction.isChatInputCommand()
        ? (interaction.options.getString('search') ?? undefined)
        : undefined;
    const activityType = interaction.isChatInputCommand()
        ? interaction.options.getString('activity_type')
        : null;
    const hasOpenSlots = interaction.isChatInputCommand()
        ? (interaction.options.getBoolean('open_slots') ?? undefined)
        : undefined;
    const result = await getServices().opportunityService.searchOpportunities({
        sourceType,
        searchTerm,
        activityTypes: activityType ? [activityType] : undefined,
        hasOpenSlots: hasOpenSlots || undefined,
    }, { page: 1, limit: 10 });
    if (result.data.length === 0) {
        await interaction.editReply({
            embeds: [(0, discoverEmbeds_1.buildNoOpportunitiesEmbed)()],
        });
        return;
    }
    const lines = result.data.map((item, i) => {
        const icon = item.sourceType === 'job' ? '💼' : '🎮';
        const status = item.isActive ? '🟢' : '🔴';
        let slots = '';
        if (item.sourceType === 'job') {
            if (item.crewSpotsTotal) {
                slots = `${item.crewSpotsFilled ?? 0}/${item.crewSpotsTotal} crew`;
            }
        }
        else if (item.maxParticipants) {
            slots = `${item.currentParticipants ?? 0}/${item.maxParticipants} players`;
        }
        const slotsDisplay = slots ? ` (${slots})` : '';
        const description = item.description?.slice(0, 80) || 'No description';
        const organizationSuffix = item.organizationName ? ` — *${item.organizationName}*` : '';
        return `**${i + 1}.** ${status} ${icon} **${item.title}**${slotsDisplay}\n> ${description}${organizationSuffix}`;
    });
    const embed = (0, discoverEmbeds_1.buildDiscoveredOpportunitiesEmbed)(lines, {
        total: result.pagination.total,
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
    });
    await interaction.editReply({ embeds: [embed] });
}
async function handleGroups(interaction) {
    await (0, deferInteraction_1.deferInteraction)(interaction, 'reply');
    const activity = interaction.isChatInputCommand()
        ? interaction.options.getString('activity')
        : null;
    const allPosts = await getServices().lfgService.getAllActivePosts();
    let filtered = allPosts;
    if (activity) {
        filtered = allPosts.filter(post => post.activity === activity);
    }
    const guildId = interaction.guildId;
    if (guildId) {
        filtered = filtered.filter(post => post.guildId === guildId);
    }
    filtered = filtered.filter(post => post.status === 'open');
    if (filtered.length === 0) {
        const desc = activity
            ? `No open LFG groups found for **${(0, emojiMaps_1.getLfgActivityEmoji)(activity)} ${activity}**. Try creating one with \`/lfg create\`!`
            : 'No open LFG groups found in this server. Try creating one with `/lfg create`!';
        await interaction.editReply({
            embeds: [(0, discoverEmbeds_1.buildNoGroupsFoundEmbed)(desc)],
        });
        return;
    }
    const sortedPosts = [...filtered];
    sortedPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const sorted = sortedPosts.slice(0, 10);
    const lines = sorted.map((post, i) => {
        const emoji = (0, emojiMaps_1.getLfgActivityEmoji)(post.activity);
        const statusEmoji = (0, emojiMaps_1.getLfgStatusEmoji)(post.status);
        const timeLeft = Math.max(0, Math.round((post.expiresAt.getTime() - Date.now()) / 60000));
        return `**${i + 1}.** ${statusEmoji} ${emoji} **${post.activity}** — ${post.description.slice(0, 60)}\n> 👥 ${post.currentPlayers}/${post.maxPlayers} players • ⏱️ ${timeLeft}m left • ID: \`${post.id}\``;
    });
    const embed = (0, discoverEmbeds_1.buildActiveLfgGroupsEmbed)(lines, filtered.length);
    await interaction.editReply({ embeds: [embed] });
}
async function handleStats(interaction) {
    await (0, deferInteraction_1.deferInteraction)(interaction, 'reply');
    const targetUser = interaction.isChatInputCommand()
        ? (interaction.options.getUser('user') ?? interaction.user)
        : interaction.user;
    const stats = await getServices().lfgService.getUserStats(targetUser.id);
    const embed = (0, discoverEmbeds_1.buildLfgStatsEmbed)(targetUser.displayName, targetUser.displayAvatarURL(), stats);
    await interaction.editReply({ embeds: [embed] });
}
//# sourceMappingURL=discover.js.map