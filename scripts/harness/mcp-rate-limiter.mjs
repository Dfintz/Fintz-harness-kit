/**
 * Sliding-window token bucket rate limiter for per-caller quota enforcement
 * @module mcp-rate-limiter
 *
 * Design: factory-based to enable isolated state per server instance and per test run.
 * Use createRateLimiter() for production (mcp-server.mjs) and tests that need isolation.
 * The convenience exports (checkQuota, etc.) use a shared default store for backward compat.
 * Phase 2c upgrade: pass a persistent-store adapter to createRateLimiter(store).
 */

/**
 * Create an isolated rate-limiter instance backed by the given store.
 * @param {Map} [store] - Optional store; defaults to a fresh in-memory Map.
 *   Inject a persistent adapter (e.g. Redis-backed Map) for Phase 2c.
 * @returns {{ checkQuota, getQuotaStatus, resetQuota, listCallers }}
 */
export function createRateLimiter(store = new Map()) {
  function getQuotaBucket(callerId, config) {
    if (store.has(callerId)) {
      return store.get(callerId);
    }

    const rateLimit = config?.rateLimit || {};
    const perCallerConfig = rateLimit.perCaller?.[callerId];
    const defaultConfig = rateLimit.default || { limit: 100, periodMs: 3600000 };

    // Fall back individual fields so partial per-caller overrides (e.g. only 'limit') are safe
    const limit = perCallerConfig?.limit ?? defaultConfig.limit ?? 100;
    const periodMs = perCallerConfig?.periodMs ?? defaultConfig.periodMs ?? 3600000;

    const bucket = {
      callerId,
      allowance: limit,
      lastRefillAt: Date.now(),
      limit,
      periodMs,
    };

    store.set(callerId, bucket);
    return bucket;
  }

  /**
   * Check and consume quota for a caller (sliding-window token bucket).
   * @param {string} callerId
   * @param {object} config - Config with .rateLimit settings
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number|null }}
   */
  function checkQuota(callerId, config) {
    const bucket = getQuotaBucket(callerId, config);
    const now = Date.now();
    const elapsed = now - bucket.lastRefillAt;

    const refillRate = bucket.limit / bucket.periodMs;
    const tokensToAdd = elapsed * refillRate;
    bucket.allowance = Math.min(bucket.limit, bucket.allowance + tokensToAdd);
    bucket.lastRefillAt = now;

    if (bucket.allowance >= 1) {
      bucket.allowance -= 1;
      return { allowed: true, remaining: Math.floor(bucket.allowance), retryAfterMs: null };
    }

    const retryAfterMs = Math.ceil((1 - bucket.allowance) / refillRate);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  /**
   * Read-only quota status (no token consumed).
   * @param {string} callerId
   * @param {object} config
   * @returns {{ allowed: boolean, remaining: number, limit: number, periodMs: number, retryAfterMs: number|null }}
   */
  function getQuotaStatus(callerId, config) {
    const bucket = getQuotaBucket(callerId, config);
    const now = Date.now();
    const elapsed = now - bucket.lastRefillAt;

    const refillRate = bucket.limit / bucket.periodMs;
    const tokensToAdd = elapsed * refillRate;
    const currentAllowance = Math.min(bucket.limit, bucket.allowance + tokensToAdd);

    if (currentAllowance >= 1) {
      return {
        allowed: true,
        remaining: Math.floor(currentAllowance),
        limit: bucket.limit,
        periodMs: bucket.periodMs,
        retryAfterMs: null,
      };
    }

    const retryAfterMs = Math.ceil((1 - currentAllowance) / refillRate);
    return {
      allowed: false,
      remaining: 0,
      limit: bucket.limit,
      periodMs: bucket.periodMs,
      retryAfterMs,
    };
  }

  /**
   * Reset quota state.
   * @param {string|null} callerId - Reset only this caller, or all if null.
   */
  function resetQuota(callerId = null) {
    if (callerId) {
      store.delete(callerId);
    } else {
      store.clear();
    }
  }

  /** @returns {string[]} Active caller IDs */
  function listCallers() {
    return Array.from(store.keys());
  }

  return { checkQuota, getQuotaStatus, resetQuota, listCallers };
}

// ── Backward-compat convenience exports using a module-level default store ──────────────────
// These are kept for existing callers (tests, one-off scripts) that import { checkQuota }.
// Production code (mcp-server.mjs) should use createRateLimiter() for instance isolation.
const _defaultLimiter = createRateLimiter();
export const checkQuota = _defaultLimiter.checkQuota;
export const getQuotaStatus = _defaultLimiter.getQuotaStatus;
export const resetQuota = _defaultLimiter.resetQuota;
export const listCallers = _defaultLimiter.listCallers;

