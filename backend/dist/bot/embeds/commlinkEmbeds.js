"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTunnelCreatedEmbed = buildTunnelCreatedEmbed;
exports.buildTunnelInfoEmbed = buildTunnelInfoEmbed;
exports.buildAvailableTunnelsEmbed = buildAvailableTunnelsEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildTunnelCreatedEmbed(input) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u2705 Tunnel Created')
        .addFields({ name: 'Name', value: input.tunnelName, inline: true }, { name: 'ID', value: `\`${input.tunnelId}\``, inline: true }, { name: 'Public', value: input.isPublicFromPassword ? 'Yes' : 'No', inline: true })
        .setTimestamp();
    if (input.inviteCode) {
        embed.addFields({ name: 'Invite Code', value: `\`${input.inviteCode}\``, inline: true });
    }
    return embed;
}
function buildTunnelInfoEmbed(input) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`\u{1F517} Tunnel: ${input.tunnelName}`)
        .addFields({ name: 'ID', value: `\`${input.tunnelId}\``, inline: true }, { name: 'Public', value: input.isPublic ? 'Yes' : 'No', inline: true }, { name: 'Connections', value: `${input.connectedChannelsCount}`, inline: true })
        .setTimestamp();
    if (input.inviteCode) {
        embed.addFields({ name: 'Invite Code', value: `\`${input.inviteCode}\``, inline: true });
    }
    return embed;
}
function buildAvailableTunnelsEmbed(input) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F309} Available Tunnels')
        .setTimestamp();
    if (input.guildTunnels.length > 0) {
        const guildList = input.guildTunnels
            .map(t => {
            const icon = t.isPublic ? '\u{1F30D}' : '\u{1F512}';
            return `${icon} **${t.name}** (ID: \`${t.id}\`)\n   Connected: ${t.connectedChannelsCount} channels`;
        })
            .join('\n\n');
        embed.addFields({ name: "Your Server's Tunnels", value: guildList, inline: false });
    }
    const otherPublicTunnels = input.publicTunnels.filter(t => !input.guildTunnels.some(gt => gt.id === t.id));
    if (otherPublicTunnels.length > 0) {
        const publicList = otherPublicTunnels
            .slice(0, 10)
            .map(t => `\u{1F30D} **${t.name}** (ID: \`${t.id}\`)\n   Connected: ${t.connectedChannelsCount} channels`)
            .join('\n\n');
        embed.addFields({ name: 'Public Tunnels', value: publicList, inline: false });
    }
    if (input.guildTunnels.length === 0 && otherPublicTunnels.length === 0) {
        embed.setDescription('No tunnels available. Create one with `/commlink create`!');
    }
    return embed;
}
//# sourceMappingURL=commlinkEmbeds.js.map