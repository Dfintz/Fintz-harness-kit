"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUserStatsEmbed = buildUserStatsEmbed;
exports.buildInviteLeaderboardEmbed = buildInviteLeaderboardEmbed;
exports.buildEngagementLeaderboardEmbed = buildEngagementLeaderboardEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildUserStatsEmbed(stats) {
    const voiceHours = Math.floor(stats.voiceMinutes / 60);
    const voiceMins = stats.voiceMinutes % 60;
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle('\u{1F4CA} Your Engagement Stats (30 days)')
        .addFields({ name: '\u{1F4AC} Messages', value: `${stats.messageCount}`, inline: true }, { name: '\u{1F3A4} Voice', value: `${voiceHours}h ${voiceMins}m`, inline: true })
        .setTimestamp();
}
function buildInviteLeaderboardEmbed(topInviters) {
    const lines = topInviters.map((e, i) => `**${i + 1}.** <@${e.inviterUserId}> \u2014 ${e.count} invite${e.count !== 1 ? 's' : ''}`);
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle('\u{1F4E8} Invite Leaderboard')
        .setDescription(lines.join('\n'))
        .setTimestamp();
}
function buildEngagementLeaderboardEmbed(entries, metric) {
    const metricLabel = metric === 'messageCount' ? '\u{1F4AC} Messages' : '\u{1F3A4} Voice';
    const lines = entries.map((entry, i) => {
        const value = metric === 'voiceMinutes'
            ? `${Math.floor(entry.total / 60)}h ${entry.total % 60}m`
            : `${entry.total}`;
        return `**${i + 1}.** <@${entry.userId}> \u2014 ${value}`;
    });
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle(`\u{1F4CA} ${metricLabel} Leaderboard (30 days)`)
        .setDescription(lines.join('\n'))
        .setTimestamp();
}
//# sourceMappingURL=statsEmbeds.js.map