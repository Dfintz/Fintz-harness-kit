"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_FEATURE_FLAG_REGISTRY = exports.BotFeatureFlag = void 0;
exports.sanitizeGuildFeatureFlagOverrides = sanitizeGuildFeatureFlagOverrides;
exports.parseEnvFlag = parseEnvFlag;
exports.describeGuildFeatureFlag = describeGuildFeatureFlag;
exports.resolveGuildFeatureFlag = resolveGuildFeatureFlag;
exports.BotFeatureFlag = {
    AI_BRIEFINGS: 'aiBriefings',
};
exports.BOT_FEATURE_FLAG_REGISTRY = {
    [exports.BotFeatureFlag.AI_BRIEFINGS]: {
        label: 'AI Briefings',
        description: 'AI-generated tactical briefings (Azure OpenAI) for missions and activities.',
        defaultEnabled: true,
        envVar: 'BOT_FEATURE_AI_BRIEFINGS',
    },
};
function sanitizeGuildFeatureFlagOverrides(raw) {
    if (raw === null || typeof raw !== 'object') {
        return {};
    }
    const knownFlags = new Set(Object.values(exports.BotFeatureFlag));
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        if (knownFlags.has(key) && typeof value === 'boolean') {
            result[key] = value;
        }
    }
    return result;
}
function parseEnvFlag(raw) {
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
function describeGuildFeatureFlag(flag, overrides, env = process.env) {
    const definition = exports.BOT_FEATURE_FLAG_REGISTRY[flag];
    const envOverride = definition.envVar === undefined ? undefined : parseEnvFlag(env[definition.envVar]);
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
function resolveGuildFeatureFlag(flag, overrides, env = process.env) {
    return describeGuildFeatureFlag(flag, overrides, env).enabled;
}
//# sourceMappingURL=guildFeatureFlags.js.map