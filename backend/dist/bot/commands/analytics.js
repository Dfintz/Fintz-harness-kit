"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analytics = void 0;
const discord_js_1 = require("discord.js");
const analyticsEmbeds_1 = require("../embeds/analyticsEmbeds");
const commandAnalytics_1 = require("../utils/commandAnalytics");
const commandAnalytics = commandAnalytics_1.CommandAnalytics.getInstance();
exports.analytics = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('analytics')
        .setDescription('View bot command usage summary (Admin only)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    cooldown: 10,
    category: 'admin',
    permissions: ['ManageGuild'],
    guildOnly: true,
    defer: 'ephemeral',
    async execute(interaction) {
        const stats = commandAnalytics.getSystemStats();
        const successRate = stats.totalCommands > 0
            ? ((stats.totalSuccessful / stats.totalCommands) * 100).toFixed(1)
            : '0.0';
        const topList = stats.topCommands.length > 0
            ? stats.topCommands
                .slice(0, 5)
                .map((cmd, i) => `${i + 1}. \`/${cmd.command}\` — ${cmd.count.toLocaleString()}`)
                .join('\n')
            : 'No data yet';
        const uptimeSeconds = Math.floor(process.uptime());
        const uptimeHours = Math.floor(uptimeSeconds / 3600);
        const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
        const embed = (0, analyticsEmbeds_1.buildBotAnalyticsSummaryEmbed)({
            totalCommands: stats.totalCommands,
            successRate,
            averageExecutionTime: stats.averageExecutionTime,
            uptimeHours,
            uptimeMinutes,
            uniqueUsers: stats.uniqueUsers,
            wsPing: interaction.client.ws.ping,
            uniqueGuilds: stats.uniqueGuilds,
            topList,
        });
        await interaction.editReply({ embeds: [embed] });
    },
};
//# sourceMappingURL=analytics.js.map