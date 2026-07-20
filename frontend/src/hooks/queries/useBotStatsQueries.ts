import { useQuery } from '@tanstack/react-query';

import { botStatsService } from '@/services/botStatsService';

import { botStatsKeys } from './queryKeys';

export function useSystemCommandStats() {
  return useQuery({
    queryKey: botStatsKeys.systemCommands(),
    queryFn: () => botStatsService.getSystemCommandStats(),
    staleTime: 30 * 1000, // 30 seconds — analytics data refreshes frequently
  });
}

export function useAllCommandStats() {
  return useQuery({
    queryKey: botStatsKeys.allCommands(),
    queryFn: () => botStatsService.getAllCommandStats(),
    staleTime: 30 * 1000,
  });
}

export function useGuildCommandStats(guildId: string | undefined) {
  return useQuery({
    queryKey: botStatsKeys.guildCommands(guildId!),
    queryFn: () => botStatsService.getGuildCommandStats(guildId!),
    enabled: !!guildId,
    staleTime: 30 * 1000,
  });
}

export function usePresenceStats(guildId: string | undefined) {
  return useQuery({
    queryKey: botStatsKeys.presence(guildId!),
    queryFn: () => botStatsService.getPresenceStats(guildId!),
    enabled: !!guildId,
    staleTime: 15 * 1000, // 15 seconds — real-time presence
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });
}

export function useActivityHeatmap(guildId: string | undefined, days = 7) {
  return useQuery({
    queryKey: botStatsKeys.heatmap(guildId!, days),
    queryFn: () => botStatsService.getActivityHeatmap(guildId!, days),
    enabled: !!guildId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useGameHistory(guildId: string | undefined, days = 7) {
  return useQuery({
    queryKey: botStatsKeys.games(guildId!, days),
    queryFn: () => botStatsService.getGameHistory(guildId!, days),
    enabled: !!guildId,
    staleTime: 5 * 60 * 1000,
  });
}
