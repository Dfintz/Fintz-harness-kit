/**
 * Role-sync backpressure glue.
 *
 * Bulk RSI → Discord role synchronization can issue hundreds of role mutations
 * in a single run. The per-operation Discord layer already reacts to individual
 * HTTP 429s, but nothing previously paced the *bulk loop* — so a large first sync
 * could continuously hammer the shared bot token and starve interactive traffic.
 *
 * This module wires the generic {@link AdaptiveRateLimiter} to the role-sync
 * Discord adapter: every `assignRole` / `removeRole` is paced, and any
 * rate-limit failure that surfaces feeds adaptive backpressure (the spacing
 * interval ramps up and any `retry-after` hint is honored) before the next op.
 */

import { AdaptiveRateLimiter } from '../../utils/adaptiveRateLimiter';

/** Minimal Discord role adapter used by the bulk RSI org sync. */
export interface RoleSyncDiscordService {
  assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
  removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
}

const DEFAULT_MIN_INTERVAL_MS = 250;
const DEFAULT_MAX_INTERVAL_MS = 5_000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECOVERY_MULTIPLIER = 0.5;
const DEFAULT_MAX_COOLDOWN_MS = 30_000;

function readNumericProp(obj: Record<string, unknown>, key: string): number | undefined {
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

/**
 * Best-effort detection of a Discord rate-limit failure across the shapes this
 * codebase surfaces:
 *  - `@discordjs/rest` `RateLimitError` (gateway path)
 *  - plain `Error` from the REST fallback ("Discord API returned 429 …")
 *  - HTTP-style errors carrying a numeric `status`/`statusCode`/`httpStatus`
 */
export function isDiscordRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as Record<string, unknown>;

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
    if (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract a `retry-after` cooldown hint, normalized to milliseconds.
 * `@discordjs/rest` exposes `retryAfter` / `timeToReset` in milliseconds, while a
 * raw Discord error body uses `retry_after` in seconds.
 */
export function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const candidate = error as Record<string, unknown>;

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

function parsePositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Build an {@link AdaptiveRateLimiter} configured for bulk role sync from
 * environment overrides (with conservative defaults that stay well under
 * Discord's global limit and leave headroom for interactive bot traffic).
 */
export function createRoleSyncRateLimiter(): AdaptiveRateLimiter {
  return new AdaptiveRateLimiter({
    minIntervalMs: parsePositiveNumberEnv('RSI_ROLE_SYNC_MIN_INTERVAL_MS', DEFAULT_MIN_INTERVAL_MS),
    maxIntervalMs: parsePositiveNumberEnv('RSI_ROLE_SYNC_MAX_INTERVAL_MS', DEFAULT_MAX_INTERVAL_MS),
    backoffMultiplier: parsePositiveNumberEnv(
      'RSI_ROLE_SYNC_BACKOFF_MULTIPLIER',
      DEFAULT_BACKOFF_MULTIPLIER
    ),
    recoveryMultiplier: parsePositiveNumberEnv(
      'RSI_ROLE_SYNC_RECOVERY_MULTIPLIER',
      DEFAULT_RECOVERY_MULTIPLIER
    ),
    maxCooldownMs: parsePositiveNumberEnv('RSI_ROLE_SYNC_MAX_COOLDOWN_MS', DEFAULT_MAX_COOLDOWN_MS),
    label: 'rsi-role-sync',
  });
}

/**
 * Decorate a Discord role adapter so every role mutation is paced by the given
 * limiter. Successful ops decay the interval; rate-limit failures ramp it up and
 * honor any `retry-after` hint. Non-rate-limit failures pass through untouched
 * (the per-op retry queue still handles those). Return values and thrown errors
 * are preserved so callers observe identical behavior aside from pacing.
 */
export function wrapWithRoleSyncBackpressure(
  service: RoleSyncDiscordService,
  limiter: AdaptiveRateLimiter
): RoleSyncDiscordService {
  const runPaced = async (operation: () => Promise<string>): Promise<string> => {
    await limiter.acquire();
    try {
      const result = await operation();
      limiter.recordSuccess();
      return result;
    } catch (error: unknown) {
      if (isDiscordRateLimitError(error)) {
        limiter.recordBackpressure(extractRetryAfterMs(error));
      }
      throw error;
    }
  };

  return {
    assignRole: (guildId, userId, roleId) =>
      runPaced(() => service.assignRole(guildId, userId, roleId)),
    removeRole: (guildId, userId, roleId) =>
      runPaced(() => service.removeRole(guildId, userId, roleId)),
  };
}

