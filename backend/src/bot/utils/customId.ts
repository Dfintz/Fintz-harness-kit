/**
 * Shared Discord interaction customId codec (C9 / ARCH-09 parser groundwork).
 *
 * The bot's customId convention is `<prefix>_<action>_<...params>` joined by `_`
 * (see `interactionRouter`: `prefix` → command via `COMMAND_PREFIX_MAP`, and
 * `prefix_action` → the per-action cooldown scope). Historically every command
 * re-implemented this with bespoke `indexOf('_')` math or per-action regexes. This
 * module is the single source of truth for building and parsing that convention so
 * new interaction code shares one parser instead of hand-rolling string slicing.
 *
 * Convention & constraints:
 *  - Segments are joined/split on `_`. `prefix` is the first segment, `action` the
 *    second, and `params` everything after.
 *  - Individual params therefore MUST NOT contain `_` — the existing convention
 *    (resource ids are UUIDs using `-`, or plain numbers). Parsing a param that
 *    contains `_` will split it into multiple params.
 *  - Discord limits customIds to 100 characters ({@link MAX_CUSTOM_ID_LENGTH}); use
 *    {@link isCustomIdWithinLimit} when building from dynamic/user-derived data.
 */

const SEPARATOR = '_';

/** Discord's hard limit on interaction customId length. */
export const MAX_CUSTOM_ID_LENGTH = 100;

/** Parsed shape of a `<prefix>_<action>_<...params>` customId. */
export interface ParsedCustomId {
  /** First segment — maps to a command via the router prefix map. */
  prefix: string;
  /** Second segment — the action within the command (`''` when absent). */
  action: string;
  /** Remaining segments after prefix + action. */
  params: string[];
}

/**
 * Build a customId from a prefix, action, and optional params, joined by `_`.
 *
 * Params must not contain `_` (see module constraints). Does not enforce the
 * length limit — guard with {@link isCustomIdWithinLimit} when params are dynamic.
 */
export function buildCustomId(prefix: string, action: string, ...params: string[]): string {
  return [prefix, action, ...params].join(SEPARATOR);
}

/**
 * Parse a `<prefix>_<action>_<...params>` customId into its segments. `action` is
 * `''` and `params` is empty when those segments are absent. Total inverse of
 * {@link buildCustomId} for params that contain no `_`.
 */
export function parseCustomId(customId: string): ParsedCustomId {
  const [prefix = '', action = '', ...params] = customId.split(SEPARATOR);
  return { prefix, action, params };
}

/** The `prefix_action` scope of a customId (just `prefix` when there is no action). */
export function customIdScope(customId: string): string {
  const { prefix, action } = parseCustomId(customId);
  return action ? buildCustomId(prefix, action) : prefix;
}

/** Whether a customId is within Discord's {@link MAX_CUSTOM_ID_LENGTH} limit. */
export function isCustomIdWithinLimit(customId: string): boolean {
  return customId.length <= MAX_CUSTOM_ID_LENGTH;
}
