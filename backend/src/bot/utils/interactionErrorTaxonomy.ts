/**
 * Interaction error taxonomy (C5 / ARCH-08).
 *
 * Classifies a thrown interaction-handler error into a small, stable set of
 * taxonomy classes so that bot command failures are breakable-down by cause in
 * incident triage and dashboards — distinguishing user-correctable problems
 * (bad input, missing permission, not found) from genuine system failures
 * (internal bugs, downstream dependency outages, timeouts).
 *
 * The classifier is intentionally dependency-light: it recognizes the project's
 * typed `ApiError` subclasses (by HTTP status — the single source of truth after
 * the error-to-HTTP normalization lane), duck-types discord.js HTTP errors, and
 * detects timeouts, falling back to `internal` for anything unrecognized.
 */

import { ApiError } from '../../utils/apiErrors';

/**
 * Stable taxonomy of interaction-handler failure causes.
 *
 * - `user_input`  — the user supplied invalid input (400-class).
 * - `permission`  — the user lacked authentication/authorization (401/403).
 * - `not_found`   — a referenced resource did not exist (404).
 * - `conflict`    — the action conflicted with current state (409).
 * - `rate_limit`  — a rate limit was hit (429, ours or Discord's).
 * - `timeout`     — the operation timed out / was aborted.
 * - `dependency`  — a downstream dependency failed (Discord API, unavailable service — 503).
 * - `internal`    — an unclassified/server-side failure (treat as a real bug to investigate).
 */
export const INTERACTION_ERROR_CLASSES = [
  'user_input',
  'permission',
  'not_found',
  'conflict',
  'rate_limit',
  'timeout',
  'dependency',
  'internal',
] as const;

export type InteractionErrorClass = (typeof INTERACTION_ERROR_CLASSES)[number];

/** Map a typed `ApiError` HTTP status onto a taxonomy class. */
function classifyByStatus(statusCode: number): InteractionErrorClass {
  if (statusCode === 400) {
    return 'user_input';
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'permission';
  }
  if (statusCode === 404) {
    return 'not_found';
  }
  if (statusCode === 409) {
    return 'conflict';
  }
  if (statusCode === 429) {
    return 'rate_limit';
  }
  if (statusCode === 503) {
    return 'dependency';
  }
  // Any other status (incl. 500-class DatabaseError) is a server-side failure.
  return 'internal';
}

/**
 * Duck-typed discord.js REST error shape. We avoid importing discord.js error
 * classes (keeps this primitive light and test-friendly) and instead recognize
 * `DiscordAPIError` / `HTTPError` / `RateLimitError` by name and HTTP status.
 */
function classifyDiscordError(error: Error): InteractionErrorClass | null {
  const candidate = error as Error & { status?: unknown; code?: unknown };
  const name = error.name;

  // discord.js @discordjs/rest RateLimitError (our own RateLimitError is an
  // ApiError and is handled before this point).
  if (name === 'RateLimitError') {
    return 'rate_limit';
  }

  const looksLikeDiscordHttp =
    name.startsWith('DiscordAPIError') ||
    name === 'HTTPError' ||
    (typeof candidate.status === 'number' &&
      ('rawError' in candidate || 'url' in candidate || 'requestBody' in candidate));

  if (!looksLikeDiscordHttp) {
    return null;
  }

  if (candidate.status === 429 || candidate.code === 429) {
    return 'rate_limit';
  }
  return 'dependency';
}

/** Detect timeout / abort errors by name or message. */
function isTimeoutError(error: Error): boolean {
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return true;
  }
  return /\btimed?\s?-?\s?out\b|\btimeout\b/i.test(error.message);
}

/**
 * Classify an interaction-handler error into an {@link InteractionErrorClass}.
 *
 * Resolution order: typed `ApiError` (by HTTP status) → discord.js HTTP error →
 * timeout/abort → `internal`.
 */
export function classifyInteractionError(error: Error): InteractionErrorClass {
  // 1. Project typed errors carry an explicit HTTP status (single source of truth).
  if (error instanceof ApiError) {
    return classifyByStatus(error.statusCode);
  }
  // Defensive duck-type: an error-like object carrying a numeric statusCode that
  // is not (or no longer) an `ApiError` instance across module boundaries.
  const maybeStatus = (error as Error & { statusCode?: unknown }).statusCode;
  if (typeof maybeStatus === 'number') {
    return classifyByStatus(maybeStatus);
  }

  // 2. Downstream Discord REST failures.
  const discordClass = classifyDiscordError(error);
  if (discordClass) {
    return discordClass;
  }

  // 3. Timeouts / aborts.
  if (isTimeoutError(error)) {
    return 'timeout';
  }

  // 4. Anything else is a server-side failure worth investigating.
  return 'internal';
}

/**
 * Whether a taxonomy class represents a user-correctable problem rather than a
 * system failure. Useful for triage filters and alert suppression (e.g. a spike
 * of `not_found` is usually a user/UX issue, not an outage).
 */
export function isUserCorrectable(errorClass: InteractionErrorClass): boolean {
  return (
    errorClass === 'user_input' ||
    errorClass === 'permission' ||
    errorClass === 'not_found' ||
    errorClass === 'conflict'
  );
}
