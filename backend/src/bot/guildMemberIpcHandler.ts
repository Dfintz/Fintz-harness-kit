import { Client } from 'discord.js';

import { logger } from '../utils/logger';

import { BotIPCService, IPCMessage, IPCResponse } from './BotIPCService';

/** IPC action name for fetching guild member presence */
export const GUILD_FETCH_MEMBER_ACTION = 'guild:fetchMember';

/**
 * Payload expected by the guild:fetchMember IPC handler.
 */
interface GuildFetchMemberPayload {
  /** Discord guild (server) ID */
  guildId: string;
  /** Discord user ID to look up */
  discordUserId: string;
}

/**
 * Initialize the guild:fetchMember IPC handler.
 *
 * When the bot runs in a separate container (DISABLE_BOT=true on the Express side),
 * the Express process cannot access BotClientManager directly. This handler allows
 * Express to request guild member data via Redis Pub/Sub IPC.
 *
 * Flow:
 * 1. MemberProfileService.fetchDiscordPresence() detects BotClientManager is not ready
 * 2. Sends IPC request: { action: 'guild:fetchMember', data: { guildId, discordUserId } }
 * 3. This handler fetches the member from the bot's Discord client
 * 4. Returns member presence data (displayName, roles, joinedAt, status, isInGuild)
 */
export function initializeGuildMemberHandler(ipcService: BotIPCService, client: Client): void {
  if (!ipcService.isAvailable()) {
    logger.debug('GuildMemberIPC: IPC not available, handler not registered');
    return;
  }

  ipcService.registerHandler(
    GUILD_FETCH_MEMBER_ACTION,
    async (message: IPCMessage): Promise<IPCResponse> => {
      const data = message.data;

      if (!data.guildId || !data.discordUserId) {
        return {
          correlationId: message.correlationId,
          success: false,
          status: 'handled',
          definitive: true,
          error: 'Invalid payload: missing guildId or discordUserId',
        };
      }

      const { guildId, discordUserId } = data as unknown as GuildFetchMemberPayload;

      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          return {
            correlationId: message.correlationId,
            success: true,
            status: 'not_handled',
            definitive: false,
            data: { found: false, reason: 'guild_not_cached', guildId },
          };
        }

        const member = await guild.members.fetch(discordUserId).catch(() => null);
        if (!member) {
          return {
            correlationId: message.correlationId,
            success: true,
            status: 'handled',
            definitive: true,
            data: {
              found: false,
              isInGuild: false,
              guildName: guild.name,
            },
          };
        }

        return {
          correlationId: message.correlationId,
          success: true,
          status: 'handled',
          definitive: true,
          data: {
            found: true,
            isInGuild: true,
            discordId: member.id,
            displayName: member.displayName ?? member.user.username,
            guildId: guild.id,
            guildName: guild.name,
            roleIds: member.roles.cache
              .filter(r => r.id !== guild.id) // exclude @everyone
              .map(r => r.id),
            roleNames: member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name),
            status:
              member.presence?.status === 'invisible'
                ? 'offline'
                : (member.presence?.status ?? null),
            joinedAt: member.joinedAt?.toISOString() ?? null,
          },
        };
      } catch (error: unknown) {
        logger.error('GuildMemberIPC: Failed to fetch member', {
          error: error instanceof Error ? error.message : String(error),
          guildId,
          discordUserId,
        });
        return {
          correlationId: message.correlationId,
          success: false,
          status: 'handled',
          definitive: true,
          error: `Failed to fetch member: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  );

  logger.info('GuildMemberIPC: guild:fetchMember handler registered');
}
