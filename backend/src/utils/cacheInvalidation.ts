/**
 * Cache Invalidation Helpers
 *
 * Centralized cache key invalidation for the 10 Redis-cached endpoints (Phase 5).
 * Each domain has a helper that clears its cache key + the dashboard summary.
 *
 * Functions are synchronous fire-and-forget: they kick off async deletion
 * internally and catch errors so callers don't need await/void.
 *
 * Usage: Call the appropriate invalidation function after any mutation that
 * changes the cached data. The helper handles key construction and deletion.
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Phase 5 (Redis Caching)
 */

import { logger } from './logger';
import { cache } from './redis';

/** Convert wildcard cache patterns (e.g. org:123:trade:overview:*) into key prefixes */
function toPrefix(pattern: string): string {
  return pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
}

/** Internal helper: run cache deletions and catch errors */
function fireAndForget(
  organizationId: string | undefined,
  keys: string[],
  patterns: string[],
  label: string
): void {
  const ops: Promise<unknown>[] = [];

  if (keys.length > 0) {
    ops.push(cache.del(keys));
  }

  // Use per-org key registry for wildcard invalidation to avoid global keyspace scans.
  if (organizationId && patterns.length > 0) {
    ops.push(cache.delOrgCacheKeys(organizationId, patterns.map(toPrefix)));
  }

  Promise.all(ops).catch(err => {
    logger.warn(`Cache invalidation failed: ${label}`, err);
  });
}

/**
 * Invalidate member stats cache for an organization
 * Call after: addMember, removeMember, updateMemberRole, transferMember, batchAdd/Remove/Update
 */
export function invalidateMemberStatsCache(orgId: string): void {
  fireAndForget(
    orgId,
    [`org:${orgId}:member:stats`, `org:${orgId}:dashboard:summary`],
    [],
    `member:stats for org ${orgId}`
  );
}

/**
 * Invalidate fleet summary cache for an organization
 * Call after: createOrgShip, updateOrgShip, deleteOrgShip, loanOrgShip, returnOrgShipLoan
 */
export function invalidateFleetSummaryCache(orgId: string): void {
  fireAndForget(
    orgId,
    [`org:${orgId}:fleet:summary`, `org:${orgId}:dashboard:summary`],
    [],
    `fleet:summary for org ${orgId}`
  );
}

/**
 * Invalidate bounty stats cache for an organization
 * Call after: createBounty, updateBounty, claimBounty, completeBounty, cancelBounty, deleteBounty, payBounty, verifyBounty
 */
export function invalidateBountyStatsCache(orgId: string): void {
  fireAndForget(
    orgId,
    [`org:${orgId}:bounty:stats`, `org:${orgId}:dashboard:summary`],
    [],
    `bounty:stats for org ${orgId}`
  );
}

/**
 * Invalidate activity caches for an organization
 * Call after: createActivity, updateActivity, deleteActivity, updateStatus, completeActivity
 */
export function invalidateActivityCache(orgId: string): void {
  fireAndForget(
    orgId,
    [`org:${orgId}:activity:metrics`, `org:${orgId}:dashboard:summary`],
    [`org:${orgId}:activity:trends:*`],
    `activity caches for org ${orgId}`
  );
}

/**
 * Invalidate trade overview cache for an organization
 * Call after: createRoute, updateRoute, deleteRoute, createAlert, updateAlert, deleteAlert
 */
export function invalidateTradeCache(orgId: string): void {
  fireAndForget(
    orgId,
    [`org:${orgId}:dashboard:summary`],
    [`org:${orgId}:trade:overview:*`],
    `trade:overview for org ${orgId}`
  );
}

/**
 * Invalidate trust score cache for an organization
 * Call after: relationship changes, RSI verification updates, reputation updates
 */
export function invalidateTrustScoreCache(orgId: string): void {
  fireAndForget(orgId, [`org:${orgId}:trust:score`], [], `trust:score for org ${orgId}`);
}

/**
 * Invalidate public directory stats cache (global, not org-scoped)
 * Call after: profile create/update/delete, verification status change
 */
export function invalidateDirectoryStatsCache(): void {
  fireAndForget(
    undefined,
    ['public:directory:stats', 'public:sitemap:xml'],
    [],
    'public directory stats + sitemap'
  );
}
