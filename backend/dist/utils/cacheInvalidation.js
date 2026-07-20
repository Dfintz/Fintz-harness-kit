"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateMemberStatsCache = invalidateMemberStatsCache;
exports.invalidateFleetSummaryCache = invalidateFleetSummaryCache;
exports.invalidateBountyStatsCache = invalidateBountyStatsCache;
exports.invalidateActivityCache = invalidateActivityCache;
exports.invalidateTradeCache = invalidateTradeCache;
exports.invalidateTrustScoreCache = invalidateTrustScoreCache;
exports.invalidateDirectoryStatsCache = invalidateDirectoryStatsCache;
const logger_1 = require("./logger");
const redis_1 = require("./redis");
function toPrefix(pattern) {
    return pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
}
function fireAndForget(organizationId, keys, patterns, label) {
    const ops = [];
    if (keys.length > 0) {
        ops.push(redis_1.cache.del(keys));
    }
    if (organizationId && patterns.length > 0) {
        ops.push(redis_1.cache.delOrgCacheKeys(organizationId, patterns.map(toPrefix)));
    }
    Promise.all(ops).catch(err => {
        logger_1.logger.warn(`Cache invalidation failed: ${label}`, err);
    });
}
function invalidateMemberStatsCache(orgId) {
    fireAndForget(orgId, [`org:${orgId}:member:stats`, `org:${orgId}:dashboard:summary`], [], `member:stats for org ${orgId}`);
}
function invalidateFleetSummaryCache(orgId) {
    fireAndForget(orgId, [`org:${orgId}:fleet:summary`, `org:${orgId}:dashboard:summary`], [], `fleet:summary for org ${orgId}`);
}
function invalidateBountyStatsCache(orgId) {
    fireAndForget(orgId, [`org:${orgId}:bounty:stats`, `org:${orgId}:dashboard:summary`], [], `bounty:stats for org ${orgId}`);
}
function invalidateActivityCache(orgId) {
    fireAndForget(orgId, [`org:${orgId}:activity:metrics`, `org:${orgId}:dashboard:summary`], [`org:${orgId}:activity:trends:*`], `activity caches for org ${orgId}`);
}
function invalidateTradeCache(orgId) {
    fireAndForget(orgId, [`org:${orgId}:dashboard:summary`], [`org:${orgId}:trade:overview:*`], `trade:overview for org ${orgId}`);
}
function invalidateTrustScoreCache(orgId) {
    fireAndForget(orgId, [`org:${orgId}:trust:score`], [], `trust:score for org ${orgId}`);
}
function invalidateDirectoryStatsCache() {
    fireAndForget(undefined, ['public:directory:stats', 'public:sitemap:xml'], [], 'public directory stats + sitemap');
}
//# sourceMappingURL=cacheInvalidation.js.map