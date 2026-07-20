import { useQuery } from '@tanstack/react-query';

import { botCommandKeys } from './queryKeys';
import { botCommandsService, type BotCommandsResponse } from '@/services/botCommandsService';

export function useBotCommands(category?: string) {
  return useQuery<BotCommandsResponse>({
    queryKey: botCommandKeys.list(category),
    queryFn: () => botCommandsService.getCommands(category),
    staleTime: 30 * 60 * 1000, // Bot commands rarely change — 30 min
  });
}
