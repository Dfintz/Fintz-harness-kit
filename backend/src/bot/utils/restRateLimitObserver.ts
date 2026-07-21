import type { InvalidRequestWarningData, RateLimitData, REST } from 'discord.js';
import { RESTEvents } from 'discord.js';

import { logger } from '../../utils/logger';

/**
 * Structured log entry produced by the REST rate-limit observers.
 *
 * `level` is decided by the pure `describe*` builders so the dispatch in
 * {@link registerRestRateLimitObserver} stays trivial and the severity logic is
 * unit-testable without a live Discord client.
 */
export interface RateLimitLogEntry {
  level: 'warn' | 'debug';
  message: string;
  context: Record<string, unknown>;
}

/** Minimal logger surface the observer needs (injectable for tests). */
export type RateLimitObserverLogger = Pick<typeof logger, 'warn' | 'debug'>;

/**
 * Build a structured log entry for a discord.js REST `rateLimited` event.
 *
 * discord.js's REST manager already queues the request and retries it
 * automatically once the bucket resets, so this is observability only — no
 * retry/backoff logic is added here (BOT-07). Global rate limits pause *every*
 * REST request and are logged at `warn`; routine per-route/per-bucket limits are
 * logged at `debug` so a busy shard does not flood the warn stream.
 */
export function describeRateLimit(data: RateLimitData): RateLimitLogEntry {
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

/**
 * Build a structured log entry for a discord.js REST `invalidRequestWarning`
 * event. Invalid requests (401/403/429 responses) accumulate toward
 * Cloudflare's 10,000-per-10-minutes ban threshold, so this is always logged at
 * `warn` to surface the ban risk early.
 */
export function describeInvalidRequestWarning(data: InvalidRequestWarningData): RateLimitLogEntry {
  return {
    level: 'warn',
    message:
      'Discord invalid-request warning — approaching the Cloudflare ban threshold (10k invalid requests / 10 min)',
    context: {
      invalidRequestCount: data.count,
      windowResetMs: data.remainingTime,
    },
  };
}

function emit(log: RateLimitObserverLogger, entry: RateLimitLogEntry): void {
  if (entry.level === 'warn') {
    log.warn(entry.message, entry.context);
  } else {
    log.debug(entry.message, entry.context);
  }
}

/**
 * Attach structured observability for Discord REST rate-limit signals.
 *
 * discord.js's REST manager already performs 429-aware retry/backoff for every
 * managed request; this fills the missing visibility (BOT-07) so rate-limit
 * contention and the Cloudflare invalid-request ban risk are no longer silent in
 * production. Safe to call once per REST manager.
 *
 * Note: `invalidRequestWarning` only fires when the client is constructed with a
 * positive `rest.invalidRequestWarningInterval` (configured in BotClientManager).
 */
export function registerRestRateLimitObserver(
  rest: Pick<REST, 'on'>,
  log: RateLimitObserverLogger = logger
): void {
  rest.on(RESTEvents.RateLimited, (data: RateLimitData) => {
    emit(log, describeRateLimit(data));
  });
  rest.on(RESTEvents.InvalidRequestWarning, (data: InvalidRequestWarningData) => {
    emit(log, describeInvalidRequestWarning(data));
  });
}
