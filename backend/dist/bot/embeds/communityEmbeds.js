"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCommunityHubEmbed = buildCommunityHubEmbed;
exports.buildCommunityGiveawaysEmbed = buildCommunityGiveawaysEmbed;
exports.buildCommunityPollsEmbed = buildCommunityPollsEmbed;
exports.buildCommunityAnnouncementsEmbed = buildCommunityAnnouncementsEmbed;
exports.buildCommunityCustomEmbedsEmbed = buildCommunityCustomEmbedsEmbed;
exports.buildCommunityReactionRolesEmbed = buildCommunityReactionRolesEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildCommunityHubEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🎉 Community Tools')
        .setDescription([
        'Manage engagement tools for your server.',
        '',
        '🎁 **Giveaways** — Create and manage prize giveaways',
        '🗳️ **Polls** — Run polls and view results',
        '📢 **Announcements** — Draft, schedule, and send announcements',
        '📝 **Custom Embeds** — Create and send rich embed messages',
        '🎭 **Reaction Roles** — Button-based self-assignment role panels',
    ].join('\n'))
        .setFooter({ text: 'Click a button below to open that tool' })
        .setTimestamp();
}
function buildCommunityGiveawaysEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🎁 Giveaways')
        .setDescription('Create and manage giveaways.');
}
function buildCommunityPollsEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🗳️ Polls')
        .setDescription('Create and manage organization polls.');
}
function buildCommunityAnnouncementsEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('📢 Announcements')
        .setDescription('Create, manage, and send announcements.');
}
function buildCommunityCustomEmbedsEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('📝 Custom Embeds')
        .setDescription('Create and send custom embed messages.');
}
function buildCommunityReactionRolesEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🎭 Reaction Roles')
        .setDescription('Create button-based role self-assignment panels.');
}
//# sourceMappingURL=communityEmbeds.js.map