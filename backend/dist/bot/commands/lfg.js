"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lfg = exports.JOIN_LIMIT_PER_HOUR = void 0;
exports.lfgPostRateLimitKey = lfgPostRateLimitKey;
exports.lfgJoinRateLimitKey = lfgJoinRateLimitKey;
exports._resolveLfgMentionRoleIdForGuild = _resolveLfgMentionRoleIdForGuild;
exports._buildLfgListView = _buildLfgListView;
const discord_js_1 = require("discord.js");
const communication_1 = require("../../services/communication");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const rateLimitPolicy_1 = require("../../services/shared/rateLimitPolicy");
const RedisRateLimiter_1 = require("../../services/shared/RedisRateLimiter");
const social_1 = require("../../services/social");
const ReputationService_1 = require("../../services/social/ReputationService");
const types_1 = require("../../types");
const logger_1 = require("../../utils/logger");
const lfgEmbed_1 = require("../embeds/lfgEmbed");
const voiceInterfaceEmbed_1 = require("../embeds/voiceInterfaceEmbed");
const lfgButtons_1 = require("../interactions/lfgButtons");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const dmAwareReply_1 = require("../utils/dmAwareReply");
const emojiMaps_1 = require("../utils/emojiMaps");
const paginationControls_1 = require("../utils/paginationControls");
const sharedChoices_1 = require("../utils/sharedChoices");
const lfgPresenceMonitor_1 = require("../voice/lfgPresenceMonitor");
let _lfgService = null;
function getLfgService() {
    _lfgService ??= social_1.SocialGroupService.getInstance();
    return _lfgService;
}
let _repService = null;
function getReputationService() {
    _repService ??= new ReputationService_1.ReputationService();
    return _repService;
}
const POST_LIMIT_PER_HOUR = 3;
exports.JOIN_LIMIT_PER_HOUR = 15;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const pendingLfgCreates = new Map();
const PENDING_LFG_TTL_MS = 10 * 60 * 1000;
function cleanPendingLfgCreates() {
    const now = Date.now();
    for (const [key, val] of pendingLfgCreates) {
        if (now - val.timestamp > PENDING_LFG_TTL_MS) {
            pendingLfgCreates.delete(key);
        }
    }
}
function lfgPostRateLimitKey(guildId, userId) {
    return (0, rateLimitPolicy_1.buildRateLimitKey)('lfg', 'post', guildId ?? 'DM', userId);
}
function lfgJoinRateLimitKey(guildId, userId) {
    return (0, rateLimitPolicy_1.buildRateLimitKey)('lfg', 'join', guildId ?? 'DM', userId);
}
async function resolveGuildScopedSettings(guildId) {
    try {
        const organizationId = await GuildOrganizationService_1.GuildOrganizationService.getInstance()
            .resolveOrganization(guildId)
            .catch(() => null);
        if (organizationId) {
            const orgScoped = await DiscordSettingsService_1.discordSettingsService.getSettings(organizationId, guildId);
            if (orgScoped) {
                return orgScoped;
            }
        }
        const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        return allSettings?.[0] ?? null;
    }
    catch {
        return null;
    }
}
async function _resolveLfgMentionRoleIdForGuild(guildId) {
    try {
        const guildSettings = await resolveGuildScopedSettings(guildId);
        return guildSettings?.lfgSettings?.lfgMentionRoleId ?? undefined;
    }
    catch (error) {
        logger_1.logger.debug('LFG: failed to resolve mention role from guild settings', {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
    }
}
const LFG_LIST_PAGE_PREFIX = 'lfg_listpage_';
const LFG_LIST_PAGE_SIZE = 10;
function _buildLfgListView(posts, page) {
    const { pageItems, page: currentPage, totalPages, total, } = (0, paginationControls_1.paginate)(posts, page, LFG_LIST_PAGE_SIZE);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('\ud83c\udfae Active LFG Posts')
        .setDescription(`Found ${total} active LFG post(s)`)
        .setTimestamp();
    for (const post of pageItems) {
        const statusIcon = (0, emojiMaps_1.getLfgStatusEmoji)(post.status);
        const activityIcon = (0, emojiMaps_1.getLfgActivityEmoji)(post.activity);
        embed.addFields({
            name: `${activityIcon} ${post.activity} - ${post.description}`,
            value: `**ID:** ${post.id}\n` +
                `**Creator:** ${post.creatorName}\n` +
                `**Players:** ${post.currentPlayers}/${post.maxPlayers} ${statusIcon}\n` +
                `**Expires:** <t:${Math.floor(post.expiresAt.getTime() / 1000)}:R>`,
            inline: false,
        });
    }
    if (totalPages > 1) {
        embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} \u2022 ${total} posts` });
    }
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => `${LFG_LIST_PAGE_PREFIX}${targetPage}`,
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
async function handlePanelList(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guildId = interaction.guildId || 'DM';
    const activePosts = await getLfgService().getActivePostsByGuild(guildId);
    if (activePosts.length === 0) {
        await interaction.editReply('\ud83d\udd0d No active LFG posts in this server at the moment.');
        return;
    }
    await (0, dmAwareReply_1.dmAwareEditReply)(interaction, _buildLfgListView(activePosts, 0));
}
async function handleLfgListPageButton(interaction) {
    const page = Number.parseInt(interaction.customId.slice(LFG_LIST_PAGE_PREFIX.length), 10);
    if (Number.isNaN(page) || page < 0) {
        return;
    }
    const guildId = interaction.guildId || 'DM';
    const activePosts = await getLfgService().getActivePostsByGuild(guildId);
    if (activePosts.length === 0) {
        await interaction.update({
            content: '\ud83d\udd0d No active LFG posts in this server at the moment.',
            embeds: [],
            components: [],
        });
        return;
    }
    await interaction.update(_buildLfgListView(activePosts, page));
}
async function handlePanelCreate(interaction) {
    const row = (0, sharedChoices_1.buildLfgActivitySelect)('lfg_select_create_activity');
    await interaction.reply({
        content: '🎮 **Create LFG Post** — What activity are you looking for?',
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handlePanelMatch(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply('\u274c This command can only be used in a server.');
        return;
    }
    const userId = interaction.user.id;
    const allPosts = await getLfgService().getActivePostsByGuild(interaction.guildId);
    let matchedPosts = allPosts.filter((p) => p.status === 'open' && !p.members.includes(userId));
    matchedPosts.sort((a, b) => b.maxPlayers - b.currentPlayers - (a.maxPlayers - a.currentPlayers));
    matchedPosts = matchedPosts.slice(0, 5);
    if (matchedPosts.length === 0) {
        await interaction.editReply('\ud83d\udd0d No matching LFG posts found. Try creating one!');
        return;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('\ud83c\udfaf LFG Matches')
        .setDescription(`Found **${matchedPosts.length}** matching post(s):`)
        .setTimestamp();
    for (const post of matchedPosts) {
        const slotsLeft = post.maxPlayers - post.currentPlayers;
        embed.addFields({
            name: `${(0, emojiMaps_1.getLfgActivityEmoji)(post.activity)} ${post.activity} \u2014 ${slotsLeft} slot(s) left`,
            value: `${post.description}\n\ud83c\udd94 \`${post.id}\` \u00b7 ${(0, emojiMaps_1.getLfgStatusEmoji)(post.status)} ${post.status.toUpperCase()} \u00b7 \ud83d\udc65 ${post.currentPlayers}/${post.maxPlayers}`,
            inline: false,
        });
    }
    await interaction.editReply({ embeds: [embed] });
}
async function handlePanelReputation(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply('\u274c This command can only be used in a server.');
        return;
    }
    const targetUser = interaction.user;
    try {
        const organizationId = await GuildOrganizationService_1.GuildOrganizationService.getInstance()
            .resolveOrganization(interaction.guildId)
            .catch(() => null);
        const unified = await getReputationService().getUnifiedReputation(targetUser.id, organizationId ?? undefined);
        const tierLabel = unified.userReputation.tier;
        const totalSessions = unified.userReputation.totalSessions;
        const successRate = Math.round(unified.userReputation.successRate ?? 0);
        const avgRating = unified.userReputation.averageRating?.toFixed(1) ?? 'N/A';
        const score = unified.combinedScore;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`LFG Reputation: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields({ name: '\ud83c\udfc5 Tier', value: tierLabel, inline: true }, { name: '\ud83d\udcca Combined Score', value: `${score}/100`, inline: true }, { name: '\ud83c\udfae Sessions', value: `${totalSessions}`, inline: true }, { name: '\u2705 Success Rate', value: `${successRate}%`, inline: true }, { name: '\u2b50 Avg Rating', value: avgRating, inline: true })
            .setFooter({ text: 'Reputation is based on your full LFG history' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('ReputationService unavailable, falling back to active-post heuristic', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            userId: targetUser.id,
            guildId: interaction.guildId,
        });
        let totalActivity = 0;
        try {
            const history = await getLfgService().getUserHistory(targetUser.id, 1000);
            totalActivity = history.length;
        }
        catch {
            const activePosts = await getLfgService().getActivePostsByGuild(interaction.guildId);
            totalActivity =
                activePosts.filter((p) => p.creatorId === targetUser.id).length +
                    activePosts.filter((p) => p.members.includes(targetUser.id)).length;
        }
        let tier;
        let tierEmoji;
        if (totalActivity >= 50) {
            tier = 'Legendary';
            tierEmoji = '\ud83c\udfc6';
        }
        else if (totalActivity >= 25) {
            tier = 'Veteran';
            tierEmoji = '\u2b50';
        }
        else if (totalActivity >= 10) {
            tier = 'Active';
            tierEmoji = '\ud83c\udf96\ufe0f';
        }
        else if (totalActivity >= 3) {
            tier = 'Regular';
            tierEmoji = '\ud83d\udd35';
        }
        else {
            tier = 'Newcomer';
            tierEmoji = '\ud83c\udd95';
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`${tierEmoji} LFG Reputation: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields({ name: '\ud83c\udfc5 Tier', value: `${tierEmoji} ${tier}`, inline: true }, { name: '\ud83d\udcca Total Sessions', value: `${totalActivity}`, inline: true })
            .setFooter({ text: 'Reputation based on session history (detailed stats unavailable)' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
}
async function handlePanelSettings(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply('\u274c This command can only be used in a server.');
        return;
    }
    const currentSettings = await resolveGuildScopedSettings(interaction.guildId);
    const current = currentSettings?.lfgSettings;
    const gameFiltersText = current?.gameFilters?.length
        ? current.gameFilters.map((g) => `\`${g}\``).join(', ')
        : '*(Star Citizen only)*';
    const otherGamesChannelText = current?.otherGamesChannelId
        ? `<#${current.otherGamesChannelId}>`
        : '*(not set)*';
    const publicLfgChannelText = current?.publicLfgChannelId
        ? `<#${current.publicLfgChannelId}>`
        : '*(not set)*';
    const publicOptInRoleText = current?.publicLfgOptInRoleId
        ? `<@&${current.publicLfgOptInRoleId}>`
        : '*(all members)*';
    const mentionRoleText = current?.lfgMentionRoleId
        ? `<@&${current.lfgMentionRoleId}>`
        : '*(none — no role pinged)*';
    const lines = [
        '**LFG Settings:**',
        `\u2022 Default Game: \`${current?.defaultGame ?? 'Star Citizen'}\``,
        `\u2022 Game Filters: ${gameFiltersText}`,
        `\u2022 Other Games Channel: ${otherGamesChannelText}`,
        `\u2022 Public LFG: ${current?.publicLfgEnabled ? '**Enabled**' : '**Disabled**'}`,
        `\u2022 Public Delivery: \`${current?.publicLfgDelivery ?? 'dm'}\``,
        `\u2022 Public LFG Channel: ${publicLfgChannelText}`,
        `\u2022 Public Opt-in Role: ${publicOptInRoleText}`,
        `\u2022 LFG Mention Role: ${mentionRoleText}`,
        '',
        '*Use admin-level slash commands for advanced settings changes.*',
    ];
    await interaction.editReply(lines.join('\n'));
}
async function handlePanelAutoLfg(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply('\u274c This command can only be used in a server.');
        return;
    }
    const monitor = lfgPresenceMonitor_1.LfgPresenceMonitor.getInstance();
    const isOptedIn = monitor.isOptedIn(interaction.user.id, interaction.guildId);
    if (isOptedIn) {
        monitor.optOut(interaction.user.id, interaction.guildId);
        await interaction.editReply('\u274c **Auto-LFG disabled.** You will no longer get automatic LFG posts when you start playing a game in voice chat.');
    }
    else {
        monitor.optIn(interaction.user.id, interaction.guildId, { maxPlayers: 4 });
        await interaction.editReply('\u2705 **Auto-LFG enabled!** When you start playing a game while in a voice channel, ' +
            'an LFG post will be created automatically so others can join you.\n\n' +
            '*Click Auto-LFG again to disable.*');
    }
}
async function handlePanelSmartPing(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    if (!interaction.guildId) {
        await interaction.editReply('\u274c This command can only be used in a server.');
        return;
    }
    const settings = await resolveGuildScopedSettings(interaction.guildId);
    const ping = settings?.smartLfgPingSettings;
    const enabled = ping?.enabled ?? false;
    const optInRoleText = ping?.optInRoleId ? `<@&${ping.optInRoleId}>` : '*(all members)*';
    const lines = [
        `\ud83d\udd14 **Smart LFG Ping:** ${enabled ? '\u2705 Enabled' : '\u274c Disabled'}`,
        '',
        'When enabled, the bot will intelligently ping members who might be interested when a new LFG post matches their activity preferences.',
        '',
        `\u2022 Cooldown: **${ping?.cooldownHours ?? 8}h** between pings`,
        `\u2022 Max pings per post: **${ping?.maxPingsPerPost ?? 5}**`,
        `\u2022 Opt-in role: ${optInRoleText}`,
        '',
        'Use `/notify` → **LFG Toggle** to enable/disable, or **LFG Config** to change settings.',
    ];
    await interaction.editReply(lines.join('\n'));
}
exports.lfg = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('lfg')
        .setDescription('Looking For Group - Quick group formation'),
    cooldown: 5,
    category: 'social',
    examples: ['/lfg'],
    guildOnly: true,
    async execute(interaction) {
        const panelConfig = {
            prefix: 'lfg',
            title: '\ud83c\udfae Looking for Group',
            description: 'Find or create groups for Star Citizen activities.\nClick a button below to get started.',
            buttons: [
                {
                    subcommand: 'list',
                    label: 'Browse Groups',
                    emoji: '\ud83d\udccb',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                {
                    subcommand: 'create',
                    label: 'Create Group',
                    emoji: '\u2795',
                    style: discord_js_1.ButtonStyle.Success,
                },
                { subcommand: 'match', label: 'Find Match', emoji: '\ud83c\udfaf' },
                { subcommand: 'autolfg', label: 'Auto-LFG', emoji: '\ud83e\udd16' },
                { subcommand: 'smartping', label: 'Smart Ping', emoji: '\ud83d\udd14' },
                { subcommand: 'reputation', label: 'My Reputation', emoji: '\u2b50' },
                { subcommand: 'settings', label: 'LFG Settings', emoji: '\u2699\ufe0f' },
            ],
        };
        const { embed, components } = (0, commandPanelBuilder_1.buildCommandPanel)(panelConfig);
        await interaction.reply({ embeds: [embed], components });
        if (interaction.guildId && interaction.channelId) {
            try {
                const organizationId = await GuildOrganizationService_1.GuildOrganizationService.getInstance()
                    .resolveOrganization(interaction.guildId)
                    .catch(() => null);
                if (organizationId) {
                    const guildSettings = await resolveGuildScopedSettings(interaction.guildId);
                    const current = guildSettings?.lfgNetworkSettings;
                    if (!current?.lfgChannelId) {
                        await DiscordSettingsService_1.discordSettingsService.updateLfgSettings(organizationId, interaction.guildId, { lfgChannelId: interaction.channelId }, interaction.user.id);
                        logger_1.logger.info(`LFG: captured panel channel ${interaction.channelId} as lfgChannelId for guild ${interaction.guildId}`);
                    }
                }
            }
            catch (err) {
                logger_1.logger.debug('LFG: failed to auto-capture panel channel as lfgChannelId', {
                    error: err instanceof Error ? err.message : String(err),
                    guildId: interaction.guildId,
                });
            }
        }
    },
    async handleButton(interaction) {
        const panelSub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'lfg');
        if (panelSub) {
            try {
                if (panelSub === 'list') {
                    await handlePanelList(interaction);
                }
                else if (panelSub === 'create') {
                    await handlePanelCreate(interaction);
                }
                else if (panelSub === 'match') {
                    await handlePanelMatch(interaction);
                }
                else if (panelSub === 'reputation') {
                    await handlePanelReputation(interaction);
                }
                else if (panelSub === 'autolfg') {
                    await handlePanelAutoLfg(interaction);
                }
                else if (panelSub === 'smartping') {
                    await handlePanelSmartPing(interaction);
                }
                else if (panelSub === 'settings') {
                    await handlePanelSettings(interaction);
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
            return;
        }
        if (interaction.customId.startsWith(LFG_LIST_PAGE_PREFIX)) {
            await handleLfgListPageButton(interaction);
            return;
        }
        if (interaction.customId.startsWith('lfg_team_')) {
            await (0, lfgButtons_1.handleTeamSuggestionButton)(interaction);
            return;
        }
        if ((0, lfgEmbed_1.parseLfgRatingId)(interaction.customId)) {
            await (0, lfgButtons_1.handleLfgRatingButton)(interaction);
            return;
        }
        await (0, lfgButtons_1.handleLfgButton)(interaction);
    },
    async handleSelectMenu(interaction) {
        if (interaction.customId === 'lfg_select_create_activity') {
            cleanPendingLfgCreates();
            const selectedActivity = interaction.values[0];
            if (!Object.values(types_1.LFGActivity).includes(selectedActivity)) {
                await interaction.reply({
                    content: '❌ Invalid activity type selected.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            pendingLfgCreates.set(interaction.user.id, {
                activity: selectedActivity,
                timestamp: Date.now(),
            });
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('lfg_panel_create_modal')
                .setTitle(`Create ${selectedActivity} LFG Post`);
            const descInput = new discord_js_1.TextInputBuilder()
                .setCustomId('description')
                .setPlaceholder('What are you looking to do?')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(200);
            const maxPlayersInput = new discord_js_1.TextInputBuilder()
                .setCustomId('maxplayers')
                .setPlaceholder('4')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2);
            const descLabel = new discord_js_1.LabelBuilder().setLabel('Description').setTextInputComponent(descInput);
            const maxPlayersLabel = new discord_js_1.LabelBuilder()
                .setLabel('Max Players (1-50)')
                .setTextInputComponent(maxPlayersInput);
            modal.addLabelComponents(descLabel, maxPlayersLabel);
            await interaction.showModal(modal);
            return;
        }
        await (0, lfgButtons_1.handleLfgRatingSelect)(interaction);
    },
    async handleModal(interaction) {
        if (interaction.customId === 'lfg_panel_create_modal') {
            await handlePanelCreateModal(interaction);
            return;
        }
        if (interaction.customId.startsWith('lfg_rate_comment_modal_')) {
            await (0, lfgButtons_1.handleLfgCommentModal)(interaction);
        }
        else {
            await (0, lfgButtons_1.handleLfgRatingModal)(interaction);
        }
    },
};
async function handlePanelCreateModal(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const pending = pendingLfgCreates.get(interaction.user.id);
    const activity = pending?.activity ?? types_1.LFGActivity.OTHER;
    pendingLfgCreates.delete(interaction.user.id);
    const description = interaction.fields.getTextInputValue('description').trim();
    const maxPlayersRaw = interaction.fields.getTextInputValue('maxplayers').trim();
    const maxPlayers = Number.parseInt(maxPlayersRaw, 10);
    if (Number.isNaN(maxPlayers) || maxPlayers < 1 || maxPlayers > 50) {
        await interaction.editReply('\u274c Max players must be a number between 1 and 50.');
        return;
    }
    const rateLimit = await RedisRateLimiter_1.redisRateLimiter.check(lfgPostRateLimitKey(interaction.guildId, interaction.user.id), POST_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_SECONDS);
    if (!rateLimit.allowed) {
        await interaction.editReply('\u26d4 You have reached the hourly limit for creating LFG posts in this server.');
        return;
    }
    let voiceChannelId;
    let autoCreatedVoiceChannel = false;
    const guildId = interaction.guildId ?? 'DM';
    if (interaction.guild) {
        const member = interaction.member;
        const existingVc = member?.voice?.channel;
        if (existingVc) {
            voiceChannelId = existingVc.id;
        }
        else {
            voiceChannelId = await createLfgVoiceChannel(interaction.guild, member, activity, maxPlayers);
            if (voiceChannelId) {
                autoCreatedVoiceChannel = true;
            }
        }
    }
    const lfgService = getLfgService();
    const post = lfgService.createPost(activity, description, interaction.user.id, interaction.user.username, maxPlayers, guildId, interaction.channelId ?? '', 60, { voiceChannelId });
    post.autoCreatedVoiceChannel = autoCreatedVoiceChannel;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('\ud83c\udfae LFG Post Created!')
        .setDescription(`**${(0, emojiMaps_1.getLfgActivityEmoji)(activity)} ${activity}**\n${description}`)
        .addFields({ name: 'Post ID', value: post.id, inline: true }, { name: 'Players', value: `${post.currentPlayers}/${post.maxPlayers}`, inline: true }, {
        name: 'Status',
        value: `${(0, emojiMaps_1.getLfgStatusEmoji)(post.status)} ${post.status.toUpperCase()}`,
        inline: true,
    }, { name: 'Creator', value: interaction.user.username, inline: true }, {
        name: 'Expires',
        value: `<t:${Math.floor(post.expiresAt.getTime() / 1000)}:R>`,
        inline: true,
    })
        .setFooter({ text: `Post ID: ${post.id}` })
        .setTimestamp();
    await (0, dmAwareReply_1.dmAwareEditReply)(interaction, { embeds: [embed] });
    if (interaction.channel && 'send' in interaction.channel) {
        const lfgEmbed = (0, lfgEmbed_1.buildLfgEmbed)(post);
        const lfgButtons = (0, lfgEmbed_1.buildLfgButtons)(post.id);
        let mentionContent;
        let mentionRoleId;
        if (interaction.guildId) {
            mentionRoleId = await _resolveLfgMentionRoleIdForGuild(interaction.guildId);
            if (mentionRoleId) {
                mentionContent = `<@&${mentionRoleId}>`;
            }
        }
        const sentMessage = await interaction.channel.send({
            content: mentionContent,
            embeds: [lfgEmbed],
            components: [lfgButtons],
            allowedMentions: mentionRoleId ? { roles: [mentionRoleId] } : { parse: [] },
        });
        getLfgService().setMessageId(post.id, sentMessage.id);
    }
}
async function createLfgVoiceChannel(guild, member, activity, maxPlayers) {
    try {
        const botMember = guild.members.me;
        if (!botMember?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
            logger_1.logger.debug('LFG VC: bot lacks ManageChannels permission', { guildId: guild.id });
            return undefined;
        }
        let parentCategoryId;
        try {
            const settings = await resolveGuildScopedSettings(guild.id);
            parentCategoryId =
                settings?.lfgSettings?.lfgVoiceCategoryId ??
                    settings?.voiceChannelSettings?.parentCategoryId;
        }
        catch {
        }
        if (parentCategoryId) {
            try {
                const parentChannel = await guild.channels.fetch(parentCategoryId);
                if (parentChannel?.type !== discord_js_1.ChannelType.GuildCategory) {
                    logger_1.logger.warn('LFG VC: configured parent category not found or wrong type, falling back to root', {
                        guildId: guild.id,
                        parentCategoryId,
                    });
                    parentCategoryId = undefined;
                }
            }
            catch {
                logger_1.logger.warn('LFG VC: configured parent category not found, falling back to root', {
                    guildId: guild.id,
                    parentCategoryId,
                });
                parentCategoryId = undefined;
            }
        }
        const channelName = `🎮 LFG: ${activity}`;
        const vc = await guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildVoice,
            parent: parentCategoryId,
            userLimit: maxPlayers,
            reason: 'Auto-created for LFG post',
            permissionOverwrites: member
                ? [
                    {
                        id: member.id,
                        allow: [
                            discord_js_1.PermissionFlagsBits.ManageChannels,
                            discord_js_1.PermissionFlagsBits.MoveMembers,
                            discord_js_1.PermissionFlagsBits.MuteMembers,
                        ],
                    },
                ]
                : [],
        });
        const voiceChannelService = communication_1.VoiceChannelService.getInstance();
        voiceChannelService.createChannel(channelName, guild.id, vc.id, member?.id ?? 'system', types_1.VoiceChannelType.TEMPORARY, { expiresAt: new Date(Date.now() + 65 * 60 * 1000), userLimit: maxPlayers });
        if (member?.voice?.channelId === null) {
        }
        logger_1.logger.info(`🎤 Created LFG voice channel "${channelName}" in ${guild.name}`, {
            channelId: vc.id,
            guildId: guild.id,
        });
        try {
            const creatorName = member?.displayName ?? 'Unknown';
            const embed = (0, voiceInterfaceEmbed_1.buildVoiceInterfaceEmbed)(channelName, creatorName);
            const controlRow = (0, voiceInterfaceEmbed_1.buildVoiceControlButtons)(vc.id);
            const modRow = (0, voiceInterfaceEmbed_1.buildVoiceModerationButtons)(vc.id);
            const extRow = (0, voiceInterfaceEmbed_1.buildVoiceExtendedButtons)(vc.id);
            await vc.send({ embeds: [embed], components: [controlRow, modRow, extRow] });
        }
        catch (panelErr) {
            logger_1.logger.debug('LFG VC: failed to post voice control panel', {
                channelId: vc.id,
                error: panelErr instanceof Error ? panelErr.message : String(panelErr),
            });
        }
        return vc.id;
    }
    catch (error) {
        logger_1.logger.warn('Failed to create LFG voice channel', {
            guildId: guild.id,
            activity,
            maxPlayers,
            error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
    }
}
//# sourceMappingURL=lfg.js.map