"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNoOpportunitiesEmbed = buildNoOpportunitiesEmbed;
exports.buildDiscoveredOpportunitiesEmbed = buildDiscoveredOpportunitiesEmbed;
exports.buildNoGroupsFoundEmbed = buildNoGroupsFoundEmbed;
exports.buildActiveLfgGroupsEmbed = buildActiveLfgGroupsEmbed;
exports.buildLfgStatsEmbed = buildLfgStatsEmbed;
const discord_js_1 = require("discord.js");
function buildNoOpportunitiesEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('\u{1F50D} No Opportunities Found')
        .setDescription('No matching opportunities were found. Try broadening your search.');
}
function buildDiscoveredOpportunitiesEmbed(lines, pagination) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('\u{1F50D} Discovered Opportunities')
        .setDescription(lines.join('\n\n'))
        .setFooter({
        text: `Showing ${lines.length} of ${pagination.total} results • Page ${pagination.page}/${pagination.totalPages}`,
    })
        .setTimestamp();
}
function buildNoGroupsFoundEmbed(description) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('\u{1F50D} No Groups Found')
        .setDescription(description);
}
function buildActiveLfgGroupsEmbed(lines, totalFound) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('\u{1F3AE} Active LFG Groups')
        .setDescription(lines.join('\n\n'))
        .setFooter({
        text: `${totalFound} group${totalFound === 1 ? '' : 's'} found • Use /lfg join postid:<id> to join`,
    })
        .setTimestamp();
}
function buildLfgStatsEmbed(displayName, avatarUrl, stats) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`\u{1F4CA} LFG Stats \u2014 ${displayName}`)
        .setThumbnail(avatarUrl)
        .addFields({ name: '\u{1F3AE} Total Sessions', value: String(stats.totalSessions), inline: true }, { name: '✅ Successful', value: String(stats.successfulSessions), inline: true }, { name: '❌ Failed', value: String(stats.failedSessions), inline: true }, {
        name: '\u{1F4C8} Success Rate',
        value: `${stats.successRate}%`,
        inline: true,
    }, {
        name: '⏱️ Avg Duration',
        value: stats.averageDuration ? `${stats.averageDuration} min` : 'N/A',
        inline: true,
    }, {
        name: '⭐ Favorite Activity',
        value: stats.favoriteActivity ?? 'N/A',
        inline: true,
    }, {
        name: '\u{1F465} Players Encountered',
        value: String(stats.totalPlayersEncountered),
        inline: true,
    })
        .setTimestamp();
    if (stats.totalSessions === 0) {
        embed.setDescription('No LFG sessions recorded yet. Use `/lfg create` to start grouping!');
    }
    return embed;
}
//# sourceMappingURL=discoverEmbeds.js.map