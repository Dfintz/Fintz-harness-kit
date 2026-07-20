"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deferInteraction = deferInteraction;
const discord_js_1 = require("discord.js");
async function deferInteraction(interaction, mode = 'reply') {
    if (interaction.replied || interaction.deferred) {
        return false;
    }
    if (mode === 'update' &&
        'deferUpdate' in interaction &&
        typeof interaction.deferUpdate === 'function') {
        await interaction.deferUpdate();
        return true;
    }
    if (mode === 'ephemeral') {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        return true;
    }
    await interaction.deferReply();
    return true;
}
//# sourceMappingURL=deferInteraction.js.map