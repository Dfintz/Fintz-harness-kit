import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import type { FederationDiscordGuildSettings } from '../../models/FederationDiscordGuildSettings';
import { federationDiscordSettingsService } from '../federation/FederationDiscordSettingsService';

import { discordSettingsService } from './DiscordSettingsService';

/**
 * Result from guild settings resolution.
 * `source` indicates whether the settings came from an organization row
 * or a federation row (or null if none found).
 */
export interface ResolvedGuildSettings<T> {
  settings: T | undefined;
  source: 'org' | 'federation' | null;
}

// Setting section keys shared between both entity types
type SharedSettingKey = keyof DiscordGuildSettings & keyof FederationDiscordGuildSettings;

/**
 * Unified Guild Settings Resolver
 *
 * Bot handlers call this instead of directly querying org or federation
 * settings. Org settings take priority; federation settings are the fallback.
 *
 * This prevents the org-then-federation fallback logic from being scattered
 * across 20+ bot handlers.
 */
export class GuildSettingsResolver {
  private static instance: GuildSettingsResolver;

  static getInstance(): GuildSettingsResolver {
    if (!GuildSettingsResolver.instance) {
      GuildSettingsResolver.instance = new GuildSettingsResolver();
    }
    return GuildSettingsResolver.instance;
  }

  /**
   * Resolve a single settings section for a guild.
   *
   * 1. Check org settings (priority — a guild may be linked to multiple orgs)
   * 2. If no org settings have the section enabled, check federation settings
   *
   * @param guildId  Discord guild snowflake
   * @param section  JSONB column name (e.g. 'voiceChannelSettings', 'welcomeSettings')
   */
  async resolve<K extends SharedSettingKey>(
    guildId: string,
    section: K
  ): Promise<ResolvedGuildSettings<DiscordGuildSettings[K]>> {
    // 1. Try org settings
    const orgRows = await discordSettingsService.getSettingsByGuildId(guildId);
    const orgMatch = orgRows.find(s => s[section] !== null && s[section] !== undefined);
    if (orgMatch?.[section] !== null && orgMatch?.[section] !== undefined) {
      return { settings: orgMatch[section], source: 'org' };
    }

    // 2. Try federation settings
    const fedRows = await federationDiscordSettingsService.getSettingsByGuildId(guildId);
    const fedMatch = fedRows.find(s => s[section] !== null && s[section] !== undefined);
    if (fedMatch?.[section] !== null && fedMatch?.[section] !== undefined) {
      return {
        settings: fedMatch[section] as unknown as DiscordGuildSettings[K],
        source: 'federation',
      };
    }

    return { settings: undefined, source: null };
  }

  /**
   * Resolve all settings rows for a guild from both sources.
   * Returns org rows first, then federation rows.
   */
  async resolveAll(guildId: string): Promise<{
    orgSettings: DiscordGuildSettings[];
    fedSettings: FederationDiscordGuildSettings[];
  }> {
    const [orgSettings, fedSettings] = await Promise.all([
      discordSettingsService.getSettingsByGuildId(guildId),
      federationDiscordSettingsService.getSettingsByGuildId(guildId),
    ]);
    return { orgSettings, fedSettings };
  }
}

export const guildSettingsResolver = GuildSettingsResolver.getInstance();

