"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBriefingUsageEmbed = buildBriefingUsageEmbed;
exports.buildGeneratedMissionBriefingEmbed = buildGeneratedMissionBriefingEmbed;
exports.buildQuickMissionBriefingEmbed = buildQuickMissionBriefingEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildBriefingUsageEmbed(stats) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle('\u{1F4CA} Briefing Usage')
        .addFields({ name: 'Used Today', value: `${stats.requestCount}`, inline: true }, { name: 'Daily Limit', value: `${stats.dailyLimit}`, inline: true }, { name: 'Remaining', value: `${stats.remaining}`, inline: true }, { name: 'Total Tokens', value: stats.totalTokens.toLocaleString(), inline: true })
        .setFooter({ text: 'Limits reset daily at midnight UTC' })
        .setTimestamp();
}
function buildGeneratedMissionBriefingEmbed(input) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`Briefing: ${input.missionTitle}`)
        .setDescription(input.briefingText || '*No briefing content generated.*')
        .addFields({ name: 'Model', value: input.modelUsed, inline: true }, { name: 'Tokens', value: `${input.tokensUsed.toLocaleString()}`, inline: true })
        .setFooter({ text: `Mission ID: ${input.missionId}` })
        .setTimestamp();
}
function buildQuickMissionBriefingEmbed(input) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.QUANTUM_GOLD)
        .setTitle(`Quick Briefing: ${input.missionTypeLabel} Mission`)
        .setDescription(input.briefingText || '*No briefing content generated.*')
        .addFields({ name: 'Difficulty', value: 'Medium', inline: true }, { name: 'Model', value: input.modelUsed, inline: true }, { name: 'Tokens', value: `${input.tokensUsed.toLocaleString()}`, inline: true })
        .setFooter({ text: 'Quick briefing \u2014 not attached to a saved mission' })
        .setTimestamp();
}
//# sourceMappingURL=briefingEmbeds.js.map