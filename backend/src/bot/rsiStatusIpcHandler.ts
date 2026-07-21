import { Client } from 'discord.js';

import { logger } from '../utils/logger';

import { BotIPCService, IPCMessage, IPCResponse } from './BotIPCService';
import {
  deployRsiStatusPanelForGuild,
  getRsiStatusPanelForGuild,
  removeRsiStatusPanelForGuild,
} from './commands/rsistatus';
import {
  assignStatusChannelForGuild,
  createManagedStatusChannelsForGuild,
  getStatusChannelsForGuild,
  removeStatusChannelsForGuild,
  type StatusRole,
} from './commands/rsiStatusChannels';
import { RSI_STATUS_IPC_ACTIONS, type RsiStatusChannelsAssignPayload } from './rsiStatusIpc';

function getGuildId(data: Record<string, unknown>): string | null {
  return typeof data.guildId === 'string' && data.guildId.length > 0 ? data.guildId : null;
}

function isStatusRole(value: unknown): value is StatusRole {
  return value === 'application' || value === 'server';
}

function success(correlationId: string, data: Record<string, unknown>): IPCResponse {
  return {
    correlationId,
    success: true,
    status: 'handled',
    definitive: true,
    data,
  };
}

function failure(correlationId: string, error: string): IPCResponse {
  return {
    correlationId,
    success: false,
    status: 'handled',
    definitive: true,
    error,
  };
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function handleGetPanel(message: IPCMessage): Promise<IPCResponse> {
  const guildId = getGuildId(message.data);
  if (!guildId) {
    return failure(message.correlationId, 'Invalid payload: guildId is required');
  }

  const panel = await getRsiStatusPanelForGuild(guildId);
  return success(message.correlationId, { panel });
}

async function handleDeployPanel(message: IPCMessage): Promise<IPCResponse> {
  const guildId = getGuildId(message.data);
  const channelId =
    typeof message.data.channelId === 'string' && message.data.channelId.length > 0
      ? message.data.channelId
      : null;

  if (!guildId || !channelId) {
    return failure(message.correlationId, 'Invalid payload: guildId and channelId are required');
  }

  const panel = await deployRsiStatusPanelForGuild(guildId, channelId);
  return success(message.correlationId, { panel });
}

async function handleRemovePanel(message: IPCMessage): Promise<IPCResponse> {
  const guildId = getGuildId(message.data);
  if (!guildId) {
    return failure(message.correlationId, 'Invalid payload: guildId is required');
  }

  const removed = await removeRsiStatusPanelForGuild(guildId);
  return success(message.correlationId, { removed });
}

async function handleGetChannels(message: IPCMessage): Promise<IPCResponse> {
  const guildId = getGuildId(message.data);
  if (!guildId) {
    return failure(message.correlationId, 'Invalid payload: guildId is required');
  }

  const channels = await getStatusChannelsForGuild(guildId);
  return success(message.correlationId, { channels });
}

async function handleCreateManagedChannels(message: IPCMessage): Promise<IPCResponse> {
  const guildId = getGuildId(message.data);
  if (!guildId) {
    return failure(message.correlationId, 'Invalid payload: guildId is required');
  }

  await createManagedStatusChannelsForGuild(guildId);
  return success(message.correlationId, { ok: true });
}

async function handleAssignChannel(message: IPCMessage): Promise<IPCResponse> {
  const payload = message.data as unknown as Partial<RsiStatusChannelsAssignPayload>;
  const guildId = typeof payload.guildId === 'string' ? payload.guildId : null;
  const role = payload.role;
  const channelId = typeof payload.channelId === 'string' ? payload.channelId : null;

  if (!guildId || !channelId || !isStatusRole(role)) {
    return failure(
      message.correlationId,
      'Invalid payload: guildId, channelId, and role(application|server) are required'
    );
  }

  await assignStatusChannelForGuild(guildId, role, channelId);
  return success(message.correlationId, { ok: true });
}

async function handleRemoveChannels(message: IPCMessage): Promise<IPCResponse> {
  const guildId = getGuildId(message.data);
  if (!guildId) {
    return failure(message.correlationId, 'Invalid payload: guildId is required');
  }

  const removed = await removeStatusChannelsForGuild(guildId);
  return success(message.correlationId, { removed });
}

function registerHandler(
  ipcService: BotIPCService,
  client: Client,
  action: string,
  handler: (message: IPCMessage) => Promise<IPCResponse>
): void {
  ipcService.registerHandler(action, async (message: IPCMessage): Promise<IPCResponse> => {
    const guildId = message.routing?.guildId ?? getGuildId(message.data);
    if (guildId && !client.guilds.cache.has(guildId)) {
      return {
        correlationId: message.correlationId,
        success: true,
        status: 'not_handled',
        definitive: false,
        data: { reason: 'guild_not_cached', guildId },
      };
    }

    try {
      return await handler(message);
    } catch (error: unknown) {
      const errorMessage = asErrorMessage(error);
      logger.error(`RsiStatusIPC: ${action} failed`, {
        error: errorMessage,
      });
      return failure(message.correlationId, errorMessage);
    }
  });
}

export function initializeRsiStatusIpcHandler(ipcService: BotIPCService, client: Client): void {
  if (!ipcService.isAvailable()) {
    logger.debug('RsiStatusIPC: IPC not available, handlers not registered');
    return;
  }

  registerHandler(ipcService, client, RSI_STATUS_IPC_ACTIONS.GET_PANEL, handleGetPanel);
  registerHandler(ipcService, client, RSI_STATUS_IPC_ACTIONS.DEPLOY_PANEL, handleDeployPanel);
  registerHandler(ipcService, client, RSI_STATUS_IPC_ACTIONS.REMOVE_PANEL, handleRemovePanel);
  registerHandler(ipcService, client, RSI_STATUS_IPC_ACTIONS.GET_CHANNELS, handleGetChannels);
  registerHandler(
    ipcService,
    client,
    RSI_STATUS_IPC_ACTIONS.CREATE_MANAGED_CHANNELS,
    handleCreateManagedChannels
  );
  registerHandler(ipcService, client, RSI_STATUS_IPC_ACTIONS.ASSIGN_CHANNEL, handleAssignChannel);
  registerHandler(ipcService, client, RSI_STATUS_IPC_ACTIONS.REMOVE_CHANNELS, handleRemoveChannels);

  logger.info('RsiStatusIPC: RSI status IPC handlers registered');
}
