"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RATE_LIMIT_MULTIPLIERS = exports.RATE_LIMIT_ALERT_THRESHOLD = exports.RATE_LIMIT_LOGGING_ENABLED = exports.RATE_LIMIT_WHITELIST_IPS = exports.RATE_LIMIT_WHITELIST_USERS = exports.RATE_LIMIT_REDIS_PREFIX = exports.RATE_LIMIT_REDIS_ENABLED = exports.RATE_LIMIT_MAX_REQUESTS = exports.RATE_LIMIT_WINDOW_MS = void 0;
exports.getRoleLimitMultiplier = getRoleLimitMultiplier;
exports.isUserWhitelisted = isUserWhitelisted;
exports.isIpWhitelisted = isIpWhitelisted;
exports.logRateLimitConfig = logRateLimitConfig;
const logger_1 = require("../utils/logger");
exports.RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
exports.RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 200);
exports.RATE_LIMIT_REDIS_ENABLED = process.env.RATE_LIMIT_REDIS_ENABLED !== 'false';
exports.RATE_LIMIT_REDIS_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX ?? 'ratelimit:';
exports.RATE_LIMIT_WHITELIST_USERS = process.env.RATE_LIMIT_WHITELIST_USERS?.split(',')
    .map(id => id.trim())
    .filter(Boolean) ?? [];
exports.RATE_LIMIT_WHITELIST_IPS = process.env.RATE_LIMIT_WHITELIST_IPS?.split(',')
    .map(ip => ip.trim())
    .filter(Boolean) ?? [];
exports.RATE_LIMIT_LOGGING_ENABLED = process.env.RATE_LIMIT_LOGGING_ENABLED !== 'false';
exports.RATE_LIMIT_ALERT_THRESHOLD = Number(process.env.RATE_LIMIT_ALERT_THRESHOLD ?? 5);
exports.ROLE_RATE_LIMIT_MULTIPLIERS = {
    admin: Number(process.env.RATE_LIMIT_ADMIN_MULTIPLIER || 5),
    premium: Number(process.env.RATE_LIMIT_PREMIUM_MULTIPLIER || 3),
    user: Number(process.env.RATE_LIMIT_USER_MULTIPLIER || 1),
    guest: Number(process.env.RATE_LIMIT_GUEST_MULTIPLIER || 0.5),
};
function getRoleLimitMultiplier(role) {
    if (!role) {
        return 1.0;
    }
    return exports.ROLE_RATE_LIMIT_MULTIPLIERS[role.toLowerCase()] || 1.0;
}
function isUserWhitelisted(userId) {
    return exports.RATE_LIMIT_WHITELIST_USERS.includes(userId);
}
function isIpWhitelisted(ip) {
    return exports.RATE_LIMIT_WHITELIST_IPS.includes(ip);
}
function logRateLimitConfig() {
    logger_1.logger.info('Rate Limiting Configuration:');
    logger_1.logger.info(`  Window: ${exports.RATE_LIMIT_WINDOW_MS}ms (${exports.RATE_LIMIT_WINDOW_MS / 1000 / 60} minutes)`);
    logger_1.logger.info(`  Max Requests: ${exports.RATE_LIMIT_MAX_REQUESTS}`);
    logger_1.logger.info(`  Redis Enabled: ${exports.RATE_LIMIT_REDIS_ENABLED}`);
    logger_1.logger.info(`  Redis Prefix: ${exports.RATE_LIMIT_REDIS_PREFIX}`);
    logger_1.logger.info(`  Logging Enabled: ${exports.RATE_LIMIT_LOGGING_ENABLED}`);
    logger_1.logger.info(`  Alert Threshold: ${exports.RATE_LIMIT_ALERT_THRESHOLD} violations`);
    if (exports.RATE_LIMIT_WHITELIST_USERS.length > 0) {
        logger_1.logger.info(`  Whitelisted Users: ${exports.RATE_LIMIT_WHITELIST_USERS.length} user(s)`);
    }
    if (exports.RATE_LIMIT_WHITELIST_IPS.length > 0) {
        logger_1.logger.info(`  Whitelisted IPs: ${exports.RATE_LIMIT_WHITELIST_IPS.length} IP(s)`);
    }
    logger_1.logger.info('  Role Multipliers:');
    Object.entries(exports.ROLE_RATE_LIMIT_MULTIPLIERS).forEach(([role, multiplier]) => {
        logger_1.logger.info(`    ${role}: ${multiplier}x`);
    });
}
//# sourceMappingURL=rateLimitConfig.js.map