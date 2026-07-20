"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIRMATION_CANCELLED_MESSAGE = void 0;
exports.confirmationQuestion = confirmationQuestion;
exports.buildConfirmationPrompt = buildConfirmationPrompt;
exports.respondConfirmationCancelled = respondConfirmationCancelled;
const discord_js_1 = require("discord.js");
const DEFAULT_CONFIRM_LABEL = 'Confirm';
const DEFAULT_CANCEL_LABEL = 'Cancel';
const DEFAULT_CONFIRM_EMOJI = '✅';
const DEFAULT_CANCEL_EMOJI = '❌';
exports.CONFIRMATION_CANCELLED_MESSAGE = '❎ Cancelled — no changes were made.';
function confirmationQuestion(message) {
    return `⚠️ Are you sure you want to ${message}? **This can't be undone.**`;
}
function buildConfirmationPrompt(options) {
    const { confirmCustomId, cancelCustomId, message, confirmLabel = DEFAULT_CONFIRM_LABEL, cancelLabel = DEFAULT_CANCEL_LABEL, confirmEmoji = DEFAULT_CONFIRM_EMOJI, cancelEmoji = DEFAULT_CANCEL_EMOJI, content, } = options;
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(confirmCustomId)
        .setLabel(confirmLabel)
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji(confirmEmoji), new discord_js_1.ButtonBuilder()
        .setCustomId(cancelCustomId)
        .setLabel(cancelLabel)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji(cancelEmoji));
    return {
        content: content ?? confirmationQuestion(message),
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    };
}
async function respondConfirmationCancelled(interaction, message = exports.CONFIRMATION_CANCELLED_MESSAGE) {
    const payload = { content: message, flags: discord_js_1.MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => { });
    }
    else {
        await interaction.reply(payload).catch(() => { });
    }
}
//# sourceMappingURL=confirmationPrompt.js.map