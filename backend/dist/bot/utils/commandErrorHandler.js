"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeReply = safeReply;
exports.handleCommandError = handleCommandError;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
async function safeReply(interaction, options) {
    const flags = options.flags ?? discord_js_1.MessageFlags.Ephemeral;
    try {
        if (interaction.replied) {
            await interaction.followUp({ content: options.content, flags });
        }
        else if (interaction.deferred) {
            await interaction.editReply({ content: options.content });
        }
        else {
            await interaction.reply({ content: options.content, flags });
        }
    }
    catch {
        logger_1.logger.warn(`Could not respond to interaction ${interaction.id} — may have expired`);
    }
}
async function handleCommandError(interaction, error, context, guidance) {
    logger_1.logger.error(`Error in ${context}`, error instanceof Error ? error : new Error(String(error)));
    let content = '❌ Something went wrong. Please try again later.';
    if (guidance) {
        content += `\n💡 ${guidance}`;
    }
    await safeReply(interaction, { content, flags: discord_js_1.MessageFlags.Ephemeral });
}
//# sourceMappingURL=commandErrorHandler.js.map