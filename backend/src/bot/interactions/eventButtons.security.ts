/**
 * Discord message display-safety helpers for the event interaction handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the pure,
 * self-contained sanitization and truncation logic its own ownership boundary,
 * separate from the Discord interaction handlers.
 *
 * These guard every user-provided string before it reaches a Discord message:
 * - `sanitizeDiscordInput` neutralises `@everyone`/`@here` pings and markdown
 *   injection and caps length (CWE-74 mitigation).
 * - `sanitizeErrorForUser` strips internal/technical detail from error text shown
 *   to users (CWE-209 mitigation).
 * - `truncate` is the generic length-capper used to fit Discord's field limits.
 *
 * This module is dependency-free of `eventButtons.ts` (one-way: handlers import from
 * here) and of everything else — keeping the import graph acyclic. The helpers are
 * consumed only inside `eventButtons.ts`, so they are not re-exported there.
 */

/** Max length for user-provided strings displayed in Discord messages. */
const MAX_DISPLAY_LENGTH = 100;

/**
 * Sanitize user-provided text before including it in Discord messages.
 * Prevents @everyone/@here mentions, markdown injection, and excessive length.
 * CWE-74 (Injection) mitigation.
 */
export function sanitizeDiscordInput(input: string): string {
  return input
    .replaceAll(/@(everyone|here)/gi, '@\u200b$1') // zero-width space breaks mentions
    .replaceAll(/[`*_~|>]/g, '') // strip markdown formatting chars
    .slice(0, MAX_DISPLAY_LENGTH);
}

/** Truncate a value to `maxLength`, appending an ellipsis when shortened. */
export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

/**
 * Sanitize error messages before showing them to users.
 * Prevents leaking internal details (CWE-209).
 */
export function sanitizeErrorForUser(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();
  // Block messages that look like they contain internal/technical details
  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('sql') ||
    lower.includes('query') ||
    lower.includes('relation') ||
    lower.includes('column') ||
    lower.includes('password') ||
    lower.includes('timeout') ||
    lower.includes('stack')
  ) {
    return 'An unexpected error occurred. Please try again later.';
  }
  // Truncate long error messages
  return errorMsg.length > 200 ? `${errorMsg.slice(0, 200)}…` : errorMsg;
}
