import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import type { FederationDiscordGuildSettings } from '../../models/FederationDiscordGuildSettings';
export interface ResolvedGuildSettings<T> {
    settings: T | undefined;
    source: 'org' | 'federation' | null;
}
type SharedSettingKey = keyof DiscordGuildSettings & keyof FederationDiscordGuildSettings;
export declare class GuildSettingsResolver {
    private static instance;
    static getInstance(): GuildSettingsResolver;
    resolve<K extends SharedSettingKey>(guildId: string, section: K): Promise<ResolvedGuildSettings<DiscordGuildSettings[K]>>;
    resolveAll(guildId: string): Promise<{
        orgSettings: DiscordGuildSettings[];
        fedSettings: FederationDiscordGuildSettings[];
    }>;
}
export declare const guildSettingsResolver: GuildSettingsResolver;
export {};
//# sourceMappingURL=GuildSettingsResolver.d.ts.map