"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMumbleButtons = buildMumbleButtons;
const discord_js_1 = require("discord.js");
function buildMumbleButtons(connectUrl, isOnline, hasAccess) {
    if (!connectUrl || !isOnline || !hasAccess) {
        return null;
    }
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setLabel('Join Server')
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(connectUrl)
        .setEmoji('🎧'));
    return row;
}
//# sourceMappingURL=mumblePanel.js.map