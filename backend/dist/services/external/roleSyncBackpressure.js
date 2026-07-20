"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDiscordRateLimitError = isDiscordRateLimitError;
exports.extractRetryAfterMs = extractRetryAfterMs;
exports.createRoleSyncRateLimiter = createRoleSyncRateLimiter;
exports.wrapWithRoleSyncBackpressure = wrapWithRoleSyncBackpressure;
const adaptiveRateLimiter_1 = require("../../utils/adaptiveRateLimiter");
const DEFAULT_MIN_INTERVAL_MS = 250;
const DEFAULT_MAX_INTERVAL_MS = 5_000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECOVERY_MULTIPLIER = 0.5;
const DEFAULT_MAX_COOLDOWN_MS = 30_000;
function readNumericProp(obj, key) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
function isDiscordRateLimitError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    if (candidate.name === 'RateLimitError') {
        return true;
    }
    for (const key of ['status', 'statusCode', 'httpStatus']) {
        if (readNumericProp(candidate, key) === 429) {
            return true;
        }
    }
    if (typeof candidate.message === 'string') {
        const message = candidate.message.toLowerCase();
        if (message.includes('429') ||
            message.includes('rate limit') ||
            message.includes('too many requests')) {
            return true;
        }
    }
    return false;
}
function extractRetryAfterMs(error) {
    if (!error || typeof error !== 'object') {
        return undefined;
    }
    const candidate = error;
    const retryAfterMs = readNumericProp(candidate, 'retryAfter');
    if (retryAfterMs !== undefined && retryAfterMs > 0) {
        return retryAfterMs;
    }
    const timeToReset = readNumericProp(candidate, 'timeToReset');
    if (timeToReset !== undefined && timeToReset > 0) {
        return timeToReset;
    }
    const retryAfterSeconds = readNumericProp(candidate, 'retry_after');
    if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
    }
    return undefined;
}
function parsePositiveNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function createRoleSyncRateLimiter() {
    return new adaptiveRateLimiter_1.AdaptiveRateLimiter({
        minIntervalMs: parsePositiveNumberEnv('RSI_ROLE_SYNC_MIN_INTERVAL_MS', DEFAULT_MIN_INTERVAL_MS),
        maxIntervalMs: parsePositiveNumberEnv('RSI_ROLE_SYNC_MAX_INTERVAL_MS', DEFAULT_MAX_INTERVAL_MS),
        backoffMultiplier: parsePositiveNumberEnv('RSI_ROLE_SYNC_BACKOFF_MULTIPLIER', DEFAULT_BACKOFF_MULTIPLIER),
        recoveryMultiplier: parsePositiveNumberEnv('RSI_ROLE_SYNC_RECOVERY_MULTIPLIER', DEFAULT_RECOVERY_MULTIPLIER),
        maxCooldownMs: parsePositiveNumberEnv('RSI_ROLE_SYNC_MAX_COOLDOWN_MS', DEFAULT_MAX_COOLDOWN_MS),
        label: 'rsi-role-sync',
    });
}
function wrapWithRoleSyncBackpressure(service, limiter) {
    const runPaced = async (operation) => {
        await limiter.acquire();
        try {
            const result = await operation();
            limiter.recordSuccess();
            return result;
        }
        catch (error) {
            if (isDiscordRateLimitError(error)) {
                limiter.recordBackpressure(extractRetryAfterMs(error));
            }
            throw error;
        }
    };
    return {
        assignRole: (guildId, userId, roleId) => runPaced(() => service.assignRole(guildId, userId, roleId)),
        removeRole: (guildId, userId, roleId) => runPaced(() => service.removeRole(guildId, userId, roleId)),
    };
}
//# sourceMappingURL=roleSyncBackpressure.js.map