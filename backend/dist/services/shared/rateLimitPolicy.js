"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRateLimitKey = buildRateLimitKey;
exports.rateLimitRetryAfterSeconds = rateLimitRetryAfterSeconds;
function buildRateLimitKey(domain, action, ...scope) {
    return [domain, action, ...scope].join(':');
}
function rateLimitRetryAfterSeconds(result, now = Date.now()) {
    const deltaMs = result.resetAt.getTime() - now;
    if (deltaMs <= 0) {
        return 0;
    }
    return Math.ceil(deltaMs / 1000);
}
//# sourceMappingURL=rateLimitPolicy.js.map