import { discordService, type GuildSettingsDTO } from '@/services/discordService';
import {
  getNotificationChannelDestinations,
  type NotificationDestinationType,
} from '@/utils/discordNotificationDestinations';
import { useQueries } from '@tanstack/react-query';
import { discordSettingsKeys } from './queryKeys';
import type { DiscordGuild } from './useOrgSettingsQueries';

const MAX_GUILDS_DESTINATION_LOOKUP = 10;

export interface GuildNotificationDestination {
  key: string;
  guildId: string;
  channelId: string;
  channelType: NotificationDestinationType;
}

export interface GuildNotificationDestinationsResult {
  destinations: GuildNotificationDestination[];
  failedGuilds: DiscordGuild[];
  isLoading: boolean;
  truncatedGuildCount: number;
}

/**
 * Resolve Discord notification destinations (announcement/pinned channels)
 * for linked guilds using React Query guild-settings cache keys.
 */
export function useGuildNotificationDestinations(
  orgId: string | undefined,
  guilds: DiscordGuild[]
): GuildNotificationDestinationsResult {
  const resolvedOrgId = orgId ?? '';
  const guildsToLoad = guilds.slice(0, MAX_GUILDS_DESTINATION_LOOKUP);
  const truncatedGuildCount = Math.max(0, guilds.length - guildsToLoad.length);

  const settingsQueries = useQueries({
    queries: guildsToLoad.map(guild => ({
      queryKey: discordSettingsKeys.guild(resolvedOrgId, guild.guildId),
      queryFn: (): Promise<GuildSettingsDTO> =>
        discordService.getGuildSettings(resolvedOrgId, guild.guildId),
      enabled: Boolean(orgId),
      staleTime: 2 * 60 * 1000,
    })),
  });

  const failedGuilds: DiscordGuild[] = [];
  const destinations = new Map<string, GuildNotificationDestination>();

  settingsQueries.forEach((query, index) => {
    const guild = guildsToLoad[index];
    if (!guild) return;

    if (query.isError) {
      failedGuilds.push(guild);
      return;
    }

    if (!query.data) return;

    const notificationDestinations = getNotificationChannelDestinations(
      query.data.notificationPreferences
    );

    for (const destination of notificationDestinations) {
      const key = `${guild.guildId}:${destination.channelId}`;
      destinations.set(key, {
        key,
        guildId: guild.guildId,
        channelId: destination.channelId,
        channelType: destination.channelType,
      });
    }
  });

  const isLoading = settingsQueries.some(query => query.isLoading || query.isFetching);

  return {
    destinations: Array.from(destinations.values()),
    failedGuilds,
    isLoading,
    truncatedGuildCount,
  };
}
