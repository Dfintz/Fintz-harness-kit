import {
  BOT_FEATURE_FLAG_REGISTRY,
  BotFeatureFlag,
  describeGuildFeatureFlag,
  parseEnvFlag,
  resolveGuildFeatureFlag,
  sanitizeGuildFeatureFlagOverrides,
  type GuildFeatureFlagOverrides,
} from '../guildFeatureFlags';

describe('parseEnvFlag', () => {
  it('returns undefined for unset values', () => {
    expect(parseEnvFlag(undefined)).toBeUndefined();
  });

  it.each(['true', 'TRUE', ' True ', '1', 'yes', 'on'])('parses %s as true', raw => {
    expect(parseEnvFlag(raw)).toBe(true);
  });

  it.each(['false', 'FALSE', ' off ', '0', 'no'])('parses %s as false', raw => {
    expect(parseEnvFlag(raw)).toBe(false);
  });

  it.each(['', 'maybe', '2', 'enabled'])('returns undefined for unrecognised value %s', raw => {
    expect(parseEnvFlag(raw)).toBeUndefined();
  });
});

describe('resolveGuildFeatureFlag (ARCH-11)', () => {
  const FLAG = BotFeatureFlag.AI_BRIEFINGS;
  const ENV_VAR = BOT_FEATURE_FLAG_REGISTRY[FLAG].envVar as string;

  it('returns the registry default when nothing overrides it', () => {
    expect(resolveGuildFeatureFlag(FLAG, undefined, {})).toBe(
      BOT_FEATURE_FLAG_REGISTRY[FLAG].defaultEnabled
    );
  });

  it('uses the per-guild stored override when present', () => {
    const overrides: GuildFeatureFlagOverrides = { [FLAG]: false };
    expect(resolveGuildFeatureFlag(FLAG, overrides, {})).toBe(false);
  });

  it('lets the operator env override win over the per-guild override (kill-switch)', () => {
    const overrides: GuildFeatureFlagOverrides = { [FLAG]: true };
    expect(resolveGuildFeatureFlag(FLAG, overrides, { [ENV_VAR]: 'false' })).toBe(false);
  });

  it('lets the operator env override force-enable over a per-guild disable', () => {
    const overrides: GuildFeatureFlagOverrides = { [FLAG]: false };
    expect(resolveGuildFeatureFlag(FLAG, overrides, { [ENV_VAR]: 'true' })).toBe(true);
  });

  it('ignores an unparseable env value and falls through to the next layer', () => {
    const overrides: GuildFeatureFlagOverrides = { [FLAG]: false };
    expect(resolveGuildFeatureFlag(FLAG, overrides, { [ENV_VAR]: 'maybe' })).toBe(false);
  });

  it('ignores an unparseable env value and falls through to the default', () => {
    expect(resolveGuildFeatureFlag(FLAG, undefined, { [ENV_VAR]: '' })).toBe(
      BOT_FEATURE_FLAG_REGISTRY[FLAG].defaultEnabled
    );
  });

  it('treats a non-boolean stored override as absent', () => {
    // A corrupt persisted value must not be honoured; fall through to default.
    const overrides = { [FLAG]: 'yes' } as unknown as GuildFeatureFlagOverrides;
    expect(resolveGuildFeatureFlag(FLAG, overrides, {})).toBe(
      BOT_FEATURE_FLAG_REGISTRY[FLAG].defaultEnabled
    );
  });
});

describe('BOT_FEATURE_FLAG_REGISTRY', () => {
  it('keys every entry by its own id and documents each flag', () => {
    for (const [id, definition] of Object.entries(BOT_FEATURE_FLAG_REGISTRY)) {
      expect(Object.values(BotFeatureFlag)).toContain(id);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(typeof definition.defaultEnabled).toBe('boolean');
    }
  });
});

describe('sanitizeGuildFeatureFlagOverrides (ARCH-11 storage)', () => {
  const FLAG = BotFeatureFlag.AI_BRIEFINGS;

  it.each([null, undefined, 'aiBriefings', 42, true, [FLAG]])(
    'returns an empty object for the non-object input %p',
    raw => {
      expect(sanitizeGuildFeatureFlagOverrides(raw)).toEqual({});
    }
  );

  it('keeps a known flag with a boolean value', () => {
    expect(sanitizeGuildFeatureFlagOverrides({ [FLAG]: false })).toEqual({ [FLAG]: false });
    expect(sanitizeGuildFeatureFlagOverrides({ [FLAG]: true })).toEqual({ [FLAG]: true });
  });

  it('drops unknown flag keys', () => {
    expect(sanitizeGuildFeatureFlagOverrides({ notARealFlag: true, [FLAG]: false })).toEqual({
      [FLAG]: false,
    });
  });

  it.each([
    ['string', 'true'],
    ['number', 1],
    ['null', null],
    ['object', {}],
  ])('drops a known flag whose value is a non-boolean %s', (_label, value) => {
    expect(sanitizeGuildFeatureFlagOverrides({ [FLAG]: value })).toEqual({});
  });

  it('returns a value the resolver honours end-to-end', () => {
    const overrides = sanitizeGuildFeatureFlagOverrides({ [FLAG]: false, junk: 'x' });
    expect(resolveGuildFeatureFlag(FLAG, overrides, {})).toBe(false);
  });
});

describe('describeGuildFeatureFlag (ARCH-11 admin)', () => {
  const FLAG = BotFeatureFlag.AI_BRIEFINGS;
  const ENV_VAR = BOT_FEATURE_FLAG_REGISTRY[FLAG].envVar as string;
  const DEFAULT = BOT_FEATURE_FLAG_REGISTRY[FLAG].defaultEnabled;

  it('reports the registry default with source=default and no override', () => {
    expect(describeGuildFeatureFlag(FLAG, undefined, {})).toEqual({
      flag: FLAG,
      enabled: DEFAULT,
      source: 'default',
      guildOverride: undefined,
      guildEnabled: DEFAULT,
      operatorLocked: false,
    });
  });

  it('reports a guild override with source=guild-override and not operator-locked', () => {
    const overrides: GuildFeatureFlagOverrides = { [FLAG]: false };
    expect(describeGuildFeatureFlag(FLAG, overrides, {})).toEqual({
      flag: FLAG,
      enabled: false,
      source: 'guild-override',
      guildOverride: false,
      guildEnabled: false,
      operatorLocked: false,
    });
  });

  it('reports operator-locked when the env override is set, preserving the guild lever', () => {
    // Env forces ON; the guild's own lever (stored OFF) is what a toggle controls.
    const overrides: GuildFeatureFlagOverrides = { [FLAG]: false };
    expect(describeGuildFeatureFlag(FLAG, overrides, { [ENV_VAR]: 'true' })).toEqual({
      flag: FLAG,
      enabled: true,
      source: 'operator-env',
      guildOverride: false,
      guildEnabled: false, // toggle math uses the guild lever, not the env-forced value
      operatorLocked: true,
    });
  });

  it('keeps guildEnabled = default when no guild override exists, even under env lock', () => {
    expect(describeGuildFeatureFlag(FLAG, undefined, { [ENV_VAR]: 'false' })).toMatchObject({
      enabled: false,
      source: 'operator-env',
      guildEnabled: DEFAULT,
      operatorLocked: true,
    });
  });

  it('treats a corrupt non-boolean stored override as absent', () => {
    const overrides = { [FLAG]: 'yes' } as unknown as GuildFeatureFlagOverrides;
    expect(describeGuildFeatureFlag(FLAG, overrides, {})).toMatchObject({
      source: 'default',
      guildOverride: undefined,
      guildEnabled: DEFAULT,
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
