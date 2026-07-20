"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRsiStatusRootMenuEmbed = buildRsiStatusRootMenuEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildRsiStatusRootMenuEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🛰️ RSI Status Monitor')
        .setDescription('Check the current RSI service status, deploy a live-updating panel, or mirror the ' +
        'status into channel names with an emoji.');
}
//# sourceMappingURL=rsistatusEmbeds.js.map