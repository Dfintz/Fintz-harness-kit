"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stats = void 0;
const discord_js_1 = require("discord.js");
const InviteTrackingService_1 = require("../../services/discord/InviteTrackingService");
const MemberEngagementService_1 = require("../../services/discord/MemberEngagementService");
const statsEmbeds_1 = require("../embeds/statsEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const deferInteraction_1 = require("../utils/deferInteraction");
exports.stats = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('stats')
        .setDescription('Server engagement statistics and configuration'),
    category: 'utility',
    handleButton: async (interaction) => {
        await handleStatsButton(interaction);
    },
    execute: async (interaction) => {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, STATS_PANEL_CONFIG);
    },
};
const STATS_PANEL_PREFIX = 'stats';
const STATS_PANEL_CONFIG = {
    prefix: STATS_PANEL_PREFIX,
    title: '📊 Server Stats',
    description: 'View engagement statistics, invite tracking, and leaderboards.',
    buttons: [
        { subcommand: 'me', label: 'My Stats', emoji: '👤', style: discord_js_1.ButtonStyle.Primary },
        { subcommand: 'invites', label: 'Invites', emoji: '📨' },
        { subcommand: 'leaderboard_msg', label: 'Leaderboard (Messages)', emoji: '💬' },
        { subcommand: 'leaderboard_voice', label: 'Leaderboard (Voice)', emoji: '🎤' },
    ],
};
async function handleStatsButton(interaction) {
    const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, STATS_PANEL_PREFIX);
    if (!sub) {
        return;
    }
    switch (sub) {
        case 'me':
            await handleStatMeFromButton(interaction);
            break;
        case 'invites':
            await handleInvitesFromButton(interaction);
            break;
        case 'leaderboard_msg':
            await handleLeaderboardFromButton(interaction, 'messageCount');
            break;
        case 'leaderboard_voice':
            await handleLeaderboardFromButton(interaction, 'voiceMinutes');
            break;
        default:
            break;
    }
}
async function handleStatMeFromButton(interaction) {
    await (0, deferInteraction_1.deferInteraction)(interaction, 'ephemeral');
    try {
        const service = MemberEngagementService_1.MemberEngagementService.getInstance();
        const stats = await service.getUserStats(interaction.guildId, interaction.user.id, 30);
        const embed = (0, statsEmbeds_1.buildUserStatsEmbed)(stats);
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.editReply({ content: `❌ Error: ${msg}` });
    }
}
async function handleInvitesFromButton(interaction) {
    await (0, deferInteraction_1.deferInteraction)(interaction, 'ephemeral');
    try {
        const service = InviteTrackingService_1.InviteTrackingService.getInstance();
        const topInviters = await service.getTopInviters(interaction.guildId, 10);
        if (topInviters.length === 0) {
            await interaction.editReply({ content: '📭 No invite data yet.' });
            return;
        }
        const embed = (0, statsEmbeds_1.buildInviteLeaderboardEmbed)(topInviters);
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.editReply({ content: `❌ Error: ${msg}` });
    }
}
async function handleLeaderboardFromButton(interaction, metric) {
    await (0, deferInteraction_1.deferInteraction)(interaction, 'ephemeral');
    try {
        const service = MemberEngagementService_1.MemberEngagementService.getInstance();
        const lb = await service.getLeaderboard(interaction.guildId, metric, 30, 10);
        if (lb.length === 0) {
            await interaction.editReply({ content: '📭 No engagement data yet.' });
            return;
        }
        const embed = (0, statsEmbeds_1.buildEngagementLeaderboardEmbed)(lb, metric);
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.editReply({ content: `❌ Error: ${msg}` });
    }
}
//# sourceMappingURL=stats.js.map