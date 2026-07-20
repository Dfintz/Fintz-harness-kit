export declare const BotFeatureFlag: {
    readonly AI_BRIEFINGS: "aiBriefings";
};
export type BotFeatureFlag = (typeof BotFeatureFlag)[keyof typeof BotFeatureFlag];
export interface BotFeatureFlagDefinition {
    readonly label: string;
    readonly description: string;
    readonly defaultEnabled: boolean;
    readonly envVar?: string;
}
export declare const BOT_FEATURE_FLAG_REGISTRY: Readonly<Record<BotFeatureFlag, BotFeatureFlagDefinition>>;
export type GuildFeatureFlagOverrides = Partial<Record<BotFeatureFlag, boolean>>;
export declare function sanitizeGuildFeatureFlagOverrides(raw: unknown): GuildFeatureFlagOverrides;
export declare function parseEnvFlag(raw: string | undefined): boolean | undefined;
export type FeatureFlagSource = 'operator-env' | 'guild-override' | 'default';
export interface ResolvedFeatureFlag {
    readonly flag: BotFeatureFlag;
    readonly enabled: boolean;
    readonly source: FeatureFlagSource;
    readonly guildOverride: boolean | undefined;
    readonly guildEnabled: boolean;
    readonly operatorLocked: boolean;
}
export declare function describeGuildFeatureFlag(flag: BotFeatureFlag, overrides?: GuildFeatureFlagOverrides, env?: NodeJS.ProcessEnv): ResolvedFeatureFlag;
export declare function resolveGuildFeatureFlag(flag: BotFeatureFlag, overrides?: GuildFeatureFlagOverrides, env?: NodeJS.ProcessEnv): boolean;
//# sourceMappingURL=guildFeatureFlags.d.ts.map