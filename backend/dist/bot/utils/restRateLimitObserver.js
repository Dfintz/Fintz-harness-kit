"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeRateLimit = describeRateLimit;
exports.describeInvalidRequestWarning = describeInvalidRequestWarning;
exports.registerRestRateLimitObserver = registerRestRateLimitObserver;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
function describeRateLimit(data) {
    const isGlobal = data.global || data.scope === 'global';
    return {
        level: isGlobal ? 'warn' : 'debug',
        message: isGlobal
            ? 'Discord global rate limit reached — all bot REST requests are paused until reset'
            : 'Discord rate limit reached — request queued and retried automatically by discord.js',
        context: {
            scope: data.scope,
            global: data.global,
            method: data.method,
            route: data.route,
            majorParameter: data.majorParameter,
            limit: data.limit,
            retryAfterMs: data.retryAfter,
            timeToResetMs: data.timeToReset,
            sublimitTimeoutMs: data.sublimitTimeout,
        },
    };
}
function describeInvalidRequestWarning(data) {
    return {
        level: 'warn',
        message: 'Discord invalid-request warning — approaching the Cloudflare ban threshold (10k invalid requests / 10 min)',
        context: {
            invalidRequestCount: data.count,
            windowResetMs: data.remainingTime,
        },
    };
}
function emit(log, entry) {
    if (entry.level === 'warn') {
        log.warn(entry.message, entry.context);
    }
    else {
        log.debug(entry.message, entry.context);
    }
}
function registerRestRateLimitObserver(rest, log = logger_1.logger) {
    rest.on(discord_js_1.RESTEvents.RateLimited, (data) => {
        emit(log, describeRateLimit(data));
    });
    rest.on(discord_js_1.RESTEvents.InvalidRequestWarning, (data) => {
        emit(log, describeInvalidRequestWarning(data));
    });
}
//# sourceMappingURL=restRateLimitObserver.js.map