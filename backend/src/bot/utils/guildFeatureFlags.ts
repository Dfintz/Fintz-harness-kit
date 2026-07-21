/**
 * Per-guild bot feature flags (ARCH-11).
 *
 * A single, typed mechanism for gating bot features per Discord guild, replacing
 * the need for each feature to invent its own bespoke `enabled` boolean. A flag's
 * effective value is resolved by layering three sources (highest priority first):
 *
 *   1. **Operator env override (kill-switch)** — when a flag declares an `envVar`
 *      and that variable is set to a parseable boolean, it wins over everything
 *      else, so operators can force a feature on/off fleet-wide instantly
 *      (e.g. disable an expensive Azure OpenAI feature during an incident).
 *   2. **Per-guild stored override** — an explicit boolean persisted for the
 *      guild (the `DiscordGuildSettings.featureFlags` column, read via
 *      `DiscordSettingsService.getGuildFeatureFlagOverrides`).
 *   3. **Registry default** — the flag's built-in default.
 *
 * The resolver is pure and side-effect-free so it is trivially unit-testable.
 * New flags are added to the registry alongside the feature that consumes them.
 */

/** Stable ids for every per-guild bot feature flag. */
export const BotFeatureFlag = {
  /** AI-generated tactical briefings (Azure OpenAI) for missions/activities. */
  AI_BRIEFINGS: 'aiBriefings',
} as const;

export type BotFeatureFlag = (typeof BotFeatureFlag)[keyof typeof BotFeatureFlag];

export interface BotFeatureFlagDefinition {
  /** Short, user-facing name shown in the admin toggle UI. */
  readonly label: string;
  /** Human-readable description for operator tooling/docs. */
  readonly description: string;
  /** Effective value when no operator or per-guild override applies. */
  readonly defaultEnabled: boolean;
  /**
   * Optional operator kill-switch env var. When set to a parseable boolean it
   * overrides the per-guild override and the default.
   */
  readonly envVar?: string;
}

/** The set of recognised per-guild bot feature flags and their metadata. */
export const BOT_FEATURE_FLAG_REGISTRY: Readonly<Record<BotFeatureFlag, BotFeatureFlagDefinition>> =
  {
    [BotFeatureFlag.AI_BRIEFINGS]: {
      label: 'AI Briefings',
      description: 'AI-generated tactical briefings (Azure OpenAI) for missions and activities.',
      defaultEnabled: true,
      envVar: 'BOT_FEATURE_AI_BRIEFINGS',
    },
  };

/**
 * Per-guild stored overrides — the persisted layer of the resolver. A flag may
 * be present (explicit boolean) or absent (defer to env/default). Persisted in
 * the `DiscordGuildSettings.featureFlags` JSONB column and read back (sanitized)
 * via `DiscordSettingsService.getGuildFeatureFlagOverrides`.
 */
export type GuildFeatureFlagOverrides = Partial<Record<BotFeatureFlag, boolean>>;

/**
 * Sanitize a raw stored value (e.g. a `DiscordGuildSettings.featureFlags` JSONB
 * column read back from the DB) into a typed {@link GuildFeatureFlagOverrides}.
 * Keeps only entries whose key is a recognised {@link BotFeatureFlag} and whose
 * value is a boolean; unknown flags, non-boolean values, and non-objects are
 * dropped. Defensive so a corrupt/legacy row can never inject an unexpected
 * override into the resolver. Pure.
 */
export function sanitizeGuildFeatureFlagOverrides(raw: unknown): GuildFeatureFlagOverrides {
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  const knownFlags = new Set<string>(Object.values(BotFeatureFlag));
  const result: GuildFeatureFlagOverrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (knownFlags.has(key) && typeof value === 'boolean') {
      result[key as BotFeatureFlag] = value;
    }
  }
  return result;
}

/**
 * Parse an env value as a strict tristate boolean. Returns `undefined` for unset
 * or unrecognised values so the caller falls through to the next layer (an
 * operator must set an explicit boolean to override).
 */
export function parseEnvFlag(raw: string | undefined): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') {
    return true;
  }
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') {
    return false;
  }
  return undefined;
}

/** Which layer of the resolver decided a flag's effective value. */
export type FeatureFlagSource = 'operator-env' | 'guild-override' | 'default';

/** A flag's fully-resolved state across all layers (for UI/admin tooling). */
export interface ResolvedFeatureFlag {
  /** The flag id. */
  readonly flag: BotFeatureFlag;
  /** Effective value after layering env → guild → default. */
  readonly enabled: boolean;
  /** Which layer decided {@link enabled}. */
  readonly source: FeatureFlagSource;
  /** The guild's own stored override (`undefined` when not set). */
  readonly guildOverride: boolean | undefined;
  /**
   * What the guild's setting resolves to *ignoring* the operator env layer
   * (`guildOverride ?? registry default`) — i.e. the value a guild owner's toggle
   * controls. Equals {@link enabled} unless an operator env override is active.
   */
  readonly guildEnabled: boolean;
  /**
   * True when an operator env kill-switch currently forces {@link enabled},
   * overriding the guild's own setting.
   */
  readonly operatorLocked: boolean;
}

/**
 * Fully resolve a per-guild feature flag across every layer (operator env
 * kill-switch → per-guild stored override → registry default), returning a
 * structured explanation for admin tooling. Pure: the env source is injectable.
 */
export function describeGuildFeatureFlag(
  flag: BotFeatureFlag,
  overrides?: GuildFeatureFlagOverrides,
  env: NodeJS.ProcessEnv = process.env
): ResolvedFeatureFlag {
  const definition = BOT_FEATURE_FLAG_REGISTRY[flag];
  const envOverride =
    definition.envVar === undefined ? undefined : parseEnvFlag(env[definition.envVar]);
  const rawGuildOverride = overrides?.[flag];
  const guildOverride = typeof rawGuildOverride === 'boolean' ? rawGuildOverride : undefined;
  const guildEnabled = guildOverride ?? definition.defaultEnabled;

  if (envOverride !== undefined) {
    return {
      flag,
      enabled: envOverride,
      source: 'operator-env',
      guildOverride,
      guildEnabled,
      operatorLocked: true,
    };
  }
  if (guildOverride !== undefined) {
    return {
      flag,
      enabled: guildOverride,
      source: 'guild-override',
      guildOverride,
      guildEnabled,
      operatorLocked: false,
    };
  }
  return {
    flag,
    enabled: definition.defaultEnabled,
    source: 'default',
    guildOverride,
    guildEnabled,
    operatorLocked: false,
  };
}

/**
 * Resolve the effective value of a single per-guild feature flag by layering the
 * operator env override (kill-switch) over the per-guild stored override over the
 * registry default. Pure: the env source is injectable for testing.
 */
export function resolveGuildFeatureFlag(
  flag: BotFeatureFlag,
  overrides?: GuildFeatureFlagOverrides,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return describeGuildFeatureFlag(flag, overrides, env).enabled;
}
