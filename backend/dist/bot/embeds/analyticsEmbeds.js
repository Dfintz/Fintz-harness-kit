"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBotAnalyticsSummaryEmbed = buildBotAnalyticsSummaryEmbed;
const discord_js_1 = require("discord.js");
function buildBotAnalyticsSummaryEmbed(input) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Bot Analytics Summary')
        .addFields({
        name: 'Commands Today',
        value: `${input.totalCommands.toLocaleString()} (${input.successRate}% success)`,
        inline: true,
    }, {
        name: 'Avg Response',
        value: `${input.averageExecutionTime.toFixed(0)}ms`,
        inline: true,
    }, {
        name: 'Uptime',
        value: `${input.uptimeHours}h ${input.uptimeMinutes}m`,
        inline: true,
    }, {
        name: 'Unique Users',
        value: input.uniqueUsers.toLocaleString(),
        inline: true,
    }, {
        name: 'WebSocket Ping',
        value: `${input.wsPing}ms`,
        inline: true,
    }, {
        name: 'Guilds',
        value: input.uniqueGuilds.toLocaleString(),
        inline: true,
    }, {
        name: 'Top 5 Commands',
        value: input.topList,
        inline: false,
    })
        .setFooter({ text: 'Full analytics at fringecore.space/bot-stats' })
        .setTimestamp();
}
//# sourceMappingURL=analyticsEmbeds.js.map