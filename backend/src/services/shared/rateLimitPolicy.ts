/**
 * Rate-limit policy taxonomy (ARCH-06 / C6 baseline).
 *
 * The codebase has several rate-limit mechanisms that grew independently:
 *  - {@link RedisRateLimiter} — distributed sliding window (the canonical
 *    cross-shard/cross-instance limiter).
 *  - the bot `CooldownManager` — per-process command cooldowns.
 *  - the bot `TunnelRateLimiter` — per-process tunnel message limits.
 *  - the Express `rateLimiting` middleware — HTTP request limits.
 *
 * They previously duplicated the result contract and built Redis keys ad-hoc,
 * so a typo in a key prefix silently created a *separate* counter (a bypassed
 * limit). This module is the single source of truth for the shared rate-limit
 * vocabulary so those mechanisms — and future call sites — converge on one
 * taxonomy without being rewritten:
 *  - the {@link RateLimitResult} contract,
 *  - {@link buildRateLimitKey} for structured, collision-resistant keys,
 *  - {@link rateLimitRetryAfterSeconds} for a consistent retry-after value.
 *
 * It is dependency-free (no Redis/Discord imports) so any layer can use it.
 */

/**
 * Outcome of a rate-limit check.
 *
 * - `allowed`: whether the action is permitted under the configured limit.
 * - `remaining`: actions still permitted in the current window (>= 0).
 * - `resetAt`: when the current window expires and the counter resets.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * A {@link RateLimitResult} that may also carry a temporary block (used by
 * mechanisms that escalate to a cooldown/block after the limit is exceeded,
 * e.g. the tunnel message limiter).
 */
export interface BlockableRateLimitResult extends RateLimitResult {
  /** When set, the subject is blocked until this time (beyond the window reset). */
  blockedUntil?: Date;
}

/**
 * Build a structured, collision-resistant rate-limit key.
 *
 * Enforces the `domain:action:scope…` convention that {@link RedisRateLimiter}
 * prescribes but previously left to each caller (e.g. `lfg:post:{guildId}:{userId}`).
 * Centralizing it removes typo-prone hand-built keys — a wrong prefix would
 * otherwise create a separate counter and silently bypass the limit.
 *
 * Scope parts are typed as `string` so callers must resolve nullable ids (e.g.
 * `guildId ?? 'DM'`) before building the key, keeping keys deterministic.
 *
 * @param domain Logical domain (e.g. `lfg`, `tunnel`, `auth`).
 * @param action Action within the domain (e.g. `post`, `join`).
 * @param scope Ordered scope segments, most-significant first (e.g. tenant then subject).
 */
export function buildRateLimitKey(domain: string, action: string, ...scope: string[]): string {
  return [domain, action, ...scope].join(':');
}

/**
 * Derive whole seconds until the rate-limit window resets, from a
 * {@link RateLimitResult}. Centralizes the `ceil((resetAt - now) / 1000)`
 * previously duplicated at denial sites. Never negative; a reset already in the
 * past returns 0.
 *
 * @param result The rate-limit result to read `resetAt` from.
 * @param now Injectable clock for deterministic testing (defaults to `Date.now`).
 */
export function rateLimitRetryAfterSeconds(
  result: Pick<RateLimitResult, 'resetAt'>,
  now: number = Date.now()
): number {
  const deltaMs = result.resetAt.getTime() - now;
  if (deltaMs <= 0) {
    return 0;
  }
  return Math.ceil(deltaMs / 1000);
}

