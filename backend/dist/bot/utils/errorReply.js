"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatErrorForUser = formatErrorForUser;
exports.replyWithError = replyWithError;
const discord_js_1 = require("discord.js");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
function isJoiError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        error.isJoi === true &&
        Array.isArray(error.details));
}
function formatJoiDetails(items) {
    return items
        .slice(0, 5)
        .map(item => `• ${item.message}`)
        .join('\n');
}
function formatErrorForUser(error) {
    if (isJoiError(error)) {
        return `❌ Invalid input:\n${formatJoiDetails(error.details)}`;
    }
    if ((0, apiErrors_1.isApiError)(error)) {
        return formatApiErrorForUser(error);
    }
    return '❌ An unexpected error occurred. Please try again or contact an administrator.';
}
function formatApiErrorForUser(error) {
    if (error instanceof apiErrors_1.ValidationError) {
        return `❌ ${error.message}`;
    }
    if (error instanceof apiErrors_1.NotFoundError) {
        return `❌ ${error.message || 'Not found.'}`;
    }
    if (error instanceof apiErrors_1.UnauthorizedError) {
        return '🔒 You need to authenticate before using this command.';
    }
    if (error instanceof apiErrors_1.ForbiddenError) {
        return "🚫 You don't have permission to perform this action.";
    }
    if (error instanceof apiErrors_1.ConflictError) {
        return `⚠️ ${error.message}`;
    }
    if (error instanceof apiErrors_1.RateLimitError) {
        return '⏳ You are doing that too often. Please wait a moment and try again.';
    }
    return `❌ ${error.message}`;
}
async function replyWithError(interaction, error, options = {}) {
    const userMessage = formatErrorForUser(error);
    const logFields = {
        context: options.context,
        interactionId: interaction.id,
        userId: interaction.user?.id,
        guildId: interaction.guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...options.logExtra,
    };
    if ((0, apiErrors_1.isApiError)(error) || isJoiError(error)) {
        logger_1.logger.info('Bot command operational error', logFields);
    }
    else {
        logger_1.logger.error('Bot command unexpected error', logFields);
    }
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: userMessage });
        }
        else {
            await interaction.reply({ content: userMessage, flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
    catch (replyErr) {
        logger_1.logger.warn('Failed to send error reply to Discord interaction', {
            context: options.context,
            interactionId: interaction.id,
            replyError: replyErr instanceof Error ? replyErr.message : String(replyErr),
        });
    }
}
//# sourceMappingURL=errorReply.js.map