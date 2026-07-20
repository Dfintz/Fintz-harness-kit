"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionCooldownMessage = interactionCooldownMessage;
exports.consumeInteractionCooldown = consumeInteractionCooldown;
exports.interactionErrorMessage = interactionErrorMessage;
exports.trackInteractionLatency = trackInteractionLatency;
exports.executeInteraction = executeInteraction;
const discord_js_1 = require("discord.js");
const applicationInsights_1 = require("../../config/applicationInsights");
const rateLimitPolicy_1 = require("../../services/shared/rateLimitPolicy");
const RedisRateLimiter_1 = require("../../services/shared/RedisRateLimiter");
const logger_1 = require("../../utils/logger");
const deferInteraction_1 = require("./deferInteraction");
const interactionErrorTaxonomy_1 = require("./interactionErrorTaxonomy");
function interactionCooldownMessage(remainingSeconds) {
    return `⏱️ Please wait ${remainingSeconds.toFixed(1)}s before trying that again.`;
}
function isDistributedCooldownEnabled() {
    return process.env.BOT_DISTRIBUTED_COOLDOWN === 'true';
}
const COOLDOWN_RATE_LIMIT_DOMAIN = 'cooldown';
async function consumeInteractionCooldown(cooldownKey, userId, cooldownSeconds, cooldownManager) {
    if (isDistributedCooldownEnabled()) {
        const key = (0, rateLimitPolicy_1.buildRateLimitKey)(COOLDOWN_RATE_LIMIT_DOMAIN, cooldownKey, userId);
        const result = await RedisRateLimiter_1.RedisRateLimiter.getInstance().check(key, 1, cooldownSeconds);
        return result.allowed ? 0 : (0, rateLimitPolicy_1.rateLimitRetryAfterSeconds)(result);
    }
    const remaining = cooldownManager.checkCooldown(cooldownKey, userId, cooldownSeconds);
    if (remaining > 0) {
        return remaining;
    }
    cooldownManager.setCooldown(cooldownKey, userId);
    return 0;
}
const INTERACTION_ERROR_MESSAGE = {
    slash: '❌ Something went wrong running that command.',
    button: '❌ Something went wrong processing that action.',
    modal: '❌ Something went wrong processing that form.',
    select: '❌ Something went wrong processing that selection.',
};
const INTERACTION_DEGRADED_MESSAGE = '⏳ The service is a bit busy right now — please try that again in a moment.';
const INTERACTION_RATE_LIMITED_MESSAGE = '⏱️ That action is being rate-limited right now — please wait a moment and try again.';
function interactionErrorMessage(kind, errorClass) {
    if (errorClass === 'timeout' || errorClass === 'dependency') {
        return INTERACTION_DEGRADED_MESSAGE;
    }
    if (errorClass === 'rate_limit') {
        return INTERACTION_RATE_LIMITED_MESSAGE;
    }
    return INTERACTION_ERROR_MESSAGE[kind];
}
function trackInteractionLatency(kind, commandName, durationMs, success, guildId, errorClass) {
    (0, applicationInsights_1.trackMetric)(`bot_${kind}_latency_ms`, durationMs);
    (0, applicationInsights_1.trackEvent)('BotCommandExecuted', {
        kind,
        commandName,
        success: String(success),
        durationMs: String(durationMs),
        guildId: guildId ?? 'DM',
        ...(errorClass ? { errorClass } : {}),
    });
}
function trackInteractionFailure(kind, commandName, errorClass, guildId) {
    (0, applicationInsights_1.trackMetric)(`bot_interaction_failed_${errorClass}`, 1);
    (0, applicationInsights_1.trackEvent)('BotInteractionFailed', {
        kind,
        commandName,
        errorClass,
        guildId: guildId ?? 'DM',
    });
}
function trackCooldownRejection(kind, commandName, guildId) {
    (0, applicationInsights_1.trackMetric)(`bot_${kind}_cooldown_rejected`, 1);
    (0, applicationInsights_1.trackEvent)('BotInteractionCooldownRejected', {
        kind,
        commandName,
        guildId: guildId ?? 'DM',
    });
}
async function respondEphemeral(interaction, content) {
    const payload = { content, flags: discord_js_1.MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => { });
    }
    else {
        await interaction.reply(payload).catch(() => { });
    }
}
async function executeInteraction(options) {
    const { interaction, kind, analyticsLabel, cooldownKey, cooldownSeconds, cooldownManager, commandAnalytics, defer, run, } = options;
    const userId = interaction.user.id;
    const guildId = interaction.guildId ?? undefined;
    const remaining = await consumeInteractionCooldown(cooldownKey, userId, cooldownSeconds, cooldownManager);
    if (remaining > 0) {
        trackCooldownRejection(kind, analyticsLabel, guildId);
        await respondEphemeral(interaction, interactionCooldownMessage(remaining));
        return;
    }
    const startTime = Date.now();
    let success = true;
    let errorMessage;
    let errorClass;
    try {
        if (defer) {
            await (0, deferInteraction_1.deferInteraction)(interaction, defer);
        }
        await run();
    }
    catch (error) {
        success = false;
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        errorMessage = normalizedError.message;
        errorClass = (0, interactionErrorTaxonomy_1.classifyInteractionError)(normalizedError);
        logger_1.logger.error(`Interaction handler failed (kind=${kind}, label=${analyticsLabel}, class=${errorClass}, guild=${guildId ?? 'DM'}, user=${userId}): ${errorMessage}`, normalizedError);
        await respondEphemeral(interaction, interactionErrorMessage(kind, errorClass));
    }
    finally {
        const executionTime = Date.now() - startTime;
        commandAnalytics?.logCommandUsage({
            commandName: analyticsLabel,
            userId,
            userName: interaction.user.username,
            guildId: interaction.guildId ?? 'DM',
            guildName: interaction.guild?.name ?? 'Direct Message',
            success,
            executionTime,
            error: errorMessage,
            timestamp: new Date(),
        });
        trackInteractionLatency(kind, analyticsLabel, executionTime, success, guildId, errorClass);
        if (errorClass) {
            trackInteractionFailure(kind, analyticsLabel, errorClass, guildId);
        }
    }
}
//# sourceMappingURL=interactionExecutor.js.map