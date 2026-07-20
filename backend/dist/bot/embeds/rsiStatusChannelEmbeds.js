"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRsiStatusChannelMenuEmbed = buildRsiStatusChannelMenuEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildRsiStatusChannelMenuEmbed(applicationLine, serverLine) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🏷️ RSI Status Channels')
        .setDescription([
        'Show RSI status as a channel name with a status emoji that auto-updates every 5 minutes.',
        '',
        '• 🟢 Operational · 🟡 Degraded · 🔧 Maintenance · 🔴 Outage · ⚪ Unknown',
        '',
        '**Create channels** — the bot makes two locked voice channels for you.',
        '**Use existing** — search and pick a channel below; the bot keeps its name in sync.',
        '',
        applicationLine,
        serverLine,
    ].join('\n'))
        .setFooter({ text: 'Requires the Manage Channels permission.' });
}
//# sourceMappingURL=rsiStatusChannelEmbeds.js.map